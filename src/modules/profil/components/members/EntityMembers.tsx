import "@/modules/profil/i18n";
import { Suspense, useState } from "react";
import { lazy } from "vite-preload";
import { useT } from "@/hooks/useT";
import { useLoadNamespace } from "@/hooks/useLoadNamespace";
import { useDebounce } from "@/hooks/useDebounce";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Users, UserPlus, Settings, Search, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { EntityTypes, Organization, User, SearchEntity } from "@communecter/cocolight-api-client";
import type { LocalizedString } from "@/types/locale-schema";
import { isEvent, isOrganization, isProject } from "@/lib/getTypedEntity";
import { useEntityMembers } from "../../hooks/useMembersQuery";
import { useEntityLabels } from "../../hooks/useEntityLabels";
import { useProfilPermissions } from "../../hooks/useProfilPermissions";
import { useConfirmationDialog } from "../../hooks/useConfirmationDialog";
import { PROFIL_QUERY_KEYS } from "../../constants/queryKeys";
import { MemberListRenderer } from "./MemberListRenderer";
import { MemberManagementDialog } from "./MemberManagementDialog";
import { InviteMemberDialog } from "./InviteMemberDialog";
import { ConfirmationDialog } from "./ConfirmationDialog";
import CardProfile from "@/modules/search/components/card/CardProfile";
import { exigerConvention, type ConventionRattachement } from "../../lib/teamDirectory";

// Variante EXCLUSIVE : `card.type` n'en rend qu'une à la fois, et « team » ne sert qu'aux pages
// vitrines d'un seul site. En statique, tout le parc embarquait la carte, sa lecture de fiche et
// ses helpers de rattachement dans le bundle initial. `lazy` de `vite-preload` (et non `React.lazy`)
// pour garder le tracking SSR et l'injection de `<link modulepreload>`. Constante de module :
// évaluée une seule fois, donc référence stable d'un render à l'autre.
const CardTeamMember = lazy(() => import("./CardTeamMember"));
import { SwitchDetailsMode } from "@/modules/search/components/SwitchDetailsMode";

export interface MemberCardConfig {
  type?: "default" | "profile" | "team";
  /** Disposition de la carte « équipe » — cf. `MemberCardConfSchema.layout`. */
  layout?: "stack" | "row";
  /** Convention de rattachement — cf. `MemberCardConfSchema.rattachement`. */
  rattachement?: ConventionRattachement;
  /** Couleur fixe de la carte « équipe », prime sur `rattachement` — cf. `MemberCardConfSchema.fixedColors`. */
  fixedColors?: { fond: string; encre: string; bordure?: string };
  /** Plafond de colonnes de la grille « équipe » — cf. `MemberCardConfSchema.maxColumns`. */
  maxColumns?: 2 | 3 | 4;
  showDescription?: boolean;
  showAddress?: boolean;
  /** Bloc de compteurs de `CardProfile`. Absent = affiché — cf. `MemberCardConfSchema.showStats`. */
  showStats?: boolean;
  detailsMode?: "drawer" | "dialog" | "link";
}

