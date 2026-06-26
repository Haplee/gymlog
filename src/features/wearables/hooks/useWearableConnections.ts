import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@features/auth/stores/authStore';
import {
  fetchWearableConnections,
  fetchWearableDaily,
  fetchWearableSleep,
  WEARABLE_CONNECTIONS_KEY,
  WEARABLE_DAILY_KEY,
  WEARABLE_SLEEP_KEY,
} from '../api/wearablesQueries';

export function useWearableConnections() {
  const userId = useAuthStore((s) => s.user?.id);
  return useQuery({
    queryKey: WEARABLE_CONNECTIONS_KEY(userId ?? ''),
    queryFn: () => fetchWearableConnections(userId as string),
    enabled: !!userId,
  });
}

export function useWearableDaily(limit = 30) {
  const userId = useAuthStore((s) => s.user?.id);
  return useQuery({
    queryKey: WEARABLE_DAILY_KEY(userId ?? ''),
    queryFn: () => fetchWearableDaily(userId as string, limit),
    enabled: !!userId,
  });
}

export function useWearableSleep(limit = 30) {
  const userId = useAuthStore((s) => s.user?.id);
  return useQuery({
    queryKey: WEARABLE_SLEEP_KEY(userId ?? ''),
    queryFn: () => fetchWearableSleep(userId as string, limit),
    enabled: !!userId,
  });
}
