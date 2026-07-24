import { EntityCardDetailed } from "site-forge";
import { Users } from "lucide-react";

// Carte-liste détaillée du module profil : props DÉJÀ APLATIES (name,
// description, imageUrl…) — pas d'objet Entity/serverData ici.
// Images = data-URI SVG (pas de service /img dans les aperçus).

const cover = (bg: string, fg: string, label: string) =>
  `data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="220"><rect width="320" height="220" fill="${bg}"/><circle cx="268" cy="42" r="64" fill="${fg}" opacity="0.35"/><circle cx="52" cy="196" r="84" fill="${fg}" opacity="0.22"/><text x="22" y="118" font-family="sans-serif" font-size="19" font-weight="600" fill="${fg}">${label}</text></svg>`
  )}`;

const badge = (label: string) => (
  <span
    style={{
      display: "inline-flex",
      alignItems: "center",
      padding: "2px 10px",
      borderRadius: 999,
      fontSize: 11,
      fontWeight: 600,
      background: "color-mix(in srgb, var(--primary) 12%, transparent)",
      color: "var(--primary)",
    }}
  >
    {label}
  </span>
);

export const FicheComplete = () => (
  <div style={{ maxWidth: 720, margin: "0 auto" }}>
    <EntityCardDetailed
      name="Maison des familles d'Arras"
      description="Lieu d'accueil et d'écoute pour les parents : ateliers parent-enfant, groupes de parole et accompagnement à la scolarité, ouverts à toutes les familles de l'Arrageois."
      imageUrl={cover("#dbeafe", "#1d4ed8", "Maison des familles")}
      slug="maison-des-familles-arras"
      locality="Arras"
      postalCode="62000"
      typeBadge={badge("Association")}
      tags={[
        "Parentalité",
        "Ateliers",
        "Groupes de parole",
        "Petite enfance",
        "Soutien scolaire",
        "Café des parents",
        "Médiation familiale",
      ]}
      maxTags={5}
      moreTagsLabel="autres"
      metadata={
        <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
          <Users size={12} /> 42 membres
        </span>
      }
    />
  </div>
);

export const Evenement = () => (
  <div style={{ maxWidth: 720, margin: "0 auto" }}>
    <EntityCardDetailed
      name="Semaine des parents — édition 2026"
      description="Une semaine d'ateliers, de conférences et de portes ouvertes dans tout le département pour échanger autour de la parentalité."
      imageUrl={cover("#fef3c7", "#b45309", "Semaine des parents")}
      slug="semaine-des-parents-2026"
      locality="Béthune"
      postalCode="62400"
      typeBadge={badge("Événement")}
      startDate={new Date(2026, 9, 5)}
      endDate={new Date(2026, 9, 11)}
      formatDate={(d) =>
        d.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })
      }
      tags={["Conférences", "Ateliers", "Gratuit"]}
    />
  </div>
);

export const SansImage = () => (
  <div style={{ maxWidth: 720, margin: "0 auto" }}>
    <EntityCardDetailed
      name="Groupe de parole des parents solos"
      description="Rencontres mensuelles animées par une médiatrice familiale, sans inscription préalable."
      locality="Liévin"
      postalCode="62800"
      typeBadge={badge("Projet")}
      tags={["Entraide", "Monoparentalité"]}
    />
  </div>
);
