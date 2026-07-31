import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Pencil } from 'lucide-react';
import { supabase } from '@shared/lib/supabase';
import { Modal, Button } from '@shared/components/ui';
import type { WorkoutWithSets } from '@shared/lib/types';
import { devError } from '@shared/lib/devtools';

/**
 * Edición de un entreno ya guardado: cambiar reps y kg de sus series.
 *
 * Vivía dentro de `HistoryPage`, que pasaba de las 800 líneas de CLAUDE.md.
 * Solo lo usa esa página, pero como componente propio se lee sin tener que
 * bajar por medio fichero de listado y filtros.
 */
interface EditRow {
  id: string;
  exercise: string;
  reps: string;
  weight: string;
}

export function EditWorkoutModal({
  workout,
  onClose,
  onSaved,
}: {
  workout: WorkoutWithSets;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useTranslation();
  const [rows, setRows] = useState<EditRow[]>(() =>
    [...workout.sets]
      .sort((a, b) => a.set_num - b.set_num)
      .map((s) => ({
        id: s.id,
        exercise: s.exercise?.name ?? '',
        reps: String(s.reps),
        weight: String(s.weight),
      })),
  );
  const [saving, setSaving] = useState(false);

  const update = (id: string, field: 'reps' | 'weight', val: string) =>
    setRows((r) => r.map((x) => (x.id === id ? { ...x, [field]: val } : x)));

  const handleSave = async () => {
    setSaving(true);
    try {
      for (const row of rows) {
        const reps = parseInt(row.reps, 10);
        const weight = parseFloat(row.weight.replace(',', '.'));
        if (!Number.isFinite(reps) || reps <= 0 || !Number.isFinite(weight) || weight < 0) continue;
        const { error } = await supabase
          .from('workout_sets')
          .update({ reps, weight })
          .eq('id', row.id);
        if (error) throw error;
      }
      toast.success(t('history.edit_saved'));
      onSaved();
    } catch (err) {
      devError('Error editing workout', err);
      toast.error(t('history.edit_error'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={t('history.edit_title')}
      icon={<Pencil className="w-5 h-5 text-accent" />}
    >
      <div className="space-y-2 max-h-[50vh] overflow-y-auto mb-4">
        {rows.map((row, i) => (
          <div key={row.id} className="flex items-center gap-2">
            <span className="w-5 text-xs font-mono tabular-nums text-fg-subtle">{i + 1}</span>
            <span className="flex-1 text-sm text-fg truncate">{row.exercise}</span>
            <input
              type="text"
              inputMode="numeric"
              value={row.reps}
              onChange={(e) => update(row.id, 'reps', e.target.value.replace(/[^\d]/g, ''))}
              aria-label={`${t('workout.reps')} ${i + 1}`}
              className="w-12 rounded-card text-sm font-mono tabular-nums px-2 py-1.5 text-center outline-none bg-surface-2 border border-line text-fg"
            />
            <span className="text-xs text-fg-subtle">×</span>
            <input
              type="text"
              inputMode="decimal"
              value={row.weight}
              onChange={(e) => update(row.id, 'weight', e.target.value.replace(/[^\d.,]/g, ''))}
              aria-label={`${t('workout.weight')} ${i + 1}`}
              className="w-16 rounded-card text-sm font-mono tabular-nums px-2 py-1.5 text-center outline-none bg-surface-2 border border-line text-fg"
            />
          </div>
        ))}
      </div>
      <div className="flex gap-3">
        <Button variant="secondary" onClick={onClose} className="flex-1">
          {t('common.cancel')}
        </Button>
        <Button variant="primary" onClick={handleSave} disabled={saving} className="flex-1">
          {t('common.save')}
        </Button>
      </div>
    </Modal>
  );
}
