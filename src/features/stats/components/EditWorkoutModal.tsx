import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { supabase } from '@shared/lib/supabase';
import { Modal, Button, Input, SegmentedControl } from '@shared/components/ui';
import type { WorkoutWithSets } from '@shared/lib/types';
import { devError } from '@shared/lib/devtools';
import { Edit } from '@shared/components/icons';
import { LoadTypeBadge } from '@shared/components/LoadTypeBadge';
import { isBodyweightLoad } from '@shared/lib/loadType';

/**
 * Edición de un entreno ya guardado: cambiar reps, duration_seconds, kg, set_type, rpe, notes, is_warmup, load_type.
 *
 * Vivía dentro de `HistoryPage`, que pasaba de las 800 líneas de CLAUDE.md.
 * Solo lo usa esa página, pero como componente propio se lee sin tener que
 * bajar por medio fichero de listado y filtros.
 */
type SetType = 'normal' | 'dropset' | 'rest_pause' | 'amrap';
const SET_TYPES: SetType[] = ['normal', 'dropset', 'rest_pause', 'amrap'];

interface EditRow {
  id: string;
  exercise: string;
  reps: string;
  weight: string;
  duration_seconds: string;
  set_type: SetType;
  rpe: string;
  notes: string;
  is_warmup: boolean;
  load_type: string;
  /** Si el ejercicio usa peso corporal (para etiquetar el campo peso) */
  is_bodyweight: boolean;
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
        reps: String(s.reps ?? ''),
        weight: String(s.weight ?? ''),
        duration_seconds: String(s.duration_seconds ?? ''),
        set_type: (s.set_type as SetType) ?? 'normal',
        rpe: String(s.rpe ?? ''),
        notes: s.notes ?? '',
        is_warmup: s.is_warmup ?? false,
        load_type: s.exercise?.load_type ?? 'external',
        is_bodyweight: isBodyweightLoad(s.exercise?.load_type),
      })),
  );
  const [saving, setSaving] = useState(false);

  const update = (id: string, field: keyof EditRow, val: string) =>
    setRows((r) => r.map((x) => (x.id === id ? { ...x, [field]: val } : x)));

  const handleSave = async () => {
    setSaving(true);
    try {
      for (const row of rows) {
        const reps = row.reps ? parseInt(row.reps, 10) : null;
        const duration_seconds = row.duration_seconds ? parseInt(row.duration_seconds, 10) : null;
        const weight = row.weight ? parseFloat(row.weight.replace(',', '.')) : null;
        const rpe = row.rpe ? parseInt(row.rpe, 10) : null;

        // Validación: una serie debe tener reps o duration_seconds
        const hasReps = reps !== null && Number.isFinite(reps) && reps > 0;
        const hasDuration =
          duration_seconds !== null && Number.isFinite(duration_seconds) && duration_seconds > 0;
        if (!hasReps && !hasDuration) continue;

        const updateData: Record<string, unknown> = {
          set_type: row.set_type,
          rpe,
          notes: row.notes || null,
          is_warmup: row.is_warmup,
          load_type: row.load_type,
        };
        if (hasReps) updateData.reps = reps;
        else updateData.reps = null;
        if (hasDuration) updateData.duration_seconds = duration_seconds;
        else updateData.duration_seconds = null;
        if (weight !== null) updateData.weight = weight;
        else updateData.weight = 0;

        const { error } = await supabase.from('workout_sets').update(updateData).eq('id', row.id);
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
      icon={<Edit className="w-5 h-5 text-accent" />}
    >
      <div className="space-y-2 max-h-[50vh] overflow-y-auto mb-4">
        {rows.map((row, i) => (
          <div key={row.id} className="space-y-2 p-3 bg-surface-2 border border-line rounded-card">
            <div className="flex items-center gap-2">
              <span className="w-5 text-xs font-mono tabular-nums text-fg-subtle">{i + 1}</span>
              <span className="flex-1 text-sm text-fg truncate">{row.exercise}</span>
              {row.load_type !== 'external' && (
                <LoadTypeBadge loadType={row.load_type} className="!py-0.5 !px-1.5 !text-[10px]" />
              )}
            </div>

            <div className="grid grid-cols-2 gap-2">
              {row.load_type !== 'external' ? (
                // Para bodyweight/band/plyo: mostramos carga como "Lastre" o similar
                <>
                  <Input
                    label={
                      row.is_bodyweight ? t('workout.load_label_lastre') : t('workout.load_label')
                    }
                    type="number"
                    inputMode="decimal"
                    step="0.5"
                    min={0}
                    value={row.weight}
                    onChange={(e) =>
                      update(row.id, 'weight', e.target.value.replace(/[^\d.,]/g, ''))
                    }
                    aria-label={`${t('workout.weight')} ${i + 1}`}
                  />
                  <Input
                    label={t('workout.reps')}
                    type="text"
                    inputMode="numeric"
                    value={row.reps}
                    onChange={(e) => update(row.id, 'reps', e.target.value.replace(/[^\d]/g, ''))}
                    aria-label={`${t('workout.reps')} ${i + 1}`}
                  />
                </>
              ) : (
                <>
                  <Input
                    label={t('workout.weight')}
                    type="text"
                    inputMode="decimal"
                    step="0.5"
                    min={0}
                    value={row.weight}
                    onChange={(e) =>
                      update(row.id, 'weight', e.target.value.replace(/[^\d.,]/g, ''))
                    }
                    aria-label={`${t('workout.weight')} ${i + 1}`}
                  />
                  <Input
                    label={t('workout.reps')}
                    type="text"
                    inputMode="numeric"
                    value={row.reps}
                    onChange={(e) => update(row.id, 'reps', e.target.value.replace(/[^\d]/g, ''))}
                    aria-label={`${t('workout.reps')} ${i + 1}`}
                  />
                </>
              )}
            </div>

            {row.duration_seconds !== undefined && (
              <Input
                label={t('workout.seconds')}
                type="number"
                inputMode="numeric"
                min={0}
                value={row.duration_seconds}
                onChange={(e) =>
                  update(row.id, 'duration_seconds', e.target.value.replace(/[^\d]/g, ''))
                }
                aria-label={`${t('workout.seconds')} ${i + 1}`}
              />
            )}

            <div className="flex flex-wrap gap-2">
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-fg-subtle">{t('workout.rpe_label')}</span>
                <Input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={10}
                  value={row.rpe}
                  onChange={(e) => update(row.id, 'rpe', e.target.value.replace(/[^\d]/g, ''))}
                  aria-label={`${t('workout.rpe_label')} ${i + 1}`}
                  className="w-16"
                />
              </div>

              <div className="flex items-center gap-1.5">
                <span className="text-xs text-fg-subtle">{t('workout.set_type_label')}</span>
                <SegmentedControl
                  value={row.set_type}
                  onChange={(v) => update(row.id, 'set_type', v)}
                  options={SET_TYPES.map((v) => ({ value: v, label: t(`workout.set_type_${v}`) }))}
                  ariaLabel={t('workout.set_type_label')}
                />
              </div>

              <div className="flex items-center gap-1.5">
                <span className="text-xs text-fg-subtle">{t('workout.load_type_label')}</span>
                <SegmentedControl
                  value={row.load_type}
                  onChange={(v) => update(row.id, 'load_type', v)}
                  options={[
                    { value: 'external', label: t('workout.load_type_external') },
                    { value: 'bodyweight', label: t('workout.load_type_bodyweight') },
                    { value: 'bodyweight_loaded', label: t('workout.load_type_bodyweight_loaded') },
                    { value: 'band_resistance', label: t('workout.load_type_band_resistance') },
                    { value: 'plyometrics', label: t('workout.load_type_plyometrics') },
                  ]}
                  ariaLabel={t('workout.load_type_label')}
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <label className="flex items-center gap-1.5 text-sm text-fg-muted">
                <input
                  type="checkbox"
                  checked={row.is_warmup}
                  onChange={(e) => update(row.id, 'is_warmup', e.target.checked ? 'true' : 'false')}
                  className="rounded border-line"
                />
                <span>{t('workout.warmup')}</span>
              </label>
            </div>

            <Input
              label={t('workout.set_note_placeholder')}
              type="text"
              value={row.notes}
              onChange={(e) => update(row.id, 'notes', e.target.value.slice(0, 500))}
              className="w-full"
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
