import { useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { NavRow, SectionHeader } from '@shared/components/ui';
import { FileContent, Fingerprint } from '@shared/components/icons';

/**
 * Entrada de Ajustes al centro de privacidad.
 *
 * Antes este bloque hacía el trabajo: exportaba y borraba la cuenta en línea.
 * Ahora Ajustes solo navega —una lista de ajustes no es sitio para un borrado
 * irreversible— y el centro reúne el resumen real, la cola offline, las
 * descargas y los borrados por categoría con su confirmación.
 *
 * Los documentos se quedan aquí porque son de lectura, no una acción sobre los
 * datos: quien entra buscando el contrato lo encuentra sin pasar por el centro.
 */
export function PrivacySection() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <section>
      <SectionHeader title={t('settings.privacy')} />
      <div className="glass-2 rounded-card overflow-hidden">
        <NavRow
          icon={<Fingerprint className="w-4 h-4" />}
          label={t('privacy.center_title')}
          desc={t('privacy.center_desc')}
          onClick={() => navigate('/settings/privacy')}
        />
        <NavRow
          icon={<FileContent className="w-4 h-4" />}
          label={t('settings.privacy_policy')}
          onClick={() => navigate('/legal/privacy')}
          divider
        />
        <NavRow
          icon={<FileContent className="w-4 h-4" />}
          label={t('settings.terms')}
          onClick={() => navigate('/legal/terms')}
          divider
        />
        <NavRow
          icon={<FileContent className="w-4 h-4" />}
          label={t('settings.third_party_notices')}
          onClick={() => navigate('/legal/notices')}
          divider
        />
      </div>
    </section>
  );
}
