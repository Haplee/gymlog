import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Layout } from '@app/components/Layout';
import { useAuthStore } from '@features/auth/stores/authStore';
import { clearQueryAndBrowserCaches } from '@app/userDataCleanup';
import { useOutboxStore } from '@shared/stores/outboxStore';
import {
  Button,
  Input,
  Modal,
  PageHeader,
  SectionHeader,
  SettingRow,
  ConfirmDialog,
} from '@shared/components/ui';
import {
  Cloud,
  CloudCross,
  Database,
  Download,
  FileContent,
  Loader,
  Refresh,
  Trash2,
  WifiOff,
} from '@shared/components/icons';
import { devError } from '@shared/lib/devtools';
import {
  clearOutboxForUser,
  discardPendingWorkout,
  flushWorkoutOutbox,
  getPendingWorkouts,
  retryPendingWorkout,
  type OutboxWorkout,
} from '@shared/lib/workoutOutbox';
import {
  checkAccountDeletionAvailability,
  deleteDataCategory,
  fetchAccountCounts,
  fetchAccountSnapshot,
  fetchExerciseNames,
  requestAccountDeletion,
  DATA_CATEGORY_TABLES,
  type AccountCounts,
  type AccountDeletionAvailability,
  type DataCategoryId,
} from '../data/accountData';
import { hasHealthConsent, readHealthConsent, revokeHealthConsent } from '../consent/healthConsent';
import {
  buildAccountExport,
  buildWorkoutCsv,
  exportFileName,
  workoutCsvFileName,
} from '../utils/fullExport';
import { saveTextFile } from '../utils/saveFile';

