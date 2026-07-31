import { useTranslation } from 'react-i18next';
import { m } from 'framer-motion';
import { BarChart2, BarChart3 } from 'lucide-react';

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
}

/**
 * Barra de vista, búsqueda e importación/exportación del historial.
 *
 * Extraída de `HistoryPage` por tamaño (CLAUDE.md fija 800 líneas). Scrollea con
 * el contenido a propósito: fijarla se comió media pantalla en móvil.
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
}: HistoryFiltersProps) {
  const { t } = useTranslation();

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
        <button
          type="button"
          onClick={() => onOpenStats()}
          className="flex items-center gap-1.5 px-3 py-2 rounded-pill font-semibold text-sm transition-all hover:scale-[1.02] active:scale-[0.98] bg-accent text-accent-fg"
        >
          <BarChart3 className="w-4 h-4" />
          {t('stats.title')}
        </button>

        <button
          type="button"
          onClick={() => onOpenUserStats()}
          className="flex items-center gap-1.5 px-3 py-2 rounded-pill font-semibold text-sm transition-all hover:scale-[1.02] active:scale-[0.98] bg-surface-2 text-accent"
        >
          <BarChart2 className="w-4 h-4" />
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
              className="flex-1 min-w-[10rem] bg-surface border border-line-strong rounded-card text-fg text-base p-2 outline-none"
            />
            <select
              value={filterExercise}
              onChange={(e) => onFilterExercise(e.target.value)}
              className="bg-surface border border-line-strong rounded-card text-fg-muted text-base p-2 cursor-pointer transition-all hover:scale-[1.02]"
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
              onClick={exportToExcel}
              className="bg-surface border border-line-strong rounded-card text-accent text-base px-3 py-2 cursor-pointer font-semibold transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              {t('history.export_btn')}
            </button>
            <button
              type="button"
              onClick={exportToJson}
              className="bg-surface border border-line-strong rounded-card text-accent text-base px-3 py-2 cursor-pointer font-semibold transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              {t('history.export_json')}
            </button>
            <label className="bg-surface border border-line-strong rounded-card text-fg-muted text-base px-3 py-2 cursor-pointer font-semibold transition-all hover:scale-[1.02] active:scale-[0.98]">
              {t('history.import_btn')}
              <input
                type="file"
                accept=".csv,.txt,.xlsx"
                onChange={importFromCsv}
                className="hidden"
              />
            </label>
            <label className="bg-surface border border-line-strong rounded-card text-fg-muted text-base px-3 py-2 cursor-pointer font-semibold transition-all hover:scale-[1.02] active:scale-[0.98]">
              {t('history.import_json')}
              <input
                type="file"
                accept=".json,application/json"
                onChange={importFromJson}
                className="hidden"
              />
            </label>
          </>
        )}
      </div>
    </div>
  );
}
