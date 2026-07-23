import { useEffect, useState, type ComponentType } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Calculator, CloudOff, ChevronDown, ChevronRight, Lightbulb } from 'lucide-react';
import {
  IconBook,
  IconCalendar,
  IconChart,
  IconDumbbell,
  IconGear,
  IconHistory,
  IconRuler,
  IconShoe,
  IconTimer,
  IconWatch,
} from '@shared/components/icons';
import { Layout } from '@app/components/Layout';
import { Button, SectionHeader } from '@shared/components/ui';
import { useSettingsStore } from '@shared/stores/settingsStore';

interface GuideSection {
  /** Sufijo de la clave i18n: guide.<id>.title / guide.<id>.bullets */
  id: string;
  /** Vale tanto para los iconos propios como para los de lucide que quedan. */
  Icon: ComponentType<{ className?: string }>;
  /** Ruta a la que lleva el botón "Abrir"; sin ruta, la sección es solo informativa. */
  path?: string;
}

const SECTIONS: GuideSection[] = [
  { id: 'workout', Icon: IconDumbbell, path: '/' },
  { id: 'tools', Icon: Calculator, path: undefined },
  { id: 'rest', Icon: IconTimer },
  { id: 'routines', Icon: IconCalendar, path: '/routines' },
  { id: 'cardio', Icon: IconShoe, path: '/cardio' },
  { id: 'history', Icon: IconHistory, path: '/history' },
  { id: 'stats', Icon: IconChart, path: '/stats' },
  { id: 'measurements', Icon: IconRuler, path: '/user-stats' },
  { id: 'wearables', Icon: IconWatch, path: '/wearables' },
  { id: 'offline', Icon: CloudOff },
  { id: 'settings', Icon: IconGear, path: '/settings' },
];

const STEPS = ['step1', 'step2', 'step3'] as const;

export function GuidePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const setGuideSeen = useSettingsStore((s) => s.setGuideSeen);
  // La primera sección abierta da pista de que las tarjetas se despliegan.
  const [open, setOpen] = useState<string | null>('workout');

  // i18next devuelve arrays con returnObjects; el fallback evita romper si falta la clave.
  const tips = t('guide.tips', { returnObjects: true }) as string[];

  // Con haberla abierto basta: la app no vuelve a redirigir aquí al arrancar.
  useEffect(() => {
    setGuideSeen(true);
  }, [setGuideSeen]);

  const handleFinish = () => {
    setGuideSeen(true);
    navigate('/');
  };

  return (
    <Layout>
      <div className="space-y-6 pb-8">
        <header className="rounded-card bg-surface border border-line p-4">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-pill bg-accent text-accent-fg">
              <IconBook className="h-5 w-5" />
            </span>
            {/* El título ya está en la cabecera; aquí basta la bajada. */}
            <p className="min-w-0 text-sm text-fg-muted">{t('guide.subtitle')}</p>
          </div>
        </header>

        {/* Quickstart: los 3 pasos del primer entreno */}
        <section>
          <SectionHeader title={t('guide.quickstart')} />
          <ol className="space-y-2">
            {STEPS.map((step, i) => (
              <li
                key={step}
                className="flex gap-3 rounded-card bg-surface border border-line p-3.5"
              >
                <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-pill bg-accent font-display text-sm font-bold text-accent-fg">
                  {i + 1}
                </span>
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold text-fg">{t(`guide.${step}_title`)}</h3>
                  <p className="mt-0.5 text-sm text-fg-muted">{t(`guide.${step}_desc`)}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        {/* Acordeón: una tarjeta por pantalla de la app */}
        <section>
          <SectionHeader title={t('guide.sections_title')} />
          <div className="space-y-2">
            {SECTIONS.map(({ id, Icon, path }) => {
              const isOpen = open === id;
              const bullets = t(`guide.${id}.bullets`, { returnObjects: true }) as string[];
              return (
                <div
                  key={id}
                  className="rounded-card bg-surface border border-line overflow-hidden"
                >
                  <button
                    type="button"
                    onClick={() => setOpen(isOpen ? null : id)}
                    aria-expanded={isOpen}
                    aria-controls={`guide-panel-${id}`}
                    className="flex min-h-11 w-full items-center gap-3 p-3.5 text-left active:opacity-70"
                  >
                    <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-pill bg-accent/12">
                      <Icon className="h-4 w-4 text-accent" />
                    </span>
                    <span className="flex-1 text-sm font-semibold text-fg">
                      {t(`guide.${id}.title`)}
                    </span>
                    <ChevronDown
                      className={`h-4 w-4 flex-shrink-0 text-fg-subtle transition-transform ${
                        isOpen ? 'rotate-180' : ''
                      }`}
                    />
                  </button>

                  {isOpen && (
                    <div id={`guide-panel-${id}`} className="px-3.5 pb-3.5">
                      <ul className="space-y-2 border-t border-line pt-3">
                        {(Array.isArray(bullets) ? bullets : []).map((text) => (
                          <li key={text} className="flex gap-2 text-sm text-fg-muted">
                            <span
                              aria-hidden="true"
                              className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-accent"
                            />
                            <span>{text}</span>
                          </li>
                        ))}
                      </ul>
                      {path && (
                        <button
                          type="button"
                          onClick={() => navigate(path)}
                          className="mt-3 flex min-h-11 w-full items-center justify-between gap-2 rounded-md border border-line bg-surface-2 px-3 text-sm text-accent active:scale-[0.99] transition-transform"
                        >
                          <span>{t('guide.open')}</span>
                          <ChevronRight className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* Trucos sueltos */}
        <section>
          <SectionHeader title={t('guide.tips_title')} />
          <ul className="space-y-2">
            {(Array.isArray(tips) ? tips : []).map((tip) => (
              <li
                key={tip}
                className="flex gap-3 rounded-card bg-surface border border-line p-3.5 text-sm text-fg-muted"
              >
                <Lightbulb className="h-4 w-4 flex-shrink-0 text-accent" />
                <span>{tip}</span>
              </li>
            ))}
          </ul>
        </section>

        <Button variant="primary" onClick={handleFinish} className="w-full">
          {t('guide.finish')}
        </Button>
      </div>
    </Layout>
  );
}
