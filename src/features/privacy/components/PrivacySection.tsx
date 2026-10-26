import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { useAuthStore } from '@features/auth/stores/authStore';
import { ConfirmDialog, NavRow, SectionHeader } from '@shared/components/ui';
import { Download, FileContent, Loader, Trash2 } from '@shared/components/icons';
import { devError } from '@shared/lib/devtools';
import { fetchAccountSnapshot, requestAccountDeletion } from '../data/accountData';
import { buildAccountExport, exportFileName } from '../utils/fullExport';
import { saveTextFile } from '../utils/saveFile';

/**
 * Bloque de Ajustes con los derechos que se ejercen desde la app: leer los
 * documentos, descargar los datos y borrar la cuenta.
 *
 * Estaba todo prometido en la política de privacidad y nada de esto existía: ni
 * enlace a los documentos, ni exportación completa, ni borrado. Un derecho que
 * solo se ejerce escribiendo un correo es un derecho que depende de que alguien
 * lo lea.
 */
export function PrivacySection() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const signOut = useAuthStore((s) => s.signOut);

  const [exporting, setExporting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleExport = async () => {
    if (!user || exporting) return;
    setExporting(true);
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
        // Se ha exportado, pero no todo. Decirlo es obligatorio: un fichero
        // incompleto que parece completo es peor que un error.
        toast.warning(t('privacy.export_incomplete', { tables: failed.join(', ') }));
      } else {
        toast.success(t('privacy.export_ok'));
      }
    } catch (err) {
      devError('[Privacidad] Error exportando la cuenta:', err);
      toast.error(t('privacy.export_error'));
    } finally {
      setExporting(false);
    }
  };

  const handleDelete = async () => {
    if (deleting) return;
    setDeleting(true);
    try {
      const { error } = await requestAccountDeletion();
      if (error) {
        toast.error(t('privacy.delete_error'));
        devError('[Privacidad] Error borrando la cuenta:', error);
        return;
      }
      setConfirmDelete(false);
      toast.success(t('privacy.delete_ok'));
      // La cuenta ya no existe: cerrar sesión deja el cliente sin credenciales
      // y limpia caché, tokens y estado local. Las tareas de subida fallarán
      // (el usuario ya no está) y el registro las ignora a propósito.
      await signOut();
      navigate('/login', { replace: true });
    } catch (err) {
      devError('[Privacidad] Error borrando la cuenta:', err);
      toast.error(t('privacy.delete_error'));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <section>
      <SectionHeader title={t('settings.privacy')} />
      <div className="glass-2 rounded-card overflow-hidden">
        <NavRow
          icon={<FileContent className="w-4 h-4" />}
          label={t('settings.privacy_policy')}
          onClick={() => navigate('/legal/privacy')}
        />
        <NavRow
          icon={<FileContent className="w-4 h-4" />}
          label={t('settings.terms')}
          onClick={() => navigate('/legal/terms')}
          divider
        />
        <NavRow
          icon={
            exporting ? (
              <Loader className="w-4 h-4 animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )
          }
          label={t('settings.export_data')}
          desc={t('settings.export_data_desc')}
          onClick={() => void handleExport()}
          divider
        />
        <NavRow
          icon={<Trash2 className="w-4 h-4" />}
          label={t('settings.delete_account')}
          desc={t('settings.delete_account_desc')}
          onClick={() => setConfirmDelete(true)}
          divider
        />
      </div>

      <ConfirmDialog
        open={confirmDelete}
        title={t('privacy.delete_title')}
        description={t('privacy.delete_body', { email: user?.email ?? '' })}
        confirmLabel={deleting ? t('privacy.deleting') : t('privacy.delete_confirm')}
        onConfirm={() => void handleDelete()}
        onCancel={() => setConfirmDelete(false)}
        icon={<Trash2 className="w-5 h-5" />}
      />

      {/* `aria-live` para que el cambio de estado del borrado no pase
          desapercibido a un lector de pantalla. */}
      <p className="mt-2 px-1 text-xs text-fg-subtle" aria-live="polite">
        {deleting ? t('privacy.deleting') : t('settings.delete_account_hint')}
      </p>
    </section>
  );
}
