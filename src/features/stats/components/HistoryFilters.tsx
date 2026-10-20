import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { m } from 'framer-motion';
import { Modal } from '@shared/components/ui';
import {
  ChartBar,
  DocumentCode,
  Download,
  FileContent,
  HeartPulse,
  IconUser,
  Upload,
} from '@shared/components/icons';

export type HistoryView = 'all' | 'workouts' | 'sets' | 'cardio';

interface HistoryFiltersProps {
  view: HistoryView;
  onView: (view: HistoryView) => void;
  searchText: string;
  onSearchText: (value: string) => void;
  filterExercise: string;
  onFilterExercise: (value: string) => void;
  exercises: string[];
  onOpenStats: () => void;
  onOpenUserStats: () => void;
  exportToExcel: () => void;
  exportToJson: () => void;
  importFromCsv: (e: React.ChangeEvent<HTMLInputElement>) => void;
  importFromJson: (e: React.ChangeEvent<HTMLInputElement>) => void;
  importFromAppleHealth: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

/**
 * Barra de vista, búsqueda e importación/exportación del historial.
 *
 * Extraída de `HistoryPage` por tamaño (CLAUDE.md fija 800 líneas). Scrollea con
 * el contenido a propósito: fijarla se comió media pantalla en móvil.
 *
 * Exportar e importar se resumen en dos acciones que abren un diálogo con el
 * formato; cuatro botones atómicos en la barra ocultaban el alcance de cada uno.
 */
export function HistoryFilters({
  view,
  onView,
  searchText,
  onSearchText,
  filterExercise,
  onFilterExercise,
  exercises,
  onOpenStats,
  onOpenUserStats,
  exportToExcel,
  exportToJson,
  importFromCsv,
  importFromJson,
  importFromAppleHealth,
}: HistoryFiltersProps) {
  const { t } = useTranslation();
  const [exportOpen, setExportOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  const optionClass =
    'flex min-h-12 items-center gap-2 glass-2 rounded-card px-3 text-left text-sm font-medium text-fg transition-colors active:bg-hover';
  const optionIconClass = 'h-4 w-4 flex-shrink-0 text-accent';

  return (
    <div className="mb-3 space-y-2">
      {/* Segmented control de vista — píldora deslizante */}
      <div
        role="tablist"
        aria-label={t('history.view_label')}
        className="flex p-1 rounded-sm bg-surface border border-line"
      >
        {(
          [
            { id: 'all', label: t('history.view_all') },
            { id: 'workouts', label: t('history.workouts_view') },
            { id: 'sets', label: t('history.sets_view') },
            { id: 'cardio', label: t('history.cardio_view') },
          ] as const
        ).map((v) => {
          const active = view === v.id;
          return (
            <button
              key={v.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onView(v.id)}
              className={`relative flex-1 py-2.5 text-xs font-semibold rounded-sm transition-colors ${
                active ? 'text-accent-fg' : 'text-fg-muted active:text-fg'
              }`}
            >
              {active && (
                <m.div
                  layoutId="historyViewPill"
                  className="absolute inset-0 rounded-sm bg-accent shadow-btn-accent"
                  transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                />
              )}
              <span className="relative">{v.label}</span>
            </button>
          );
        })}
      </div>

      <div className="flex gap-2 flex-wrap">
        {/* Estos dos son navegación, y estaban con el mismo peso que el filtro
            activo de arriba: un relleno de acento y otro con el texto en acento,
            justo debajo de la píldora que marca «dónde estoy». Tres acentos en
            dos filas seguidas y ninguna forma de distinguir estado de destino.
            Ahora van neutros con el icono en acento, que es como este mismo
            fichero pinta el resto de sus filas de navegación (`optionClass`). */}
        <button
          type="button"
          onClick={() => onOpenStats()}
          className="flex items-center gap-1.5 px-3 py-2 rounded-pill font-semibold text-sm transition-all hover:scale-[1.02] active:scale-[0.98] bg-surface-2 text-fg"
        >
          <ChartBar className="w-4 h-4 text-accent" />
          {t('stats.title')}
        </button>

        <button
          type="button"
          onClick={() => onOpenUserStats()}
          className="flex items-center gap-1.5 px-3 py-2 rounded-pill font-semibold text-sm transition-all hover:scale-[1.02] active:scale-[0.98] bg-surface-2 text-fg"
        >
          <IconUser className="w-4 h-4 text-accent" />
          {t('history.my_stats')}
        </button>

        {view === 'sets' && (
          <>
            <input
              type="search"
              value={searchText}
              onChange={(e) => onSearchText(e.target.value)}
              placeholder={t('history.search_placeholder')}
              aria-label={t('history.search_placeholder')}
              className="flex-1 min-w-[10rem] glass-2 rounded-card text-fg text-base p-2 outline-none"
            />
            <select
              value={filterExercise}
              onChange={(e) => onFilterExercise(e.target.value)}
              className="glass-2 rounded-card text-fg-muted text-base p-2 cursor-pointer transition-all hover:scale-[1.02]"
            >
              <option value="">{t('history.filter_all')}</option>
              {exercises.map((ex) => (
                <option key={ex} value={ex}>
                  {ex}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => setExportOpen(true)}
              className="flex items-center gap-1.5 glass-2 rounded-card text-accent text-base px-3 py-2 cursor-pointer font-semibold transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              <Download className="w-4 h-4" />
              {t('history.export_btn')}
            </button>
            <button
              type="button"
              onClick={() => setImportOpen(true)}
              className="flex items-center gap-1.5 glass-2 rounded-card text-fg-muted text-base px-3 py-2 cursor-pointer font-semibold transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              <Upload className="w-4 h-4" />
              {t('history.import_btn')}
            </button>
          </>
        )}
      </div>

      <Modal
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        title={t('history.export_title')}
        icon={<Download className="w-5 h-5" />}
      >
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={() => {
              setExportOpen(false);
              exportToExcel();
            }}
            className={optionClass}
          >
            <FileContent className={optionIconClass} />
            {t('history.format_excel')}
          </button>
          <button
            type="button"
            onClick={() => {
              setExportOpen(false);
              exportToJson();
            }}
            className={optionClass}
          >
            <DocumentCode className={optionIconClass} />
            {t('history.format_json')}
          </button>
        </div>
      </Modal>

      <Modal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        title={t('history.import_title')}
        icon={<Upload className="w-5 h-5" />}
      >
        <div className="flex flex-col gap-2">
          <label className={`${optionClass} cursor-pointer`}>
            <FileContent className={optionIconClass} />
            {t('history.format_spreadsheet')}
            <input
              type="file"
              accept=".csv,.txt,.xlsx"
              onChange={(e) => {
                importFromCsv(e);
                setImportOpen(false);
              }}
              className="hidden"
            />
          </label>
          {/* El export de Salud es un XML enorme, así que va por su propia
              opción: mezclarlo con «Excel o CSV» significaría intentar leerlo
              como tabla y fallar con un mensaje que no ayuda a nadie. */}
          <label className={`${optionClass} cursor-pointer`}>
            <HeartPulse className={optionIconClass} />
            {t('history.format_apple_health')}
            <input
              type="file"
              accept=".xml,.zip,text/xml,application/xml"
              onChange={(e) => {
                importFromAppleHealth(e);
                setImportOpen(false);
              }}
              className="hidden"
            />
          </label>
          <label className={`${optionClass} cursor-pointer`}>
            <DocumentCode className={optionIconClass} />
            {t('history.format_json')}
            <input
              type="file"
              accept=".json,application/json"
              onChange={(e) => {
                importFromJson(e);
                setImportOpen(false);
              }}
              className="hidden"
            />
          </label>
        </div>
      </Modal>
    </div>
  );
}
