import { useMemo, useState, useCallback } from "react";
import { useNavigate } from "react-router";
import { Helmet } from "@dr.pogodin/react-helmet";
import { toast } from "sonner";
import { Building2, ChevronRight, Loader2, Search, UserPlus } from "lucide-react";
import { cn } from "@/lib/utils";
import { useT } from "@/hooks/useT";
import { useCocolight } from "@/hooks/useCocolight";
import { useUserEligiblePlaces } from "@/modules/profil/hooks/useMembershipQuery";
import { calculateOrganizationPermissions } from "@/modules/profil/permissions/calculators/organization";
import {
  useRequestToJoin,
  useRequestToJoinAdmin,
  useAcceptInvitation,
  useRejectInvitation,
} from "@/modules/profil/actions/mutations/relationship";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FinderSearchModal } from "./FinderSearchModal";
import { getSharedFinderInfo } from "../utils/formParser";
import { buildFinderMongoFilters } from "../utils/finderFilters";
import { pickProfileImageUrl } from "../utils/helpers";
import type { CoFormData, FinderConfig, FinderElement } from "../types";
import type { Organization } from "@communecter/cocolight-api-client";

interface PlacesListViewProps {
  formData: CoFormData;
  formId: string;
}

// ─── Sub-component : ligne d'un lieu (Admin / Membre) ──────────────────────

interface PlaceRowProps {
  org: Organization;
  role: "admin" | "member";
  onOpen: (org: Organization) => void;
  i18n: { admin: string; member: string; open: string };
}

function PlaceRow({ org, role, onOpen, i18n }: PlaceRowProps) {
  const data = (org as unknown as { serverData?: Record<string, unknown> }).serverData ?? {};
  const name = (data.name as string) || (org as unknown as { name?: string }).name || "—";
  const logoUrl = pickProfileImageUrl(data);

  return (
    <button
      type="button"
      onClick={() => onOpen(org)}
      className={cn(
        "w-full flex items-center gap-3 p-3 rounded-lg border bg-card",
        "hover:bg-muted transition-colors text-left cursor-pointer",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      )}
    >
      {/* Avatar — rendu aligné sur la fiche élément : `object-cover` sur fond
          `bg-card` (le fond clair évite qu'un logo transparent paraisse sale).
          Radix bascule seul sur le fallback (icône) si l'image échoue ou manque. */}
      <Avatar className="h-10 w-10 rounded-md shrink-0 bg-card">
        {logoUrl && <AvatarImage src={logoUrl} alt="" className="object-cover" />}
        <AvatarFallback className="rounded-md bg-muted">
          <Building2 aria-hidden="true" className="h-5 w-5 text-muted-foreground" />
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <div className="font-medium text-sm truncate">{name}</div>
        <span
          className={cn(
            "inline-flex items-center text-xs px-1.5 py-0.5 rounded",
            role === "admin"
              ? "bg-primary/10 text-primary"
              : "bg-muted text-muted-foreground"
          )}
        >
          {role === "admin" ? i18n.admin : i18n.member}
        </span>
      </div>
      <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" aria-label={i18n.open} />
    </button>
  );
}

// ─── Sub-component : ligne d'un lieu en attente ─────────────────────────────

interface PendingRowProps {
  org: Organization;
  pendingType: "toBeValidated" | "isInviting" | "isInvitingAdmin" | "isAdminPending";
  i18n: {
    badge: string;
    accept: string;
    reject: string;
  };
}

function PendingRow({ org, pendingType, i18n }: PendingRowProps) {
  const acceptMutation = useAcceptInvitation(org);
  const rejectMutation = useRejectInvitation(org);

  const data = (org as unknown as { serverData?: Record<string, unknown> }).serverData ?? {};
  const name = (data.name as string) || (org as unknown as { name?: string }).name || "—";
  const logoUrl = pickProfileImageUrl(data);

  const showActions = pendingType === "isInviting" || pendingType === "isInvitingAdmin";

  return (
    <div className="w-full flex items-center gap-3 p-3 rounded-lg border bg-card">
      {/* Avatar — rendu aligné sur la fiche élément : `object-cover` sur fond
          `bg-card` (le fond clair évite qu'un logo transparent paraisse sale).
          Radix bascule seul sur le fallback (icône) si l'image échoue ou manque. */}
      <Avatar className="h-10 w-10 rounded-md shrink-0 bg-card">
        {logoUrl && <AvatarImage src={logoUrl} alt="" className="object-cover" />}
        <AvatarFallback className="rounded-md bg-muted">
          <Building2 aria-hidden="true" className="h-5 w-5 text-muted-foreground" />
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <div className="font-medium text-sm truncate">{name}</div>
        <span className="inline-flex items-center text-xs px-1.5 py-0.5 rounded bg-warning/15 text-warning-foreground">
          {i18n.badge}
        </span>
      </div>
      {showActions && (
        <div className="flex gap-2 shrink-0">
          <Button
            size="sm"
            variant="default"
            disabled={acceptMutation.isPending || rejectMutation.isPending}
            onClick={() => acceptMutation.mutate()}
          >
            {acceptMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : i18n.accept}
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={acceptMutation.isPending || rejectMutation.isPending}
            onClick={() => rejectMutation.mutate()}
          >
            {rejectMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : i18n.reject}
          </Button>
        </div>
      )}
    </div>
  );
}

