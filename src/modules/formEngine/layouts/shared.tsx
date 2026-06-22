/**
 * Helpers partagés des layouts (§5 du design). Mutualisés entre Flat/Wizard/Tabs (fichiers séparés
 * → code-split lazy via le registry). La navigation d'étapes est bâtie sur **Radix Tabs**
 * (`@radix-ui/react-tabs`) — on récupère gratuitement rôles ARIA (tablist/tab/tabpanel), navigation
 * clavier (flèches/Home/End, roving tabindex) et montage du seul panneau actif. Les déclencheurs sont
 * stylés en **pastilles** (look conservé) via `asChild` sur notre `<Button>`.
 */
import { useEffect, useState, type ReactNode } from "react";
import type { FieldValues, UseFormReturn } from "react-hook-form";
import * as Tabs from "@radix-ui/react-tabs";
import { AlertCircle } from "lucide-react";
import { DynamicIcon, type IconName } from "lucide-react/dynamic";
import { Button } from "@/components/ui/button";
import { TabsList, TabsTrigger } from "@/components/ui/tabs";
import { check } from "../engine/conditional";
import { hasErrorAt } from "../engine/sectionErrors";
import type { FieldGroup, FormDescriptor, LayoutPresentation, SectionDescriptor } from "../types";

/** Options de présentation d'un layout, avec les défauts « équipement » (pills/count/plain). */
export function layoutPresentation(layout: FormDescriptor["layout"]): Required<LayoutPresentation> {
  const l = layout as LayoutPresentation;
  return { stepper: l.stepper ?? "pills", progress: l.progress ?? "count", header: l.header ?? "plain" };
}

export interface LayoutProps {
  descriptor: FormDescriptor;
  form: UseFormReturn<FieldValues>;
  t: (key: string) => string;
  renderField: (name: string) => ReactNode;
  renderSlot: (slotId: string) => ReactNode;
  submitLabel: string;
  /** Libellés de navigation fournis par l'app (le moteur ne hardcode aucune clé i18n).
   *  `stepLabel(i, n)` → ex. « Étape 1 / 4 » (optionnel ; fallback « 1 / 4 »). */
  texts: { next: string; previous: string; cancel: string; stepLabel?: (index: number, total: number) => string };
  submitting?: boolean;
  onCancel?: () => void;
}

const isSlot = (f: string) => f.startsWith("$slot:");
const slotName = (f: string) => f.slice("$slot:".length);

const COLS: Record<number, string> = { 1: "", 2: "sm:grid-cols-2", 3: "sm:grid-cols-3" };

/** Normalise une section vers ses groupes (format plat = un unique groupe 1 colonne). */
export function sectionGroups(section: SectionDescriptor | undefined): FieldGroup[] {
  if (!section) return []; // garde : section disparue (visibleIf) → pas de déréférencement
  if (section.groups && section.groups.length) return section.groups;
  return [{ columns: 1, fields: section.fields ?? [] }];
}

/** Tous les noms de champs (hors $slot) d'une section — groupes ou format plat. */
export function sectionFieldNames(section: SectionDescriptor | undefined): string[] {
  return sectionGroups(section).flatMap((g) => g.fields).filter((f) => !isSlot(f));
}

function renderEntry(f: string, p: LayoutProps): ReactNode {
  return isSlot(f) ? <div key={f}>{p.renderSlot(slotName(f))}</div> : <div key={f}>{p.renderField(f)}</div>;
}

/** Rend une section : ses groupes (grille N colonnes + titre + séparateur + conditionnel de bloc). */
export function renderSection(section: SectionDescriptor, p: LayoutProps, values: FieldValues): ReactNode {
  return sectionGroups(section).map((g, gi) => {
    if (!check(g.visibleIf, values)) return null; // bloc conditionnel : titre + champs masqués
    const cols = COLS[g.columns ?? 1] ?? "";
    return (
      <div key={gi} className={`space-y-3${g.divider ? " border-t pt-6" : ""}`}>
        {g.label && <div className={g.titleClassName ?? "text-sm font-medium"}>{p.t(g.label)}{g.required && " *"}</div>}
        <div className={`grid gap-4 ${cols}`}>{g.fields.map((f) => renderEntry(f, p))}</div>
      </div>
    );
  });
}

