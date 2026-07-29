import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { useMutation } from '@tanstack/react-query';
import { Sparkles, AlertTriangle, Info, CheckCircle2, Stethoscope, Send } from 'lucide-react';
import { toast } from 'sonner';
import { Layout } from '@app/components/Layout';
import { Button, SectionHeader } from '@shared/components/ui';
import { useAuthStore } from '@features/auth/stores/authStore';
import { devError } from '@shared/lib/devtools';
import { callCoach, markSuggestion } from '../api/coach';
import { useCoachStore } from '../stores/coachStore';
import { routeForSuggestion } from '../utils/suggestionTarget';
import {
  CoachError,
  type CoachOutput,
  type CoachInsight,
  type CoachSuggestion,
  type CoachTurn,
} from '../types';

const SEVERITY_ICON = {
  info: Info,
  success: CheckCircle2,
  warning: AlertTriangle,
} as const;

/** Longitud que acepta la Edge Function. Se corta aquí para avisar antes. */
const MAX_MESSAGE = 1000;

function InsightCard({ insight }: { insight: CoachInsight }) {
  const Icon = SEVERITY_ICON[insight.severity];
  // El color va por token, no por hex: el tema claro también tiene que leerse.
  const tone =
    insight.severity === 'warning'
      ? 'text-warning'
      : insight.severity === 'success'
        ? 'text-accent'
        : 'text-fg-muted';

  return (
    <div className="rounded-card bg-surface border border-line p-4">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-fg">
        <Icon className={`w-4 h-4 flex-shrink-0 ${tone}`} aria-hidden="true" />
        {insight.title}
      </h3>
      <p className="mt-1.5 text-sm text-fg-muted">{insight.body}</p>
    </div>
  );
}

function SuggestionCard({ suggestion }: { suggestion: CoachSuggestion }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;

  /**
   * Aplicar NO cambia nada por su cuenta: registra que el usuario la aceptó y
   * lo deja en la pantalla donde ese cambio se hace, con la sugerencia a la
   * vista. Si el marcado falla, el viaje sigue: quedarse quieto por no poder
   * escribir una fila de estado sería peor.
   */
  const decide = (status: 'applied' | 'dismissed') => {
    if (suggestion.id) {
      markSuggestion(suggestion.id, status).catch(devError);
    }
    if (status === 'dismissed') {
      setDismissed(true);
      return;
    }
    navigate(routeForSuggestion(suggestion.kind), { state: { coachSuggestion: suggestion } });
  };

  return (
    <div className="rounded-card bg-surface border border-line p-4">
      <div className="flex items-center gap-2">
        <span className="rounded-pill bg-accent/15 px-2.5 py-0.5 text-xs font-semibold text-accent">
          {t(`coach.kind.${suggestion.kind}`)}
        </span>
        {suggestion.exercise_name && (
          <span className="truncate text-xs text-fg-subtle">{suggestion.exercise_name}</span>
        )}
      </div>
      <p className="mt-2 text-sm text-fg">{suggestion.action}</p>
      <p className="mt-1 text-xs text-fg-muted">{suggestion.rationale}</p>
      <div className="mt-3 flex gap-2">
        <Button size="md" onClick={() => decide('applied')}>
          {t('coach.apply')}
        </Button>
        <Button size="md" variant="secondary" onClick={() => decide('dismissed')}>
          {t('coach.dismiss')}
        </Button>
      </div>
    </div>
  );
}

/** Cuerpo de una respuesta del entrenador: resumen, avisos, ideas y propuestas. */
function CoachAnswer({ output }: { output: CoachOutput }) {
  const { t } = useTranslation();

  return (
    <>
      <p className="rounded-card bg-surface-2 p-4 text-sm text-fg">{output.summary}</p>

      {/* Derivación a profesional: va lo primero y las sugerencias de carga ya
          vienen suprimidas del servidor. */}
      {output.needs_professional && (
        <div className="rounded-card border border-warning bg-warning/10 p-4">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-fg">
            <Stethoscope className="h-4 w-4 text-warning" aria-hidden="true" />
            {t('coach.needs_professional_title')}
          </h2>
          <p className="mt-1.5 text-sm text-fg-muted">{t('coach.needs_professional_body')}</p>
        </div>
      )}

      {output.insights.length > 0 && (
        <section>
          <SectionHeader title={t('coach.insights_title')} />
          <div className="space-y-2">
            {output.insights.map((insight) => (
              <InsightCard key={insight.title} insight={insight} />
            ))}
          </div>
        </section>
      )}

      {output.suggestions.length > 0 && (
        <section>
          <SectionHeader title={t('coach.suggestions_title')} />
          <div className="space-y-2">
            {output.suggestions.map((s, i) => (
              <SuggestionCard key={s.id ?? `${s.kind}-${i}`} suggestion={s} />
            ))}
          </div>
        </section>
      )}
    </>
  );
}

