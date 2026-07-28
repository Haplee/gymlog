import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ChevronRight } from 'lucide-react';
import toast from 'react-hot-toast';
import { SectionHeader, SettingRow, Toggle } from '@shared/components/ui';
import { useAuthStore } from '@features/auth/stores/authStore';
import { useCoachStore } from '../stores/coachStore';
import { CoachConsentModal } from './CoachConsentModal';

/**
 * Bloque de Ajustes del entrenador IA.
 *
 * Vivía dentro de `auth/pages/SettingsPage`, que para pintarlo tenía que
 * importar el store y el modal de `coach` — mientras `coach` importaba
 * `authStore`. Eso cerraba una dependencia circular entre features.
 *
 * Ahora la sección vive donde vive su dominio y `SettingsPage` la recibe como
 * prop desde `App.tsx`, que es la capa que sí puede conocer a las dos.
 */
export function CoachSettingsSection() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);

  // El estado real vive en el servidor (profiles.ai_coach_enabled); el store es
  // un espejo y se corrige al abrir Ajustes.
  const coachEnabled = useCoachStore((s) => s.enabled);
  const syncCoach = useCoachStore((s) => s.sync);
  const enableCoach = useCoachStore((s) => s.enable);
  const disableCoach = useCoachStore((s) => s.disable);
  const [showCoachConsent, setShowCoachConsent] = useState(false);
  const [coachBusy, setCoachBusy] = useState(false);

  useEffect(() => {
    if (user?.id) void syncCoach(user.id);
  }, [user?.id, syncCoach]);

  /**
   * Encender NUNCA es directo: pasa por el consentimiento. Apagar sí es
   * inmediato, pero avisa de que borra los datos, porque los borra de verdad.
   */
  const handleCoachToggle = async (next: boolean) => {
    if (next) {
      setShowCoachConsent(true);
      return;
    }
    if (!window.confirm(t('coach.settings.purge_confirm'))) return;
    setCoachBusy(true);
    try {
      await disableCoach();
      toast.success(t('coach.settings.purged'));
    } catch {
      toast.error(t('coach.error.unknown'));
    } finally {
      setCoachBusy(false);
    }
  };

  const handleCoachAccept = async () => {
    if (!user?.id) return;
    setCoachBusy(true);
    try {
      await enableCoach(user.id);
      setShowCoachConsent(false);
    } catch {
      toast.error(t('coach.error.unknown'));
    } finally {
      setCoachBusy(false);
    }
  };

  return (
    <>
      {/* Entrenador IA — apagado por defecto; activarlo pasa por consentimiento */}
      <section>
        <SectionHeader title={t('coach.settings.section')} />
        <div className="rounded-card bg-surface border border-line overflow-hidden">
          <SettingRow
            label={t('coach.settings.toggle')}
            desc={t('coach.settings.toggle_desc')}
            control={
              <Toggle
                checked={coachEnabled}
                onChange={handleCoachToggle}
                ariaLabel={t('coach.settings.toggle')}
              />
            }
            divider={coachEnabled}
          />
          {coachEnabled && (
            <>
              <button
                type="button"
                onClick={() => navigate('/coach')}
                className="w-full flex items-center justify-between gap-3 px-4 py-3.5 text-left active:bg-hover dotted-separator"
              >
                <span className="text-base text-fg">{t('coach.settings.open')}</span>
                <ChevronRight className="w-4 h-4 flex-shrink-0 text-fg-subtle" />
              </button>
              <button
                type="button"
                onClick={() => navigate('/coach/memory')}
                className="w-full flex items-center justify-between gap-3 px-4 py-3.5 text-left active:bg-hover"
              >
                <span className="min-w-0">
                  <span className="block text-base text-fg">{t('coach.settings.memory')}</span>
                  <span className="block text-xs mt-0.5 text-fg-subtle">
                    {t('coach.settings.memory_desc')}
                  </span>
                </span>
                <ChevronRight className="w-4 h-4 flex-shrink-0 text-fg-subtle" />
              </button>
            </>
          )}
        </div>
      </section>

      <CoachConsentModal
        open={showCoachConsent}
        loading={coachBusy}
        onAccept={handleCoachAccept}
        onClose={() => setShowCoachConsent(false)}
      />
    </>
  );
}
