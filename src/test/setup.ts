import { beforeEach } from 'vitest';

/**
 * Node ≥ 22 define `localStorage` y `sessionStorage` en `globalThis` como
 * getters experimentales que devuelven `undefined` si el proceso no arranca
 * con `--localstorage-file`.
 *
 * Vitest monta jsdom y copia sus globals, pero descarta las claves que ya
 * existen en `globalThis` y no están en su lista de claves del DOM. El
 * resultado es que `globalThis.window === globalThis` y `window.localStorage`
 * acaba apuntando al getter de Node, no al Storage de jsdom. Los tests se
 * quedaban sin Storage («Cannot read properties of undefined»).
 *
 * Este setup publica un Storage funcional en `globalThis` para todos los
 * entornos: el real de jsdom cuando lo hay (tests de componentes) y uno en
 * memoria, fiel a la API `Storage`, en el entorno `node` (tests de stores).
 * En ningún caso se toca código de producción.
 */
type StorageLike = Storage;

/** Storage en memoria con la semántica de `Storage` (claves como strings). */
function createMemoryStorage(): StorageLike {
  const items = new Map<string, string>();
  return {
    get length() {
      return items.size;
    },
    key(index) {
      return [...items.keys()][index] ?? null;
    },
    getItem(key) {
      return items.get(String(key)) ?? null;
    },
    setItem(key, value) {
      items.set(String(key), String(value));
    },
    removeItem(key) {
      items.delete(String(key));
    },
    clear() {
      items.clear();
    },
  };
}

type JsdomGlobal = typeof globalThis & {
  jsdom?: { window: Window };
};

function resolveStorage(key: 'localStorage' | 'sessionStorage'): StorageLike {
  if (typeof window !== 'undefined') {
    const fromJsdom = (globalThis as JsdomGlobal).jsdom?.window[key];
    if (fromJsdom) return fromJsdom;
  }
  return createMemoryStorage();
}

const local = resolveStorage('localStorage');
const session = resolveStorage('sessionStorage');

for (const [key, storage] of [
  ['localStorage', local],
  ['sessionStorage', session],
] as const) {
  Object.defineProperty(globalThis, key, {
    configurable: true,
    enumerable: true,
    get: () => storage,
  });
}

// Cada test arranca con el almacenamiento vacío: un test que persiste estado
// no debe condicionar al siguiente.
beforeEach(() => {
  local.clear();
  session.clear();
});