/** Color del estado de red: verde conectado, ámbar sin conexión. */
function SyncStatus({ online }: { online: boolean }) {
  const { t } = useTranslation();
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-xs ${online ? 'text-success' : 'text-warning'}`}
    >
      {online ? <Cloud className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
      {online ? t('privacy.sync_online') : t('privacy.sync_offline')}
    </span>
  );
}

function formatDate(iso: string, language: string): string {
  try {
    return new Date(iso).toLocaleString(language, { dateStyle: 'medium', timeStyle: 'short' });
  } catch {
    return iso;
  }
}

/**
 * Motivo para enseñar bajo el resumen, o `null` si no hay nada que contar.
 *
 * Hay dos fallos distintos: la consulta entera (sin red, RLS) y las tablas
 * sueltas que el servidor no dejó contar. Los dos importan, pero se dicen por
 * separado — «no se pudo contar nada» no es lo mismo que «faltan tres tablas».
 */
function countsFailure(counts: AccountCounts | null, error: unknown): string | null {
  if (error) return error instanceof Error ? error.message : String(error);
  if (!counts) return null;
  const failed = Object.keys(counts.errors);
  return failed.length > 0 ? failed.join(', ') : null;
}

/**
 * Centro de privacidad y datos.
 *
 * Reúne en un solo sitio lo que antes estaba repartido entre una política que
 * prometía derechos y una copia de seguridad que solo cubría el historial:
 * cuánto hay de verdad, qué queda sin subir, cómo llevárselo y cómo borrarlo
 * por partes o entero.
 *
 * Dos reglas que se respetan en toda la pantalla:
 * - **Nada se borra sin decir qué se borra.** Cada acción destructiva abre una
 *   confirmación con la consecuencia concreta, no un «¿seguro?».
 * - **No se promete lo que el servidor no hace.** El borrado de cuenta se
 *   comprueba contra la Edge Function; si no está desplegada, se dice y se
 *   ofrece la vía por correo en vez de un botón que devuelve 404.
 */
export function PrivacyCenterPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const signOut = useAuthStore((s) => s.signOut);

  const refreshOutboxCounter = useOutboxStore((s) => s.refresh);

  const [syncing, setSyncing] = useState(false);
  const [online, setOnline] = useState(() =>
    typeof navigator === 'undefined' ? true : navigator.onLine,
  );
  const [busyAction, setBusyAction] = useState(false);
  const [exporting, setExporting] = useState<'json' | 'csv' | null>(null);

  const [confirmAction, setConfirmAction] = useState<
    | { kind: 'category'; category: DataCategoryId }
    | { kind: 'outbox-entry'; entry: OutboxWorkout }
    | { kind: 'outbox-all' }
    | { kind: 'local-cache' }
    | { kind: 'health-consent' }
    | null
  >(null);

  const [availability, setAvailability] = useState<AccountDeletionAvailability | 'checking'>(
    'checking',
  );
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [typedEmail, setTypedEmail] = useState('');
  const [deleting, setDeleting] = useState(false);

  const [consentRevision, setConsentRevision] = useState(0);

  const userId = user?.id;

  /**
   * El consentimiento se lee de `localStorage` durante el render (es una
   * lectura barata) y no con un `setState` dentro de un efecto: así no hay un
   * fotograma con la fila de consentimiento en el estado equivocado.
   */
  const healthConsent = useMemo(() => {
    // `consentRevision` no se lee: existe para volver a leer el consentimiento
    // después de retirarlo, que es lo único que puede cambiarlo desde aquí.
    void consentRevision;
    return userId && hasHealthConsent(userId) ? readHealthConsent(userId) : null;
  }, [userId, consentRevision]);

  // Los tres bloques se leen con TanStack Query, no con un efecto que llame a
  // `setState`: al invalidar la caché tras un borrado el recuento se refresca
  // solo, dos visitas seguidas no repiten las mismas consultas y no queda un
  // «cargando» colgado si la pantalla se desmonta a mitad.
  const countsQuery = useQuery({
    queryKey: ['privacyCounts', userId],
    queryFn: () => fetchAccountCounts(userId as string),
    enabled: Boolean(userId),
    staleTime: 30_000,
  });

  const queueQuery = useQuery({
    queryKey: ['privacyOutbox', userId],
    queryFn: () => getPendingWorkouts(userId as string),
    enabled: Boolean(userId),
  });

  // El catálogo solo hace falta para poner nombre a las series del CSV y a los
  // entrenos pendientes. Se cachea: no cambia entre pantallas.
  const namesQuery = useQuery({
    queryKey: ['privacyExerciseNames'],
    queryFn: fetchExerciseNames,
    staleTime: 5 * 60_000,
  });

  const counts = countsQuery.data ?? null;
  const countsError = countsFailure(counts, countsQuery.error);
  const loadingCounts = countsQuery.isFetching;
  const queue = queueQuery.data ?? [];
  const totalPending = queue.length;
  const exerciseNames = namesQuery.data ?? {};

  const refreshQueue = useCallback(async () => {
    await queueQuery.refetch();
    if (userId) void refreshOutboxCounter(userId);
  }, [queueQuery, refreshOutboxCounter, userId]);

  const refreshCounts = useCallback(async () => {
    await countsQuery.refetch();
  }, [countsQuery]);

  useEffect(() => {
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    void checkAccountDeletionAvailability().then((result) => {
      if (!cancelled) setAvailability(result);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const categoryCount = useCallback(
    (category: DataCategoryId): number => {
      if (!counts) return 0;
      // Suma de todas las tablas de la categoría: es exactamente el número de
      // filas que borrará la acción, no solo la tabla «principal». Un recuento
      // que no coincide con lo que se borra es una promesa incumplida.
      return DATA_CATEGORY_TABLES[category].reduce(
        (sum, table) => sum + (counts.counts[table] ?? 0),
        0,
      );
    },
    [counts],
  );

  const handleSync = async () => {
    if (!userId || syncing) return;
    setSyncing(true);
    try {
      const flushed = await flushWorkoutOutbox(userId);
      await Promise.all([refreshQueue(), refreshCounts()]);
      if (flushed > 0) {
        queryClient.invalidateQueries();
        toast.success(t('privacy.sync_now_ok', { count: flushed }));
      } else {
        toast.info(t('privacy.sync_now_none'));
      }
    } catch (err) {
      devError('[Privacidad] Error sincronizando la cola:', err);
      toast.error(t('privacy.sync_error'));
    } finally {
      setSyncing(false);
    }
  };

  const exportJson = async () => {
    if (!user || exporting) return;
    setExporting('json');
    try {
      const snapshot = await fetchAccountSnapshot(user);
      const json = buildAccountExport({
        exportedAt: new Date().toISOString(),
        user: {
          id: user.id,
          email: user.email ?? null,
          createdAt: user.created_at ?? null,
          lastSignInAt: user.last_sign_in_at ?? null,
          provider: user.app_metadata?.provider ?? null,
        },
        snapshot,
      });
      await saveTextFile(exportFileName(new Date()), json, 'application/json');

      const failed = Object.keys(snapshot.errors ?? {});
      if (failed.length > 0) {
        toast.warning(t('privacy.export_incomplete', { tables: failed.join(', ') }));
      } else {
        toast.success(t('privacy.export_ok'));
      }
    } catch (err) {
      devError('[Privacidad] Error exportando la cuenta:', err);
      toast.error(t('privacy.export_error'));
    } finally {
      setExporting(null);
    }
  };

  const exportCsv = async () => {
    if (!user || exporting) return;
    setExporting('csv');
    try {
      const snapshot = await fetchAccountSnapshot(user);
      const names =
        Object.keys(exerciseNames).length > 0 ? exerciseNames : await fetchExerciseNames();
      const csv = buildWorkoutCsv(snapshot, names);
      const hasWorkouts = (snapshot.tables.workouts ?? []).length > 0;
      if (!hasWorkouts) {
        toast.info(t('privacy.export_csv_empty'));
        return;
      }
      await saveTextFile(workoutCsvFileName(new Date()), csv, 'text/csv;charset=utf-8');
      toast.success(t('privacy.export_csv_ok'));
    } catch (err) {
      devError('[Privacidad] Error exportando el CSV:', err);
      toast.error(t('privacy.export_csv_error'));
    } finally {
      setExporting(null);
    }
  };

  const runConfirmedAction = async () => {
    if (!user || !confirmAction || busyAction) return;
    const action = confirmAction;
    setBusyAction(true);
    try {
      if (action.kind === 'category') {
        const result = await deleteDataCategory(action.category, user.id);
        const failed = Object.keys(result.errors);
        if (failed.length > 0) {
          toast.error(t('privacy.delete_category_partial', { tables: failed.join(', ') }));
        } else {
          toast.success(t('privacy.delete_category_ok'));
        }
        await refreshCounts();
        queryClient.invalidateQueries();
      } else if (action.kind === 'outbox-entry') {
        const discarded = await discardPendingWorkout(action.entry.id, user.id);
        await refreshQueue();
        if (discarded) toast.success(t('privacy.pending_discarded'));
        else toast.error(t('privacy.outbox_error'));
      } else if (action.kind === 'outbox-all') {
        const removed = await clearOutboxForUser(user.id);
        await refreshQueue();
        toast.success(t('privacy.pending_cleared', { count: removed }));
      } else if (action.kind === 'local-cache') {
        await clearQueryAndBrowserCaches();
        queryClient.invalidateQueries();
        toast.success(t('privacy.local_clear_ok'));
      } else if (action.kind === 'health-consent') {
        revokeHealthConsent(user.id);
        setConsentRevision((n) => n + 1);
        toast.success(t('privacy.consent_revoke_ok'));
      }
      setConfirmAction(null);
    } catch (err) {
      devError('[Privacidad] Error ejecutando la acción:', err);
      toast.error(t('privacy.action_error'));
    } finally {
      setBusyAction(false);
    }
  };

  const retry = async (entry: OutboxWorkout) => {
    if (!user) return;
    const ok = await retryPendingWorkout(entry.id, user.id);
    if (!ok) {
      toast.error(t('privacy.outbox_error'));
      return;
    }
    await handleSync();
  };

  const handleDeleteAccount = async () => {
    if (deleting) return;
    setDeleting(true);
    try {
      const result = await requestAccountDeletion();
      if (result.error) {
        if (result.reason === 'not-deployed') {
          setAvailability('not-deployed');
          setDeleteOpen(false);
          toast.error(t('privacy.delete_unavailable_toast'));
        } else {
          toast.error(t('privacy.delete_error'));
        }
        devError('[Privacidad] Error borrando la cuenta:', result.error);
        return;
      }
      setDeleteOpen(false);
      toast.success(t('privacy.delete_ok'));
      // La cuenta ya no existe: cerrar sesión deja el cliente sin credenciales
      // y limpia caché, tokens y estado local.
      await signOut();
      navigate('/login', { replace: true });
    } catch (err) {
      devError('[Privacidad] Error borrando la cuenta:', err);
      toast.error(t('privacy.delete_error'));
    } finally {
      setDeleting(false);
    }
  };

  const emailConfirmed =
    Boolean(user?.email) && typedEmail.trim().toLowerCase() === user?.email?.toLowerCase();

  const confirmCopy = (() => {
    if (!confirmAction) return { title: '', body: '', confirm: '', onConfirm: () => undefined };
    switch (confirmAction.kind) {
      case 'category':
        return {
          title: t('privacy.delete_category_title', {
            category: t(`privacy.category_${confirmAction.category}`),
          }),
          body: t('privacy.delete_category_body', {
            count: categoryCount(confirmAction.category),
            category: t(`privacy.category_${confirmAction.category}`),
          }),
          confirm: t('privacy.delete_category_confirm'),
          onConfirm: () => void runConfirmedAction(),
        };
      case 'outbox-entry':
        return {
          title: t('privacy.pending_discard_title'),
          body: t('privacy.pending_discard_body', {
            date: formatDate(confirmAction.entry.startedAt, i18n.language),
          }),
          confirm: t('privacy.pending_discard_confirm'),
          onConfirm: () => void runConfirmedAction(),
        };
      case 'outbox-all':
        return {
          title: t('privacy.pending_clear_title'),
          body: t('privacy.pending_clear_body', { count: totalPending }),
          confirm: t('privacy.pending_clear_confirm'),
          onConfirm: () => void runConfirmedAction(),
        };
      case 'local-cache':
        return {
          title: t('privacy.local_clear_title'),
          body: t('privacy.local_clear_body'),
          confirm: t('privacy.local_clear_confirm'),
          onConfirm: () => void runConfirmedAction(),
        };
      case 'health-consent':
        return {
          title: t('privacy.consent_revoke_title'),
          body: t('privacy.consent_revoke_body'),
          confirm: t('privacy.consent_revoke_confirm'),
          onConfirm: () => void runConfirmedAction(),
        };
    }
  })();

  return (
    <Layout>
      <div className="space-y-4 pb-24">
        <PageHeader
          title={t('privacy.center_title')}
          subtitle={t('privacy.center_subtitle')}
          onBack={() => navigate('/settings')}
          backLabel={t('common.back')}
          className="mb-0"
        />

        {/* Resumen real ---------------------------------------------------- */}
        <section>
          <SectionHeader
            title={t('privacy.summary_title')}
            subtitle={t('privacy.summary_desc')}
            action={
              <Button
                variant="icon"
                size="sm"
                onClick={() => void refreshCounts()}
                disabled={loadingCounts}
                aria-label={t('privacy.refresh')}
              >
                <Refresh className={`h-4 w-4 ${loadingCounts ? 'animate-spin' : ''}`} />
              </Button>
            }
          />
          <div className="card">
            {loadingCounts && !counts ? (
              <div className="flex items-center justify-center gap-2 py-8 text-sm text-fg-subtle">
                <Loader className="h-4 w-4 animate-spin" />
                {t('privacy.loading')}
              </div>
            ) : (
              <>
                <SettingRow
                  label={t('privacy.account_label')}
                  desc={user?.email ?? t('privacy.account_no_email')}
                  control={
                    <span className="max-w-[9rem] truncate text-xs text-fg-subtle">{userId}</span>
                  }
                  icon={<Database className="h-4 w-4" />}
                />
                {(
                  [
                    'workouts',
                    'measurements',
                    'cardio',
                    'health',
                    'routines',
                    'exerciseMeta',
                    'coach',
                    'devices',
                  ] as DataCategoryId[]
                ).map((category, index, all) => {
                  const count = categoryCount(category);
                  return (
                    <SettingRow
                      key={category}
                      label={t(`privacy.category_${category}`)}
                      desc={t(`privacy.category_${category}_desc`)}
                      divider={index < all.length - 1}
                      control={
                        <div className="flex items-center gap-3">
                          <span className="tabular text-sm text-fg">{counts ? count : '—'}</span>
                          <button
                            type="button"
                            onClick={() => setConfirmAction({ kind: 'category', category })}
                            disabled={!counts || count === 0}
                            aria-label={t('privacy.delete_category_action', {
                              category: t(`privacy.category_${category}`),
                            })}
                            className="flex h-9 w-9 items-center justify-center rounded-full text-fg-subtle transition-colors hover:bg-hover hover:text-error focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:pointer-events-none disabled:opacity-30"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      }
                    />
                  );
                })}
              </>
            )}
          </div>
          {countsError ? (
            <p className="mt-2 px-1 text-xs text-warning" role="status">
              {t('privacy.summary_error', { tables: countsError })}
            </p>
          ) : null}
        </section>

        {/* Sincronización y cola offline ----------------------------------- */}
        <section>
          <SectionHeader
            title={t('privacy.sync_title')}
            subtitle={t('privacy.sync_desc')}
            action={<SyncStatus online={online} />}
          />
          <div className="card">
            <div className="flex items-center justify-between gap-3 px-4 py-3.5">
              <div className="min-w-0">
                <div className="text-sm text-fg">
                  {totalPending === 0
                    ? t('privacy.sync_none')
                    : t('privacy.sync_pending', { count: totalPending })}
                </div>
                <p className="mt-0.5 text-xs text-fg-subtle">{t('privacy.sync_pending_hint')}</p>
              </div>
              <div className="flex flex-shrink-0 items-center gap-2">
                {totalPending > 0 ? (
                  <button
                    type="button"
                    onClick={() => setConfirmAction({ kind: 'outbox-all' })}
                    className="flex h-9 items-center rounded-pill px-3 text-xs font-medium text-fg-muted hover:bg-hover hover:text-error focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                  >
                    {t('privacy.pending_clear')}
                  </button>
                ) : null}
                <Button
                  size="sm"
                  variant="secondary"
                  loading={syncing}
                  disabled={!online || totalPending === 0}
                  onClick={() => void handleSync()}
                >
                  {t('privacy.sync_now')}
                </Button>
              </div>
            </div>

            {queueQuery.isPending ? (
              <div className="border-t border-line px-4 py-3 text-xs text-fg-subtle">
                {t('privacy.pending_loading')}
              </div>
            ) : null}

            {queue.map((entry) => {
              const name =
                (entry.exerciseId ? exerciseNames[entry.exerciseId] : null) ||
                entry.customExerciseName ||
                t('privacy.pending_unknown_exercise');
              return (
                <div
                  key={entry.id}
                  className="flex items-center gap-3 border-t border-line px-4 py-3"
                >
                  <CloudCross className="h-4 w-4 flex-shrink-0 text-warning" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm text-fg">{name}</div>
                    <div className="text-xs text-fg-subtle">
                      {formatDate(entry.startedAt, i18n.language)}
                      {entry.failed ? ` · ${t('privacy.pending_failed')}` : ''}
                    </div>
                  </div>
                  <div className="flex flex-shrink-0 gap-1">
                    <button
                      type="button"
                      onClick={() => void retry(entry)}
                      className="flex h-9 items-center rounded-pill px-2.5 text-xs font-medium text-fg-muted hover:bg-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                    >
                      {t('privacy.pending_retry')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmAction({ kind: 'outbox-entry', entry })}
                      aria-label={t('privacy.pending_discard')}
                      className="flex h-9 w-9 items-center justify-center rounded-full text-fg-subtle hover:bg-hover hover:text-error focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
          <p className="mt-2 px-1 text-xs text-fg-subtle">{t('privacy.sync_outbox_note')}</p>
        </section>

        {/* Descargas ------------------------------------------------------- */}
        <section>
          <SectionHeader title={t('privacy.export_title')} subtitle={t('privacy.export_desc')} />
          <div className="grid gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => void exportJson()}
              disabled={exporting !== null}
              className="glass-2 rounded-card flex items-start gap-3 p-4 text-left transition-colors hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-60"
            >
              <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-accent text-accent-fg">
                {exporting === 'json' ? (
                  <Loader className="h-4 w-4 animate-spin" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-medium text-fg">
                  {t('privacy.export_json')}
                </span>
                <span className="mt-0.5 block text-xs text-fg-subtle">
                  {t('privacy.export_json_desc')}
                </span>
              </span>
            </button>
            <button
              type="button"
              onClick={() => void exportCsv()}
              disabled={exporting !== null}
              className="glass-2 rounded-card flex items-start gap-3 p-4 text-left transition-colors hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-60"
            >
              <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-accent text-accent-fg">
                {exporting === 'csv' ? (
                  <Loader className="h-4 w-4 animate-spin" />
                ) : (
                  <FileContent className="h-4 w-4" />
                )}
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-medium text-fg">{t('privacy.export_csv')}</span>
                <span className="mt-0.5 block text-xs text-fg-subtle">
                  {t('privacy.export_csv_desc')}
                </span>
              </span>
            </button>
          </div>
        </section>

        {/* Copias locales -------------------------------------------------- */}
        <section>
          <SectionHeader title={t('privacy.local_title')} subtitle={t('privacy.local_desc')} />
          <div className="glass-2 rounded-card overflow-hidden">
            <SettingRow
              label={t('privacy.local_clear')}
              desc={t('privacy.local_clear_desc')}
              icon={<Database className="h-4 w-4" />}
              control={
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setConfirmAction({ kind: 'local-cache' })}
                >
                  {t('privacy.local_clear_confirm')}
                </Button>
              }
              stacked
            />
            {healthConsent ? (
              <SettingRow
                label={t('privacy.consent_title')}
                desc={t('privacy.consent_accepted', {
                  date: formatDate(healthConsent.acceptedAt, i18n.language),
                })}
                icon={<Cloud className="h-4 w-4" />}
                divider={false}
                control={
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => setConfirmAction({ kind: 'health-consent' })}
                  >
                    {t('privacy.consent_revoke')}
                  </Button>
                }
              />
            ) : null}
          </div>
          <p className="mt-2 px-1 text-xs text-fg-subtle">{t('privacy.local_note')}</p>
        </section>

        {/* Documentos ------------------------------------------------------ */}
        <section>
          <SectionHeader title={t('privacy.docs_title')} />
          <div className="glass-2 rounded-card overflow-hidden">
            <SettingRow
              label={t('settings.privacy_policy')}
              icon={<FileContent className="h-4 w-4" />}
              control={
                <button
                  type="button"
                  onClick={() => navigate('/legal/privacy')}
                  className="flex h-9 items-center rounded-pill px-3 text-xs font-medium text-accent hover:bg-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                >
                  {t('privacy.docs_open')}
                </button>
              }
            />
            <SettingRow
              label={t('settings.terms')}
              icon={<FileContent className="h-4 w-4" />}
              control={
                <button
                  type="button"
                  onClick={() => navigate('/legal/terms')}
                  className="flex h-9 items-center rounded-pill px-3 text-xs font-medium text-accent hover:bg-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                >
                  {t('privacy.docs_open')}
                </button>
              }
            />
            <SettingRow
              label={t('settings.third_party_notices')}
              icon={<FileContent className="h-4 w-4" />}
              divider={false}
              control={
                <button
                  type="button"
                  onClick={() => navigate('/legal/notices')}
                  className="flex h-9 items-center rounded-pill px-3 text-xs font-medium text-accent hover:bg-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                >
                  {t('privacy.docs_open')}
                </button>
              }
            />
          </div>
        </section>

        {/* Borrado de cuenta ---------------------------------------------- */}
        <section>
          <SectionHeader
            title={t('privacy.delete_section_title')}
            subtitle={t('privacy.delete_section_desc')}
          />
          <div className="rounded-card border border-error/30 bg-error/5 p-4">
            {availability === 'not-deployed' ? (
              <div className="space-y-2">
                <p className="text-sm font-medium text-fg">{t('privacy.delete_unavailable')}</p>
                <p className="text-xs text-fg-subtle">{t('privacy.delete_unavailable_body')}</p>
                <a
                  href={`mailto:fvidalmateo@gmail.com?subject=${encodeURIComponent(
                    t('privacy.delete_mail_subject'),
                  )}`}
                  className="inline-flex h-10 items-center rounded-pill bg-error px-4 text-sm font-semibold text-accent-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                >
                  {t('privacy.delete_mail')}
                </a>
              </div>
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm text-fg">{t('privacy.delete_ready')}</p>
                  <p className="mt-0.5 text-xs text-fg-subtle">
                    {availability === 'checking'
                      ? t('privacy.delete_checking')
                      : t('privacy.delete_hint')}
                  </p>
                </div>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => setDeleteOpen(true)}
                  disabled={availability === 'checking'}
                >
                  {t('settings.delete_account')}
                </Button>
              </div>
            )}
          </div>
        </section>
      </div>

      <ConfirmDialog
        open={confirmAction !== null}
        title={confirmCopy.title}
        description={confirmCopy.body}
        confirmLabel={busyAction ? t('privacy.deleting') : confirmCopy.confirm}
        onConfirm={confirmCopy.onConfirm}
        onCancel={() => {
          if (!busyAction) setConfirmAction(null);
        }}
        icon={<Trash2 className="h-5 w-5" />}
      />

      <Modal
        open={deleteOpen}
        onClose={() => {
          if (!deleting) setDeleteOpen(false);
        }}
        title={t('privacy.delete_title')}
        variant="danger"
        icon={<Trash2 className="h-5 w-5" />}
      >
        <div className="space-y-4">
          <p className="text-sm text-fg-muted">
            {t('privacy.delete_body', { email: user?.email ?? '' })}
          </p>
          <Input
            label={t('privacy.delete_type_label', { email: user?.email ?? '' })}
            value={typedEmail}
            onChange={(e) => setTypedEmail(e.target.value)}
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            placeholder={user?.email ?? ''}
            disabled={deleting}
          />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setDeleteOpen(false)} disabled={deleting}>
              {t('common.cancel')}
            </Button>
            <Button
              variant="danger"
              loading={deleting}
              disabled={!emailConfirmed}
              onClick={() => void handleDeleteAccount()}
            >
              {deleting ? t('privacy.deleting') : t('privacy.delete_confirm')}
            </Button>
          </div>
        </div>
      </Modal>
    </Layout>
  );
}