interface EntityMembersProps {
  /** Entité résolue (org → membres, projet → contributeurs, event → participants). */
  entity: EntityTypes | null;
  title?: LocalizedString | string;
  /** Affiche les badges de rôle sur les cartes. */
  showRole?: boolean;
  /** Affiche le bouton "Gérer" (admins). */
  showManagement?: boolean;
  /** Active les actions inline (gérer/confirmer) — mode page de profil. */
  showActions?: boolean;
  /** Affiche l'input de recherche. */
  search?: boolean;
  /** Enveloppe dans une `<Card>` (défaut: true). */
  showCard?: boolean;
  /** Barre d'onglets (Membres / Admins / À valider). `true` par défaut = historique. `false` quand la
   *  page ne montre qu'une liste filtrée : les onglets y proposeraient une autre population que celle
   *  que la section annonce. */
  showTabs?: boolean;
  /** Titre interne de la liste. `true` par défaut = historique. `false` quand la page porte déjà son
   *  propre titre de section, pour ne pas l'afficher deux fois. */
  showTitle?: boolean;
  /** Bouton « Inviter ». `true` par défaut = historique. `false` sur une page vitrine, où la
   *  gestion n'a pas sa place même pour un admin de passage — elle vit dans l'espace admin.
   *  Nommé `…Button` : `showInvite` est déjà l'état d'ouverture de la modale. */
  showInviteButton?: boolean;
  /** Restreint la liste aux membres portant l'un de ces rôles (texte libre du lien).
   *  Absent → tous les membres, comme avant. */
  roles?: string[];
  /** Filtre SERVEUR complémentaire sur les documents des membres (`{ territoires: "Arrageois" }`),
   *  fusionné côté SDK sous le filtre d'appartenance. Combiné à `roles`, c'est ce qui donne « le
   *  coordonnateur DE ce territoire » — en une requête, exacte quel que soit l'effectif. Égalité
   *  Mongo : la valeur doit être EXACTEMENT celle stockée sur les profils. */
  filters?: Record<string, unknown>;
  /** Champs AJOUTÉS à la projection de la liste — ceux que la carte lit et que la projection par
   *  défaut ne ramène pas (`territoires`, `telephone`, `email`…). */
  fields?: string[];
  /** Texte libre sous la liste (canal de contact d'une équipe). Sauts de ligne respectés.
   *  Ne s'affiche que si AUCUNE carte n'est rendue — sinon `cardText` prend le relais. */
  footerText?: LocalizedString | string;
  /** Texte libre posé dans chaque carte « équipe », sous les contacts de la personne. */
  cardText?: LocalizedString | string;
  /** Masque TOUTE la section quand la liste finit vide. Sur une page vitrine, « Aucun membre »
   *  ressemble à une panne ; l'absence de coordonnateur rattaché doit juste ne rien afficher. */
  hideWhenEmpty?: boolean;
  /** Mode de rendu des cartes. */
  card?: MemberCardConfig;
}

type MemberItem = User | Organization;

/** Colonnes selon le nombre de cartes — au-delà de 4, on garde la grille pleine. Réservé à la
 *  carte « équipe » : la grille `profile` historique reste pleine largeur quel que soit l'effectif. */
const GRILLE_CARTES: Record<number, string> = {
  1: "max-w-sm grid-cols-1",
  2: "max-w-2xl grid-cols-1 sm:grid-cols-2",
  3: "max-w-4xl grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
  4: "grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4",
};

/** Variante élargie de `GRILLE_CARTES[3]`, réservée à `card.maxColumns` (opt-in) — une section qui
 *  tombe à 3 cartes par le SEUL effet de son effectif naturel (sans `maxColumns` configuré) garde
 *  `max-w-4xl` partout, y compris sur les autres sites du parc. */
const GRILLE_CARTES_PLAFONNEE: Record<number, string> = {
  ...GRILLE_CARTES,
  3: "max-w-5xl grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
};

