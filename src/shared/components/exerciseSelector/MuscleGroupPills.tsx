import { useTranslation } from 'react-i18next';
import { MuscleGroupIcon } from '@shared/components/CardioIcons';
import { MUSCLE_GROUPS } from '@shared/constants/muscleGroups';
import { muscleGroupLabel } from '@shared/lib/muscleGroupLabel';
import { Chip } from '@shared/components/ui';

interface MuscleGroupPillsProps {
  active: string;
  onSelect: (mg: string) => void;
  className?: string;
}

/**
 * Filtro por grupo muscular. Usa la primitiva `Chip` en vez de su propio
 * `<button>`: esta fila estaba marcada con `text-xs px-2.5 py-1`, es decir
 * unos 24px de alto —por debajo del suelo táctil de 44px— y, sobre todo, sin
 * `aria-pressed` ni anillo de foco. Para un lector de pantalla era un grupo de
 * botones sueltos sin decir cuál estaba elegido, y con el teclado no había
 * dónde aparecer el foco. Dos opciones de chip en la app que no se parecían
 * ninguna.
 *
 * `size="md"` porque son diez grupos que se tocan con el pulgar y no conviven
 * con otros controles apretados alrededor.
 */
export function MuscleGroupPills({ active, onSelect, className = '' }: MuscleGroupPillsProps) {
  const { t } = useTranslation();

  return (
    <div className={`flex flex-wrap gap-2 ${className}`}>
      {MUSCLE_GROUPS.map((mg) => (
        <Chip key={mg} size="md" selected={active === mg} onClick={() => onSelect(mg)}>
          <MuscleGroupIcon name={mg} className="w-3.5 h-3.5" />
          {muscleGroupLabel(mg, t)}
        </Chip>
      ))}
    </div>
  );
}