/** Une section a-t-elle une erreur (un de ses champs dans formState.errors) ? */
export function sectionHasError(section: SectionDescriptor, errors: Record<string, unknown>): boolean {
  return sectionFieldNames(section).some((n) => hasErrorAt(errors, n));
}

/** Déclencheurs d'étapes = `Tabs.List` Radix avec `Tabs.Trigger asChild` stylés en pastilles
 *  numérotées cliquables (libellé sur l'active, point rouge d'erreur). À placer dans `<Tabs.Root>`. */
export function StepTriggers(props: {
  steps: SectionDescriptor[];
  active: number;
  errors: Record<string, unknown>;
  t: (key: string) => string;
}): ReactNode {
  const { steps, active, errors, t } = props;
  return (
    <Tabs.List className="flex flex-wrap items-center justify-end gap-2">
      {steps.map((s, i) => {
        const hasErr = sectionHasError(s, errors);
        const isActive = i === active;
        return (
          <Tabs.Trigger key={s.id} value={s.id} asChild>
            <Button type="button" size="sm"
              variant={isActive ? "default" : "outline"}
              className={`relative h-8 rounded-full ${isActive ? "px-3" : "w-8 p-0"}`}
              data-testid={`step-${s.id}`}
              data-error={hasErr ? "true" : "false"}
              aria-label={s.label ? t(s.label) : `${i + 1}`}>
              {s.icon
                ? <DynamicIcon name={s.icon as IconName} fallback={() => <span className="text-xs font-semibold">{i + 1}</span>} className="h-4 w-4 shrink-0" />
                : <span className="text-xs font-semibold">{i + 1}</span>}
              {isActive && s.label && <span className="ml-2 text-xs font-medium">{t(s.label)}</span>}
              {hasErr && <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-destructive" aria-hidden="true" />}
            </Button>
          </Tabs.Trigger>
        );
      })}
    </Tabs.List>
  );
}

/** Barre d'ONGLETS (layout `tabs`) = vraie `TabsList` shadcn/Radix avec libellés + icône d'erreur.
 *  L'onglet actif est géré par Radix (`Tabs.Root value`) ; à placer dans `<Tabs.Root>`. */
export function TabBar(props: {
  steps: SectionDescriptor[];
  errors: Record<string, unknown>;
  t: (key: string) => string;
}): ReactNode {
  const { steps, errors, t } = props;
  return (
    <TabsList className="flex w-full">
      {steps.map((s, i) => {
        const hasErr = sectionHasError(s, errors);
        return (
          <TabsTrigger key={s.id} value={s.id} className="flex-1 flex-col gap-1 sm:flex-row"
            data-testid={`step-${s.id}`} data-error={hasErr ? "true" : "false"}>
            {hasErr
              ? <AlertCircle className="h-4 w-4 shrink-0 text-destructive" aria-hidden="true" />
              : s.icon && <DynamicIcon name={s.icon as IconName} className="h-4 w-4 shrink-0" />}
            <span className="min-w-0 truncate">{s.label ? t(s.label) : `${i + 1}`}</span>
          </TabsTrigger>
        );
      })}
    </TabsList>
  );
}

/** Barre de progression linéaire animée (variant `progress:"bar"`) — largeur = (active+1)/total. */
export function ProgressBar(props: { active: number; total: number }): ReactNode {
  const pct = props.total > 0 ? ((props.active + 1) / props.total) * 100 : 0;
  return (
    <div className="w-full overflow-hidden rounded-full bg-muted h-1.5">
      <div
        className="h-full rounded-full bg-linear-to-r from-primary to-primary/70 transition-all duration-500 ease-out"
        style={{ width: `${pct}%` }}
        aria-hidden="true"
      />
    </div>
  );
}

/** Panneaux d'étapes = un `Tabs.Content` Radix par section (seul l'actif est monté). À placer dans `<Tabs.Root>`. */
export function StepPanels(props: { steps: SectionDescriptor[]; p: LayoutProps; values: FieldValues }): ReactNode {
  const { steps, p, values } = props;
  return steps.map((s) => (
    <Tabs.Content key={s.id} value={s.id} className="mt-0 focus-visible:outline-none">
      <section className="space-y-6">{renderSection(s, p, values)}</section>
    </Tabs.Content>
  ));
}

/** État de navigation par étape : suivi par ID (robuste au filtrage `visibleIf` des sections) — un index
 *  deviendrait incohérent si une section disparaît/réapparaît. `active` est dérivé de l'ID courant. */
export function useStepNav(p: LayoutProps, steps: SectionDescriptor[]) {
  const [activeId, setActiveId] = useState<string | undefined>(steps[0]?.id);
  const errors = p.form.formState.errors as Record<string, unknown>;

  // Index dérivé de l'ID ; clamp à 0 si l'étape courante a disparu (visibleIf) ou liste vide.
  const found = steps.findIndex((s) => s.id === activeId);
  const active = found >= 0 ? found : 0;
  const setActive = (i: number) => setActiveId(steps[i]?.id);

  // Saut au 1er step fautif après une soumission invalide.
  const submitCount = p.form.formState.submitCount;
  useEffect(() => {
    if (submitCount === 0) return;
    const firstBad = steps.findIndex((s) => sectionHasError(s, errors));
    if (firstBad >= 0) setActiveId(steps[firstBad].id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submitCount]);

  const current = steps[active];
  const isLast = active === steps.length - 1;
  const goNext = async () => {
    if (!current) return; // garde : aucune étape courante
    const ok = await p.form.trigger(sectionFieldNames(current) as never);
    if (ok) setActiveId(steps[Math.min(active + 1, steps.length - 1)]?.id);
  };
  const goPrev = () => setActiveId(steps[Math.max(active - 1, 0)]?.id);
  const selectById = (id: string) => setActiveId(id);
  return { active, setActive, errors, current, isLast, goNext, goPrev, selectById };
}

/** Footer séquentiel (wizard) : Précédent (gauche) · Annuler + Suivant/Submit (droite).
 *  `muted` (variant riche) ajoute un fond `bg-muted/30` (parité ancien tiers-lieu). */
export function SequentialFooter(props: { p: LayoutProps; active: number; isLast: boolean; goNext: () => void; goPrev: () => void; muted?: boolean }): ReactNode {
  const { p, active, isLast, goNext, goPrev, muted } = props;
  return (
    <div className={`shrink-0 flex items-center justify-between border-t px-6 py-4${muted ? " bg-muted/30" : ""}`}>
      <div>
        {active > 0 && <Button type="button" variant="outline" onClick={goPrev}>{p.texts.previous}</Button>}
      </div>
      <div className="flex gap-2">
        {p.onCancel && <Button type="button" variant="ghost" onClick={p.onCancel}>{p.texts.cancel}</Button>}
        {!isLast && <Button type="button" onClick={goNext}>{p.texts.next}</Button>}
        {isLast && <Button type="submit" disabled={p.submitting}>{p.submitLabel}</Button>}
      </div>
    </div>
  );
}

/** Footer global (flat/tabs) : Annuler + Submit (toujours dispo, validation globale). */
export function Footer(p: LayoutProps): ReactNode {
  return (
    <div className="shrink-0 flex justify-end gap-2 border-t px-6 py-4">
      {p.onCancel && <Button type="button" variant="ghost" onClick={p.onCancel}>{p.texts.cancel}</Button>}
      <Button type="submit" disabled={p.submitting}>{p.submitLabel}</Button>
    </div>
  );
}
