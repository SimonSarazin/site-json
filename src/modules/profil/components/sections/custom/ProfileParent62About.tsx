import {
  Accessibility,
  Building2,
  Facebook,
  FileText,
  Globe,
  Instagram,
  Linkedin,
  ListChecks,
  MessageSquare,
  Package,
  Tags,
  User,
  Users,
  Youtube,
} from "lucide-react";
import { FilesList } from "@/components/media/FilesList";
import { useReactiveProperty } from "@/hooks/useReactiveProperty";
import { renderMarkdown } from "@/helpers/renderMarkdown";
import { useDocumentsList } from "../../../hooks/useDocuments";
import { useFormatProfileEntity } from "../../../hooks/useFormatProfileEntity";
import { useProfileSetup } from "../../../hooks/useProfileSetup";
import type { ProfileParent62AboutSection } from "../../../schema";

interface ProfileParent62AboutProps {
  section: ProfileParent62AboutSection;
}

/** `type` de `costumForms.parent62-partenaire` — valeur technique (compat Communecter) → libellé du
 *  formulaire. Pas de mapping partagé ailleurs dans le code : recopié tel quel depuis le form, comme
 *  les libellés déjà écrits en dur dans `ProfileSsbeAbout`. */
const TYPE_LABELS: Record<string, string> = {
  NGO: "Association",
  GovernmentOrganization: "Collectivité / service public",
  Group: "Établissement (crèche, école, centre social…)",
  LocalBusiness: "Entreprise",
};

function toStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((v): v is string => typeof v === "string" && v.trim() !== "");
  }
  if (typeof value === "string" && value.trim() !== "") return [value.trim()];
  return [];
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

function PillGroup({ values }: { values: string[] }) {
  if (values.length === 0) {
    return <p className="text-sm text-muted-foreground">Non renseigné</p>;
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

const SOCIAL_NETWORKS: ReadonlyArray<{ key: string; label: string; icon: React.ElementType }> = [
  { key: "facebook", label: "Facebook", icon: Facebook },
  { key: "instagram", label: "Instagram", icon: Instagram },
  { key: "linkedin", label: "LinkedIn", icon: Linkedin },
  { key: "youtube", label: "YouTube", icon: Youtube },
];

/**
 * Fiche « À propos » générique d'une organisation parent62 (`costumForms.parent62-partenaire`) —
 * remplace `profile-about-ssbe` (conçu pour sport-sante-bien-etre : SIREN, représentant légal… des
 * champs que ce formulaire ne collecte pas, affichés vides sur toute fiche parent62). Montre TOUS les
 * attributs saisis par ce formulaire et non couverts ailleurs sur la page profil : `profile-info`
 * (sidebar) porte déjà e-mail/téléphone/site/adresse, `profile-tags` les mots-clés dérivés.
 * `profile-opening-hours` (horaires) vit À CÔTÉ, dans `rightSections` — seul bloc généré par CE
 * composant qui en dépend ailleurs. Les documents, eux, sont rendus ICI (pas via la section générique
 * `profile-documents`) pour rester adjacents à « Interlocuteur privilégié » (demande explicite).
 * Volontairement SITE-SPÉCIFIQUE (pas une section générique `profile-fields`) : seul moyen de garder
 * l'habillage en bandeau dégradé `--primary`/`--accent` du thème parent62 sur chaque bloc, plutôt que
 * les cartes neutres de la section générique.
 *
 * Noms de champs vérifiés sur les 38 organisations importées (pas de supposition) : `themes` et
 * `territoires`, lus par une version antérieure de ce composant, n'existent sur AUCUNE d'entre elles —
 * remplacés par `typeAction` et `publicCible`, les champs réels du formulaire.
 */
export default function ProfileParent62About({ section }: ProfileParent62AboutProps) {
  const { entity } = useProfileSetup();
  const { shortDescription, description, type } = useFormatProfileEntity(entity);

  const categoryThematic = toStringArray(useReactiveProperty(entity.serverData, "categoryThematic"));
  const typeAction = toStringArray(useReactiveProperty(entity.serverData, "typeAction"));
  const publicCible = toStringArray(useReactiveProperty(entity.serverData, "publicCible"));
  const accessibility = useReactiveProperty(entity.serverData, "accessibility") as string | undefined;
  const provisionResources = useReactiveProperty(entity.serverData, "provisionResources") as string | undefined;
  const contact = useReactiveProperty(entity.serverData, "contact") as string | undefined;
  const note = useReactiveProperty(entity.serverData, "note") as string | undefined;
  const socialNetwork = (useReactiveProperty(entity.serverData, "socialNetwork") ?? {}) as Record<string, string>;
  const socialLinks = SOCIAL_NETWORKS.filter(({ key }) => typeof socialNetwork[key] === "string" && socialNetwork[key].trim() !== "");
  const { data: documents = [] } = useDocumentsList(entity);

  if (section.hidden === true) {
    return null;
  }

  const hasDescription = Boolean(shortDescription || description);
  const typeLabel = type ? (TYPE_LABELS[type] ?? type) : null;

  return (
    <div className="mb-6 space-y-5">
      {hasDescription && (
        <SectionCard icon={FileText} title="Description">
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

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <SectionCard icon={Building2} title="Type de structure">
          <p className="text-sm text-foreground">{typeLabel ?? "Non renseigné"}</p>
        </SectionCard>

        <SectionCard icon={Tags} title="Catégorie thématique">
          <PillGroup values={categoryThematic} />
        </SectionCard>

        <SectionCard icon={ListChecks} title="Type d'action">
          <PillGroup values={typeAction} />
        </SectionCard>

        <SectionCard icon={Users} title="Public cible">
          <PillGroup values={publicCible} />
        </SectionCard>
      </div>

      {socialLinks.length > 0 && (
        <SectionCard icon={Globe} title="Réseaux sociaux">
          <div className="flex flex-wrap gap-2">
            {socialLinks.map(({ key, label, icon: Icon }) => {
              const value = socialNetwork[key];
              const href = /^https?:\/\//i.test(value) ? value : `https://${value}`;
              return (
                <a
                  key={key}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary transition-colors hover:bg-primary/20"
                >
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                </a>
              );
            })}
          </div>
        </SectionCard>
      )}

      {(accessibility || provisionResources || contact || documents.length > 0 || note) && (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          {accessibility && <TextCard icon={Accessibility} title="Accès / stationnement" value={accessibility} />}
          {provisionResources && (
            <TextCard icon={Package} title="Mise à disposition de ressources" value={provisionResources} />
          )}
          {/* Documents juste à côté de l'interlocuteur (demande explicite) : même source que la section
              générique `profile-documents` (`getGalleryFiles`), rendue ici en carte bandeau pour rester
              dans le même langage visuel que le reste de la fiche plutôt que la carte neutre générique. */}
          {contact && <TextCard icon={User} title="Interlocuteur privilégié" value={contact} />}
          {documents.length > 0 && (
            <SectionCard icon={FileText} title="Documents">
              <FilesList files={documents} />
            </SectionCard>
          )}
          {note && <TextCard icon={MessageSquare} title="Remarques" value={note} />}
        </div>
      )}
    </div>
  );
}
