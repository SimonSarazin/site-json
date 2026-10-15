import {
  Accessibility,
  FileText,
  Globe,
  ListChecks,
  MessageSquare,
  Package,
  Tags,
  User,
  Users,
} from "lucide-react";
import { FilesList } from "@/components/media/FilesList";
import SocialLinks from "@/components/layout/footer/SocialLinks";
import { useT } from "@/hooks/useT";
import { useReactiveProperty } from "@/hooks/useReactiveProperty";
import { renderMarkdown } from "@/helpers/renderMarkdown";
import { toStringArray } from "@/helpers/toStringArray";
import { useDocumentsList } from "../../../hooks/useDocuments";
import { useFormatProfileEntity } from "../../../hooks/useFormatProfileEntity";
import { useProfileSetup } from "../../../hooks/useProfileSetup";
import type { ProfileParent62AboutSection } from "../../../schema";
import { toPresentationDocs } from "./profileParent62Documents";
import { toSocialLinks } from "./profileParent62Social";

interface ProfileParent62AboutProps {
  section: ProfileParent62AboutSection;
}

function SectionCard({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ElementType;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      <div
        className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-primary-foreground"
        // `--primary`/`--accent` directement (pas `--card-header-gradient`, cf. ProfileSsbeAbout) :
        // ce token bespoke n'est déclaré que par 3 sites (ssbe, équipements-sportifs, la-tampon) —
        // `index-parent62.css` l'indique en tête, aucun token bespoke n'y vit, tout vient de
        // `config.theme`. `--primary`/`--accent` sont eux garantis partout (`@theme inline`).
        style={{ background: "linear-gradient(135deg, var(--primary), var(--accent))" }}
      >
        <Icon className="h-4 w-4" />
        {title}
      </div>
      <div className="px-5 py-4">{children}</div>
    </div>
  );
}

function PillGroup({ values, notProvided }: { values: string[]; notProvided: string }) {
  if (values.length === 0) {
    return <p className="text-sm text-muted-foreground">{notProvided}</p>;
  }
  return (
    <div className="flex flex-wrap gap-1.5">
      {values.map((v) => (
        <span
          key={v}
          className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary"
        >
          {v}
        </span>
      ))}
    </div>
  );
}

function TextCard({ icon, title, value }: { icon: React.ElementType; title: string; value: string }) {
  return (
    <SectionCard icon={icon} title={title}>
      <p className="whitespace-pre-line text-sm text-foreground">{value}</p>
    </SectionCard>
  );
}

/**
 * Fiche « À propos » d'une organisation parent62 — remplace `profile-about-ssbe` (conçu pour
 * sport-sante-bien-etre : SIREN, représentant légal… des champs que ce formulaire ne collecte pas,
 * affichés vides sur toute fiche parent62). Couvre les DEUX formulaires `organizations` du costum
 * (`parent62-partenaire` et `parent62-acteur`, cf. §9septquadragies.3 de `doc-projets/parent62.md`) —
 * distingués par le même tag `"Partenaires"` que `/annuaire` vs `/annuaire-acteurs-parentalite` et le
 * routage d'édition, PAS par `type` (discriminant de sous-type costum côté acteur, nature juridique côté
 * partenaire — deux sémantiques incompatibles) ni par `source.key` (non fiable sur les fiches importées).
 * `profile-info` (sidebar) porte déjà e-mail/téléphone/site/adresse, `profile-tags` les mots-clés dérivés.
 * `profile-opening-hours` (horaires) vit À CÔTÉ, dans `rightSections` — seul bloc généré par CE
 * composant qui en dépend ailleurs. Les documents, eux, sont rendus ICI (pas via la section générique
 * `profile-documents`) pour rester adjacents à « Interlocuteur privilégié » (demande explicite).
 * Volontairement SITE-SPÉCIFIQUE (pas une section générique `profile-fields`) : seul moyen de garder
 * l'habillage en bandeau dégradé `--primary`/`--accent` du thème parent62 sur chaque bloc, plutôt que
 * les cartes neutres de la section générique.
 *
 * Pas de carte « Type de structure » : `type` est le DISCRIMINANT de sous-type costum lu par le SDK en
 * édition (`serverData.type === "acteur"` → résout `costum.typeObj.acteur`) côté acteur — sa valeur n'a
 * rien d'affichable ; côté partenaire il porte la nature juridique (NGO/Group/…), non montrée ici non
 * plus (champ jamais renseigné en pratique sur les fiches réelles).
 */
