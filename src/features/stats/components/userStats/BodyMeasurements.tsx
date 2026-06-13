import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { m } from 'framer-motion';
import { Plus, Trash2 } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { toast } from 'sonner';
import { useWeight } from '@shared/hooks/useWeight';
import {
  fetchBodyMeasurements,
  addBodyMeasurement,
  deleteBodyMeasurement,
  type BodyMeasurement,
} from '@shared/api/queries';
import { SectionLabel } from './SectionLabel';

const MEASUREMENTS_KEY = (userId: string) => ['bodyMeasurements', userId];

export function BodyMeasurements({ userId }: { userId: string }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { unit, convert, convertFromDisplay } = useWeight();

  const [weightInput, setWeightInput] = useState('');
  const [bodyFatInput, setBodyFatInput] = useState('');

  const { data: measurements = [] } = useQuery({
    queryKey: MEASUREMENTS_KEY(userId),
    queryFn: () => fetchBodyMeasurements(userId),
    enabled: !!userId,
  });

  const addMutation = useMutation({
    mutationFn: (values: { weight_kg: number | null; body_fat_pct: number | null }) =>
      addBodyMeasurement(userId, values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: MEASUREMENTS_KEY(userId) });
      setWeightInput('');
      setBodyFatInput('');
    },
    onError: () => toast.error(t('measurements.save_error')),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteBodyMeasurement(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: MEASUREMENTS_KEY(userId) }),
  });

  // Datos del chart: peso en unidad de visualización, orden cronológico.
  const chartData = useMemo(
    () =>
      measurements
        .filter((m_): m_ is BodyMeasurement & { weight_kg: number; date: string } =>
          Boolean(m_.weight_kg && m_.date),
        )
        .map((m_) => ({
          date: m_.date,
          value: Number(convert(m_.weight_kg).toFixed(1)),
        })),
    [measurements, convert],
  );

  const handleAdd = () => {
    const weightDisplay = parseFloat(weightInput.replace(',', '.'));
    const bodyFat = parseFloat(bodyFatInput.replace(',', '.'));
    const hasWeight = Number.isFinite(weightDisplay) && weightDisplay > 0;
    const hasBodyFat = Number.isFinite(bodyFat) && bodyFat > 0;
    if (!hasWeight && !hasBodyFat) return;

    addMutation.mutate({
      weight_kg: hasWeight ? convertFromDisplay(weightDisplay) : null,
      body_fat_pct: hasBodyFat ? bodyFat : null,
    });
  };

  return (
    <section className="space-y-3">
      <SectionLabel>{t('measurements.title')}</SectionLabel>

      <m.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-card p-4 bg-surface border border-line shadow-card space-y-4"
      >
        {/* Formulario */}
        <div className="flex gap-2">
          <div className="flex-1">
            <label className="text-2xs uppercase font-semibold text-fg-subtle">
              {t('measurements.weight')} ({unit})
            </label>
            <input
              type="text"
              inputMode="decimal"
              placeholder="0"
              value={weightInput}
              onChange={(e) => setWeightInput(e.target.value.replace(/[^\d.,]/g, ''))}
              className="w-full mt-1 rounded-lg text-base px-3 py-2.5 outline-none text-center text-fg bg-surface-2 border border-line-strong"
            />
          </div>
          <div className="flex-1">
            <label className="text-2xs uppercase font-semibold text-fg-subtle">
              {t('measurements.body_fat')} (%)
            </label>
            <input
              type="text"
              inputMode="decimal"
              placeholder="0"
              value={bodyFatInput}
              onChange={(e) => setBodyFatInput(e.target.value.replace(/[^\d.,]/g, ''))}
              className="w-full mt-1 rounded-lg text-base px-3 py-2.5 outline-none text-center text-fg bg-surface-2 border border-line-strong"
            />
          </div>
          <button
            onClick={handleAdd}
            disabled={addMutation.isPending}
            aria-label={t('measurements.add')}
            className="self-end w-11 h-11 flex items-center justify-center rounded-lg bg-accent text-accent-fg disabled:opacity-50"
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>

        {/* Chart de peso */}
        {chartData.length >= 2 && (
          <div className="h-[160px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <XAxis
                  dataKey="date"
                  tick={{ fill: 'var(--text-tertiary)', fontSize: 9 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => format(parseISO(v), 'dd/MM')}
                />
                <YAxis hide domain={['dataMin - 2', 'dataMax + 2']} />
                <Tooltip
                  contentStyle={{
                    background: 'var(--bg-surface-3)',
                    border: '1px solid var(--border-default)',
                    borderRadius: 10,
                    fontSize: 12,
                  }}
                  labelStyle={{ color: 'var(--text-secondary)' }}
                  labelFormatter={(v) => format(parseISO(v as string), 'dd MMM', { locale: es })}
                  formatter={(value) => [`${value} ${unit}`, t('measurements.weight')]}
                />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke="var(--interactive-primary)"
                  strokeWidth={2.5}
                  dot={{ r: 3, fill: 'var(--interactive-primary)' }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Lista de registros (más recientes primero) */}
        {measurements.length === 0 ? (
          <div className="text-center py-4 text-sm text-fg-subtle">{t('measurements.empty')}</div>
        ) : (
          <div className="space-y-1.5 max-h-48 overflow-y-auto">
            {[...measurements].reverse().map((entry) => (
              <div
                key={entry.id}
                className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-surface-2 border border-line-glass"
              >
                <div className="text-xs text-fg-subtle">
                  {entry.date ? format(parseISO(entry.date), 'dd MMM yyyy', { locale: es }) : '—'}
                </div>
                <div className="flex items-center gap-3">
                  {entry.weight_kg != null && (
                    <span className="text-sm font-medium text-fg">
                      {convert(entry.weight_kg).toFixed(1)} {unit}
                    </span>
                  )}
                  {entry.body_fat_pct != null && (
                    <span className="text-sm text-fg-muted">{entry.body_fat_pct}%</span>
                  )}
                  <button
                    onClick={() => deleteMutation.mutate(entry.id)}
                    aria-label={t('common.delete')}
                    className="w-8 h-8 flex items-center justify-center rounded-lg text-fg-subtle"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </m.div>
    </section>
  );
}
