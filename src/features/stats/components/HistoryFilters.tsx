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

  // Un solo patrón de "botón secundario en una fila de herramientas": píldora,
  // surface-2 y el mismo `active:scale-95` que usa `Button`. Antes convivían
  // en esta fila tres formas distintas —píldora en los dos de navegación,
  // `rounded-card` en los de exportar e importar— y todas se estiraban con
  // `hover:scale-[1.02]`, que en táctil no llega a dispararse y en puntero
  // empuja a los vecinos mientras comprueban si el cursor está encima.
  const toolbarClass =
    'flex items-center gap-1.5 px-3.5 min-h-11 rounded-pill bg-surface-2 text-fg text-sm font-semibold transition-transform active:scale-95 cursor-pointer';

  return (
    <div className="mb-4 space-y-3">
      {/* Segmented control de vista — píldora deslizante. Era `rounded-sm` desde
          la etapa Stitch, y quedaba un rectángulo de esquinas de 8px pegado
          justo encima de una fila de píldoras: la forma decía que era otra
          cosa cuando es el mismo control. */}
      <div
        role="tablist"
        aria-label={t('history.view_label')}
        className="flex p-1 rounded-pill bg-surface-2"
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
              className={`relative flex-1 min-h-9 py-1 px-2 text-sm font-semibold rounded-pill transition-colors ${
                active ? 'text-accent-fg' : 'text-fg-muted active:text-fg'
              }`}
            >
              {active && (
                <m.div
                  layoutId="historyViewPill"
                  className="absolute inset-0 rounded-pill bg-accent"
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
        <button type="button" onClick={() => onOpenStats()} className={toolbarClass}>
          <ChartBar className="w-4 h-4 text-accent" />
          {t('stats.title')}
        </button>

        <button type="button" onClick={() => onOpenUserStats()} className={toolbarClass}>
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
              className="flex-1 min-w-40 min-h-11 rounded-pill border border-line-interactive bg-surface-2 px-4 text-base text-fg outline-none"
            />
            <select
              value={filterExercise}
              onChange={(e) => onFilterExercise(e.target.value)}
              aria-label={t('history.filter_all')}
              className="min-h-11 rounded-pill border border-line-interactive bg-surface-2 px-4 text-base text-fg-muted cursor-pointer"
            >
              <option value="">{t('history.filter_all')}</option>
              {exercises.map((ex) => (
                <option key={ex} value={ex}>
                  {ex}
                </option>
              ))}
            </select>
            {/* Exportar e importar van neutros como el resto de la fila. Antes
                «Exportar» era el único con el texto en acento de toda la barra,
                y por eso parecía la acción principal del Historial, que no lo
                es: la acción principal de la app está en la pestaña de Inicio. */}
            <button type="button" onClick={() => setExportOpen(true)} className={toolbarClass}>
              <Download className="w-4 h-4 text-fg-subtle" />
              {t('history.export_btn')}
            </button>
            <button type="button" onClick={() => setImportOpen(true)} className={toolbarClass}>
              <Upload className="w-4 h-4 text-fg-subtle" />
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
