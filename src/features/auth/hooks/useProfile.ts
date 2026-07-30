import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@shared/lib/supabase';
import { useAuthStore } from '@features/auth/stores/authStore';

export interface Profile {
  fullName: string;
  avatarUrl: string | null;
}

/** Clave de query del perfil. Compartida entre header y ajustes. */
export const profileQueryKey = (userId: string) => ['profile', userId] as const;

/**
 * Fuente única de verdad del perfil visible (nombre + avatar). El header y la
 * página de ajustes leen de aquí para no divergir: sin esto, el header pintaba
 * el prefijo del email y ajustes el `full_name`, así que el nombre "cambiaba"
 * al navegar entre pestañas.
 */
export function useProfile() {
  const user = useAuthStore((s) => s.user);
  const userId = user?.id;

  const query = useQuery({
    queryKey: profileQueryKey(userId ?? 'anon'),
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<Profile> => {
      // maybeSingle: si la fila aún no existe (usuario antiguo sin backfill)
      // no queremos un error, solo el fallback al prefijo del email.
      const { data } = await supabase
        .from('profiles')
        .select('full_name, avatar_url')
        .eq('id', userId as string)
        .maybeSingle();
      return {
        fullName: data?.full_name ?? '',
        avatarUrl: data?.avatar_url ?? null,
      };
    },
  });

  const emailName = user?.email?.split('@')[0] ?? '';
  const profile = query.data;

  return {
    ...query,
    fullName: profile?.fullName ?? '',
    avatarUrl: profile?.avatarUrl ?? null,
    /** Nombre a mostrar: `full_name` si existe, si no el prefijo del email. */
    displayName: profile?.fullName || emailName,
    emailName,
  };
}

/** Actualiza la cache del perfil tras editar nombre o avatar (header al día). */
export function useUpdateProfileCache() {
  const queryClient = useQueryClient();
  return (userId: string, patch: Partial<Profile>) => {
    queryClient.setQueryData<Profile>(profileQueryKey(userId), (prev) => ({
      fullName: patch.fullName ?? prev?.fullName ?? '',
      avatarUrl: patch.avatarUrl ?? prev?.avatarUrl ?? null,
    }));
  };
}
