import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import type { LibraryExercise } from '@shared/api/queries';
import { MuscleGroupIcon } from '@shared/components/CardioIcons';
import { EquipmentIcon } from '@shared/components/icons/EquipmentIcons';
import { LoadTypeBadge } from '@shared/components/LoadTypeBadge';
import { ChevronRight } from '@shared/components/icons';
import { MUSCLE_COLORS } from '@shared/constants/muscleColors';
import { muscleGroupLabel } from '@shared/lib/muscleGroupLabel';
import { equipmentLabel } from '@shared/lib/equipmentLabel';

/**
 * Color de identidad del grupo muscular, con el acento como respaldo.
 *
 * Es el mismo mapa que pinta el mapa muscular de estadísticas: si el pecho es
 * azul en una pantalla, en la biblioteca también, y el ejercicio se reconoce
 * antes de leer nada. Un grupo de un historial importado que no esté en el mapa
 * cae al acento en vez de quedarse sin color.
 */
function muscleColor(group: string | null): string {
  return (group && MUSCLE_COLORS[group]) || 'var(--interactive-primary)';
}

/**
 * Cuadro identificativo de la fila: la imagen si la hay, y debajo —siempre— el
 * icono anatómico del grupo muscular teñido con su color.
 *
 * La imagen va como fondo de un velo y no como `<img>` por una razón concreta:
 * así la degradación es gratis. Si el GIF no carga, la capa no pinta nada y
 * queda a la vista el icono que ya estaba debajo, sin necesidad de un `onError`
 * ni de un estado de «ha fallado». El hueco nunca se queda vacío.
 *
 * Sin `lazy`: solo montan las filas visibles (la lista está virtualizada), así
 * que como mucho se piden las imágenes que están en pantalla.
 */
