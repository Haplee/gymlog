import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/react/shallow';
import { toast } from 'sonner';
import { SectionHeader, SegmentedControl, SettingRow, Toggle } from '@shared/components/ui';
import { useSettingsStore } from '@shared/stores/settingsStore';
import { ACCENT_PRESETS, getAccentPreset } from '@shared/constants/accents';
import { isAppIconSupported, setAppIcon as setAppIconNative } from '@shared/lib/appIcon';
import { playSettingsChime } from '@shared/lib/alarm';
import { devError } from '@shared/lib/devtools';
import { Check, ChevronRight } from '@shared/components/icons';

/**
 * Bloque «Preferencias» de Ajustes: idioma, tema, acento, icono de la app,
 * unidades, sonido y series de calentamiento.
 *
 * Lee el store directamente en vez de recibir quince props: son ajustes, y el
 * store ya es la fuente de verdad. Extraído de `SettingsPage`, que pasaba de
 * las 800 líneas de CLAUDE.md.
 */
export function PreferencesSection() {
  const { t } = useTranslation();
  const {
    sound,
    setSound,
    language,
    setLanguage,
    theme,
    setTheme,
    systemDark,
    unitSystem,
    setUnitSystem,
    showWarmupSets,
    setShowWarmupSets,
    accentColor,
    setAccentColor,
    appIcon,
    setAppIcon,
  } = useSettingsStore(
    useShallow((s) => ({
      sound: s.sound,
      setSound: s.setSound,
      language: s.language,
      setLanguage: s.setLanguage,
      theme: s.theme,
      setTheme: s.setTheme,
      systemDark: s.systemDark,
      unitSystem: s.unitSystem,
      setUnitSystem: s.setUnitSystem,
      showWarmupSets: s.showWarmupSets,
      setShowWarmupSets: s.setShowWarmupSets,
      accentColor: s.accentColor,
      setAccentColor: s.setAccentColor,
      appIcon: s.appIcon,
      setAppIcon: s.setAppIcon,
    })),
  );

  /** El tema efectivo (resolve 'system') decide qué variante de acento pintar. */
  const effectiveTheme = theme === 'system' ? (systemDark ? 'dark' : 'light') : theme;

  /** La paleta de acentos arranca plegada para no alargar la pantalla. */
  const [accentOpen, setAccentOpen] = useState(false);
  const [iconOpen, setIconOpen] = useState(false);

  const applyAppIcon = useCallback(
    async (id: string) => {
      try {
        await setAppIconNative(id);
        setAppIcon(id);
        toast.success(t('settings.app_icon_changed'));
      } catch (e) {
        devError('[Settings] setAppIcon:', e);
        toast.error(t('settings.app_icon_error'));
      }
    },
    [setAppIcon, t],
  );

  // Reutiliza el AudioContext único de `alarm.ts`: crear uno por pulsación
  // agotaba el límite del WebView (~6) y mantenía despierto el pipeline.
  const playFeedbackSound = useCallback(() => {
    playSettingsChime();
  }, []);

  return (
    <section>
      <SectionHeader title={t('settings.preferences')} />
      <div className="glass-2 rounded-card overflow-hidden">
        <SettingRow
          label={t('settings.language')}
          control={
            <SegmentedControl
              options={[
                { value: 'es', label: 'ES' },
                { value: 'en', label: 'EN' },
              ]}
              value={language as 'es' | 'en'}
              onChange={(v) => setLanguage(v)}
              ariaLabel={t('settings.language')}
            />
          }
        />
        <SettingRow
          label={t('settings.theme')}
          control={
            <SegmentedControl
              options={[
                { value: 'system', label: t('settings.theme_system') },
                { value: 'dark', label: t('settings.theme_dark') },
                { value: 'light', label: t('settings.theme_light') },
              ]}
              value={theme}
              onChange={(v) => setTheme(v)}
              ariaLabel={t('settings.theme')}
            />
          }
        />

        {/* El color de acento va en su propia fila (no en el hueco del control
            de una SettingRow) y colapsado: con la paleta completa son
            diecisiete muestras, que abiertas empujaban el resto de ajustes
            fuera de pantalla. Cerrado enseña solo el color activo. */}
        <div className="hairline-separator px-4 py-3.5">
          <button
            type="button"
            onClick={() => setAccentOpen((v) => !v)}
            aria-expanded={accentOpen}
            aria-controls="accent-swatches"
            className="flex w-full items-center gap-3 text-left"
          >
            <div className="min-w-0 flex-1">
              <div className="text-base text-fg">{t('settings.accent')}</div>
              <div className="text-xs mt-0.5 text-fg-subtle">
                {t(`settings.accent_${accentColor}`)}
              </div>
            </div>
            <span
              className="h-7 w-7 flex-shrink-0 rounded-full border border-line"
              style={{ backgroundColor: getAccentPreset(accentColor)[effectiveTheme].primary }}
              aria-hidden="true"
            />
            <ChevronRight
              className={`h-5 w-5 flex-shrink-0 text-fg-subtle transition-transform ${
                accentOpen ? 'rotate-90' : ''
              }`}
              aria-hidden="true"
            />
          </button>
          {accentOpen && (
            <>
              <div className="text-xs mt-3 text-fg-subtle">{t('settings.accent_desc')}</div>
              <div
                id="accent-swatches"
                role="radiogroup"
                aria-label={t('settings.accent')}
                className="mt-2.5 flex flex-wrap gap-2.5"
              >
                {ACCENT_PRESETS.map((preset) => {
                  const isActive = preset.id === accentColor;
                  const swatch = preset[effectiveTheme].primary;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      role="radio"
                      aria-checked={isActive}
                      aria-label={t(`settings.accent_${preset.id}`)}
                      onClick={() => setAccentColor(preset.id)}
                      className={`h-11 w-11 rounded-full transition-transform active:scale-95 ${
                        isActive ? 'ring-2 ring-offset-2 ring-offset-surface ring-fg' : ''
                      }`}
                      style={{ backgroundColor: swatch }}
                    >
                      {isActive && (
                        <Check
                          className="mx-auto h-4 w-4"
                          style={{ color: preset[effectiveTheme].fg }}
                          aria-hidden="true"
                        />
                      )}
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* Icono del lanzador. Solo Android: en web el icono lo congela el
            manifest al instalar la PWA. Va separado del acento porque
            cambiarlo reordena la pantalla de inicio del usuario. */}
        {isAppIconSupported() && (
          <div className="hairline-separator px-4 py-3.5">
            <button
              type="button"
              onClick={() => setIconOpen((v) => !v)}
              aria-expanded={iconOpen}
              aria-controls="app-icon-swatches"
              className="flex w-full items-center gap-3 text-left"
            >
              <div className="min-w-0 flex-1">
                <div className="text-base text-fg">{t('settings.app_icon')}</div>
                <div className="text-xs mt-0.5 text-fg-subtle">
                  {t(`settings.accent_${appIcon}`)}
                </div>
              </div>
              <span
                className="h-7 w-7 flex-shrink-0 rounded-full border border-line"
                style={{ backgroundColor: getAccentPreset(appIcon).dark.primary }}
                aria-hidden="true"
              />
              <ChevronRight
                className={`h-5 w-5 flex-shrink-0 text-fg-subtle transition-transform ${
                  iconOpen ? 'rotate-90' : ''
                }`}
                aria-hidden="true"
              />
            </button>
            {iconOpen && (
              <>
                <div className="text-xs mt-3 text-fg-subtle">{t('settings.app_icon_desc')}</div>
                {appIcon !== accentColor && (
                  <button
                    type="button"
                    onClick={() => void applyAppIcon(accentColor)}
                    className="mt-2.5 rounded-pill bg-surface-2 px-3 py-2 text-xs text-fg"
                  >
                    {t('settings.app_icon_match')}
                  </button>
                )}
                <div
                  id="app-icon-swatches"
                  role="radiogroup"
                  aria-label={t('settings.app_icon')}
                  className="mt-2.5 flex flex-wrap gap-2.5"
                >
                  {ACCENT_PRESETS.map((preset) => {
                    const isActive = preset.id === appIcon;
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        role="radio"
                        aria-checked={isActive}
                        aria-label={t(`settings.accent_${preset.id}`)}
                        onClick={() => void applyAppIcon(preset.id)}
                        className={`h-11 w-11 rounded-[14px] transition-transform active:scale-95 ${
                          isActive ? 'ring-2 ring-offset-2 ring-offset-surface ring-fg' : ''
                        }`}
                        style={{ backgroundColor: preset.dark.primary }}
                      >
                        {isActive && (
                          <Check
                            className="mx-auto h-4 w-4"
                            style={{ color: preset.dark.fg }}
                            aria-hidden="true"
                          />
                        )}
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        )}
        <SettingRow
          label={t('settings.weight_unit')}
          control={
            <SegmentedControl
              options={[
                { value: 'kg', label: 'KG' },
                { value: 'lb', label: 'LB' },
              ]}
              value={unitSystem}
              onChange={(v) => setUnitSystem(v)}
              ariaLabel={t('settings.weight_unit')}
            />
          }
        />
        <SettingRow
          label={t('settings.sound')}
          desc={t('settings.sound_desc')}
          control={
            <Toggle
              checked={sound}
              onChange={(v) => {
                setSound(v);
                if (v) playFeedbackSound();
              }}
              ariaLabel={t('settings.sound')}
            />
          }
        />
        <SettingRow
          label={t('settings.warmup_sets')}
          desc={t('settings.warmup_sets_desc')}
          control={
            <Toggle
              checked={showWarmupSets}
              onChange={setShowWarmupSets}
              ariaLabel={t('settings.warmup_sets')}
            />
          }
          divider={false}
        />
      </div>
    </section>
  );
}
