import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Trash2, Brain } from 'lucide-react';
import { toast } from 'sonner';
import { Layout } from '@app/components/Layout';
import { SectionHeader } from '@shared/components/ui';
import { useAuthStore } from '@features/auth/stores/authStore';
import { fetchCoachMemory, deleteCoachMemoryFact } from '../api/coach';
import type { CoachMemoryFact } from '../types';

const CATEGORIES: CoachMemoryFact['category'][] = ['injury', 'constraint', 'preference', 'goal'];

/**
 * Todo lo que el entrenador ha aprendido, visible y borrable.
 *
 * Esta pantalla es lo que hace aceptable que un modelo escriba memoria: el
 * peor caso de una inyección de prompt es un hecho falso aquí, que el usuario
 * ve y borra.
 */
export function CoachMemoryPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();

  const { data: facts = [] } = useQuery({
    queryKey: ['coachMemory', user?.id],
    queryFn: () => fetchCoachMemory(user?.id ?? ''),
    enabled: !!user?.id,
  });

  const remove = useMutation({
    mutationFn: deleteCoachMemoryFact,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['coachMemory', user?.id] }),
    onError: () => toast.error(t('coach.error.unknown')),
  });

  if (!user) {
    navigate('/login');
    return null;
  }

  return (
    <Layout>
      <div className="space-y-4 pb-24">
        <header className="px-1">
          <h1 className="text-xl font-display font-bold text-fg">{t('coach.memory.title')}</h1>
          <p className="text-sm text-fg-subtle">{t('coach.memory.desc')}</p>
        </header>

        {facts.length === 0 && (
          <div className="rounded-card bg-surface border border-line p-6 text-center">
            <Brain className="mx-auto h-8 w-8 text-fg-subtle" aria-hidden="true" />
            <p className="mt-3 text-sm text-fg-muted">{t('coach.memory.empty')}</p>
          </div>
        )}

        {CATEGORIES.map((category) => {
          const items = facts.filter((f) => f.category === category);
          if (items.length === 0) return null;
          return (
            <section key={category}>
              <SectionHeader title={t(`coach.memory.category.${category}`)} />
              <ul className="rounded-card bg-surface border border-line overflow-hidden">
                {items.map((fact) => (
                  <li
                    key={fact.id}
                    className="flex items-center justify-between gap-3 px-4 py-3 hairline-separator"
                  >
                    <span className="min-w-0 text-sm text-fg">{fact.fact}</span>
                    <button
                      type="button"
                      onClick={() => remove.mutate(fact.id)}
                      aria-label={`${t('coach.memory.delete')}: ${fact.fact}`}
                      className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full text-fg-subtle active:opacity-70"
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </Layout>
  );
}
