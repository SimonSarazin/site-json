/** Bandeau de section de la modale détail (façon legacy, teinté couleur primaire). */
export function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="rounded-md bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground">
      {children}
    </h3>
  );
}
