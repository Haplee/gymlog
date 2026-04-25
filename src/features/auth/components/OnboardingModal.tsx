import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Target, Calendar, ChevronRight, ChevronLeft } from 'lucide-react';
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
    <Modal
      open={true}
      title={t('onboarding.title')}
      onClose={() => {}}
      showCloseButton={false}
      icon={<Target className="w-5 h-5" style={{ color: 'var(--interactive-primary)' }} />}
    >
      <div className="space-y-6">
        {step === 1 && (
          <div className="space-y-4">
            <p className="text-[var(--text-secondary)] text-sm">{t('onboarding.subtitle')}</p>
            <label className="block text-sm font-medium mb-2">{t('onboarding.goal')}</label>
            <div className="grid grid-cols-2 gap-2">
              {goals.map((g) => (
                <button
                  key={g}
                  onClick={() => setData({ ...data, goal: g })}
                  className={`p-3 rounded-xl border text-sm transition-all ${
                    data.goal === g
                      ? 'border-[var(--interactive-primary)] text-[var(--interactive-primary)]'
                      : 'bg-[var(--bg-surface-2)] border-[var(--border-subtle)] text-[var(--text-secondary)]'
                  }`}
                  style={data.goal === g ? { backgroundColor: 'rgba(200,255,0,0.1)' } : {}}
                >
                  {t(`onboarding.goal_${g}`)}
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4" style={{ color: 'var(--interactive-primary)' }} />
              <label className="block text-sm font-medium">{t('onboarding.days')}</label>
            </div>
            <div className="flex justify-between gap-2">
              {[1, 2, 3, 4, 5, 6, 7].map((d) => (
                <button
                  key={d}
                  onClick={() => setData({ ...data, days_per_week: d })}
                  className={`flex-1 aspect-square rounded-full border flex items-center justify-center transition-all text-sm font-medium ${
                    data.days_per_week === d
                      ? 'border-[var(--interactive-primary)]'
                      : 'border-[var(--border-subtle)]'
                  }`}
                  style={
                    data.days_per_week === d
                      ? {
                          backgroundColor: 'var(--interactive-primary)',
                          color: 'var(--interactive-primary-fg)',
                        }
                      : {}
                  }
                >
                  {d}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="flex gap-3 pt-4 border-t border-[var(--border-subtle)]">
          {step > 1 ? (
            <Button variant="secondary" onClick={() => setStep(step - 1)} className="flex-1">
              <ChevronLeft className="w-4 h-4 mr-1" />
              {t('common.back')}
            </Button>
          ) : (
            <div className="flex-1" />
          )}
          {step < 2 ? (
            <Button variant="primary" onClick={() => setStep(step + 1)} className="flex-1">
              {t('common.next')}
              <ChevronRight className="w-4 h-4 ml-1" />
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
