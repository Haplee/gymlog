/**
 * Celebración de confeti sobre Canvas 2D.
 *
 * Sustituye a canvas-confetti para poder dar físicas reales (gravedad, viento,
 * balanceo del papel, rebote contra el suelo) sin sostener un loop de render
 * indefinido: el rAF se detiene en cuanto no queda ninguna partícula viva, al
 * agotarse la duración máxima o si la app pasa a segundo plano. Es la diferencia
 * entre una animación de ~2 s y un timer que despierta la CPU para siempre.
 */

/**
 * La paleta se lee del tema en cada celebración para que el confeti siga al
 * color de acento que haya elegido el usuario en Ajustes; los tonos neutros
 * acompañan a cualquiera de ellos.
 */
function paletteFromTheme(): string[] {
  const styles = getComputedStyle(document.documentElement);
  const accent = styles.getPropertyValue('--interactive-primary').trim() || '#ffd93d';
  const dim = styles.getPropertyValue('--interactive-primary-dim').trim() || accent;
  return [accent, accent, dim, '#ffffff', '#e8e8e8'];
}

/** Techo duro: más partículas no se perciben y sí se notan en la batería. */
const MAX_PARTICLES = 220;
/** Corte de seguridad: pase lo que pase, la animación no vive más que esto. */
const MAX_DURATION_MS = 4500;

const GRAVITY = 0.00075; // px/ms²
const DRAG = 0.0016; // resistencia del aire (proporcional a la velocidad)
const RESTITUTION = 0.32; // energía conservada en cada rebote
const MAX_BOUNCES = 2;

type Shape = 'rect' | 'circle' | 'spark';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  w: number;
  h: number;
  color: string;
  shape: Shape;
  /** Rotación 3D simulada: el papel gira sobre su eje y "desaparece" de canto. */
  spin: number;
  spinSpeed: number;
  /** Balanceo lateral de la caída (sway). */
  swayPhase: number;
  swayFreq: number;
  swayAmp: number;
  life: number;
  maxLife: number;
  bounces: number;
}

interface Burst {
  x: number;
  y: number;
  count: number;
  /** Velocidad inicial base (px/ms). */
  power: number;
}

interface Engine {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  particles: Particle[];
  raf: number | null;
  startedAt: number;
  lastAt: number;
  /** Viento global; oscila lentamente para que la caída no sea uniforme. */
  windPhase: number;
  onPointerDown: (e: PointerEvent) => void;
  onVisibility: () => void;
  onResize: () => void;
}

let engine: Engine | null = null;

const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' &&
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;

const rand = (min: number, max: number): number => min + Math.random() * (max - min);
const pick = <T>(arr: T[]): T => arr[(Math.random() * arr.length) | 0];

function makeParticle(burst: Burst, isSpark: boolean, colors: string[]): Particle {
  const angle = rand(-Math.PI, 0); // hacia arriba, en abanico
  const power = burst.power * rand(0.45, 1);

  if (isSpark) {
    const size = rand(1.5, 3);
    return {
      x: burst.x,
      y: burst.y,
      vx: Math.cos(angle) * power * 1.5,
      vy: Math.sin(angle) * power * 1.5,
      w: size,
      h: size,
      color: Math.random() < 0.6 ? '#ffffff' : colors[0],
      shape: 'spark',
      spin: 0,
      spinSpeed: 0,
      swayPhase: 0,
      swayFreq: 0,
      swayAmp: 0,
      life: 0,
      // Los destellos son cortos: brillan y se apagan antes que el papel.
      maxLife: rand(400, 800),
      bounces: MAX_BOUNCES, // no rebotan
    };
  }

  const w = rand(6, 11);
  return {
    x: burst.x,
    y: burst.y,
    vx: Math.cos(angle) * power,
    vy: Math.sin(angle) * power,
    w,
    h: w * rand(0.4, 0.7),
    color: pick(colors),
    shape: Math.random() < 0.75 ? 'rect' : 'circle',
    spin: rand(0, Math.PI * 2),
    spinSpeed: rand(-0.012, 0.012),
    swayPhase: rand(0, Math.PI * 2),
    swayFreq: rand(0.002, 0.005),
    swayAmp: rand(0.02, 0.06),
    life: 0,
    maxLife: rand(2200, 3600),
    bounces: 0,
  };
}

function spawn(eng: Engine, burst: Burst): void {
  const room = MAX_PARTICLES - eng.particles.length;
  if (room <= 0) return;
  const count = Math.min(burst.count, room);
  const colors = paletteFromTheme();
  for (let i = 0; i < count; i++) {
    // ~1 de cada 5 es destello.
    eng.particles.push(makeParticle(burst, i % 5 === 0, colors));
  }
}