export default function ProfileParent62About({ section }: ProfileParent62AboutProps) {
  const t = useT("modules/profil");
  const { entity } = useProfileSetup();
  const { shortDescription, description } = useFormatProfileEntity(entity);

  const tags = toStringArray(useReactiveProperty(entity.serverData, "tags"));
  const isPartenaire = tags.includes("Partenaires");

  const categoryThematic = toStringArray(useReactiveProperty(entity.serverData, "categoryThematic"));
  const typeAction = toStringArray(useReactiveProperty(entity.serverData, "typeAction"));
  const publicCible = toStringArray(useReactiveProperty(entity.serverData, "publicCible"));
  const territoires = toStringArray(useReactiveProperty(entity.serverData, "territoires"));
  const publics = toStringArray(useReactiveProperty(entity.serverData, "publics"));
  const themes = toStringArray(useReactiveProperty(entity.serverData, "themes"));
  const accessibility = useReactiveProperty(entity.serverData, "accessibility") as string | undefined;
  const provisionResources = useReactiveProperty(entity.serverData, "provisionResources") as string | undefined;
  const contact = useReactiveProperty(entity.serverData, "contact") as string | undefined;
  const note = useReactiveProperty(entity.serverData, "note") as string | undefined;
  const socialNetwork = (useReactiveProperty(entity.serverData, "socialNetwork") ?? {}) as Record<string, string>;
  const facebook = useReactiveProperty(entity.serverData, "facebook") as string | undefined;
  const instagram = useReactiveProperty(entity.serverData, "instagram") as string | undefined;
  const linkedin = useReactiveProperty(entity.serverData, "linkedin") as string | undefined;
  const youtube = useReactiveProperty(entity.serverData, "youtube") as string | undefined;
  const socialLinks = toSocialLinks({ socialNetwork, facebook, instagram, linkedin, youtube });
  const presentationImages = toPresentationDocs(useReactiveProperty(entity.serverData, "images"));
  const { data: files = [] } = useDocumentsList(entity);
  const documents = [...files, ...presentationImages];

  if (section.hidden === true) {
    return null;
  }

  const hasDescription = Boolean(shortDescription || description);

  return (
    <div className="mb-6 space-y-5">
      {hasDescription && (
        <SectionCard icon={FileText} title={t("ProfileParent62About.description")}>
          {shortDescription && (
            <p className="mb-3 text-base font-medium text-foreground">{shortDescription}</p>
          )}
          {description && (
            <div
              className="prose prose-sm max-w-none dark:prose-invert"
              dangerouslySetInnerHTML={{ __html: renderMarkdown(description, { markdownEnabled: true }) }}
            />
          )}
        </SectionCard>
      )}

      {isPartenaire ? (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <SectionCard icon={Tags} title={t("ProfileParent62About.territoires")}>
            <PillGroup values={territoires} notProvided={t("ProfileParent62About.notProvided")} />
          </SectionCard>

          <SectionCard icon={Users} title={t("ProfileParent62About.publics")}>
            <PillGroup values={publics} notProvided={t("ProfileParent62About.notProvided")} />
          </SectionCard>

          <SectionCard icon={ListChecks} title={t("ProfileParent62About.themes")}>
            <PillGroup values={themes} notProvided={t("ProfileParent62About.notProvided")} />
          </SectionCard>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <SectionCard icon={Tags} title={t("ProfileParent62About.categoryThematic")}>
            <PillGroup values={categoryThematic} notProvided={t("ProfileParent62About.notProvided")} />
          </SectionCard>

          <SectionCard icon={ListChecks} title={t("ProfileParent62About.typeAction")}>
            <PillGroup values={typeAction} notProvided={t("ProfileParent62About.notProvided")} />
          </SectionCard>

          <SectionCard icon={Users} title={t("ProfileParent62About.publicCible")}>
            <PillGroup values={publicCible} notProvided={t("ProfileParent62About.notProvided")} />
          </SectionCard>
        </div>
      )}

      {socialLinks.length > 0 && (
        <SectionCard icon={Globe} title={t("ProfileParent62About.socialNetworks")}>
          <SocialLinks socials={socialLinks} />
        </SectionCard>
      )}

      {(accessibility || provisionResources || contact || documents.length > 0 || note) && (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          {accessibility && (
            <TextCard icon={Accessibility} title={t("ProfileParent62About.accessibility")} value={accessibility} />
          )}
          {provisionResources && (
            <TextCard icon={Package} title={t("ProfileParent62About.provisionResources")} value={provisionResources} />
          )}
          {/* Documents juste à côté de l'interlocuteur (demande explicite) : même source que la section
              générique `profile-documents` (`getGalleryFiles`), rendue ici en carte bandeau pour rester
              dans le même langage visuel que le reste de la fiche plutôt que la carte neutre générique. */}
          {contact && <TextCard icon={User} title={t("ProfileParent62About.contact")} value={contact} />}
          {documents.length > 0 && (
            <SectionCard icon={FileText} title={t("ProfileParent62About.documents")}>
              <FilesList files={documents} />
            </SectionCard>
          )}
          {note && <TextCard icon={MessageSquare} title={t("ProfileParent62About.note")} value={note} />}
        </div>
      )}
    </div>
  );
}
