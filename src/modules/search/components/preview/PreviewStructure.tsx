import React, { Suspense, useEffect, useMemo, useState } from "react";
import { lazy } from "vite-preload";
import type { Organization } from "@communecter/cocolight-api-client";
import {
  Award,
  Briefcase,
  Building2,
  Calendar,
  CheckCircle2,
  Download,
  Edit,
  Facebook,
  FileText,
  FolderOpen,
  Globe,
  IdCard,
  Instagram,
  Linkedin,
  Loader2,
  Mail,
  MapPin,
  Network,
  Phone,
  Scale,
  Tag,
  Youtube,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import LazyImage from "@/components/layout/LazyImage";
import ProfileMapLeaflet from "@/modules/profil/components/sections/ProfileMapLeaflet";
import { useProfilPermissions } from "@/modules/profil/hooks/useProfilPermissions";
import { DynamicEditModal } from "@/modules/profil/components/profile-edit/EditModalRegistry";
import { useEntityBySlugQuery } from "@/hooks/useEntityBySlugQuery";
import { useT } from "@/hooks/useT";
import { telephonePrincipal } from "@/lib/telephonePrincipal";
import { coerceBool } from "@/modules/formEngine/engine/coercions";
import { siteWebPrincipal } from "@/lib/siteWebPrincipal";
import { normalizeToolHref } from "@/modules/toolsCatalog/utils/toolHref";
import { PreviewProps } from "@/modules/search/schema";

// Section « équipements réservés » : lazy — le chunk (query answers + grille des
// créneaux) n'est chargé que si le site configure `preview.bookedResources`.
const PreviewBookedResources = lazy(() => import("./PreviewBookedResources"));

/**
 * Fiche détail « structure » (organisation) — `preview.type: "structure"`.
 * Reprend le principe de la fiche legacy costum SSBE (`preview.php`) : hero
 * (statut/type/logo), affiliation, adresse+carte, représentant légal /
 * personne en charge, infos, documents — mais lit les champs custom du costum
 * (statusActor, legalStatus, representativeName…) via l'index signature de
 * `serverData`, comme `CardPoiAmenities` pour ses champs `equip_*`.
 */

interface StructureAddress {
  streetAddress?: string;
  postalCode?: string;
  addressLocality?: string;
  level1Name?: string;
  addressCountry?: string;
}

/**
 * Section « Documents » de la fiche : emplacements NOMMÉS, appariés aux fichiers par `subKey` (posé à
 * l'upload = clé du champ formulaire). Reprend la fiche legacy SSBE `ssbe/organizations/preview.php` :
 * 2 emplacements, repli « Non renseigné ». Le formulaire SiteForge écrit `subKey:"statusFile"` là où
 * les fiches legacy portent `recepisseDeclaration` → le 1er emplacement accepte les deux.
 */
const DOCUMENT_SLOTS: ReadonlyArray<{ subKeys: readonly string[]; labelKey: string }> = [
  { subKeys: ["statusFile", "recepisseDeclaration"], labelKey: "PreviewStructure.docRecepisse" },
  { subKeys: ["responsableCivilePro"], labelKey: "PreviewStructure.docResponsableCivilePro" },
];

interface StructureDoc {
  docId: string;
  name?: string;
  docPath?: string;
  subKey?: string;
}

/** `about.files` (objet keyé `_id` OU tableau, cf. Organization::getById) → liste normalisée téléchargeable. */
function normalizeAboutFiles(files: unknown): StructureDoc[] {
  const list =
    files && typeof files === "object" && !Array.isArray(files)
      ? Object.values(files as Record<string, Record<string, unknown>>)
      : Array.isArray(files)
        ? (files as Array<Record<string, unknown>>)
        : [];
  return list
    .map((f) => {
      const rid = f._id as { $id?: string } | string | undefined;
      const docId = rid && typeof rid === "object" ? rid.$id : rid;
      return {
        docId: String(docId ?? f.id ?? ""),
        name: typeof f.name === "string" ? f.name : undefined,
        docPath: typeof f.docPath === "string" ? f.docPath : undefined,
        subKey: typeof f.subKey === "string" ? f.subKey : undefined,
      };
    })
    .filter((d) => d.docId && d.docPath);
}

function InfoSectionTitle({ icon: Icon, children }: { icon: React.ElementType; children: React.ReactNode }) {
  return (
    <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">
      <Icon className="size-3.5 text-primary" />
      {children}
    </h3>
  );
}

function InfoItem({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <dt className="mb-1 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
        <Icon className="size-3.5 text-primary" />
        {label}
      </dt>
      <dd className="text-sm font-semibold text-foreground">{value}</dd>
    </div>
  );
}

function PersonCard({
  roleLabel,
  roleIcon: RoleIcon,
  title,
  fullName,
  email,
  phone,
  alt,
}: {
  roleLabel: string;
  roleIcon: React.ElementType;
  title?: string;
  fullName: string;
  email?: string;
  phone?: string;
  alt?: boolean;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="mb-3 flex items-center gap-4">
        <div
          className={
            alt
              ? "flex size-12 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground"
              : "flex size-12 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary"
          }
        >
          <IdCard className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
            <RoleIcon className="size-3.5 text-primary" />
            {title || roleLabel}
          </span>
          <p className="truncate text-base font-bold text-foreground">{fullName}</p>
        </div>
      </div>
      {(email || phone) && (
        <div className="flex flex-col gap-1.5 border-t border-dashed border-border pt-3">
          {email && (
            <a
              href={`mailto:${email}`}
              className="flex items-center gap-2 truncate text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              <Mail className="size-3.5 shrink-0 text-primary" />
              <span className="truncate">{email}</span>
            </a>
          )}
          {phone && (
            <a
              href={`tel:${phone}`}
              className="flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              <Phone className="size-3.5 shrink-0 text-primary" />
              {phone}
            </a>
          )}
        </div>
      )}
    </div>
  );
}

const PreviewStructure: React.FC<PreviewProps> = ({ item, preview }) => {
  const t = useT("modules/search");

  // Édition — même mécanisme générique config-driven que PreviewPoiAmenities :
  // `useProfilPermissions` calcule les droits sur CETTE entité (pas l'entité du site),
  // `DynamicEditModal` résout le bon formulaire via `config.profiles.organizations.editModal`
  // (repli "edit-profile" générique si absent).
  const { canEditProfile } = useProfilPermissions(item ?? null);
  const [editModalOpen, setEditModalOpen] = useState(false);

  // Fiche COMPLÈTE rechargée par slug (même patron que useResourceEntity) : l'item de recherche est
  // tronqué et ne porte jamais `about.files` (avec `subKey`, via Organization::getById backend).
  // Réservée aux gestionnaires (admin de la structure ou du costum = `canEditProfile`), comme
  // `$ssbeCanManage` de la fiche legacy : sans ce droit, elle n'est même pas rechargée.
  const itemSlug = ((item as unknown as Organization | undefined)?.serverData as { slug?: unknown } | undefined)?.slug;
  const fullEntity = useEntityBySlugQuery({
    slug: typeof itemSlug === "string" ? itemSlug : undefined,
    options: { enabled: typeof itemSlug === "string" && itemSlug !== "" && canEditProfile },
  });

  // On AFFICHE l'entité que la modale MODIFIE : afficher `item` pendant que la modale édite
  // `fullEntity` laissait la fiche sur les anciennes valeurs après enregistrement.
  const org = (fullEntity.data ?? item) as unknown as Organization;
  const sd = (org?.serverData ?? {}) as Record<string, unknown>;

  // Équipements réservés par CETTE organisation (opt-in `preview.bookedResources`).
  // `reservations` porte l'ancrage du formulaire, `fields.userOrga` le finder qui
  // relie une réponse à un club : sans lui, rien ne serait rattachable.
  const bookedConf = preview?.bookedResources;
  const reservationsConf = preview?.reservations;
  const showBooked = Boolean(bookedConf && reservationsConf?.fields.userOrga && org?.id);

  // L'entité de résultat de recherche est TRONQUÉE aux champs listés dans
  // `baseParams.defaultFields` (cf. buildSearchPayload) — suffisant pour cette fiche en
  // lecture, mais pas pour le formulaire `structure`, qui a
  // `payloadEmitEmptyOnEdit: true` : un champ absent du préremplissage serait envoyé VIDE
  // à l'enregistrement et écraserait la donnée réelle. Si aucun des champs propres à ce
  // formulaire n'est présent (entité venant d'un point d'entrée encore plus minimal, ex.
  // palette Ctrl+K), on recharge l'entité complète avant d'autoriser l'édition — même
  // garde-fou que PreviewPoiAmenities pour ses champs equip_*.
  const [isLoadingFull, setIsLoadingFull] = useState(false);
  useEffect(() => {
    if (!canEditProfile || !org?.id) return;
    const hasStructureFormData = sd.siren !== undefined || sd.sigle !== undefined || sd.thematic !== undefined;
    if (hasStructureFormData) return;
    setIsLoadingFull(true);
    org
      .refresh()
      .then(() => setIsLoadingFull(false))
      .catch((err) => {
        console.error("[PreviewStructure] Failed to load full organization data", err);
        setIsLoadingFull(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canEditProfile, org?.id]);

  const name = (sd.name as string) ?? "";
  const slug = sd.slug as string | undefined;
  const type = sd.type as string | undefined;
  const statusActor = sd.statusActor as string | undefined;
  const legalStatus = sd.legalStatus as string | undefined;
  // `affiliate` : "Oui"/"Non" sur les fiches historiques, "true"/"false" depuis le formulaire actuel et le
  // legacy — livrés en BOOLÉENS par l'API. Tester `=== "Oui"` privait du badge 14 structures affiliées.
  const isAffiliated = coerceBool(sd.affiliate);
  const affiliateTo = sd.affiliateTo as string | undefined;
  const email = sd.email as string | undefined;
  // `link` d'abord (clé écrite par les formulaires structure et le legacy), repli sur `url` (fiches
  // anciennes). Le href reçoit son schéma : `www.exemple.re`, tel que saisi, serait un lien RELATIF.
  const link = siteWebPrincipal(sd);
  const linkHref = normalizeToolHref(link);
  const shortDescription = sd.shortDescription as string | undefined;
  const description = sd.description as string | undefined;
  const profilImageUrl = sd.profilImageUrl as string | undefined;
  const created = sd.created as number | string | undefined;
  const tags = (Array.isArray(sd.tags) ? sd.tags : (Array.isArray(sd.thematic) ? sd.thematic : [])) as string[];

  const address = (sd.address ?? {}) as StructureAddress;
  const geo = (sd.geo ?? {}) as { latitude?: number; longitude?: number };
  const lat = geo.latitude ? Number(geo.latitude) : undefined;
  const lng = geo.longitude ? Number(geo.longitude) : undefined;

  const socialNetwork = (sd.socialNetwork ?? {}) as Record<string, string>;
  const youtube = sd.youtube as string | undefined;

  const mainPhone = telephonePrincipal(sd);

  const repTitle = sd.representativeTitle as string | undefined;
  const repCivility = (sd.representativeCivility as string | undefined) ?? "";
  const repName = (sd.representativeName as string | undefined) ?? "";
  const repFirstName = (sd.representativeFirstName as string | undefined) ?? "";
  const repEmail = sd.representativeEmail as string | undefined;
  const repPhone = sd.representativeTelephone as string | undefined;
  const repFullName = [repCivility, repFirstName, repName].filter(Boolean).join(" ").trim();

  const picTitle = sd.personInChargeTitle as string | undefined;
  const picCivility = (sd.personInChargeCivility as string | undefined) ?? "";
  const picName = (sd.personInChargeName as string | undefined) ?? "";
  const picFirstName = (sd.personInChargeFirstName as string | undefined) ?? "";
  const picEmail = sd.personInChargeEmail as string | undefined;
  const picPhone = sd.personInChargeTelephone as string | undefined;
  const picFullName = [picCivility, picFirstName, picName].filter(Boolean).join(" ").trim();
  const samePerson = Boolean(picEmail && picEmail === repEmail);

  const links = (sd.links ?? {}) as { memberOf?: Record<string, unknown> };
  const counts = (sd.counts ?? {}) as { memberOf?: number };
  const memberOfCount = counts.memberOf ?? Object.keys(links.memberOf ?? {}).length;

  const initials = useMemo(
    () =>
      name
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 3)
        .map((w) => w[0]?.toUpperCase())
        .join(""),
    [name],
  );

  const isValidated = statusActor === "Validé" || statusActor === "Valide";
  const typeLabel = type ? t(`type.${type}`) : undefined;

  const displayDescription =
    shortDescription || (description ? `${description.replace(/<[^>]*>/g, "").slice(0, 200)}…` : undefined);

  const displayAddress = [address.streetAddress, [address.postalCode, address.addressLocality].filter(Boolean).join(" ")]
    .filter(Boolean)
    .join(", ");

  // Documents (pièces justificatives) de la fiche complète, répartis par `subKey` dans des
  // EMPLACEMENTS NOMMÉS, comme la fiche legacy SSBE, plutôt qu'en liste à plat.
  const docSlots = useMemo(() => {
    const files = normalizeAboutFiles((fullEntity.data?.serverData as { files?: unknown } | undefined)?.files);
    return DOCUMENT_SLOTS.map((s) => ({
      label: t(s.labelKey),
      files: files.filter((f) => f.subKey && s.subKeys.includes(f.subKey)),
    }));
  }, [fullEntity.data, t]);
  const hasAnyDoc = docSlots.some((s) => s.files.length > 0);

  if (!name) return null;

  return (
    <div className="flex max-h-[90vh] flex-col">
      {/* Hero — bandeau dégradé (var(--card-header-gradient), même convention que
          PreviewCoformAnswer/PreviewPoiAmenities/CardAnswer) : lecture "carte modale" cohérente
          avec le reste du costum SSBE plutôt qu'une palette recréée en dur. */}
      <div
        className="relative shrink-0 px-6 py-8 md:px-10"
        style={{ background: "var(--card-header-gradient)" }}
      >
        {canEditProfile && (
          <div className="absolute right-10 top-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setEditModalOpen(true)}
              disabled={isLoadingFull}
              className="text-primary-foreground hover:bg-white/15"
            >
              {isLoadingFull ? <Loader2 className="h-4 w-4 animate-spin" /> : <Edit className="h-4 w-4" />}
              {t("PreviewStructure.edit")}
            </Button>
          </div>
        )}
        <div className="flex flex-col gap-6 text-center sm:flex-row sm:items-start sm:text-left">
          <div className="mx-auto flex size-28 shrink-0 items-center justify-center overflow-hidden rounded-full border-4 border-white/25 bg-white/10 shadow-sm sm:mx-0">
            {profilImageUrl ? (
              <LazyImage src={profilImageUrl} alt={name} className="size-full object-contain p-2" />
            ) : (
              <span className="text-2xl font-bold tracking-wide text-primary-foreground">{initials}</span>
            )}
          </div>

          <div className="flex min-w-0 flex-1 flex-col gap-3">
            <div className="flex flex-wrap justify-center gap-2 sm:justify-start">
              {isValidated && (
                <Badge className="border-success/30 bg-success/90 text-white hover:bg-success/90">
                  <CheckCircle2 />
                  {t("PreviewStructure.validated")}
                </Badge>
              )}
              {legalStatus && (
                <Badge className="border-white/25 bg-white/15 text-primary-foreground hover:bg-white/15">
                  <Scale />
                  {legalStatus}
                </Badge>
              )}
              {typeLabel && (
                <Badge className="border-white/25 bg-white/15 text-primary-foreground hover:bg-white/15">
                  {typeLabel}
                </Badge>
              )}
            </div>

            <h1 className="text-2xl font-bold tracking-tight text-primary-foreground sm:text-3xl">{name}</h1>

            {displayDescription && (
              <p className="max-w-xl text-sm leading-relaxed text-primary-foreground/85">{displayDescription}</p>
            )}

            {tags.length > 0 && (
              <div className="flex flex-wrap justify-center gap-1.5 sm:justify-start">
                {tags.map((tag) => (
                  <Badge key={tag} className="border-white/25 bg-white/15 font-normal text-primary-foreground hover:bg-white/15">
                    <Tag />
                    {tag}
                  </Badge>
                ))}
              </div>
            )}

            <div className="flex flex-wrap justify-center gap-2 pt-1 sm:justify-start">
              {email && (
                <Button asChild size="sm" variant="secondary">
                  <a href={`mailto:${email}`}>
                    <Mail /> {email}
                  </a>
                </Button>
              )}
              {mainPhone && (
                <Button asChild size="sm" className="border border-white/30 bg-white/10 text-primary-foreground hover:bg-white/20">
                  <a href={`tel:${mainPhone}`}>
                    <Phone /> {mainPhone}
                  </a>
                </Button>
              )}
              {link && (
                <Button
                  asChild
                  size="icon"
                  className="rounded-full border border-white/30 bg-white/10 text-primary-foreground hover:bg-white/20"
                  aria-label={t("PreviewStructure.website")}
                >
                  <a href={linkHref} target="_blank" rel="noopener noreferrer">
                    <Globe className="size-4" />
                  </a>
                </Button>
              )}
              {socialNetwork.facebook && (
                <Button asChild size="icon" className="rounded-full bg-white text-[#1877F2] hover:bg-white/90" aria-label="Facebook">
                  <a href={socialNetwork.facebook} target="_blank" rel="noopener noreferrer">
                    <Facebook className="size-4" />
                  </a>
                </Button>
              )}
              {socialNetwork.instagram && (
                <Button asChild size="icon" className="rounded-full bg-white text-[#E1306C] hover:bg-white/90" aria-label="Instagram">
                  <a href={socialNetwork.instagram} target="_blank" rel="noopener noreferrer">
                    <Instagram className="size-4" />
                  </a>
                </Button>
              )}
              {socialNetwork.linkedin && (
                <Button asChild size="icon" className="rounded-full bg-white text-[#0A66C2] hover:bg-white/90" aria-label="LinkedIn">
                  <a href={socialNetwork.linkedin} target="_blank" rel="noopener noreferrer">
                    <Linkedin className="size-4" />
                  </a>
                </Button>
              )}
              {youtube && (
                <Button asChild size="icon" className="rounded-full bg-white text-[#FF0000] hover:bg-white/90" aria-label="YouTube">
                  <a href={youtube} target="_blank" rel="noopener noreferrer">
                    <Youtube className="size-4" />
                  </a>
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Corps — défilant, hero fixe au-dessus (même pattern que PreviewCoformAnswer). */}
      <div className="min-h-0 flex-1 overflow-y-auto bg-background text-foreground">
        {/* Bandeau affiliation */}
        {affiliateTo && (
          <div className="flex items-center gap-4 border-b border-border bg-primary/5 px-6 py-3 md:px-10">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Award className="size-4" />
            </div>
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                {t("PreviewStructure.affiliation")}
              </span>
              <span className="truncate text-sm font-bold text-foreground">{affiliateTo}</span>
            </div>
            {isAffiliated && (
              <Badge className="border-success/30 bg-success/15 text-success hover:bg-success/15">
                <CheckCircle2 />
                {t("PreviewStructure.affiliated")}
              </Badge>
            )}
          </div>
        )}

        {/* Contenu */}
        <div className="grid grid-cols-1 gap-8 px-6 py-6 md:grid-cols-5 md:gap-10 md:px-10 md:py-8">
          {/* Colonne adresse */}
          <div className="flex flex-col gap-4 md:col-span-2">
            <InfoSectionTitle icon={MapPin}>{t("PreviewStructure.location")}</InfoSectionTitle>

            {lat && lng ? (
              <div className="overflow-hidden rounded-xl border border-border">
                <ProfileMapLeaflet lat={lat} lng={lng} height="220px" />
              </div>
            ) : null}

            <address className="flex flex-col gap-1 text-sm not-italic leading-relaxed text-muted-foreground">
              <span className="text-base font-bold text-foreground">{name}</span>
              {displayAddress && <span>{displayAddress}</span>}
              {address.level1Name && (
                <span className="mt-1 flex items-center gap-1.5 text-xs">
                  <Globe className="size-3 text-primary" />
                  {[address.level1Name, address.addressCountry].filter(Boolean).join(" · ")}
                </span>
              )}
            </address>
          </div>

          {/* Colonne personnes + infos */}
          <div className="flex flex-col gap-4 md:col-span-3">
            {(repFullName || repEmail) && (
              <>
                <InfoSectionTitle icon={IdCard}>
                  {samePerson ? t("PreviewStructure.repAndPic") : t("PreviewStructure.representative")}
                </InfoSectionTitle>
                <PersonCard
                  roleLabel={t("PreviewStructure.representative")}
                  roleIcon={Award}
                  title={repTitle}
                  fullName={repFullName}
                  email={repEmail}
                  phone={repPhone}
                />
              </>
            )}

            {!samePerson && (picFullName || picEmail) && (
              <PersonCard
                roleLabel={t("PreviewStructure.personInCharge")}
                roleIcon={Briefcase}
                title={picTitle}
                fullName={picFullName}
                email={picEmail}
                phone={picPhone}
                alt
              />
            )}

            {/* Informations + Documents : réservés aux gestionnaires, comme le bloc `$ssbeCanManage` de la
                fiche legacy ssbe/organizations/preview.php (qui y range aussi Modifier/Supprimer et les créneaux). */}
            {canEditProfile && (
              <>
                <Separator className="my-1" />

                <InfoSectionTitle icon={Building2}>{t("PreviewStructure.information")}</InfoSectionTitle>
                <div className="grid grid-cols-2 gap-2">
                  {slug && <InfoItem icon={Tag} label={t("PreviewStructure.identifier")} value={slug} />}
                  {typeLabel && <InfoItem icon={FolderOpen} label={t("PreviewStructure.category")} value={typeLabel} />}
                  {memberOfCount > 0 && (
                    <InfoItem
                      icon={Network}
                      label={t("PreviewStructure.memberOf")}
                      value={t("PreviewStructure.memberOfCount", undefined, { count: memberOfCount })}
                    />
                  )}
                  {created && (
                    <InfoItem
                      icon={Calendar}
                      label={t("PreviewStructure.createdOn")}
                      value={new Date(typeof created === "number" ? created * 1000 : created).toLocaleDateString()}
                    />
                  )}
                </div>
              </>
            )}

            {canEditProfile && hasAnyDoc && (
              <>
                <Separator className="my-1" />
                <InfoSectionTitle icon={FileText}>{t("PreviewStructure.documents")}</InfoSectionTitle>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {docSlots.map((slot) => (
                    <div key={slot.label} className="rounded-lg border border-border bg-card p-3">
                      <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                        <FileText className="size-3.5 text-primary" />
                        {slot.label}
                      </p>
                      {slot.files.length > 0 ? (
                        <ul className="flex flex-col gap-1">
                          {slot.files.map((f) => (
                            <li key={f.docId}>
                              <a
                                href={f.docPath}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
                              >
                                <Download className="size-3.5 shrink-0" />
                                <span className="truncate">{f.name ?? f.docPath}</span>
                              </a>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-sm italic text-muted-foreground">{t("PreviewStructure.notProvided")}</p>
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Équipements réservés — pleine largeur sous les deux colonnes : une
            liste de créneaux ne tient pas dans une colonne d'infos. */}
        {showBooked && (
          <div className="px-6 pb-6 md:px-10 md:pb-8">
            <Suspense fallback={null}>
              <PreviewBookedResources
                orgaId={org!.id as string}
                conf={reservationsConf!}
                booked={bookedConf!}
              />
            </Suspense>
          </div>
        )}
      </div>

      {canEditProfile && item && (
        <DynamicEditModal
          open={editModalOpen}
          // Rechargement à la fermeture : `save()` met à jour l'entité sur place (même référence, les
          // useMemo ne se recalculent pas), et les pièces jointes sont envoyées/supprimées APRÈS le
          // save, sans rafraîchissement. Une nouvelle référence remet toute la fiche à jour.
          onOpenChange={(open) => {
            setEditModalOpen(open);
            if (!open) void fullEntity.refetch();
          }}
          // `fullEntity` (rechargée par slug, en tête du composant) porte `about.files` — `item` (résultat de
          // recherche, tronqué) ne l'a jamais. Le garde-fou `hasStructureFormData` ci-dessus ne
          // suffit pas : il ne détecte que l'absence de champs MÉTIER (siren/sigle/thematic), pas
          // l'absence des DOCUMENTS, qu'aucune projection de recherche ne porte jamais. Repli sur
          // `item` tant que `fullEntity` n'a pas fini de charger.
          entity={fullEntity.data ?? item}
        />
      )}
    </div>
  );
};

export default PreviewStructure;