function sizeCanvas(eng: Engine): void {
  // DPR capado a 2: en móviles de 3x triplicar los píxeles a pintar no aporta
  // nada visible en confeti y sí quema GPU.
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const { innerWidth: w, innerHeight: h } = window;
  eng.canvas.width = Math.floor(w * dpr);
  eng.canvas.height = Math.floor(h * dpr);
  eng.canvas.style.width = `${w}px`;
  eng.canvas.style.height = `${h}px`;
  eng.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function destroy(): void {
  if (!engine) return;
  const eng = engine;
  engine = null;

  if (eng.raf !== null) cancelAnimationFrame(eng.raf);
  window.removeEventListener('pointerdown', eng.onPointerDown);
  window.removeEventListener('resize', eng.onResize);
  document.removeEventListener('visibilitychange', eng.onVisibility);
  eng.particles.length = 0;
  eng.canvas.remove();
}

function step(now: number): void {
  const eng = engine;
  if (!eng) return;

  // Delta capado: tras un frame perdido (o el primer frame) un dt enorme
  // teletransportaría las partículas fuera de pantalla.
  const dt = Math.min(now - eng.lastAt, 34);
  eng.lastAt = now;
  eng.windPhase += dt * 0.0006;

  const width = window.innerWidth;
  const floor = window.innerHeight;
  const wind = Math.sin(eng.windPhase) * 0.00012 + 0.00003;

  const { ctx } = eng;
  ctx.clearRect(0, 0, width, floor);

  const alive: Particle[] = [];

  for (const p of eng.particles) {
    p.life += dt;
    if (p.life >= p.maxLife) continue;

    // Integración: gravedad + viento + resistencia del aire.
    p.vy += GRAVITY * dt;
    p.vx += wind * dt;
    p.vx -= p.vx * DRAG * dt;
    p.vy -= p.vy * DRAG * dt;

    // Balanceo: el papel cae zigzagueando, no en línea recta.
    if (p.shape !== 'spark') {
      p.swayPhase += p.swayFreq * dt;
      p.x += Math.sin(p.swayPhase) * p.swayAmp * dt;
      p.spin += p.spinSpeed * dt;
    }

    p.x += p.vx * dt;
    p.y += p.vy * dt;

    // Rebote leve contra el suelo; tras MAX_BOUNCES se queda posado.
    if (p.y >= floor && p.vy > 0 && p.bounces < MAX_BOUNCES) {
      p.y = floor;
      p.vy = -p.vy * RESTITUTION;
      p.vx *= 0.7;
      p.bounces += 1;
    }

    // Fuera de pantalla por los lados o muy por debajo: descartar ya.
    if (p.y - 40 > floor || p.x < -60 || p.x > width + 60) continue;

    alive.push(p);

    // Desvanecido: entra en el último 35% de vida.
    const t = p.life / p.maxLife;
    const alpha = t < 0.65 ? 1 : 1 - (t - 0.65) / 0.35;

    ctx.globalAlpha = Math.max(0, alpha);

    if (p.shape === 'spark') {
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.w / 2, 0, Math.PI * 2);
      ctx.fill();
      continue;
    }

    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.spin);
    // |cos(spin)| simula el escorzo del papel girando sobre sí mismo.
    ctx.scale(1, Math.abs(Math.cos(p.spin * 1.4)) * 0.8 + 0.2);
    ctx.fillStyle = p.color;
    if (p.shape === 'circle') {
      ctx.beginPath();
      ctx.arc(0, 0, p.w / 2, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
    }
    ctx.restore();
  }

  ctx.globalAlpha = 1;
  eng.particles = alive;

  // Fin natural: sin partículas vivas o agotada la duración máxima. En ambos
  // casos se destruye todo — nada de rAF latente en segundo plano.
  if (!alive.length || now - eng.startedAt > MAX_DURATION_MS) {
    destroy();
    return;
  }

  eng.raf = requestAnimationFrame(step);
}

/**
 * Lanza la celebración. Llamadas repetidas reutilizan el mismo canvas y añaden
 * partículas en vez de apilar canvases y loops.
 * No hace nada si el usuario pidió menos movimiento (prefers-reduced-motion).
 */
export function celebrate(): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  if (prefersReducedMotion()) return;
  // Pestaña oculta: sin nada que mostrar, no arrancamos el loop.
  if (document.hidden) return;

  if (!engine) {
    const canvas = document.createElement('canvas');
    canvas.setAttribute('aria-hidden', 'true');
    Object.assign(canvas.style, {
      position: 'fixed',
      inset: '0',
      width: '100%',
      height: '100%',
      // Nunca intercepta toques: la UI sigue siendo usable durante la fiesta.
      pointerEvents: 'none',
      zIndex: '9999',
    } satisfies Partial<CSSStyleDeclaration>);

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const now = performance.now();
    const eng: Engine = {
      canvas,
      ctx,
      particles: [],
      raf: null,
      startedAt: now,
      lastAt: now,
      windPhase: Math.random() * Math.PI * 2,
      // Interacción: tocar la pantalla durante la celebración lanza un estallido
      // extra en ese punto.
      onPointerDown: (e: PointerEvent) => {
        if (!engine) return;
        spawn(engine, { x: e.clientX, y: e.clientY, count: 24, power: 0.55 });
      },
      // Segundo plano → destruir. Al volver no hay loop huérfano consumiendo CPU.
      onVisibility: () => {
        if (document.hidden) destroy();
      },
      onResize: () => {
        if (engine) sizeCanvas(engine);
      },
    };

    document.body.appendChild(canvas);
    engine = eng;
    sizeCanvas(eng);

    window.addEventListener('pointerdown', eng.onPointerDown);
    window.addEventListener('resize', eng.onResize);
    document.addEventListener('visibilitychange', eng.onVisibility);

    eng.raf = requestAnimationFrame(step);
  }

  const w = window.innerWidth;
  const h = window.innerHeight;

  // Explosión inicial desde el centro-bajo + dos laterales, ligeramente
  // desfasados para que no parezca un único disparo simétrico.
  spawn(engine, { x: w / 2, y: h * 0.62, count: 90, power: 0.9 });
  window.setTimeout(() => {
    if (engine) spawn(engine, { x: w * 0.12, y: h * 0.75, count: 45, power: 0.85 });
  }, 120);
  window.setTimeout(() => {
    if (engine) spawn(engine, { x: w * 0.88, y: h * 0.75, count: 45, power: 0.85 });
  }, 240);
}

/** Corta la celebración y limpia canvas, listeners y rAF. */
export function stopCelebration(): void {
  destroy();
}
