import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Button } from '@shared/components/ui';
import { supabase } from '@shared/lib/supabase';
import type { Profile } from '@shared/lib/types';

interface OnboardingModalProps {
  user: { id: string };
  onComplete: () => void;
}

export function OnboardingModal({ user, onComplete }: OnboardingModalProps) {
  const { t } = useTranslation();
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);

  const [data, setData] = useState<Partial<Profile>>({
    goal: 'volume',
    days_per_week: 3,
  });

  const handleFinish = async () => {
    setSaving(true);
    await supabase.from('profiles').update(data).eq('id', user.id);
    setSaving(false);
    onComplete();
  };

  const goals: Profile['goal'][] = ['volume', 'strength', 'endurance', 'fat_loss'];

  return (
    <Modal open={true} title={t('onboarding.title')} onClose={() => {}}>
      <div className="space-y-6 py-2">
        {step === 1 && (
          <div className="space-y-4 animate-in fade-in slide-in-from-right-4">
            <p className="text-[--text-secondary] text-sm">{t('onboarding.subtitle')}</p>
            <label className="block text-sm font-medium mb-2">{t('onboarding.goal')}</label>
            <div className="grid grid-cols-2 gap-2">
              {goals.map((g) => (
                <button
                  key={g}
                  onClick={() => setData({ ...data, goal: g })}
                  className={`p-3 rounded-xl border text-sm transition-all ${
                    data.goal === g
                      ? 'bg-[--color-primary]/10 border-[--color-primary] text-[--color-primary]'
                      : 'bg-[--bg-surface] border-[--border-default] text-[--text-secondary]'
                  }`}
                >
                  {t(`onboarding.goal_${g}`)}
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4 animate-in fade-in slide-in-from-right-4">
            <label className="block text-sm font-medium">{t('onboarding.days')}</label>
            <div className="flex justify-between gap-2">
              {[1, 2, 3, 4, 5, 6, 7].map((d) => (
                <button
                  key={d}
                  onClick={() => setData({ ...data, days_per_week: d })}
                  className={`flex-1 aspect-square rounded-full border flex items-center justify-center transition-all ${
                    data.days_per_week === d
                      ? 'bg-[--color-primary] text-[--text-inverse] border-[--color-primary]'
                      : 'bg-[--bg-surface] border-[--border-default] text-[--text-secondary]'
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="flex gap-3 pt-6 border-t border-[--border-default]">
          {step > 1 && (
            <Button variant="secondary" onClick={() => setStep(step - 1)} className="flex-1">
              {t('common.back')}
            </Button>
          )}
          {step < 2 ? (
            <Button variant="primary" onClick={() => setStep(step + 1)} className="flex-1">
              {t('common.next')}
            </Button>
          ) : (
            <Button variant="primary" onClick={handleFinish} loading={saving} className="flex-1">
              {t('onboarding.finish')}
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
}
