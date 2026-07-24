import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Layout } from '@app/components/Layout';
import { Button, Chip, SegmentedControl, StatNumber, Badge } from '@shared/components/ui';
import { WeeklyChallengeBanner, LevelChips, ExerciseCard } from '@shared/components/fitbody';

type Level = 'beginner' | 'intermediate' | 'advanced';

/**
 * Página de prueba del reskin FitBody: reúne los componentes nuevos
 * (WeeklyChallengeBanner, LevelChips, ExerciseCard) junto a primitivas actuales
 * (Button, Chip, SegmentedControl, StatNumber, Badge) para verlos con el tema
 * amarillo. Ruta: /fitbody. Textos vía i18next con valor por defecto.
 */
export function FitBodyShowcasePage() {
  const { t } = useTranslation();
  const [level, setLevel] = useState<Level>('intermediate');
  const [tab, setTab] = useState<'log' | 'charts'>('log');
  const [chip, setChip] = useState(false);

  const levelOptions = [
    { value: 'beginner' as const, label: t('fitbody.level_beginner', 'Principiante') },
    { value: 'intermediate' as const, label: t('fitbody.level_intermediate', 'Intermedio') },
    { value: 'advanced' as const, label: t('fitbody.level_advanced', 'Avanzado') },
  ];

  return (
    <Layout>
      <div className="flex flex-col gap-8 pb-4">
        <header className="flex flex-col gap-1">
          <span className="label-caps text-accent">{t('fitbody.badge', 'Prueba de tema')}</span>
          <h1 className="font-display text-2xl font-bold text-fg">
            {t('fitbody.title', 'Estilo FitBody')}
          </h1>
          <p className="text-sm text-fg-muted">
            {t('fitbody.subtitle', 'Componentes nuevos + los tuyos con el tema amarillo.')}
          </p>
        </header>

        {/* ── Componente nuevo: banner ── */}
        <section className="flex flex-col gap-3">
          <span className="label-caps text-fg-subtle">
            {t('fitbody.section_banner', 'Weekly Challenge')}
          </span>
          <WeeklyChallengeBanner
            label={t('fitbody.weekly_label', 'Reto semanal')}
            title={t('fitbody.weekly_title', 'Plancha con giro de cadera')}
            subtitle={t('fitbody.weekly_subtitle', 'Reta a tu core esta semana.')}
            ctaLabel={t('fitbody.weekly_cta', 'Empezar')}
          />
        </section>

        {/* ── Componente nuevo: chips de nivel ── */}
        <section className="flex flex-col gap-3">
          <span className="label-caps text-fg-subtle">
            {t('fitbody.section_levels', 'Chips de nivel')}
          </span>
          <LevelChips
            options={levelOptions}
            value={level}
            onChange={setLevel}
            ariaLabel={t('fitbody.section_levels', 'Chips de nivel')}
          />
        </section>

        {/* ── Componente nuevo: cards de ejercicio ── */}
        <section className="flex flex-col gap-3">
          <span className="label-caps text-fg-subtle">
            {t('fitbody.section_exercises', 'Ejercicios')}
          </span>
          <div className="flex flex-col gap-2">
            <ExerciseCard
              name={t('fitbody.ex_kettlebell', 'Kettlebell Swing')}
              duration="00:30"
              reps="3x"
              playLabel={t('fitbody.play', 'Reproducir')}
            />
            <ExerciseCard
              name={t('fitbody.ex_shoulder', 'Shoulder Press')}
              duration="00:15"
              reps="2x"
              playLabel={t('fitbody.play', 'Reproducir')}
            />
            <ExerciseCard
              name={t('fitbody.ex_bicep', 'Bicep Curls')}
              duration="00:10"
              reps="4x"
              playLabel={t('fitbody.play', 'Reproducir')}
            />
          </div>
        </section>

        {/* ── Componentes actuales, con el tema nuevo ── */}
        <section className="flex flex-col gap-3">
          <span className="label-caps text-fg-subtle">
            {t('fitbody.section_current', 'Tus componentes')}
          </span>

          <SegmentedControl
            options={[
              { value: 'log', label: t('fitbody.tab_log', 'Registro') },
              { value: 'charts', label: t('fitbody.tab_charts', 'Gráficas') },
            ]}
            value={tab}
            onChange={setTab}
            ariaLabel={t('fitbody.section_current', 'Tus componentes')}
          />

          <div className="flex flex-wrap items-center gap-2">
            <Button variant="primary">{t('fitbody.btn_primary', 'Primario')}</Button>
            <Button variant="secondary">{t('fitbody.btn_secondary', 'Secundario')}</Button>
            <Button variant="ghost">{t('fitbody.btn_ghost', 'Ghost')}</Button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Chip selected={chip} onClick={() => setChip((v) => !v)}>
              {t('fitbody.chip', 'Filtro')}
            </Chip>
            <Badge>{t('fitbody.badge_new', 'Nuevo')}</Badge>
          </div>

          <div className="flex gap-6 rounded-card border border-line bg-surface p-4">
            <StatNumber value={1859} label={t('fitbody.stat_volume', 'Volumen')} />
            <StatNumber value={12} label={t('fitbody.stat_streak', 'Racha')} />
          </div>
        </section>
      </div>
    </Layout>
  );
}