export function CoachPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const enabled = useCoachStore((s) => s.enabled);
  const sync = useCoachStore((s) => s.sync);
  const [output, setOutput] = useState<CoachOutput | null>(null);
  const [turns, setTurns] = useState<CoachTurn[]>([]);
  const [draft, setDraft] = useState('');
  const endOfChatRef = useRef<HTMLDivElement>(null);

  // El servidor manda sobre el espejo local: si el consentimiento no está,
  // aquí no se pinta nada aunque el store diga que sí.
  useEffect(() => {
    if (user?.id) void sync(user.id);
  }, [user?.id, sync]);

  useEffect(() => {
    if (!user) navigate('/login');
  }, [user, navigate]);

  const onCoachError = (e: unknown) => {
    const code = e instanceof CoachError ? e.code : 'unknown';
    toast.error(t(`coach.error.${code}`));
    if (code === 'consent_required') navigate('/settings');
  };

  const analyze = useMutation({
    mutationFn: () => callCoach('weekly'),
    onSuccess: setOutput,
    onError: onCoachError,
  });

  const ask = useMutation({
    mutationFn: (message: string) => callCoach('chat', { message }),
    onSuccess: (answer, message) => {
      setTurns((prev) => [...prev, { id: crypto.randomUUID(), question: message, answer }]);
      setDraft('');
    },
    onError: onCoachError,
  });

  // Al llegar una respuesta, llevar la vista al final de la conversación.
  useEffect(() => {
    if (turns.length > 0) endOfChatRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [turns.length]);

  const send = () => {
    const message = draft.trim();
    if (!message || ask.isPending) return;
    ask.mutate(message);
  };

  if (!enabled) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center gap-4 px-6 py-16 text-center">
          <Sparkles className="h-10 w-10 text-accent" aria-hidden="true" />
          <h1 className="text-lg font-display font-bold text-fg">{t('coach.page_title')}</h1>
          <p className="text-sm text-fg-muted">{t('coach.error.consent_required')}</p>
          <Button onClick={() => navigate('/settings')}>{t('coach.settings.section')}</Button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-4 pb-24">
        <header className="px-1">
          <h1 className="text-xl font-display font-bold text-fg">{t('coach.page_title')}</h1>
          <p className="text-sm text-fg-subtle">{t('coach.page_subtitle')}</p>
        </header>

        {!output && !analyze.isPending && (
          <div className="rounded-card bg-surface border border-line p-6 text-center">
            <Sparkles className="mx-auto h-8 w-8 text-accent" aria-hidden="true" />
            <h2 className="mt-3 text-base font-semibold text-fg">{t('coach.empty_title')}</h2>
            <p className="mt-1 text-sm text-fg-muted">{t('coach.empty_desc')}</p>
          </div>
        )}

        {analyze.isPending && (
          <p className="py-8 text-center text-sm text-fg-muted" role="status" aria-live="polite">
            {t('coach.analyzing')}
          </p>
        )}

        {output && <CoachAnswer output={output} />}

        <Button onClick={() => analyze.mutate()} loading={analyze.isPending} className="w-full">
          {output ? t('coach.regenerate') : t('coach.generate')}
        </Button>

        {/* Conversación. Se apoya en el mismo endpoint con mode='chat', que
            tiene su propia cuota diaria. */}
        <section aria-label={t('coach.chat_title')}>
          <SectionHeader title={t('coach.chat_title')} />

          {turns.length === 0 && !ask.isPending && (
            <p className="px-1 text-sm text-fg-muted">{t('coach.chat_empty')}</p>
          )}

          <div className="space-y-4">
            {turns.map((turn) => (
              <article key={turn.id} className="space-y-2">
                <p className="ml-auto max-w-[85%] rounded-card bg-accent/15 px-4 py-2.5 text-sm text-fg">
                  {turn.question}
                </p>
                <CoachAnswer output={turn.answer} />
              </article>
            ))}
          </div>

          {ask.isPending && (
            <p className="py-4 text-center text-sm text-fg-muted" role="status" aria-live="polite">
              {t('coach.analyzing')}
            </p>
          )}
          <div ref={endOfChatRef} />

          <div className="mt-3 flex items-end gap-2">
            <label htmlFor="coach-chat-input" className="sr-only">
              {t('coach.chat_placeholder')}
            </label>
            <textarea
              id="coach-chat-input"
              rows={2}
              value={draft}
              maxLength={MAX_MESSAGE}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                // Enter envía; Mayús+Enter hace salto de línea. En móvil el
                // teclado manda un Enter normal, de ahí la comprobación.
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              placeholder={t('coach.chat_placeholder')}
              className="min-h-11 flex-1 resize-none rounded-card border border-line bg-surface px-3.5 py-2.5 text-sm text-fg placeholder:text-fg-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            />
            <Button
              size="md"
              variant="icon"
              onClick={send}
              loading={ask.isPending}
              disabled={draft.trim().length === 0}
              aria-label={t('coach.chat_send')}
            >
              <Send className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
        </section>

        {/* Descargo permanente, no un aviso de una sola vez. */}
        <p className="px-2 text-xs leading-relaxed text-fg-subtle">{t('coach.disclaimer')}</p>
      </div>
    </Layout>
  );
}
