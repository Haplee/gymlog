import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * Categoría del aviso. Es lo que permite filtrar el historial y decidir el
 * icono; antes todos los avisos eran indistinguibles entre sí.
 */
export type NotificationType = 'routine' | 'streak' | 'summary' | 'pr' | 'timer' | 'generic';

export interface NotificationItem {
  id: string;
  title: string;
  body: string;
  /** Epoch ms en que se emitió. */
  at: number;
  read: boolean;
  /** Categoría; los items guardados antes de existir este campo son 'generic'. */
  type: NotificationType;
  /** Ruta interna que abre el aviso al tocarlo. Ausente = no navega. */
  url?: string;
}

/** Tope del registro: es un historial de cortesía, no un archivo. */
const MAX_ITEMS = 50;

/** Sube al añadir campos al item persistido. Ver `migrate`. */
const PERSIST_VERSION = 1;

const VALID_TYPES: readonly NotificationType[] = [
  'routine',
  'streak',
  'summary',
  'pr',
  'timer',
  'generic',
];

interface AddOptions {
  type?: NotificationType;
  url?: string;
}

interface NotificationsState {
  items: NotificationItem[];
  add: (title: string, body: string, options?: AddOptions) => void;
  markAllRead: () => void;
  markRead: (id: string) => void;
  remove: (id: string) => void;
  clear: () => void;
}

/**
 * Los items guardados antes de la v1 no tienen `type` ni `url`. Sin esta
 * migración quedarían con `type: undefined` y el filtro por categoría los
 * escondería: el usuario vería desaparecer su historial en vez de verlo sin
 * clasificar. Se les asigna 'generic', que la pantalla sabe pintar.
 *
 * Se sanea también lo demás: un item sin `at` válido rompería el agrupado por
 * día, y el orden del historial deja de tener sentido.
 *
 * Exportada para poder probarla: es la pieza que, si falla, borra historial
 * ajeno sin que nadie se entere.
 */
export function migrateNotifications(persisted: unknown): { items: NotificationItem[] } {
  const state = persisted as { items?: unknown } | undefined;
  const raw = Array.isArray(state?.items) ? state.items : [];

  const items: NotificationItem[] = raw
    .filter((it): it is Record<string, unknown> => !!it && typeof it === 'object')
    .map((it) => {
      const type = it.type as NotificationType | undefined;
      const at = typeof it.at === 'number' && Number.isFinite(it.at) ? it.at : Date.now();
      return {
        id: typeof it.id === 'string' ? it.id : `${at}-${Math.random().toString(36).slice(2, 8)}`,
        title: typeof it.title === 'string' ? it.title : '',
        body: typeof it.body === 'string' ? it.body : '',
        at,
        read: it.read === true,
        type: type && VALID_TYPES.includes(type) ? type : 'generic',
        url: typeof it.url === 'string' ? it.url : undefined,
      };
    })
    .slice(0, MAX_ITEMS);

  return { items };
}

export const useNotificationsStore = create<NotificationsState>()(
  persist(
    (set) => ({
      items: [],

      add: (title, body, options) =>
        set((state) => ({
          items: [
            {
              id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
              title,
              body,
              at: Date.now(),
              read: false,
              type: options?.type ?? 'generic',
              url: options?.url,
            },
            ...state.items,
          ].slice(0, MAX_ITEMS),
        })),

      markAllRead: () =>
        set((state) => ({ items: state.items.map((n) => ({ ...n, read: true })) })),

      markRead: (id) =>
        set((state) => ({
          items: state.items.map((n) => (n.id === id ? { ...n, read: true } : n)),
        })),

      remove: (id) => set((state) => ({ items: state.items.filter((n) => n.id !== id) })),

      clear: () => set({ items: [] }),
    }),
    {
      name: 'gymlog-notifications',
      version: PERSIST_VERSION,

      migrate: migrateNotifications,
    },
  ),
);

/** Número de no leídas; para el punto del icono de la campana. */
export const selectUnreadCount = (s: NotificationsState) => s.items.filter((n) => !n.read).length;
