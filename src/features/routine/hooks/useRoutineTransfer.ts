import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { useAuthStore } from '@features/auth/stores/authStore';
import { useRoutineStore, type Routine } from '@features/routine/stores/routineStore';
import { devError } from '@shared/lib/devtools';
import {
  buildSharedRoutine,
  parseSharedRoutine,
  serializeSharedRoutine,
  sharedRoutineFileName,
  sharedRoutineToStore,
  SharedRoutineError,
} from '../utils/shareRoutine';
import { buildRoutinePrintHtml, openRoutinePrintWindow } from '../utils/printRoutine';

/**
 * Compartir, imprimir e importar rutinas.
 *
 * Sale de `RoutinePage` para no engordarla más (CLAUDE.md fija 800 líneas) y
 * porque las tres acciones comparten el mismo cuidado: **lo que sale solo lleva
 * el plan**, y **lo que entra se suma, no sustituye**.
 */
export function useRoutineTransfer() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const addRoutine = useRoutineStore((s) => s.addRoutine);
  const saveRoutinesToDb = useRoutineStore((s) => s.saveToDb);

  /** Comparte la rutina como fichero: hoja de compartir en móvil, descarga en web. */
  const shareRoutineFile = async (routine: Routine) => {
    const contenido = serializeSharedRoutine(routine);
    const nombre = sharedRoutineFileName(routine);

    try {
      if (Capacitor.isNativePlatform()) {
        await Filesystem.writeFile({
          path: nombre,
          data: contenido,
          directory: Directory.Cache,
          encoding: Encoding.UTF8,
        });
        const { uri } = await Filesystem.getUri({ directory: Directory.Cache, path: nombre });
        await Share.share({
          title: routine.name,
          url: uri,
          dialogTitle: t('routine.share_dialog_title'),
        });
        return;
      }

      const blob = new Blob([contenido], { type: 'application/json;charset=utf-8;' });
      const enlace = document.createElement('a');
      enlace.href = URL.createObjectURL(blob);
      enlace.download = nombre;
      enlace.click();
      URL.revokeObjectURL(enlace.href);
    } catch (err) {
      // Cancelar la hoja de compartir lanza igual que un fallo real; no es un
      // error que merezca molestar a nadie.
      if (err instanceof Error && /cancel/i.test(err.message)) return;
      devError('Error compartiendo rutina', err);
      toast.error(t('routine.share_error'));
    }
  };

  /**
   * Abre la rutina maquetada para imprimir o guardar como PDF.
   *
   * En el WebView de Android `window.print()` no abre ningún diálogo —imprimir
   * ahí va por el PrintManager nativo, que necesitaría un plugin—, así que en
   * nativo se comparte el HTML y el usuario lo abre con el navegador o con
   * cualquier app que sepa imprimir. Prometer un PDF que no llega sería peor que
   * dar el rodeo y decirlo.
   */
  const printRoutine = async (routine: Routine) => {
    const html = buildRoutinePrintHtml(buildSharedRoutine(routine));

    if (Capacitor.isNativePlatform()) {
      try {
        const nombre = sharedRoutineFileName(routine).replace(/\.json$/, '.html');
        await Filesystem.writeFile({
          path: nombre,
          data: html,
          directory: Directory.Cache,
          encoding: Encoding.UTF8,
        });
        const { uri } = await Filesystem.getUri({ directory: Directory.Cache, path: nombre });
        await Share.share({
          title: routine.name,
          url: uri,
          dialogTitle: t('routine.print_dialog_title'),
        });
      } catch (err) {
        if (err instanceof Error && /cancel/i.test(err.message)) return;
        devError('Error preparando la hoja de la rutina', err);
        toast.error(t('routine.print_error'));
      }
      return;
    }

    if (!openRoutinePrintWindow(html)) toast.error(t('routine.print_popup_blocked'));
  };

  /** Importa una rutina de un fichero. Se añade a las que ya hay; no sustituye. */
  const importRoutineFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    const lector = new FileReader();
    lector.onload = (evento) => {
      try {
        const bruto = JSON.parse((evento.target?.result as string) || 'null');
        const compartida = parseSharedRoutine(bruto);
        const nueva = sharedRoutineToStore(compartida);
        addRoutine(nueva);
        if (user) void saveRoutinesToDb(user.id);
        toast.success(t('routine.import_success', { name: nueva.name }));
      } catch (err) {
        if (err instanceof SharedRoutineError) {
          toast.error(err.message);
          return;
        }
        devError('Error importando rutina', err);
        toast.error(t('routine.import_error'));
      }
    };
    lector.onerror = () => toast.error(t('routine.import_error'));
    lector.readAsText(file);
  };

  return { shareRoutineFile, printRoutine, importRoutineFile };
}
