/**
 * Banc d'essai DEV du moteur de formulaire générique (`GenericForm`).
 * Monté UNIQUEMENT en dev via `buildRoutes` (`/dev/form-engine`), pour que Playwright
 * exerce le moteur EN NAVIGATEUR, en isolation (sans auth / backend / costum / serverData).
 *
 * Descripteur auto-suffisant qui couvre les briques du moteur :
 *  - layout wizard (2 steps) + navigation + validation par step,
 *  - champ requis (`name`) → blocage du Next,
 *  - conditionnel (`detail` visibleIf+requiredIf `withDetails` truthy),
 *  - valeur calculée (`surface` = longueur × largeur via le compute "multiply").
 *
 * Rendu CLIENT-ONLY (flag `mounted` + import paresseux de `GenericForm`) : la registry
 * de widgets importe des composants potentiellement non-SSR-safe ; on n'y touche qu'après
 * hydratation pour ne pas casser le rendu serveur du dev-server.
 */
import { lazy, Suspense, useMemo, useState } from "react";
import type { FieldValues } from "react-hook-form";
import { useHydrated } from "@/hooks/useHydrated";
import type { FormDescriptor } from "@/modules/formEngine";

const GenericForm = lazy(() =>
  import("@/modules/formEngine").then((m) => ({ default: m.GenericForm })),
);

const TEST_DESCRIPTOR: FormDescriptor = {
  id: "dev-test",
  collection: "poi",
  layout: { kind: "wizard" },
  sections: [
    {
      id: "infos", label: "Infos",
      groups: [
        { columns: 2, fields: ["name", "withDetails"] },
        // sous-bloc à titre, conditionné par le GROUPE (titre + champ masqués si OFF).
        { columns: 1, label: "Bloc detail", visibleIf: { field: "withDetails", op: "truthy" }, fields: ["detail"] },
      ],
    },
    {
      id: "metrics", label: "Mesures",
      groups: [
        { columns: 2, fields: ["longueur", "largeur"] },
        { columns: 1, fields: ["surface"] },
        // widgets avancés : select value≠label, horaires, liste répétable d'objets.
        { columns: 1, fields: ["kind", "hours", "links"] },
      ],
    },
  ],
  fields: {
    name: { name: "name", type: "string", widget: "text", label: "Nom", required: true },
    withDetails: { name: "withDetails", type: "boolean", widget: "switch", label: "Mode avance" },
    detail: {
      name: "detail", type: "string", widget: "text", label: "Detail",
      visibleIf: { field: "withDetails", op: "truthy" },
      requiredIf: { field: "withDetails", op: "truthy" },
    },
    longueur: { name: "longueur", type: "number", widget: "number", label: "Longueur" },
    largeur: { name: "largeur", type: "number", widget: "number", label: "Largeur" },
    surface: {
      name: "surface", type: "number", widget: "number", label: "Surface",
      computedFrom: { deps: ["longueur", "largeur"], fn: "multiply" },
    },
    // value ≠ label : le widget doit afficher le label, stocker la value.
    kind: {
      name: "kind", type: "string", widget: "select", label: "Type",
      enum: [{ value: "a", label: "Type A" }, { value: "b", label: "Type B" }],
    },
    hours: {
      name: "hours", type: "object", widget: "openingHours", label: "Horaires",
      widgetProps: { days: ["monday", "tuesday"] },
    },
    links: {
      name: "links", type: "array", widget: "fieldArray", label: "Liens",
      widgetProps: {
        addLabel: "Ajouter un lien",
        itemFields: [
          { name: "platform", kind: "select", label: "Plateforme", options: [{ value: "fb", label: "Facebook" }, { value: "tw", label: "Twitter" }] },
          { name: "url", kind: "text", placeholder: "URL" },
        ],
      },
    },
  },
};

const DEFAULTS: FieldValues = {
  name: "", withDetails: false, detail: "",
  longueur: undefined, largeur: undefined, surface: undefined,
  kind: "", hours: {}, links: [],
};

export default function FormEngineDevPage() {
  // Rendu client-only : la registry de widgets importe des composants potentiellement
  // non-SSR-safe ; on n'y touche qu'après hydratation (le dev-server SSR rend le loader).
  const mounted = useHydrated();
  const [submitted, setSubmitted] = useState<string | null>(null);
  const [cancelled, setCancelled] = useState(false);
  const [invalid, setInvalid] = useState(false);

  // Layout pilotable par l'URL (?layout=wizard|tabs|flat) pour tester chaque variante.
  const layoutKind = mounted ? (new URLSearchParams(window.location.search).get("layout") ?? "wizard") : "wizard";
  const descriptor = useMemo<FormDescriptor>(
    () => ({ ...TEST_DESCRIPTOR, layout: { ...TEST_DESCRIPTOR.layout, kind: layoutKind } }),
    [layoutKind],
  );

  return (
    <div style={{ maxWidth: 640, margin: "2rem auto", padding: "1rem" }}>
      <h1 data-testid="fe-title" className="mb-3 text-lg font-semibold">Form Engine Dev Harness</h1>
      {/* Coquille type dialog (hauteur fixe + flex-col) → footer épinglé + corps scrollable. */}
      <div className="flex h-[70vh] flex-col overflow-hidden rounded-lg border bg-card">
        {!mounted ? (
          <div data-testid="fe-loading" className="p-6">loading…</div>
        ) : (
          <Suspense fallback={<div data-testid="fe-loading" className="p-6">loading…</div>}>
            <GenericForm
              descriptor={descriptor}
              defaultValues={DEFAULTS}
              t={(k) => k}
              submitLabel="Submit"
              texts={{ next: "Next", previous: "Previous", cancel: "Cancel", stepLabel: (i, n) => `Étape ${i} / ${n}` }}
              onCancel={() => setCancelled(true)}
              onInvalid={() => setInvalid(true)}
              onSubmit={(values) => { setInvalid(false); setSubmitted(JSON.stringify(values)); }}
            />
          </Suspense>
        )}
      </div>
      {submitted !== null && <pre data-testid="fe-submitted">{submitted}</pre>}
      {cancelled && <div data-testid="fe-cancelled">cancelled</div>}
      {invalid && <div data-testid="fe-invalid">invalid</div>}
    </div>
  );
}
