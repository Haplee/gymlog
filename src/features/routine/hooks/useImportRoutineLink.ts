import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { useAuthStore } from '@features/auth/stores/authStore';
import { useRoutineStore } from '@features/routine/stores/routineStore';
import { sharedRoutineToStore, type SharedRoutine } from '../utils/shareRoutine';
import { routineFromUrl } from '../utils/routineLink';

/**
 * Importa una rutina que llega por enlace (deep link nativo o ruta web `/r`).
 *
 * Comparte el cuidado del importador de ficheros: **se suma, no sustituye**. Lo
 * único distinto es de dónde sale el plan —un parámetro de la URL en vez de un
 * fichero—, y que después se lleva al usuario a la lista de rutinas para que vea
 * lo que acaba de añadir en vez de dejarlo con la duda de si entró.
 */
export function useImportRoutineLink() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const addRoutine = useRoutineStore((s) => s.addRoutine);
  const saveToDb = useRoutineStore((s) => s.saveToDb);

  /** Añade una rutina ya leída. La comparten el enlace y la ruta web. */
  const addShared = useCallback(
    (shared: SharedRoutine) => {
      const nueva = sharedRoutineToStore(shared);
      addRoutine(nueva);
      if (user) void saveToDb(user.id);
      toast.success(t('routine.import_success', { name: nueva.name }));
      navigate('/routines');
    },
    [addRoutine, saveToDb, user, t, navigate],
  );

  /**
   * Lee una URL entrante e importa. Devuelve `true` si la ha reconocido, para que
   * quien la llama pueda seguir probando otros manejadores (el OAuth, p. ej.).
   */
  const importFromUrl = useCallback(
    (url: string): boolean => {
      const shared = routineFromUrl(url);
      if (!shared) return false;
      addShared(shared);
      return true;
    },
    [addShared],
  );

  return { importFromUrl, importShared: addShared };
}
