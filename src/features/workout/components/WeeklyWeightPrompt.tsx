import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { m } from 'framer-motion';
import { Scale, X } from 'lucide-react';
import { useAuthStore } from '@features/auth/stores/authStore';
import { fetchBodyMeasurements, upsertTodayWeight } from '@shared/api/queries';
import { daysSinceLastWeight } from '@features/workout/utils/bodyweight';

const DISMISS_KEY = 'gymlog-weight-prompt-dismissed';

/** ISO week key (yyyy-Www aprox) para no repetir el prompt dentro de la semana. */
function currentWeekKey(): string {
  const d = new Date();
  const onejan = new Date(d.getFullYear(), 0, 1);
  const week = Math.ceil(((d.getTime() - onejan.getTime()) / 86_400_000 + onejan.getDay() + 1) / 7);
  return `${d.getFullYear()}-W${week}`;
}

/**
 * Pide el peso corporal ~1 vez por semana (si hace >7 días o nunca) y lo guarda
 * en body_measurements. Dismissable; no reaparece hasta la siguiente semana.
 */
export function WeeklyWeightPrompt() {
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const [value, setValue] = useState('');
  const [dismissedThisWeek, setDismissedThisWeek] = useState(
    () => localStorage.getItem(DISMISS_KEY) === currentWeekKey(),
  );

  const { data: measurements = [] } = useQuery({
    queryKey: ['bodyMeasurements', user?.id],
    queryFn: () => fetchBodyMeasurements(user?.id ?? ''),
    enabled: !!user?.id,
    staleTime: 1000 * 60 * 30,
  });

  const saveMutation = useMutation({
    mutationFn: (kg: number) => upsertTodayWeight(user?.id ?? '', kg),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bodyMeasurements', user?.id] });
      setValue('');
    },
  });

  const today = new Date().toISOString().split('T')[0];
  const days = daysSinceLastWeight(measurements, today);
  const due = days === null || days >= 7;

  if (!user?.id || dismissedThisWeek || !due || saveMutation.isSuccess) return null;

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, currentWeekKey());
    setDismissedThisWeek(true);
  };

  const submit = () => {
    const kg = parseFloat(value.replace(',', '.'));
    if (!Number.isFinite(kg) || kg <= 0 || kg >= 500) return;
    saveMutation.mutate(kg);
  };

  return (
    <m.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-4 rounded-lg border border-line bg-surface p-3"
    >
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-sm bg-accent/10 flex items-center justify-center flex-shrink-0">
          <Scale className="w-4 h-4 text-accent" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium text-fg">{t('weight_prompt.title')}</div>
          <p className="text-xs text-fg-muted mt-0.5">{t('weight_prompt.subtitle')}</p>
          <div className="flex items-center gap-2 mt-2">
            <input
              type="number"
              inputMode="decimal"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submit()}
              placeholder={t('weight_prompt.placeholder')}
              aria-label={t('weight_prompt.placeholder')}
              className="w-24 bg-surface-2 border border-line-strong rounded-md px-3 min-h-11 text-base text-fg outline-none focus:border-accent"
            />
            <button
              type="button"
              onClick={submit}
              disabled={saveMutation.isPending || !value}
              className="min-h-11 px-4 rounded-md bg-accent text-accent-fg text-sm font-medium disabled:opacity-50"
            >
              {t('weight_prompt.save')}
            </button>
          </div>
        </div>
        <button
          type="button"
          onClick={dismiss}
          aria-label={t('common.close')}
          className="w-8 h-8 rounded-sm flex items-center justify-center text-fg-subtle hover:text-fg-muted flex-shrink-0"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </m.div>
  );
}
