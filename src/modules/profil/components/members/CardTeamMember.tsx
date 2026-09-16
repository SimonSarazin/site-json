import { ArrowRight, Mail, MapPin, Phone } from "lucide-react";
import { Link, useLocation } from "react-router";

import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useEntityBySlugQuery } from "@/hooks/useEntityBySlugQuery";
import { useT } from "@/hooks/useT";
import { cheminTerritoire, couleursTerritoire, type ConventionRattachement } from "../../lib/teamDirectory";
import { rolesDuMembre } from "../../lib/memberRoles";
import { contactsDuProfil, lignesContactEquipe } from "../../lib/contactProfil";
import { initiales } from "@/lib/initiales";
import { vueMembre } from "../../lib/ficheMembre";

import type { EntityTypes, Organization, User } from "@communecter/cocolight-api-client";

/**
 * Carte d'un membre d'ÉQUIPE — pensée pour une page vitrine (« Notre équipe »), pas pour la gestion.
 *
 * Pourquoi un GET par membre plutôt que la liste : la projection de `getMembers` ne ramène ni
 * `territoires` ni l'adresse complète, et son contrat n'accepte pas de `fields` — rien ne permet de
 * lui demander un champ de plus. `entityBySlug` rend la fiche ENTIÈRE ; React Query dédoublonne et
 * met en cache 5 minutes, donc N cartes = N requêtes une seule fois.
 *
 * Les RÔLES ne viennent pas de la fiche mais du LIEN avec l'entité (`links.<famille>[id].roles`) —
 * ils disent la fonction de la personne DANS ce réseau, pas dans l'absolu.
 *
 * La carte porte LA COULEUR DE SON TERRITOIRE (fond + encre), servie par `couleursTerritoire`. Ces
 * couples sont des couleurs de marque déjà ramenées au contraste AA : ils sont donc identiques en
 * clair et en sombre, et c'est voulu — un fond de marque qui basculerait avec le thème ne serait
 * plus la couleur du territoire. Tout le reste de la carte se peint en `currentColor`, donc rien
 * n'a besoin d'une variante `dark:`.
 */
