import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { m } from 'framer-motion';
import { useAuthStore } from '@features/auth/stores/authStore';
import { fetchBodyMeasurements, upsertTodayWeight } from '@shared/api/queries';
import { toLocalDateKey } from '@shared/lib/dateKeys';
import { isWeightPromptDue } from '@features/workout/utils/bodyweight';
import { Scale, X } from '@shared/components/icons';

const DISMISS_KEY = 'gymlog-weight-prompt-dismissed';

/** Límite superior (excluyente) del peso corporal aceptado, en kg. */
const MAX_WEIGHT_KG = 500;

/** ISO week key (yyyy-Www aprox) para no repetir el prompt dentro de la semana. */
function currentWeekKey(): string {
  const d = new Date();
  const onejan = new Date(d.getFullYear(), 0, 1);
  const week = Math.ceil(((d.getTime() - onejan.getTime()) / 86_400_000 + onejan.getDay() + 1) / 7);
  return `${d.getFullYear()}-W${week}`;
}

/**
 * Pide el peso corporal una vez por semana, **solo los lunes**, y lo guarda en
 * body_measurements. Descartable; no reaparece hasta el lunes siguiente.
 *
 * El "solo los lunes" es el requisito, no un detalle: la regla vive en
 * `isWeightPromptDue`, que explica por qué el día fijo importa.
 */
export function WeeklyWeightPrompt() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
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

  const due = isWeightPromptDue(measurements, toLocalDateKey(new Date()));

  if (!user?.id || dismissedThisWeek || !due || saveMutation.isSuccess) return null;

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, currentWeekKey());
    setDismissedThisWeek(true);
  };

  const submit = () => {
    const kg = parseFloat(value.replace(',', '.'));
    // Sin mensaje, un valor inválido hacía que "Guardar" no hiciera nada y el
    // usuario no tenía forma de saber por qué.
    if (!Number.isFinite(kg) || kg <= 0 || kg >= MAX_WEIGHT_KG) {
      setError(t('weight_prompt.invalid', { max: MAX_WEIGHT_KG }));
      return;
    }
    setError(null);
    saveMutation.mutate(kg);
  };

  return (
    <m.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-4 rounded-card border border-line bg-surface p-3"
    >
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-full bg-accent/12 flex items-center justify-center flex-shrink-0">
          <Scale className="w-4 h-4 text-accent" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium text-fg">{t('weight_prompt.title')}</div>
          <p className="text-xs text-fg-muted mt-0.5">{t('weight_prompt.subtitle')}</p>
          <div className="flex items-center gap-2 mt-2">
            <input
              type="number"
              inputMode="decimal"
              min={0}
              max={MAX_WEIGHT_KG}
              value={value}
              onChange={(e) => {
                setValue(e.target.value);
                if (error) setError(null);
              }}
              onKeyDown={(e) => e.key === 'Enter' && submit()}
              placeholder={t('weight_prompt.placeholder')}
              aria-label={t('weight_prompt.placeholder')}
              aria-invalid={!!error}
              aria-describedby={error ? 'weight-prompt-error' : undefined}
              className={`w-24 bg-surface-2 border rounded-md px-3 min-h-11 text-base text-fg outline-none ${
                error ? 'border-error' : 'border-line-strong focus:border-accent'
              }`}
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
          {error && (
            <p id="weight-prompt-error" role="alert" className="text-xs text-error mt-1.5">
              {error}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={dismiss}
          aria-label={t('common.close')}
          className="w-8 h-8 rounded-full flex items-center justify-center text-fg-subtle hover:text-fg-muted flex-shrink-0"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </m.div>
  );
}
