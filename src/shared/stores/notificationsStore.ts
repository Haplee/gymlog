import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface NotificationItem {
  id: string;
  title: string;
  body: string;
  /** Epoch ms en que se emitió. */
  at: number;
  read: boolean;
}

/** Tope del registro: es un historial de cortesía, no un archivo. */
const MAX_ITEMS = 50;

interface NotificationsState {
  items: NotificationItem[];
  add: (title: string, body: string) => void;
  markAllRead: () => void;
  clear: () => void;
}

export const useNotificationsStore = create<NotificationsState>()(
  persist(
    (set) => ({
      items: [],

      add: (title, body) =>
        set((state) => ({
          items: [
            {
              id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
              title,
              body,
              at: Date.now(),
              read: false,
            },
            ...state.items,
          ].slice(0, MAX_ITEMS),
        })),

      markAllRead: () =>
        set((state) => ({ items: state.items.map((n) => ({ ...n, read: true })) })),

      clear: () => set({ items: [] }),
    }),
    { name: 'gymlog-notifications' },
  ),
);

/** Número de no leídas; para el punto del icono de la campana. */
export const selectUnreadCount = (s: NotificationsState) => s.items.filter((n) => !n.read).length;
