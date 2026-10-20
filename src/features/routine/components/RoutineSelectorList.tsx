import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Routine } from '@features/routine/stores/routineStore';
import { Button } from '@shared/components/ui';
import { Calendar, Eye, EyeOff, Upload } from '@shared/components/icons';
import { formatShortDay } from '@shared/lib/formatDate';

interface RoutineSelectorListProps {
  /** Rutinas visibles en el selector. */
  visibles: Routine[];
  /** Rutinas ocultas, plegadas al final de la lista. */
  ocultas: Routine[];
  /** Fecha (yyyy-mm-dd) en la que cada rutina pasa a ser activa, por id. */
  schedule: Record<string, string>;
  /** Con una rutina ya activa, entrar aquí es mirar, no renunciar a ella. */
  hasActiveRoutine: boolean;
  onKeepCurrent: () => void;
  onSelect: (routineId: string) => void;
  onOpenScheduler: (e: React.MouseEvent, routineId: string) => void;
  onHide: (routine: Routine) => void;
  onUnhide: (routineId: string) => void;
  onUseAsTemplate: (e: React.MouseEvent, routineId: string) => void;
  onCreate: () => void;
  onImportFile: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

/**
 * Selector de rutina.
 *
 * Con una rutina ya activa, entrar aquí es mirar, no renunciar a ella. Antes
 * «Cambiar» la desactivaba en el acto: quien entraba por curiosidad y volvía
 * atrás se quedaba sin rutina y sin plan del día, y si además estaba oculta ya
 * no salía en esta lista.
 *
 * El plegado de las ocultas es estado de este componente: no lo mira nadie más
 * y así no viaja hasta la pantalla.
 */
export function RoutineSelectorList({
  visibles,
  ocultas,
  schedule,
  hasActiveRoutine,
  onKeepCurrent,
  onSelect,
  onOpenScheduler,
  onHide,
  onUnhide,
  onUseAsTemplate,
  onCreate,
  onImportFile,
}: RoutineSelectorListProps) {
  const { t, i18n } = useTranslation();
  const [showHidden, setShowHidden] = useState(false);

  return (
    <>
      {hasActiveRoutine && (
        <button
          type="button"
          onClick={onKeepCurrent}
          className="w-full min-h-11 mb-3 label-caps rounded-pill bg-surface-2 text-fg-muted active:scale-[0.98] transition-transform"
        >
          {t('routine.keep_current')}
        </button>
      )}

      <div className="space-y-3">
        {visibles.map((routine) => (
          <div
            key={routine.id}
            role="button"
            tabIndex={0}
            onClick={() => onSelect(routine.id)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onSelect(routine.id);
              }
            }}
            className="p-4 rounded-card cursor-pointer transition-all active:scale-[0.99] bg-surface border border-line"
          >
            {!routine.isCustom && (
              <span className="label-caps inline-block px-1.5 py-0.5 mb-2 rounded-pill bg-surface-3 text-fg-muted">
                {t('routine.predefined')}
              </span>
            )}
            {schedule[routine.id] && (
              <span className="label-caps inline-flex items-center gap-1 px-1.5 py-0.5 mb-2 ml-1 rounded-pill bg-surface-3 text-accent">
                <Calendar className="w-3 h-3" aria-hidden="true" />
                {t('routine.starts_on', {
                  date: formatShortDay(schedule[routine.id], i18n.language),
                })}
              </span>
            )}
            {/* Las predefinidas llevan tres controles y el de plantilla es
                ancho: si comparten linea con el texto, el nombre parte en
                dos y la descripcion queda estrangulada bajo los botones.
                Por eso ahi el texto se queda la fila entera (basis-full) y
                los controles bajan debajo. Las personalizadas solo tienen
                dos iconos y caben al lado sin apreturas. */}
            <div className="flex items-center gap-3 flex-wrap">
              <div className={`min-w-0 flex-1 ${routine.isCustom ? '' : 'basis-full'}`}>
                <div className="text-data font-display font-bold text-fg">{routine.name}</div>
                <div className="text-xs mt-1 text-fg-subtle">{routine.description}</div>
              </div>
              <div className="flex items-center gap-2 ml-auto">
                <button
                  type="button"
                  onClick={(e) => onOpenScheduler(e, routine.id)}
                  aria-label={t('routine.schedule_action', { name: routine.name })}
                  title={t('routine.schedule_short')}
                  className="flex-shrink-0 w-11 h-11 flex items-center justify-center rounded-pill bg-surface-2 text-fg-muted active:scale-[0.98] transition-transform"
                >
                  <Calendar className="w-4 h-4" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onHide(routine);
                  }}
                  aria-label={t('routine.hide_action', { name: routine.name })}
                  title={t('routine.hide_short')}
                  className="flex-shrink-0 w-11 h-11 flex items-center justify-center rounded-pill bg-surface-2 text-fg-muted active:scale-[0.98] transition-transform"
                >
                  <EyeOff className="w-4 h-4" aria-hidden="true" />
                </button>
                {!routine.isCustom && (
                  <button
                    type="button"
                    onClick={(e) => onUseAsTemplate(e, routine.id)}
                    className="flex-shrink-0 min-h-11 label-caps px-3 py-1.5 rounded-pill bg-surface-2 text-accent active:scale-[0.98] transition-transform"
                  >
                    {t('routine.use_template')}
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Ocultar tiene que poder deshacerse desde el mismo sitio: si la
          vuelta atras viviera en Ajustes, esconder una plantilla seria un
          viaje de ida para quien no supiera donde buscar. */}
      {ocultas.length > 0 && (
        <div className="mt-5">
          <button
            type="button"
            onClick={() => setShowHidden((v) => !v)}
            aria-expanded={showHidden}
            className="w-full min-h-11 flex items-center justify-center gap-2 rounded-pill text-xs bg-surface-2 text-fg-muted active:scale-[0.98] transition-transform"
          >
            <Eye className="w-4 h-4" aria-hidden="true" />
            {showHidden
              ? t('routine.hidden_collapse')
              : t('routine.hidden_show', { count: ocultas.length })}
          </button>

          {showHidden && (
            <div className="mt-3 space-y-2">
              <p className="text-xs text-fg-subtle">{t('routine.hidden_hint')}</p>
              {ocultas.map((routine) => (
                <div
                  key={routine.id}
                  className="p-3 rounded-card bg-surface border border-line flex justify-between items-center gap-3"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-display font-bold text-fg-muted truncate">
                      {routine.name}
                    </div>
                    {/* Una rutina escondida y programada sigue entrando
                        sola el dia que le toque: el calendario resuelve por
                        id y no mira lo oculto. Sin esta marca, el cambio
                        llegaba sin ningun aviso previo. */}
                    {schedule[routine.id] && (
                      <span className="label-caps inline-flex items-center gap-1 mt-1 px-1.5 py-0.5 rounded-pill bg-surface-3 text-accent">
                        <Calendar className="w-3 h-3" aria-hidden="true" />
                        {t('routine.starts_on', {
                          date: formatShortDay(schedule[routine.id], i18n.language),
                        })}
                      </span>
                    )}
                    <div className="text-xs mt-0.5 text-fg-subtle truncate">
                      {routine.description}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onUnhide(routine.id)}
                    aria-label={t('routine.unhide_action', { name: routine.name })}
                    className="flex-shrink-0 min-h-11 label-caps px-3 py-1.5 rounded-pill bg-surface-2 text-accent active:scale-[0.98] transition-transform"
                  >
                    {t('routine.unhide_short')}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <Button
        type="button"
        onClick={onCreate}
        size="lg"
        className="w-full mt-5 font-display font-bold uppercase tracking-[0.12em]"
      >
        {t('routine.create_custom')}
      </Button>

      {/* Recibir la rutina de alguien: entra como una más, nunca sustituye
          a las que ya hay. */}
      <label className="w-full mt-2.5 min-h-12 flex items-center justify-center gap-2 rounded-pill label-caps bg-surface-2 text-fg-muted cursor-pointer active:scale-[0.98] transition-transform">
        <Upload className="w-4 h-4 text-accent" aria-hidden="true" />
        {t('routine.import_file')}
        <input
          type="file"
          accept=".json,application/json"
          onChange={onImportFile}
          className="hidden"
        />
      </label>
    </>
  );
}
