import { useTranslation } from 'react-i18next';
import { m } from 'framer-motion';
import { AlertCircle } from '@shared/components/icons';

export function ResumeWorkoutBanner({
  onContinue,
  onDiscard,
}: {
  onContinue: () => void;
  onDiscard: () => void;
}) {
  const { t } = useTranslation();
  return (
    <m.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="mb-4 p-4 rounded-md border-2 border-accent bg-accent/5 flex flex-col gap-3"
    >
      <div className="flex items-center gap-2 text-accent">
        <AlertCircle className="w-5 h-5" />
        <span className="font-semibold text-sm">{t('workout.resume_banner')}</span>
      </div>
      <p className="text-xs text-fg-muted">{t('workout.resume_desc')}</p>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onContinue}
          className="flex-1 py-2 rounded-card bg-accent text-accent-fg text-xs font-bold"
        >
          {t('workout.continue')}
        </button>
        <button
          type="button"
          onClick={onDiscard}
          className="flex-1 py-2 rounded-card border border-line-strong text-fg-muted text-xs font-medium"
        >
          {t('workout.discard')}
        </button>
      </div>
    </m.div>
  );
}
