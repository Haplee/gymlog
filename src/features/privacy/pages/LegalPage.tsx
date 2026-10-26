import { useNavigate, useParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import { ArrowLeft } from '@shared/components/icons';

/**
 * Documentos legales dentro de la app.
 *
 * Son los mismos ficheros de `public/` que enlazan las tiendas y el correo,
 * pero servidos en una ruta propia. Un `target="_blank"` en el WebView de
 * Capacitor no abre nada: se quedaba en un enlace muerto. Con una ruta y un
 * iframe, el mismo documento se lee igual en web y en el móvil, y el usuario
 * puede volver con el botón de la cabecera.
 */
const DOCS = {
  privacy: { src: 'privacy-policy.html', titleKey: 'settings.privacy_policy' },
  terms: { src: 'terms.html', titleKey: 'settings.terms' },
  notices: { src: 'third-party-notices.txt', titleKey: 'settings.third_party_notices' },
} as const;

type DocKey = keyof typeof DOCS;

export function LegalPage() {
  const { doc } = useParams<{ doc: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();

  const key: DocKey = doc === 'terms' || doc === 'notices' ? doc : 'privacy';
  const entry = DOCS[key];

  // Vite sirve desde la raíz del proyecto; el iframe resuelve el documento
  // relativo a la ruta actual, así que se ancla al origen.
  const src = `${import.meta.env.BASE_URL}${entry.src}`;

  return (
    <div className="flex h-dvh flex-col bg-canvas">
      <header className="flex flex-shrink-0 items-center gap-2 border-b border-line px-2 py-2">
        <button
          type="button"
          onClick={() => navigate(-1)}
          aria-label={t('common.back')}
          className="flex size-11 items-center justify-center rounded-full text-fg-muted active:bg-hover"
        >
          <ArrowLeft className="size-5" />
        </button>
        <h1 className="min-w-0 flex-1 truncate text-base font-semibold text-fg">
          {t(entry.titleKey)}
        </h1>
      </header>
      <iframe src={src} title={t(entry.titleKey)} className="w-full flex-1 border-0 bg-canvas" />
    </div>
  );
}