export function CardTeamMember({
  member,
  entity,
  contactText,
  layout = "stack",
  rattachement,
}: {
  member: User | Organization;
  entity: EntityTypes | null;
  /** Coordonnées de l'ÉQUIPE (et non de la personne), posées dans la carte sous ses propres
   *  contacts : sur une page de territoire, le courriel et les téléphones du comité valent pour
   *  qui occupe le poste, pas pour l'individu. Déjà traduit par l'appelant. */
  contactText?: string;
  /** `stack` (défaut) : grand portrait en 4/3 au-dessus du texte — la carte VITRINE de `/equipe`.
   *  `row` : vignette RONDE à gauche de l'identité, pour une carte posée dans une colonne étroite
   *  à côté d'autres blocs, où le grand portrait ferait une colonne deux fois plus haute que ses
   *  voisines. */
  layout?: "stack" | "row";
  /** Convention de rattachement (chemin de page, préfixe des variables de couleur). Absente, on
   *  garde le preset en service — cf. `CONVENTION_RATTACHEMENT_DEFAUT`. */
  rattachement?: ConventionRattachement;
}) {
  const t = useT("modules/profil");
  const { pathname } = useLocation();
  const slugListe = member.serverData?.slug as string | undefined;
  const { data: fiche } = useEntityBySlugQuery({ slug: slugListe });

  const { nom, slug, photo, rattachement: territoire, donnees: sd } = vueMembre(
    member.serverData as Record<string, unknown> | undefined,
    (fiche as { serverData?: Record<string, unknown> } | undefined)?.serverData,
  );
  const roles = rolesDuMembre(
    sd.links as Record<string, unknown> | undefined,
    entity?.id,
    entity?.serverData?.links as Record<string, unknown> | undefined,
    member.id,
  );
  const { email, telephone, adresse } = contactsDuProfil(sd);
  const lignesEquipe = lignesContactEquipe(contactText, { email, telephone });
  const lienTerritoire = cheminTerritoire(territoire, rattachement);
  const { fond, encre, bordure } = couleursTerritoire(territoire, rattachement);
  const enLigne = layout === "row";

  // Photo posée sur une PLAQUE : même fond que la carte, détachée par un filet `--border` —
  // le jeton de thème, qui suit clair/sombre, là où un blanc fixe ne bougeait pas.
  // En `stack`, cadrage `contain` — les portraits du réseau portent le logo parent62 à GAUCHE du
  // visage, qu'un `cover` rognerait. En `row` la vignette est RONDE, et là `cover` s'impose :
  // `contain` laisserait le portrait en boîte aux lettres à l'intérieur du cercle.
  // `shrink-0` : la carte est un conteneur flex, sans lui la grille écrase la plaque ;
  // `overflow-hidden` parce qu'un bloc `aspect-ratio` en `overflow: visible` garde une hauteur
  // minimale basée sur son contenu.
  const portrait = (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center overflow-hidden",
        enLigne ? "h-20 w-20" : "aspect-[4/3] w-full",
      )}
      style={{ background: fond, border: "2px solid var(--border)", borderRadius: enLigne ? "9999px" : "13px" }}
    >
      {photo ? (
        <img
          src={photo}
          alt={nom}
          loading="lazy"
          className={cn(
            "h-full w-full transition-transform duration-300 group-hover:scale-105",
            enLigne ? "object-cover" : "object-contain",
          )}
        />
      ) : (
        <span
          className={enLigne ? "text-xl font-bold" : "text-4xl font-bold"}
          style={{ color: "color-mix(in srgb, currentColor 45%, transparent)" }}
        >
          {initiales(nom)}
        </span>
      )}
    </div>
  );

  const identite = (
    <>
      {territoire && (
        <span className="text-[11px] font-semibold uppercase tracking-[0.12em] opacity-85">
          {territoire}
        </span>
      )}

      {slug ? (
        <Link
          to={`/profil/${slug}`}
          className={cn("font-bold leading-tight hover:underline", enLigne ? "text-lg" : "text-xl")}
        >
          {nom}
        </Link>
      ) : (
        <span className={cn("font-bold leading-tight", enLigne ? "text-lg" : "text-xl")}>{nom}</span>
      )}

      {roles.length > 0 && <p className="text-sm leading-snug opacity-85">{roles.join(" · ")}</p>}
    </>
  );

  return (
    <Card
      className="group flex h-full flex-col gap-0 overflow-hidden rounded-2xl p-3 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl"
      style={{ background: fond, color: encre, borderColor: bordure }}
    >
      {enLigne ? (
        <div className="flex items-center gap-3 px-1 pt-1">
          {portrait}
          {/* `min-w-0` : sans lui, un nom long refuse de se couper et pousse la vignette hors carte. */}
          <div className="flex min-w-0 flex-col gap-0.5">{identite}</div>
        </div>
      ) : (
        portrait
      )}

      <div className="flex flex-1 flex-col gap-1 px-2 pt-4">
        {!enLigne && identite}

        {/* Contacts de la PERSONNE, lus sur sa fiche. Icônes plutôt que libellés : la colonne est
            étroite, et « Courriel : » y mangerait une ligne entière. */}
        {(email || telephone || adresse) && (
          <div className="mt-3 flex flex-col gap-1 text-sm leading-snug opacity-85">
            {email && (
              <a href={`mailto:${email}`} className="flex items-start gap-1.5 hover:underline">
                <Mail className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span className="break-all">{email}</span>
              </a>
            )}
            {telephone && (
              <span className="flex items-start gap-1.5">
                <Phone className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>{telephone}</span>
              </span>
            )}
            {adresse && (
              <span className="flex items-start gap-1.5">
                <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>{adresse}</span>
              </span>
            )}
          </div>
        )}

        {/* Coordonnées de l'équipe : un filet en `currentColor` les sépare des contacts de la
            personne sans introduire une couleur de plus à valider. */}
        {lignesEquipe.length > 0 && (
          <div
            className="mt-3 flex flex-col gap-0.5 border-t pt-3 text-sm leading-snug opacity-85"
            style={{ borderColor: "color-mix(in srgb, currentColor 25%, transparent)" }}
          >
            {lignesEquipe.map((ligne) => (
              <span key={ligne}>{ligne}</span>
            ))}
          </div>
        )}

        {/* Bouton INVERSÉ : l'encre de la carte devient le fond, le fond devient le texte. Le couple
            est déjà validé à ≥ 6,1:1 dans un sens, donc il l'est dans l'autre — aucune troisième
            couleur à valider. `mt-auto` le cale en bas quelle que soit la longueur des rôles.
            Masqué quand on EST déjà sur la page visée (carte posée sur `/territoire/<slug>`). */}
        {lienTerritoire && lienTerritoire !== pathname && (
          <Link
            to={lienTerritoire}
            className="mt-auto flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition-opacity hover:opacity-90"
            style={{ background: encre, color: fond }}
          >
            {t("CardTeamMember.territoryNews")}
            <ArrowRight className="h-4 w-4" />
          </Link>
        )}
      </div>
    </Card>
  );
}

export default CardTeamMember;
