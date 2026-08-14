import { useTranslation } from 'react-i18next';
import { ChevronRight, Dumbbell, Sparkle, TrendUp, Check } from '@shared/components/icons';

/**
 * Prototipo del material "Liquid Glass" (tarea F0.2 del plan).
 *
 * Muestra las tres capas del material y, sobre todo, el difuminado de borde de
 * scroll: la lista de abajo se disuelve al entrar bajo la cabecera pegajosa.
 * Ese efecto es el que sustituye al backdrop-filter — da la misma señal de
 * "hay algo pasando por debajo" sin muestrear el backdrop en cada frame.
 *
 * Para juzgarlo hay que hacer scroll en la lista, no mirar la captura.
 */
export function LiquidGlassShowcase() {
  const { t } = useTranslation();

  const capas = [
    {
      cls: 'glass-1',
      titulo: t('glass.layer1_title', 'Capa 1 — contenido'),
      desc: t('glass.layer1_desc', 'Fondo de sección. Sin sombra.'),
      Icon: Dumbbell,
    },
    {
      cls: 'glass-2',
      titulo: t('glass.layer2_title', 'Capa 2 — elevado'),
      desc: t('glass.layer2_desc', 'Tarjetas. Sombra mínima.'),
      Icon: TrendUp,
    },
    {
      cls: 'glass-3',
      titulo: t('glass.layer3_title', 'Capa 3 — flotante'),
      desc: t('glass.layer3_desc', 'Header, nav, FAB y modales.'),
      Icon: Sparkle,
    },
  ];

  const filas = Array.from({ length: 12 }, (_, i) => ({
    id: i,
    nombre: `${t('glass.row_exercise', 'Serie')} ${i + 1}`,
    dato: `${60 + i * 2.5} kg`,
  }));

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <span className="label-caps text-accent">{t('glass.badge', 'Material nuevo')}</span>
        <h2 className="font-display text-xl font-bold text-fg">
          {t('glass.title', 'Liquid Glass')}
        </h2>
        <p className="text-sm text-fg-muted">
          {t(
            'glass.subtitle',
            'Sin backdrop-filter: base casi opaca, canto luminoso arriba y caída de luz.',
          )}
        </p>
      </div>

      {/* ── Las tres capas ── */}
      <div className="flex flex-col gap-2">
        {capas.map(({ cls, titulo, desc, Icon }) => (
          <div key={cls} className={`${cls} flex items-center gap-3 rounded-card p-4`}>
            <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-accent/12">
              <Icon size={24} className="text-accent" />
            </span>
            <span className="flex min-w-0 flex-col">
              <span className="glass-text text-base text-fg">{titulo}</span>
              <span className="text-sm text-fg-subtle">{desc}</span>
            </span>
            <ChevronRight size={20} className="ml-auto shrink-0 text-fg-subtle" />
          </div>
        ))}
      </div>

      {/* ── El difuminado de borde de scroll: hay que hacer scroll para verlo ── */}
      <div className="flex flex-col gap-2">
        <span className="label-caps text-fg-subtle">
          {t('glass.section_scroll', 'Borde de scroll (haz scroll dentro)')}
        </span>

        <div className="relative overflow-hidden rounded-card border border-line">
          {/* Cabecera flotante: capa 3, pegada arriba */}
          <div className="glass-3 sticky top-0 z-(--z-floating) flex items-center gap-2 px-4 py-3">
            <Dumbbell size={20} className="text-accent" />
            <span className="glass-text text-base text-fg">
              {t('glass.scroll_header', 'Press de banca')}
            </span>
            <span className="ml-auto text-sm text-fg-subtle tabular">12 × 60 kg</span>
          </div>

          <div className="relative">
            {/* La tira que disuelve el contenido bajo la cabecera */}
            <div className="glass-scroll-fade top-0" aria-hidden="true" />
            <ul className="max-h-56 overflow-y-auto">
              {filas.map((f) => (
                <li
                  key={f.id}
                  className="flex items-center gap-3 border-b border-line px-4 py-3 last:border-0"
                >
                  <Check size={20} className="shrink-0 text-success" />
                  <span className="text-base text-fg">{f.nombre}</span>
                  <span className="ml-auto text-sm text-fg-subtle tabular">{f.dato}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
