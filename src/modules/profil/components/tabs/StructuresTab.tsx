import "@/modules/profil/i18n";
import { Building2 } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { Link } from "react-router";
import type { Organization } from "@communecter/cocolight-api-client";

import { Accordion } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useCocolight } from "@/hooks/useCocolight";
import { useHydrated } from "@/hooks/useHydrated";
import { useT } from "@/hooks/useT";

import { useUserOrganizations } from "../../hooks/useMembershipQuery";
import { validatedAdminLinkFilters } from "../../lib/adminLinks";
import { defaultOpenStructures } from "../../lib/managedStructures";
import type { StructuresTabProps } from "../../schema";
import { TOUCH_BUTTON } from "../structures/constants";
import { ManagedStructureItem } from "../structures/ManagedStructureItem";
import { RetryAlert } from "../structures/RetryAlert";
import { SubmittedSlotsItem } from "../structures/SubmittedSlotsItem";

/** Une structure exploitable a un id : c'est la clé de sa requête, de son brouillon et de l'accordéon. */
function aUnId(structure: Organization): structure is Organization & { id: string } {
  return typeof structure.id === "string" && structure.id !== "";
}

/** Squelette pendant le chargement, annoncé aux lecteurs d'écran (un squelette muet ne dit rien). */
function StructuresSkeleton({ label }: { label: string }) {
  return (
    <div role="status" className="space-y-3">
      <span className="sr-only">{label}</span>
      <Skeleton className="h-[72px] w-full rounded-xl" />
      <Skeleton className="h-[72px] w-full rounded-xl" />
    </div>
  );
}

/**
 * Onglet « Structures » du profil (propriétaire seulement, cf. `condition.userContext: own`) : les
 * structures que le compte administre — admin VALIDÉ, la règle du serveur ; tous statuts de
 * modération, signalés hors « Validé » (`structureStatusField`) — chacune avec ses créneaux de tous
 * statuts et un bouton d'ajout. Accordéon : jusqu'à trois structures tout est déplié, au-delà la
 * première seule (`defaultOpenStructures`). En option, « Modifier » dans le détail d'un créneau
 * (`answers.editButton`) et le groupe des créneaux déposés ailleurs (`answers.submittedSlots`).
 *
 * Tout dépend de `me` : neutralisé avant l'hydratation (patron `MyPlacesSection`), le HTML serveur et
 * le 1er rendu client sont identiques (titre + squelette), et rien n'est préchargé côté serveur.
 */
export default function StructuresTab({ answers, scope = "costum", emptyAction, structureStatusField }: StructuresTabProps) {
  const t = useT("modules/profil");
  const hydrated = useHydrated();
  const { me: meBrut, entity: porteur } = useCocolight();
  const me = hydrated ? meBrut : null;
  // Le slug du PORTEUR du site est le périmètre `costum` : le serveur le compare à `source.keys` /
  // `reference.costum` (même convention que `MembershipTab`).
  const slugPorteur = (porteur as { slug?: string } | null)?.slug;

  const userId = me?.id ?? null;
  // Pas de mémo : la clé de requête est comparée par VALEUR, un nouvel objet de filtres ne la change pas.
  const filters = userId ? validatedAdminLinkFilters(userId) : undefined;
  const { organizations, isLoading, error, refetch, lastItemRef } = useUserOrganizations(me, {
    indexStep: 20,
    filters,
    ...(scope === "costum" && slugPorteur ? { sourceKey: [slugPorteur] } : {}),
    enabled: !!userId,
  });
  // Les structures exploitables, et leurs ids pour ranger chaque créneau déposé à un seul endroit.
  // Mémo sur `organizations` (stable entre deux pages) : le Set garde sa référence, l'exclusion du
  // groupe des créneaux déposés ne se recalcule qu'à l'arrivée d'une page.
  const { structures, listedIds } = useMemo(() => {
    const liste = organizations.filter(aUnId);
    return { structures: liste, listedIds: new Set(liste.map((s) => s.id)) };
  }, [organizations]);
  // Repli ultime du focus : le titre de l'onglet, quand le groupe d'où venait le focus disparaît.
  const titreRef = useRef<HTMLHeadingElement>(null);

  // Dépliage par défaut calculé UNE fois, à l'arrivée de la première page (ajustement pendant le
  // rendu, patron du dépôt) : une page suivante ne replie ni ne déplie rien d'elle-même.
  const [ouvertes, setOuvertes] = useState<string[] | null>(null);
  if (ouvertes === null && structures.length > 0) {
    setOuvertes(defaultOpenStructures(structures.map((s) => s.id)));
  }
  const deplier = (id: string) => setOuvertes((courantes) => [...new Set([...(courantes ?? []), id])]);

  let contenu;
  if (!userId || isLoading) {
    contenu = <StructuresSkeleton label={t("StructuresTab.loading")} />;
  } else if (error) {
    contenu = <RetryAlert message={t("StructuresTab.loadError")} onRetry={() => void refetch()} />;
  } else if (structures.length === 0) {
    // Ce que voient la plupart des comptes (l'onglet est proposé à tout citoyen connecté, sur son
    // profil) : dire comment faire apparaître une structure, et y mener par un LIEN.
    contenu = (
      <div className="py-12 text-center">
        <Building2 aria-hidden="true" className="mx-auto mb-4 size-10 text-muted-foreground" />
        <p className="mb-2 font-medium text-foreground">{t("StructuresTab.emptyTitle")}</p>
        <p className="mx-auto mb-4 max-w-prose text-sm text-muted-foreground">{t("StructuresTab.emptyDescription")}</p>
        {emptyAction && (
          <Button asChild className={TOUCH_BUTTON}>
            <Link to={emptyAction.href}>{t(emptyAction.label)}</Link>
          </Button>
        )}
      </div>
    );
  } else {
    contenu = (
      <Accordion type="multiple" value={ouvertes ?? []} onValueChange={setOuvertes} className="space-y-3">
        {structures.map((structure, i) => (
          <ManagedStructureItem
            key={structure.id}
            structure={structure}
            structureId={structure.id}
            userId={userId}
            answers={answers}
            structureStatusField={structureStatusField}
            isOpen={(ouvertes ?? []).includes(structure.id)}
            onAdded={deplier}
            itemRef={i === structures.length - 1 ? lastItemRef : undefined}
          />
        ))}
      </Accordion>
    );
  }

  return (
    <section aria-labelledby="structures-tab-title" className="space-y-6">
      <header className="space-y-1">
        <h2 id="structures-tab-title" ref={titreRef} tabIndex={-1} className="text-xl font-semibold text-foreground">
          {t("StructuresTab.title")}
        </h2>
        <p className="max-w-prose text-sm text-muted-foreground">{t("StructuresTab.intro")}</p>
      </header>
      {contenu}
      {/* Après les structures, et seulement quand leur liste est connue : l'exclusion des créneaux
          déjà rangés en a besoin. Sous l'état vide aussi — un compte sans structure peut avoir
          déposé des créneaux. */}
      {answers.submittedSlots && userId && !isLoading && !error && (
        <SubmittedSlotsItem
          userId={userId}
          answers={answers}
          listedStructureIds={listedIds}
          afterStructures={structures.length > 0}
          focusFallbackRef={titreRef}
        />
      )}
    </section>
  );
}
