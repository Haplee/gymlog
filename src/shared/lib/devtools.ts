const isDev = import.meta.env.DEV;

export const devLog = (...args: unknown[]) => {
  // eslint-disable-next-line no-console
  if (isDev) console.log(...args);
};

export const devWarn = (...args: unknown[]) => {
  if (isDev) console.warn(...args);
};

export const devError = (...args: unknown[]) => {
  if (isDev) console.error(...args);
};
