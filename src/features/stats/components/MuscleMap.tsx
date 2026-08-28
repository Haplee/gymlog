import { useId, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  GRUPOS_DEL_MAPA,
  MAPA_ESPALDA,
  MAPA_FRENTE,
  MAPA_VIEWBOX,
  SILUETA_NEUTRA,
  grupoDelMapa,
  type FormaMapa,
  type RegionMuscular,
} from '@shared/constants/muscleMap';
import type { MuscleGroupStatus, RecoveryStatus } from '../utils/fatigueAnalysis';
import { muscleGroupLabel } from '@shared/lib/muscleGroupLabel';
import { SectionLabel } from './userStats/SectionLabel';

interface MuscleMapProps {
  /** Lo que devuelve `analyzeMuscleRecovery`. */
  recovery: MuscleGroupStatus[];
}

/**
 * Color de cada estado, en tokens.
 *
 * Son los mismos tres que ya usa la lista de recuperación (`MuscleRecovery`), y
 * eso es deliberado: si el mapa y la lista pintaran el mismo músculo con colores
 * distintos, el usuario tendría que aprender dos códigos para el mismo dato.
 *
 * Van por `var()` y no en hexadecimal porque el acento y los temas los elige el
 * usuario; un literal aquí se saltaría los dos.
 */
const COLOR_ESTADO: Record<RecoveryStatus, string> = {
  recovering: 'var(--error)',
  partial: 'var(--warning)',
  recovered: 'var(--success)',
};

/** Relleno de un músculo sin datos: no se ha entrenado nunca, no es un estado. */
const SIN_DATOS = 'var(--bg-surface-3)';

function Forma({ f, ...rest }: { f: FormaMapa } & React.SVGProps<SVGElement>) {
  if (f.k === 'e') {
    return (
      <ellipse
        cx={f.cx}
        cy={f.cy}
        rx={f.rx}
        ry={f.ry}
        {...(rest as React.SVGProps<SVGEllipseElement>)}
      />
    );
  }
  return (
    <rect
      x={f.x}
      y={f.y}
      width={f.w}
      height={f.h}
      rx={f.rx}
      {...(rest as React.SVGProps<SVGRectElement>)}
    />
  );
}

function Vista({
  regiones,
  colorDe,
  etiqueta,
}: {
  regiones: RegionMuscular[];
  colorDe: (grupo: string) => string;
  etiqueta: string;
}) {
  const titleId = useId();

  return (
    <figure className="m-0 flex-1">
      <svg
        viewBox={`0 0 ${MAPA_VIEWBOX.ancho} ${MAPA_VIEWBOX.alto}`}
        role="img"
        aria-labelledby={titleId}
        className="w-full h-auto"
      >
        <title id={titleId}>{etiqueta}</title>

        {/* Cabeza, cuello, manos y pies: sin estado, solo para que se lea que
            aquello es una persona y no seis manchas sueltas. */}
        {SILUETA_NEUTRA.map((f, i) => (
          <Forma key={`n${i}`} f={f} fill="var(--bg-surface-3)" opacity={0.55} />
        ))}

        {regiones.map((region) =>
          region.formas.map((f, i) => (
            <Forma
              key={`${region.grupo}-${i}`}
              f={f}
              // El estado de un músculo solo se ve en su color, así que sin este
              // atributo no hay forma de comprobarlo salvo contando elipses.
              data-grupo={region.grupo}
              fill={colorDe(region.grupo)}
              // El canto separa músculos contiguos del mismo color: sin él, dos
              // regiones «recuperadas» pegadas se leen como una sola mancha.
              stroke="var(--bg-canvas)"
              strokeWidth={0.8}
            />
          )),
        )}
      </svg>
      <figcaption className="label-caps mt-1 text-center text-fg-subtle">{etiqueta}</figcaption>
    </figure>
  );
}

/**
 * Silueta frontal y trasera con cada músculo coloreado según lo recuperado que
 * esté.
 *
 * Es la misma información que la lista de recuperación, leída de otra forma: la
 * lista responde «¿cuántos días lleva el pecho?» y el mapa responde «¿qué me
 * falta por entrenar?», que es la pregunta que uno se hace de pie en el gimnasio.
 * Por eso conviven en vez de sustituirse.
 *
 * **Lo que no se sabe localizar no se dibuja.** «Cardio» y «Otro» no tienen sitio
 * en un cuerpo, así que se quedan fuera del mapa en vez de repartirse por alguna
 * región elegida a dedo.
 */
export function MuscleMap({ recovery }: MuscleMapProps) {
  const { t } = useTranslation();

  /** Estado por grupo del mapa, ya normalizado desde los nombres del catálogo. */
  const estadoPorGrupo = useMemo(() => {
    const mapa = new Map<string, RecoveryStatus>();
    for (const m of recovery) {
      const grupo = grupoDelMapa(m.name);
      if (!grupo) continue;
      // Varios nombres del catálogo caen en el mismo grupo del mapa (dorsales y
      // trapecio son «Espalda»). Manda el menos recuperado: si algo de la
      // espalda se entrenó ayer, la espalda está trabajada.
      const previo = mapa.get(grupo);
      if (previo === 'recovering') continue;
      if (previo === 'partial' && m.status === 'recovered') continue;
      mapa.set(grupo, m.status);
    }
    return mapa;
  }, [recovery]);

  const colorDe = (grupo: string) => {
    const estado = estadoPorGrupo.get(grupo);
    return estado ? COLOR_ESTADO[estado] : SIN_DATOS;
  };

  /** Grupos que el mapa dibuja pero de los que no hay ni un dato. */
  const sinDatos = GRUPOS_DEL_MAPA.filter((g) => !estadoPorGrupo.has(g));

  // Sin un solo entreno el mapa sería una silueta gris entera: un dibujo que no
  // dice nada. El resto de la página oculta las secciones vacías; esta también.
  if (recovery.length === 0) return null;

  return (
    <section className="space-y-3">
      <SectionLabel>{t('muscleMap.title')}</SectionLabel>
      <div className="rounded-card border border-line bg-surface p-4 shadow-card">
        <div className="flex gap-3">
          <Vista regiones={MAPA_FRENTE} colorDe={colorDe} etiqueta={t('muscleMap.front')} />
          <Vista regiones={MAPA_ESPALDA} colorDe={colorDe} etiqueta={t('muscleMap.back')} />
        </div>

        {/* Leyenda: sin ella el color es un adorno. */}
        <ul className="mt-3 flex flex-wrap justify-center gap-x-4 gap-y-1.5">
          {(['recovering', 'partial', 'recovered'] as const).map((estado) => (
            <li key={estado} className="flex items-center gap-1.5">
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: COLOR_ESTADO[estado] }}
                aria-hidden="true"
              />
              <span className="text-xs text-fg-muted">{t(`muscleMap.legend_${estado}`)}</span>
            </li>
          ))}
          {sinDatos.length > 0 && (
            <li className="flex items-center gap-1.5">
              <span
                className="h-2.5 w-2.5 rounded-full border border-line"
                style={{ backgroundColor: SIN_DATOS }}
                aria-hidden="true"
              />
              <span className="text-xs text-fg-muted">{t('muscleMap.legend_untrained')}</span>
            </li>
          )}
        </ul>

        {sinDatos.length > 0 && (
          <p className="mt-2 text-center text-xs text-fg-subtle">
            {t('muscleMap.untrained_list', {
              groups: sinDatos.map((g) => muscleGroupLabel(g, t)).join(', '),
            })}
          </p>
        )}
      </div>
    </section>
  );
}
