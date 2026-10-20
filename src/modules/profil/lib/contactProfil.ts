/**
 * Courriel et téléphone lisibles d'une fiche (`serverData`).
 *
 * `telephone` n'a PAS une forme unique en base : c'est une chaîne pour la plupart des fiches, un
 * objet `{ mobile: string[], fixe: string[] }` pour les organisations de certains costums, et
 * quelques fiches anciennes portent encore un `mobile` plat à la racine. Rendre la valeur brute
 * ferait planter React (un objet ne peut pas être un enfant) — d'où cette normalisation.
 *
 * ⚠️ Trois copies INLINE de cette lecture existent déjà (`CardContact`, `PreviewStructure`,
 * `coformAnswer`). Elles ne sont pas fusionnées ici : chacune a son propre repli et sa propre
 * notion de « téléphone principal », et les toucher dépasserait le périmètre de la carte d'équipe.
 * C'est la première version EXPORTÉE et testée ; les reprendre est un chantier à part.
 */
export function contactsDuProfil(sd: Record<string, unknown> | undefined): {
  email: string | null;
  telephone: string | null;
  adresse: string | null;
} {
  const email = typeof sd?.email === "string" && sd.email.trim() !== "" ? sd.email.trim() : null;

  const brut = sd?.telephone ?? sd?.phone;
  let telephone: string | null = null;
  if (typeof brut === "string" && brut.trim() !== "") {
    telephone = brut.trim();
  } else if (brut && typeof brut === "object") {
    const t = brut as { mobile?: unknown; fixe?: unknown };
    // Les deux listes sont affichées, séparées : un coordonnateur donne souvent un portable ET
    // le fixe de sa structure, et n'en montrer qu'un fait perdre l'autre.
    const numeros = [...listeNumeros(t.mobile), ...listeNumeros(t.fixe)];
    telephone = numeros.length > 0 ? numeros.join(" · ") : null;
  }
  if (!telephone && typeof sd?.mobile === "string" && sd.mobile.trim() !== "") {
    telephone = sd.mobile.trim();
  }

  return { email, telephone, adresse: ligneAdresse(sd?.address) };
}

/**
 * L'adresse postale sur une ligne, ou `null` si la fiche n'en porte aucune.
 *
 * ⚠️ Le même assemblage `[streetAddress, postalCode, addressLocality]` est recopié dans une
 * dizaine de composants du parc (`CardContact`, `CardImagePanel`, `MapPopupDefault`,
 * `PreviewFacets`, `AmpliUserCard`…), avec des séparateurs différents — espace ici, virgule là — et
 * parfois un champ de plus. Ils ne sont PAS migrés d'office : changer le séparateur d'une carte
 * modifierait le rendu de sites qui n'ont rien demandé. `separateur` est là pour qu'une migration
 * se fasse plus tard sans nouvelle divergence.
 */
export function ligneAdresse(valeur: unknown, separateur = ", "): string | null {
  if (!valeur || typeof valeur !== "object") return null;
  const a = valeur as { streetAddress?: unknown; postalCode?: unknown; addressLocality?: unknown };
  const ligne = [a.streetAddress, a.postalCode, a.addressLocality]
    .filter((x): x is string => typeof x === "string" && x.trim() !== "")
    .map((x) => x.trim())
    .join(separateur);
  return ligne || null;
}

/** Une entrée `mobile`/`fixe` est un tableau, mais quelques fiches y mettent une chaîne seule. */
function listeNumeros(valeur: unknown): string[] {
  if (typeof valeur === "string") return valeur.trim() ? [valeur.trim()] : [];
  if (!Array.isArray(valeur)) return [];
  return valeur.filter((n): n is string => typeof n === "string" && n.trim() !== "").map((n) => n.trim());
}

/**
 * Le texte de contact de l'ÉQUIPE, privé des lignes que la fiche de la personne affiche déjà.
 *
 * Sur une page de territoire, les deux se recouvrent souvent : la fiche du coordonnateur porte
 * le courriel du comité (`audomarois@parent62.org`), que le bloc d'équipe redonne mot pour mot.
 * Afficher la même adresse deux fois dans une carte de 320 px la rend illisible.
 *
 * La comparaison ignore casse, espaces et ponctuation — « 07 88 15 57 38 » et « 0788155738 »
 * sont le même numéro. Elle reste VOLONTAIREMENT stricte sur le reste : deux libellés d'adresse
 * proches mais distincts (« Rue Brueghel » vs « Centre Social Inter-Générations, rue Brueghel »)
 * portent chacun une information, et on ne devine pas laquelle garder.
 */
export function lignesContactEquipe(
  texte: string | undefined,
  deja: { email: string | null; telephone: string | null },
): string[] {
  if (!texte) return [];
  const vus = new Set(
    [deja.email, deja.telephone].filter((v): v is string => !!v).map(normaliser),
  );
  return texte
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l !== "" && !vus.has(normaliser(l)));
}

function normaliser(valeur: string): string {
  return valeur.toLowerCase().replace(/[^a-z0-9@.]/g, "");
}
