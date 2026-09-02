import { supabase } from '@shared/lib/supabase';
import { notify } from '@shared/lib/notifications';
import { devError } from '@shared/lib/devtools';

/* ── Aviso de récord batido ─────────────────────────────────────────
   Batir una marca es lo único que pasa en un entreno que merece un aviso por
   sí mismo, y hasta ahora no se avisaba: el usuario tenía que entrar en
   Estadísticas y darse cuenta.

   Los récords NO se calculan aquí. Los escribe un trigger del servidor sobre
   `workout_sets` (ver remote_schema.sql), que pone `achieved_at = NOW()`. Este
   módulo solo pregunta «¿se ha escrito alguno desde que empezó este entreno?»,
   así que no puede discrepar del dato real ni inventarse un récord. */

interface RecordRow {
  weight: number;
  reps: number;
}

/** Texto del aviso. Separado para poder leerlo de un vistazo y traducirlo luego. */
function buildCopy(records: RecordRow[]): { title: string; body: string } {
  if (records.length === 1) {
    const { weight, reps } = records[0];
    return {
      title: '🏆 ¡Nuevo récord!',
      body: `Has batido tu marca: ${weight} kg × ${reps}`,
    };
  }
  return {
    title: '🏆 ¡Nuevos récords!',
    body: `Has batido ${records.length} marcas en este entreno`,
  };
}

/**
 * Avisa si el entreno recién guardado ha dejado algún récord nuevo.
 *
 * `sinceIso` es el inicio de la sesión: cualquier récord con `achieved_at`
 * posterior lo ha producido este entreno. Se llama SOLO cuando el guardado ha
 * llegado al servidor — con el entreno en la cola de salida todavía no existe
 * ningún récord que anunciar, y avisar sería mentir.
 *
 * Nunca lanza: un fallo de red aquí no puede tumbar el guardado, que ya ha ido
 * bien. Como mucho el usuario se queda sin la enhorabuena.
 */
export async function notifyNewRecords(userId: string, sinceIso: string): Promise<void> {
  if (!userId || !sinceIso) return;

  try {
    const { data, error } = await supabase
      .from('personal_records')
      .select('weight, reps')
      .eq('user_id', userId)
      .gte('achieved_at', sinceIso)
      .order('weight', { ascending: false });

    if (error || !data || data.length === 0) return;

    const copy = buildCopy(data as RecordRow[]);
    await notify(copy.title, {
      body: copy.body,
      icon: '/icon-192x192.webp',
      url: '/stats',
      type: 'pr',
    });
  } catch (e) {
    devError('[PR] Error comprobando récords nuevos:', e);
  }
}
