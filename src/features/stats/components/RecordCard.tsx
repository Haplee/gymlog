import { useEffect, useState } from 'react';
import { m } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { useWeight } from '@shared/hooks/useWeight';
import { formatWeightInput } from '@shared/lib/weight';
import { impact, ImpactStyle } from '@shared/lib/haptics';

/** Los mismos tres que ofrece el selector de métrica de `ProgressionSection`. */
type Metric = '1rm' | 'maxWeight' | 'volume';

interface RecordCardProps {
  exerciseName: string;
  metric: Metric;
  /** La marca nueva, en kilos. */
  value: number;
  /** La mejor marca anterior, en kilos, o null si no había ninguna. */
  previous: number | null;
  /** 1RM estimado del ejercicio, en kilos, o null si no aplica. */
  estimate: number | null;
}

/**
 * El mismo muelle que `--ease-spring` de `tokens.css`, para que la entrada del
 * récord y la bolita de la maqueta de movimiento digan lo mismo. Un muelle de
 * framer-motion no reproduce los cubic-bezier con rebote: aquí el rebote es
 * parte del mensaje (esto es una buena noticia), y con una curva se controla el
 * 4 % de sobrepaso que pide el token.
 */
const MUELLE_DEL_RECORD = { duration: 0.52, ease: [0.34, 1.56, 0.64, 1] } as const;

/**
 * La marca nueva, contada como un momento.
 *
 * En el gráfico un récord es un punto, y en la fila de siempre eran dos
 * palabras: «Mejor registro» y un número. Pero un récord es lo mejor que le
 * puede pasar a alguien entrenando, y lo que lo convierte en eso no es el
 * número, es el salto: cuánto había antes y cuánto se ha subido. Eso es lo que
 * se enseña aquí, y por eso la cifra va en `text-display`, la anterior tachada
 * en rojo y la subida en una píldora.
 *
 * Todo el bloque es un botón: al tocarlo, la tarjeta vuelve a entrar con el
 * muelle y suelta un golpecito. Es la única forma de repetir el momento, y
 * como el dedo ya está encima, el aviso táctil cae donde toca en vez de sonar
 * solo porque alguien abrió un desplegable.
 */
export function RecordCard({ exerciseName, metric, value, previous, estimate }: RecordCardProps) {
  const { t } = useTranslation();
  const { unit, convert } = useWeight();
  const [entrada, setEntrada] = useState(0);

  // `entrada` solo existe para remontar la cifra y repetir la animación; el
  // aviso táctil va aquí y no en el `onClick` para que el primer montaje
  // también lo suelte, que es cuando el récord se descubre.
  useEffect(() => {
    void impact(ImpactStyle.Light);
  }, [entrada]);

  // El volumen se lee en toneladas igual que en el resto de la app: en kilos
  // son cinco cifras que no caben en `text-display` y que nadie compara de un
  // vistazo.
  const esVolumen = metric === 'volume';
  const divisor = esVolumen ? 1000 : 1;
  const unidadDe = esVolumen ? (unit === 'lb' ? 'k lb' : 't') : unit;
  const cifraDe = (kg: number) => formatWeightInput(convert(kg) / divisor);
  const conUnidad = (kg: number) => `${cifraDe(kg)} ${unidadDe}`;

  const delta = previous != null ? value - previous : null;

  return (
    <m.button
      type="button"
      onClick={() => setEntrada((n) => n + 1)}
      className="block w-full rounded-card border border-line-accent p-4 text-left"
      style={{
        // El tinte sale del acento que el usuario haya elegido en Ajustes, así
        // que la tarjeta no desentona con el tema ni con el color de acento.
        background:
          'linear-gradient(160deg, rgb(var(--accent-rgb) / 0.14), rgb(var(--accent-rgb) / 0.02) 60%), var(--bg-surface-2)',
      }}
    >
      <m.span
        key={entrada}
        initial={{ scale: 0.9, opacity: 0.4 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={MUELLE_DEL_RECORD}
        className="block"
      >
        <span className="label-caps block text-accent">
          {t('stats.new_record')} · {exerciseName}
        </span>

        <span className="mt-2.5 flex items-baseline gap-2.5">
          <span className="font-display text-display tabular-nums">
            {cifraDe(value)}
            <span className="ml-1 text-lg font-semibold tracking-normal text-fg-subtle">
              {unidadDe}
            </span>
          </span>
          {previous != null && (
            <span className="font-display text-lg text-fg-subtle line-through decoration-error">
              {cifraDe(previous)}
            </span>
          )}
        </span>

        <span className="mt-3 flex flex-wrap gap-2">
          {delta != null && delta > 0 && (
            <span className="inline-flex items-center rounded-pill bg-success/12 px-2.5 py-1 text-xs font-bold text-success">
              {t('stats.record_delta', { amount: conUnidad(delta) })}
            </span>
          )}
          {/* Solo con «Peso máx»: con el 1RM la cifra grande ya es el 1RM, y
              con el volumen no viene a cuento. */}
          {metric === 'maxWeight' && estimate != null && estimate > 0 && (
            <span className="inline-flex items-center rounded-pill border border-line bg-surface-3 px-2.5 py-1 text-xs font-semibold text-fg-muted">
              {t('stats.record_1rm_est', { amount: conUnidad(estimate) })}
            </span>
          )}
        </span>

        <span className="mt-3 block text-2xs text-fg-subtle">{t('stats.record_replay')}</span>
      </m.span>
    </m.button>
  );
}