/** Grille de cartes "profile" (CardProfile) avec ouverture de détail (drawer/dialog). */
function ProfileCardList({
  members,
  isLoading,
  isFetchingNextPage,
  showRole,
  isPending,
  card,
  contactText,
  entity,
  lastItemRef,
  emptyLabel,
  loadingMoreLabel,
}: {
  members: MemberItem[];
  isLoading?: boolean;
  isFetchingNextPage?: boolean;
  showRole?: boolean;
  isPending?: boolean;
  card?: MemberCardConfig;
  /** Coordonnées d'équipe posées DANS chaque carte (déjà traduites). */
  contactText?: string;
  /** Entité porteuse : source des rôles de lien pour la carte « équipe ». */
  entity?: EntityTypes | null;
  lastItemRef?: (node: HTMLElement | null) => void;
  emptyLabel: string;
  loadingMoreLabel: string;
}) {
  const [openDetails, setOpenDetails] = useState(false);
  const [selectedItem, setSelectedItem] = useState<MemberItem | null>(null);
  const detailsMode = card?.detailsMode || "link";
  const enEquipe = card?.type === "team";
  // Convention OBLIGATOIRE pour la carte « équipe » : lue une fois, échoue tôt si la config l'omet.
  const conventionEquipe = enEquipe ? exigerConvention(card?.rattachement) : null;

  const handleOpenDetails = (member: MemberItem) => {
    if (detailsMode === "link") return;
    setSelectedItem(member);
    setOpenDetails(true);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (members.length === 0) {
    return <div className="text-center py-12 text-muted-foreground">{emptyLabel}</div>;
  }

  return (
    <div className="space-y-4">
      {/* En « équipe », le nombre de colonnes est PLAFONNÉ par le nombre de cartes : avec une seule
          fiche (le contact CAF) ou deux (l'animation départementale), une grille à 4 colonnes les
          tasse à gauche et laisse les trois quarts vides. `mx-auto` recentre alors le bloc. `maxColumns`
          (opt-in, cf. schéma) abaisse encore ce plafond pour un effectif nombreux voulu plus resserré
          (ex. 9 coordonnateurs en 3×3 plutôt qu'en 4 colonnes) — SEUL ce cas opt-in élargit la
          grille à 3 colonnes (`GRILLE_CARTES_PLAFONNEE`) ; un effectif naturel de 3 (sans
          `maxColumns`) garde la largeur historique, inchangée pour le reste du parc. Classes
          littérales — le JIT ne génère pas de classe construite. */}
      <div className={cn(
        "mx-auto grid w-full gap-4",
        enEquipe
          ? (card?.maxColumns ? GRILLE_CARTES_PLAFONNEE : GRILLE_CARTES)[Math.min(members.length, card?.maxColumns ?? 4)]
          : GRILLE_CARTES[4],
      )}>
        {members.map((member, index) => {
          const isLastItem = index === members.length - 1;
          // Variante « équipe » : carte vitrine, lue sur la liste projetée (`fields`).
          const cardElement = conventionEquipe ? (
            // Repli à la MÊME hauteur que la carte : sans lui, la grille se replierait le temps du
            // chunk et la page sauterait sous les yeux du visiteur.
            <Suspense key={member.id || index} fallback={<div className="h-80 animate-pulse rounded-2xl bg-muted" />}>
              <CardTeamMember
                member={member}
                entity={entity ?? null}
                contactText={contactText}
                layout={card?.layout}
                rattachement={conventionEquipe}
                fixedColors={card?.fixedColors}
              />
            </Suspense>
          ) : (
            <CardProfile
              key={member.id || index}
              item={member}
              index={index}
              showBadges={showRole}
              isPending={isPending}
              card={{
                showDescription: card?.showDescription,
                showAddress: card?.showAddress,
                showStats: card?.showStats,
                detailsMode: detailsMode === "link" ? "link" : undefined,
              }}
              onClick={detailsMode !== "link" ? () => handleOpenDetails(member) : undefined}
            />
          );

          if (isLastItem && lastItemRef) {
            return (
              <div key={member.id || index} ref={lastItemRef as (node: HTMLDivElement | null) => void}>
                {cardElement}
              </div>
            );
          }
          return cardElement;
        })}
      </div>

      {isFetchingNextPage && (
        <div className="flex items-center justify-center py-4">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <span className="ml-2 text-sm text-muted-foreground">{loadingMoreLabel}</span>
        </div>
      )}

      {selectedItem && detailsMode !== "link" && (
        <SwitchDetailsMode
          openDetails={openDetails}
          setOpenDetails={setOpenDetails}
          item={selectedItem as unknown as SearchEntity}
          card={{ detailsMode: detailsMode === "drawer" ? "drawer" : "dialog" }}
        />
      )}
    </div>
  );
}

/**
 * Cœur générique d'affichage des membres d'une entité (org → membres,
 * projet → contributeurs, event → participants). Onglets all/pending/admins,
 * recherche optionnelle, dialogs invite/gestion, modes liste ou cartes-profil.
 *
 * Consommé par `<ProfileMembers>` (onglet de profil) et la section `member`.
 */
export function EntityMembers({
  entity,
  title,
  showRole,
  showManagement,
  showActions = false,
  search = false,
  showCard = true,
  card,
  roles,
  filters,
  fields,
  footerText,
  cardText,
  hideWhenEmpty = false,
  showTabs = true,
  showTitle = true,
  showInviteButton = true,
}: EntityMembersProps) {
  useLoadNamespace("modules/profil");
  const t = useT("modules/profil");
  const queryClient = useQueryClient();

  const [selectedTab, setSelectedTab] = useState("all");
  const [showInvite, setShowInvite] = useState(false);
  const [showManagementDialog, setShowManagementDialog] = useState(false);
  const { confirmation, showConfirmation, hideConfirmation, executeAction } = useConfirmationDialog();

  const [searchInput, setSearchInput] = useState("");
  const debouncedSearch = useDebounce(searchInput, 400);

  const permissions = useProfilPermissions(entity);
  const labels = useEntityLabels(entity);

  const canManage = permissions.isAdmin || (entity ? isEvent(entity) && permissions.isAuthor : false);
  const canManageInline = showActions && canManage;

  // La recherche n'est appliquée qu'à l'onglet actif (évite de relancer 3 requêtes par frappe).
  const searchParams = search && debouncedSearch.trim() ? { search: debouncedSearch.trim() } : {};
  // `roles` absent → aucun filtre (comportement historique). Présent → la liste se restreint aux
  // membres portant l'un de ces rôles : c'est ce qui permet à une page de composer une équipe
  // par fonction plutôt que de lister tout le monde.
  const filtreRoles = roles && roles.length > 0 ? { roles } : {};
  // Filtre et projection SERVEUR (SDK ≥ 1.0.194), posés sur les listes que la page affiche
  // (« tous » et « admins »), jamais sur « à valider », écran de gestion. La garde « non vide »
  // vit dans `useInfiniteEntityQuery`, pas ici.
  const projection = { filters, fields };
  // Buckets GATÉS : sans onglets, seule « tous » est rendue — `pending` et `admins` partaient
  // quand même (dont un fetch de l'adhésion entière par section vitrine). `entity: null` = hook
  // inerte, même motif que `admin/sections/MembersSection`.
  const all = useEntityMembers(entity, { toBeValidated: false, ...filtreRoles }, { ...(selectedTab === "all" ? searchParams : {}), ...projection });
  const pending = useEntityMembers(showTabs && canManage ? entity : null, { toBeValidated: true }, selectedTab === "pending" ? searchParams : {});
  const admins = useEntityMembers(showTabs ? entity : null, { isAdmin: true, ...filtreRoles }, { ...(selectedTab === "admins" ? searchParams : {}), ...projection });

  /** Rafraîchit la liste après invitation/gestion — clé basée sur le slug + type (bug historique : clé par ID). */
  const refresh = () => {
    if (!entity) return;
    const slug = entity.slug ?? null;
    if (isOrganization(entity)) {
      queryClient.invalidateQueries({ queryKey: PROFIL_QUERY_KEYS.ORGANIZATION_MEMBERS_PREFIX(slug) });
    } else if (isProject(entity)) {
      queryClient.invalidateQueries({ queryKey: PROFIL_QUERY_KEYS.PROJECT_CONTRIBUTORS_PREFIX(slug) });
    } else if (isEvent(entity)) {
      queryClient.invalidateQueries({ queryKey: PROFIL_QUERY_KEYS.EVENT_ATTENDEES_PREFIX(slug) });
    }
  };

  if (!entity) return null;

  // Rien à montrer : on efface plutôt que d'afficher un état vide sur une page publique. Le
  // chargement reste visible, sinon le bloc clignoterait à chaque navigation.
  const aucuneCarte = !all.isLoading && (all.members || []).length === 0;
  const masquerListe = hideWhenEmpty && aucuneCarte;
  // …sauf si un pied porte encore du contenu : effacer la section entière emporterait avec elle
  // le canal de contact, qui doit justement survivre à l'absence de membre rattaché.
  if (masquerListe && !footerText) return null;

  const resolvedTitle = title ? t(title) : labels.title;
  // `team` emprunte la même grille de cartes que `profile` — c'est la CARTE qui diffère,
  // pas la disposition. Sans ce test, la variante retombait sur la liste en lignes.
  const useProfileCard = card?.type === "profile" || card?.type === "team";

  // Deux textes, deux rôles. `cardText` complète la carte : elle porte déjà le courriel et le
  // téléphone DE LA PERSONNE, il n'y reste à dire que ce que sa fiche ignore (le lieu de
  // permanence). `footerText` est le repli quand AUCUNE carte n'est rendue — sans lui, un
  // territoire sans coordonnateur rattaché perdrait tout moyen de contact.
  // « Au moins une carte rendue », et non « liste non masquée » : sans `hideWhenEmpty`, une liste
  // vide affiche l'état « Aucun membre » ET doit garder le pied — sinon plus aucun contact.
  const cartesAffichees = card?.type === "team" && !aucuneCarte;
  const texteCarte = cartesAffichees && cardText ? t(cardText) : undefined;

  const renderList = (
    bucket: ReturnType<typeof useEntityMembers>,
    isPending: boolean
  ) => {
    const members = (bucket.members || []) as MemberItem[];
    if (useProfileCard) {
      return (
        <ProfileCardList
          members={members}
          isLoading={bucket.isLoading}
          isFetchingNextPage={bucket.isFetchingNextPage}
          showRole={showRole}
          isPending={isPending}
          card={card}
          contactText={texteCarte}
          entity={entity}
          lastItemRef={bucket.lastItemRef}
          emptyLabel={t("ProfileMembers.noMembers")}
          loadingMoreLabel={t("ProfileMembers.loadingMore")}
        />
      );
    }
    return (
      <MemberListRenderer
        members={members}
        entity={entity}
        isLoading={bucket.isLoading}
        showActions={canManageInline}
        showBadges={showRole}
        isPending={isPending}
        lastItemRef={bucket.lastItemRef}
        isFetchingNextPage={bucket.isFetchingNextPage}
        showConfirmation={canManageInline ? showConfirmation : undefined}
      />
    );
  };

  const header = (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {showTitle ? (
          // La carte « équipe » est la variante VITRINE : son titre suit l'idiome des sections de
          // page (h2 centré) et non celui de l'espace de gestion (libellé + icône, à gauche).
          card?.type === "team" ? (
            <h2 className="w-full text-center text-2xl font-bold">{resolvedTitle}</h2>
          ) : (
            <div className="flex items-center space-x-2 text-xl font-semibold">
              <Users className="h-5 w-5" />
              <span>{resolvedTitle}</span>
            </div>
          )
        ) : (
          // Le conteneur reste : c'est lui qui pousse les boutons de gestion à droite.
          <div />
        )}
        {canManage && (showInviteButton || showManagement) && (
          <div className="flex flex-wrap items-center gap-2">
            {showInviteButton && (
            <Button variant="outline" size="sm" onClick={() => setShowInvite(true)} disabled={!permissions.canEditProfile}>
              <UserPlus className="h-4 w-4 sm:mr-1" />
              <span className="hidden sm:inline">{labels.invite}</span>
            </Button>
            )}
            {showManagement && (
              <Button variant="outline" size="sm" onClick={() => setShowManagementDialog(true)} disabled={!permissions.canEditProfile}>
                <Settings className="h-4 w-4 sm:mr-1" />
                <span className="hidden sm:inline">{t("ProfileMembers.manage")}</span>
              </Button>
            )}
          </div>
        )}
      </div>
      {search && (
        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder={t("ProfileMembers.searchPlaceholder")}
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="pl-9 w-full h-9"
          />
        </div>
      )}
    </div>
  );

  // Sans onglets : la seule liste utile est « tous », déjà restreinte par `roles`/`filters`.
  // `masquerListe` : la liste s'efface, le pied reste — c'est lui qui porte alors le bloc.
  const tabs = masquerListe ? null : !showTabs ? (
    <div className="mt-2">{renderList(all, false)}</div>
  ) : (
    <Tabs value={selectedTab} onValueChange={setSelectedTab}>
      <TabsList className={cn("grid w-full", canManage ? "grid-cols-3" : "grid-cols-2")}>
        <TabsTrigger value="all" className="text-xs sm:text-sm">
          {labels.members} ({all.totalCount})
        </TabsTrigger>
        {canManage && (
          <TabsTrigger value="pending" className="text-xs sm:text-sm">
            {labels.pending} ({pending.totalCount})
          </TabsTrigger>
        )}
        <TabsTrigger value="admins" className="text-xs sm:text-sm">
          {labels.admin}s ({admins.totalCount})
        </TabsTrigger>
      </TabsList>

      <TabsContent value="all" className="mt-4">{renderList(all, false)}</TabsContent>
      {canManage && <TabsContent value="pending" className="mt-4">{renderList(pending, true)}</TabsContent>}
      <TabsContent value="admins" className="mt-4">{renderList(admins, false)}</TabsContent>
    </Tabs>
  );

  const pied = footerText && !cartesAffichees ? (
    <p className="mt-4 whitespace-pre-line text-center text-sm leading-relaxed text-muted-foreground">
      {t(footerText)}
    </p>
  ) : null;

  const dialogs = (
    <>
      {showManagementDialog && (
        <MemberManagementDialog
          entity={entity}
          open={showManagementDialog}
          onOpenChange={(open) => {
            setShowManagementDialog(open);
            if (!open) refresh();
          }}
        />
      )}
      {showInvite && (
        <InviteMemberDialog
          entity={entity}
          open={showInvite}
          onOpenChange={(open) => {
            setShowInvite(open);
            if (!open) refresh();
          }}
        />
      )}
      <ConfirmationDialog confirmation={confirmation} onOpenChange={hideConfirmation} onConfirm={executeAction} />
    </>
  );

  if (!showCard) {
    return (
      <div className="flex flex-col gap-3">
        {header}
        {tabs}
        {pied}
        {dialogs}
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>{header}</CardHeader>
      <CardContent>
        {tabs}
        {pied}
      </CardContent>
      {dialogs}
    </Card>
  );
}

export default EntityMembers;
