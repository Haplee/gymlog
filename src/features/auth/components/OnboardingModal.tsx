import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Button } from '@shared/components/ui';
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  IconFemale,
  IconMale,
  IconRuler,
  IconUser,
  Target,
} from '@shared/components/icons';
import { supabase } from '@shared/lib/supabase';
import type { Profile } from '@shared/lib/types';
import { RulerPicker } from './RulerPicker';

const TOTAL_STEPS = 4;

/** Valores de `profiles.sex`; 'other' cubre a quien prefiere no decirlo. */
const SEXES = [
  { value: 'male', Icon: IconMale },
  { value: 'female', Icon: IconFemale },
  { value: 'other', Icon: IconUser },
] as const;

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
    sex: 'other',
    height_cm: 170,
    weight_kg: 70,
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
      icon={<Target className="w-5 h-5 text-accent" />}
    >
      <div className="space-y-6">
        {step === 1 && (
          <div className="space-y-4">
            <p className="text-fg-muted text-sm">{t('onboarding.subtitle')}</p>
            <label className="block text-sm font-medium mb-2">{t('onboarding.goal')}</label>
            <div className="grid grid-cols-2 gap-2">
              {goals.map((g) => (
                <button
                  type="button"
                  key={g}
                  onClick={() => setData({ ...data, goal: g })}
                  className={`p-3 rounded-md border text-sm transition-all ${
                    data.goal === g
                      ? 'border-accent text-accent'
                      : 'bg-surface-2 border-line text-fg-muted'
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
              <Calendar className="w-4 h-4 text-accent" />
              <label className="block text-sm font-medium">{t('onboarding.days')}</label>
            </div>
            <div className="flex justify-between gap-2">
              {[1, 2, 3, 4, 5, 6, 7].map((d) => (
                <button
                  type="button"
                  key={d}
                  onClick={() => setData({ ...data, days_per_week: d })}
                  className={`flex-1 aspect-square rounded-full border flex items-center justify-center transition-all text-sm font-medium ${
                    data.days_per_week === d ? 'border-accent' : 'border-line'
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

        {step === 3 && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <IconUser className="w-4 h-4 text-accent" />
              <span className="block text-sm font-medium">{t('onboarding.sex')}</span>
            </div>
            <div
              role="radiogroup"
              aria-label={t('onboarding.sex')}
              className="grid grid-cols-3 gap-2"
            >
              {SEXES.map(({ value, Icon }) => {
                const isActive = data.sex === value;
                return (
                  <button
                    type="button"
                    key={value}
                    role="radio"
                    aria-checked={isActive}
                    onClick={() => setData({ ...data, sex: value })}
                    className={`flex flex-col items-center gap-2 rounded-card p-3 transition-colors ${
                      isActive ? 'bg-accent text-accent-fg' : 'bg-surface-2 text-fg-muted'
                    }`}
                  >
                    <Icon className="h-7 w-7" />
                    <span className="text-xs font-medium">{t(`onboarding.sex_${value}`)}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <IconRuler className="w-4 h-4 text-accent" />
              <span className="block text-sm font-medium">{t('onboarding.body')}</span>
            </div>
            <RulerPicker
              label={t('onboarding.height')}
              unit="cm"
              min={130}
              max={220}
              value={data.height_cm ?? 170}
              onChange={(height_cm) => setData({ ...data, height_cm })}
            />
            <RulerPicker
              label={t('onboarding.weight')}
              unit="kg"
              min={35}
              max={180}
              value={data.weight_kg ?? 70}
              onChange={(weight_kg) => setData({ ...data, weight_kg })}
            />
            <p className="text-xs text-fg-subtle">{t('onboarding.body_hint')}</p>
          </div>
        )}

        <div className="flex gap-3 pt-4 border-t border-line">
          {step > 1 ? (
            <Button variant="secondary" onClick={() => setStep(step - 1)} className="flex-1">
              <ChevronLeft className="w-4 h-4 mr-1" />
              {t('common.back')}
            </Button>
          ) : (
            <div className="flex-1" />
          )}
          {step < TOTAL_STEPS ? (
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