// ─── Sub-component : confirmation Dialog pour rejoindre un lieu ─────────────

interface JoinConfirmDialogProps {
  org: Organization | null;
  onClose: () => void;
  onSuccess: () => void;
}

function JoinConfirmDialog({ org, onClose, onSuccess }: JoinConfirmDialogProps) {
  const t = useT("modules/coform");
  const requestMemberMutation = useRequestToJoin(org);
  const requestAdminMutation = useRequestToJoinAdmin(org);
  const data = (org as unknown as { serverData?: Record<string, unknown> } | null)?.serverData ?? {};
  const name = (data.name as string) || (org as unknown as { name?: string } | null)?.name || "—";

  const anyPending = requestMemberMutation.isPending || requestAdminMutation.isPending;

  const handleRequestMember = () => {
    requestMemberMutation.mutate(undefined, {
      onSuccess: () => {
        toast.success(t("coform.placeView.join.successToastMember"));
        onSuccess();
      },
    });
  };

  const handleRequestAdmin = () => {
    requestAdminMutation.mutate(undefined, {
      onSuccess: () => {
        toast.success(t("coform.placeView.join.successToastAdmin"));
        onSuccess();
      },
    });
  };

  return (
    <Dialog open={!!org} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {t("coform.placeView.join.confirmTitle", undefined, { name })}
          </DialogTitle>
          <DialogDescription>
            {t("coform.placeView.join.confirmDescription")}
          </DialogDescription>
        </DialogHeader>

        {/* Deux actions explicites — pas d'étape "valider" intermédiaire pour
            que l'user voie immédiatement quel rôle il demande. Chaque mutation
            émet son propre toast de succès. */}
        <div className="flex flex-col gap-2 py-2">
          <Button
            variant="default"
            onClick={handleRequestMember}
            disabled={anyPending}
            className="justify-start"
          >
            {requestMemberMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <UserPlus className="h-4 w-4 mr-2" />
            )}
            {t("coform.placeView.join.requestMember")}
          </Button>
          <Button
            variant="outline"
            onClick={handleRequestAdmin}
            disabled={anyPending}
            className="justify-start"
          >
            {requestAdminMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <UserPlus className="h-4 w-4 mr-2" />
            )}
            {t("coform.placeView.join.requestAdmin")}
          </Button>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={anyPending}>
            {t("coform.placeView.join.confirmCancel")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Composant principal ────────────────────────────────────────────────────

export function PlacesListView({ formData, formId }: PlacesListViewProps) {
  const t = useT("modules/coform");
  const navigate = useNavigate();
  const { me, api } = useCocolight();

  const sharedFinderInfo = useMemo(() => getSharedFinderInfo(formData), [formData]);

  // Filtres MongoDB construits depuis sharedFinderInfo. Server-side : la
  // pagination s'applique APRÈS filtrage, donc tous les lieux éligibles sont
  // accessibles, peu importe le nombre total d'orgs de l'user.
  // Compromis V1 (option A) : les lieux en attente (invitations / demandes)
  // sont aussi tag-filtered. Si on veut séparer "Mes lieux" vs "En attente
  // sans filtre", on bascule à 2 requêtes parallèles.
  const mongoFilters = useMemo(
    () =>
      sharedFinderInfo
        ? buildFinderMongoFilters(sharedFinderInfo.filters, sharedFinderInfo.excludeFilters)
        : undefined,
    [sharedFinderInfo]
  );

  const {
    organizations,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    lastItemRef,
  } = useUserEligiblePlaces(me, {
    filters: mongoFilters,
    notSourceKey: sharedFinderInfo?.notSourceKey,
    enabled: !!sharedFinderInfo,
  });

  // Tri en deux groupes : lieux validés (admin/membre) vs lieux en attente.
  // Le filtrage métier (tags, notSourceKey) est déjà appliqué côté serveur.
  const { myPlaces, pendingPlaces } = useMemo(() => {
    const my: Array<{ org: Organization; role: "admin" | "member" }> = [];
    const pending: Array<{
      org: Organization;
      pendingType: "toBeValidated" | "isInviting" | "isInvitingAdmin" | "isAdminPending";
    }> = [];

    for (const org of organizations) {
      const perms = calculateOrganizationPermissions(org);
      if (perms.isToBeValidated) {
        pending.push({ org, pendingType: "toBeValidated" });
        continue;
      }
      if (perms.isInvitingAdmin) {
        pending.push({ org, pendingType: "isInvitingAdmin" });
        continue;
      }
      if (perms.isInviting) {
        pending.push({ org, pendingType: "isInviting" });
        continue;
      }
      if (perms.isAdminPending) {
        pending.push({ org, pendingType: "isAdminPending" });
        continue;
      }
      if (perms.isAdmin) {
        my.push({ org, role: "admin" });
        continue;
      }
      if (perms.isMember) {
        my.push({ org, role: "member" });
      }
    }

    return { myPlaces: my, pendingPlaces: pending };
  }, [organizations]);

  // Navigation vers la vue détail d'un lieu.
  const handleOpenPlace = useCallback(
    (org: Organization) => {
      const orgId =
        (org as unknown as { serverData?: { id?: string } }).serverData?.id ||
        (org as unknown as { id?: string }).id;
      if (!orgId) return;
      navigate(`/coform/${formId}/place/${orgId}`);
    },
    [navigate, formId]
  );

  // ── Section "Rejoindre un lieu" ───────────────────────────────────────────
  const [searchOpen, setSearchOpen] = useState(false);
  const [confirmOrg, setConfirmOrg] = useState<Organization | null>(null);

  const handleSelectFromSearch = useCallback(
    async (elements: FinderElement[]) => {
      setSearchOpen(false);
      const picked = elements[0];
      if (!picked || !api) return;

      // Forms publics : pas besoin d'être membre/admin pour éditer la réponse
      // partagée. On bypass complètement le flow "demande à rejoindre" et on
      // navigue directement vers la vue détail. Le serveur tranchera via
      // `canAnswer` si jamais le user n'est pas autorisé pour une autre raison.
      if (formData.publicCanEditSharedAnswer) {
        navigate(`/coform/${formId}/place/${picked.id}`);
        return;
      }

      // Si déjà dans la liste user → vérifier permissions et router en conséquence.
      const alreadyOwned = organizations.find((o) => {
        const id = (o as unknown as { serverData?: { id?: string } }).serverData?.id;
        return id === picked.id;
      });
      if (alreadyOwned) {
        const perms = calculateOrganizationPermissions(alreadyOwned);
        if (perms.isAdmin || perms.isMember) {
          toast.info(t("coform.placeView.join.alreadyMember"));
          navigate(`/coform/${formId}/place/${picked.id}`);
          return;
        }
        if (perms.isToBeValidated) {
          toast.info(t("coform.placeView.join.alreadyPending"));
          return;
        }
        if (perms.isInviting || perms.isInvitingAdmin) {
          toast.info(t("coform.placeView.join.alreadyInvited"));
          return;
        }
      }

      // Sinon, fetch l'entité fraîche et ouvrir la confirmation.
      try {
        const fetched = await api.organization({ id: picked.id });
        setConfirmOrg(fetched);
      } catch (err) {
        console.warn("[PlacesListView] organization fetch failed", err);
      }
    },
    [api, organizations, navigate, formId, t, formData.publicCanEditSharedAnswer]
  );

  // Si pas de finder partagé, on ne peut pas filtrer / pré-remplir → message.
  if (!sharedFinderInfo) {
    return (
      <div className="space-y-4 max-w-3xl mx-auto p-6">
        <h1 className="text-2xl font-bold">{formData.name}</h1>
        <p className="text-sm text-muted-foreground">
          {t("coform.placeView.empty.notApplicable")}
        </p>
      </div>
    );
  }

  // Config du finder pour la modale de recherche : on calque sur sharedFinderInfo
  // pour garantir les MÊMES critères de filtrage côté server-side search.
  const searchConfig: FinderConfig = {
    type: sharedFinderInfo.type,
    filters: sharedFinderInfo.filters,
    // Propager l'exclusion à la modale « rejoindre un lieu » pour rester
    // cohérent avec la liste (sinon un réseau réapparaîtrait à la recherche).
    excludeFilters: sharedFinderInfo.excludeFilters,
    notSourceKey: sharedFinderInfo.notSourceKey,
    myContacts: false,
    initCurrentUser: false,
    // FinderSearchModal préfixe automatiquement avec "Rechercher un " → on
    // passe juste le mot-cible ("lieu" / "place").
    elementLabel: t("coform.placeView.joinSection.elementLabel"),
    buttonLabel: t("coform.placeView.joinSection.searchButton"),
    placeholderSearchField: t("coform.placeView.joinSection.searchButton"),
    field: "place",
    multiple: false,
    addNew: false,
    invite: false,
    linkToAnswer: false,
    singleAnswerPerElement: false,
    msgSingleAnswerPerElement: "",
    redirectSingleAnswerPerElement: "Accueil",
    editElement: false,
    addToLinks: { value: false, links: "" },
  };

  const documentTitle = formData.name ?? t("coform.placeView.title");

  return (
    <div className="space-y-6 max-w-3xl mx-auto p-6">
      <Helmet>
        <title>{documentTitle}</title>
      </Helmet>

      {/* Header */}
      <div className="space-y-1">
        <h1 className="text-2xl font-bold">{documentTitle}</h1>
        <p className="text-sm text-muted-foreground">{t("coform.placeView.description")}</p>
      </div>

      {/* Mes lieux */}
      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-foreground">
          {t("coform.placeView.myPlaces")} ({myPlaces.length})
        </h2>
        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> …
          </div>
        ) : myPlaces.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">
            {t("coform.placeView.empty.noPlaces")}
          </p>
        ) : (
          <div className="space-y-2">
            {myPlaces.map(({ org, role }) => (
              <PlaceRow
                key={
                  (org as unknown as { serverData?: { id?: string } }).serverData?.id ||
                  (org as unknown as { id?: string }).id
                }
                org={org}
                role={role}
                onOpen={handleOpenPlace}
                i18n={{
                  admin: t("coform.placeView.roleBadge.admin"),
                  member: t("coform.placeView.roleBadge.member"),
                  open: t("coform.placeView.actions.open"),
                }}
              />
            ))}
          </div>
        )}
      </section>

      {/* En attente */}
      {pendingPlaces.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-foreground">
            {t("coform.placeView.pendingPlaces")} ({pendingPlaces.length})
          </h2>
          <div className="space-y-2">
            {pendingPlaces.map(({ org, pendingType }) => (
              <PendingRow
                key={
                  (org as unknown as { serverData?: { id?: string } }).serverData?.id ||
                  (org as unknown as { id?: string }).id
                }
                org={org}
                pendingType={pendingType}
                i18n={{
                  badge: t(`coform.placeView.pendingBadge.${pendingType}`),
                  accept: t("coform.placeView.actions.accept"),
                  reject: t("coform.placeView.actions.reject"),
                }}
              />
            ))}
          </div>
        </section>
      )}

      {/* Sentinel infinite-scroll : observé par lastItemRef → fetch la page
          suivante quand l'user scrolle jusqu'ici. Filtrage server-side donc
          la pagination est correcte. */}
      {hasNextPage && (
        <div ref={lastItemRef} className="flex items-center justify-center py-2">
          {isFetchingNextPage && (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          )}
        </div>
      )}

      {/* Section "ouvrir un autre lieu" — labels distincts selon que le form
          autorise tout user à éditer (pas de demande à rejoindre nécessaire)
          ou non (flow demande/membership). */}
      <section className="space-y-2 pt-4 border-t">
        <h2 className="text-sm font-semibold text-foreground">
          {formData.publicCanEditSharedAnswer
            ? t("coform.placeView.openSection.title")
            : t("coform.placeView.joinSection.title")}
        </h2>
        <p className="text-sm text-muted-foreground">
          {formData.publicCanEditSharedAnswer
            ? t("coform.placeView.openSection.description")
            : t("coform.placeView.joinSection.description")}
        </p>
        <Button variant="outline" onClick={() => setSearchOpen(true)} className="gap-2">
          <Search className="h-4 w-4" />
          {formData.publicCanEditSharedAnswer
            ? t("coform.placeView.openSection.searchButton")
            : t("coform.placeView.joinSection.searchButton")}
          {!formData.publicCanEditSharedAnswer && <UserPlus className="h-4 w-4 ml-1" />}
        </Button>
      </section>

      {/* Modal recherche — mount conditionnel (cf. pattern FinderField :
          state interne frais à chaque ouverture, pas de useEffect reset). */}
      {searchOpen && (
        <FinderSearchModal
          config={searchConfig}
          selectedElements={{}}
          onClose={() => setSearchOpen(false)}
          onValidate={handleSelectFromSearch}
        />
      )}

      {/* Confirmation rejoindre */}
      <JoinConfirmDialog
        org={confirmOrg}
        onClose={() => setConfirmOrg(null)}
        onSuccess={() => setConfirmOrg(null)}
      />
    </div>
  );
}