function ExerciseThumb({ exercise }: { exercise: LibraryExercise }) {
  const color = muscleColor(exercise.muscle_group);

  return (
    <div
      aria-hidden="true"
      className="relative flex h-12 w-12 flex-shrink-0 items-center justify-center overflow-hidden rounded-md"
      style={{ backgroundColor: `${color}22` }}
    >
      <span style={{ color }}>
        <MuscleGroupIcon name={exercise.muscle_group} className="h-6 w-6" />
      </span>
      {exercise.media_url && (
        <span
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${exercise.media_url})` }}
        />
      )}
    </div>
  );
}

/** Distintivo de una etiqueta corta. Todos comparten forma para leerse en columna. */
function Tag({
  children,
  tone = 'neutral',
  style,
}: {
  children: React.ReactNode;
  tone?: 'neutral' | 'accent';
  style?: React.CSSProperties;
}) {
  return (
    <span
      style={style}
      className={`label-caps inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 ${
        tone === 'accent' ? 'bg-accent/10 text-accent' : 'bg-surface-2 text-fg-muted'
      }`}
    >
      {children}
    </span>
  );
}

/**
 * Etiquetas del ejercicio: de dónde es (músculo y material), cómo se ejecuta
 * (compuesto/aislado y bilateral/unilateral) y cómo se carga.
 *
 * Van en la fila, no solo en la ficha: son justo los datos por los que se
 * reconoce un ejercicio de un vistazo, y tener que abrir cada uno para saber si
 * es compuesto convierte la biblioteca en una lista de nombres.
 */
function ExerciseTags({ exercise }: { exercise: LibraryExercise }) {
  const { t } = useTranslation();
  const color = muscleColor(exercise.muscle_group);

  return (
    <div className="mt-1 flex flex-wrap gap-1">
      {exercise.muscle_group && (
        <Tag style={{ backgroundColor: `${color}22` }}>
          <span style={{ color }}>
            <MuscleGroupIcon name={exercise.muscle_group} className="h-3 w-3" />
          </span>
          {muscleGroupLabel(exercise.muscle_group, t)}
        </Tag>
      )}
      {exercise.equipment && (
        <Tag>
          <EquipmentIcon equipment={exercise.equipment} className="h-3 w-3" />
          {equipmentLabel(exercise.equipment, t)}
        </Tag>
      )}
      <Tag tone={exercise.is_compound === true ? 'accent' : 'neutral'}>
        {exercise.is_compound === true ? t('library.compound') : t('library.isolation')}
      </Tag>
      {/* Sin dato no se pinta ninguna de las dos: decir «unilateral» de un
          ejercicio que solo se sabe que no está marcado sería inventárselo. */}
      {exercise.is_bilateral != null && (
        <Tag>{exercise.is_bilateral ? t('library.bilateral') : t('library.unilateral')}</Tag>
      )}
      <LoadTypeBadge loadType={exercise.load_type} className="self-center" />
    </div>
  );
}

/** Ficha desplegada: la descripción de la forma y los datos con su nombre. */
export function ExerciseLibraryDetail({ exercise }: { exercise: LibraryExercise }) {
  const { t } = useTranslation();

  return (
    <div className="space-y-2.5 px-3 pb-3 pt-1">
      {exercise.media_url && (
        <img
          src={exercise.media_url}
          alt={exercise.name}
          loading="lazy"
          className="max-h-56 w-full rounded-md bg-surface-2 object-contain"
        />
      )}
      <div className="flex flex-wrap gap-1.5">
        <LoadTypeBadge loadType={exercise.load_type} className="px-2 py-1" />
        {exercise.muscle_detail && (
          <span className="label-caps rounded-sm bg-surface-2 px-2 py-1 text-fg-muted">
            {t('library.muscle')}: {exercise.muscle_detail}
          </span>
        )}
        {exercise.equipment && (
          <span className="label-caps inline-flex items-center gap-1 rounded-sm bg-surface-2 px-2 py-1 text-fg-muted">
            <EquipmentIcon equipment={exercise.equipment} className="h-3.5 w-3.5" />
            {t('library.equipment')}: {equipmentLabel(exercise.equipment, t)}
          </span>
        )}
        {exercise.movement && (
          <span className="label-caps rounded-sm bg-surface-2 px-2 py-1 text-fg-muted">
            {t('library.movement')}: {exercise.movement}
          </span>
        )}
        {exercise.is_compound === true && (
          <span className="label-caps rounded-sm bg-accent/10 px-2 py-1 text-accent">
            {t('library.compound')}
          </span>
        )}
        {exercise.is_bilateral != null && (
          <span className="label-caps rounded-sm bg-surface-2 px-2 py-1 text-fg-muted">
            {exercise.is_bilateral ? t('library.bilateral') : t('library.unilateral')}
          </span>
        )}
      </div>
      <p className="text-sm leading-relaxed text-fg-muted">
        {exercise.description || t('library.no_description')}
      </p>
    </div>
  );
}

interface ExerciseLibraryRowProps {
  exercise: LibraryExercise;
  expanded: boolean;
  onToggle: (id: string) => void;
}

/**
 * Fila de la biblioteca. Memoizada porque la lista está virtualizada y, al
 * teclear en el buscador, solo cambian las filas que entran o salen: sin el
 * `memo`, cada tecla volvería a pintar las ~15 filas montadas.
 */
export const ExerciseLibraryRow = memo(function ExerciseLibraryRow({
  exercise,
  expanded,
  onToggle,
}: ExerciseLibraryRowProps) {
  return (
    <div className={expanded ? 'border-l-2 border-l-accent' : ''}>
      <button
        type="button"
        onClick={() => onToggle(exercise.id)}
        aria-expanded={expanded}
        className="flex w-full items-center gap-3 px-3 py-3 text-left active:bg-hover"
      >
        <ExerciseThumb exercise={exercise} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-base font-medium text-fg">{exercise.name}</div>
          <ExerciseTags exercise={exercise} />
        </div>
        <ChevronRight
          className="h-4 w-4 flex-shrink-0 text-fg-subtle transition-transform"
          style={{ transform: expanded ? 'rotate(90deg)' : 'none' }}
        />
      </button>
      {expanded && <ExerciseLibraryDetail exercise={exercise} />}
    </div>
  );
});
