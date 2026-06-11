/**
 * Referencias JS a los tokens CSS (tokens.css) para estilos inline.
 * Sustituye los bloques locales `const bgCard = ...` duplicados por página.
 */
export const tv = {
  bgBase: 'var(--bg-base)',
  bgCard: 'var(--bg-surface)',
  bgSurface2: 'var(--bg-surface-2)',
  border: 'var(--border-subtle)',
  borderDefault: 'var(--border-default)',
  textPrimary: 'var(--text-primary)',
  textSecondary: 'var(--text-secondary)',
  textMuted: 'var(--text-tertiary)',
  accent: 'var(--interactive-primary)',
  accentFg: 'var(--interactive-primary-fg)',
  success: 'var(--success)',
  warning: 'var(--warning)',
  error: 'var(--error)',
} as const;
