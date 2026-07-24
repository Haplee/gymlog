/** Mismo rótulo que SectionHeader: titular en acento, sin versalitas ni regla. */
export function SectionLabel({ children }: { children: React.ReactNode }) {
  return <h2 className="font-display text-base font-bold text-accent px-1">{children}</h2>;
}
