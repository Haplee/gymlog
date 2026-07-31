import { useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { ChevronRight, Sparkles } from 'lucide-react';
import { useCoachStore } from '../stores/coachStore';

/**
 * Atajo al entrenador desde la pantalla de inicio.
 *
 * Solo se dibuja con el entrenador encendido. Es deliberado: está apagado por
 * defecto y anunciarlo en la portada a quien ya dijo que no sería insistir en
 * una función que manda datos fuera del dispositivo. Quien no lo ha activado lo
 * encuentra igual desde el menú lateral y desde Ajustes.
 *
 * Lee el espejo local del consentimiento sin sincronizar: aquí solo se decide
 * si pintar un enlace, no se manda nada a ningún sitio. Quien manda es el
 * servidor, y `/coach` ya se encarga si el espejo estuviera desfasado.
 *
 * El margen superior va en el propio botón: en un envoltorio dejaría un hueco
 * flotando cuando el entrenador está apagado y no se pinta nada.
 */
export function CoachHomeCard() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const enabled = useCoachStore((s) => s.enabled);

  if (!enabled) return null;

  return (
    <button
      type="button"
      onClick={() => navigate('/coach')}
      className="mt-3 w-full flex items-center justify-between gap-3 rounded-card border border-line bg-surface px-4 py-3.5 text-left active:bg-hover"
    >
      <span className="flex items-center gap-3 min-w-0">
        <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-accent text-accent-fg">
          <Sparkles className="w-4 h-4" aria-hidden="true" />
        </span>
        <span className="min-w-0">
          <span className="block text-base text-fg">{t('coach.page_title')}</span>
          <span className="block text-xs mt-0.5 text-fg-subtle">{t('coach.home_hint')}</span>
        </span>
      </span>
      <ChevronRight className="w-4 h-4 flex-shrink-0 text-fg-subtle" aria-hidden="true" />
    </button>
  );
}
