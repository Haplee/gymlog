import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router';
import { toast } from 'sonner';
import { PageSkeleton } from '@shared/components/ui';
import { decodeRoutineParam } from '../utils/routineLink';
import { useImportRoutineLink } from '../hooks/useImportRoutineLink';

/**
 * Destino del enlace web de una rutina: `/r?d=…`.
 *
 * Es la pata que hace que un enlace pegado en un chat funcione sin la app
 * instalada: se abre en el navegador, la rutina se importa igual y el usuario
 * acaba en su lista. El enlace nativo (`com.franvi.gymlog://routine?d=…`) no
 * pasa por aquí, lo atrapa `App` en el `appUrlOpen`; pero los dos leen el mismo
 * parámetro con la misma función, así que no pueden divergir.
 */
export function ImportRoutineLinkPage() {
  const { t } = useTranslation();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { importShared } = useImportRoutineLink();

  // La importación es un efecto y no un `useMemo`: escribe en el store y navega.
  // El cerrojo evita que un re-render (el `StrictMode` de desarrollo, sin ir más
  // lejos) añada la rutina dos veces.
  const hecha = useRef(false);

  useEffect(() => {
    if (hecha.current) return;
    hecha.current = true;

    const shared = decodeRoutineParam(params.get('d'));
    if (!shared) {
      toast.error(t('routine.link_invalid'));
      navigate('/', { replace: true });
      return;
    }
    importShared(shared);
  }, [params, importShared, navigate, t]);

  return <PageSkeleton />;
}
