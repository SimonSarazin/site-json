/**
 * `tags` d'une entité → tableau de chaînes, quelle que soit la forme reçue du backend.
 *
 * Le legacy renvoie parfois `tags` en OBJET : tableau PHP à index non contigus après un `$unset`
 * (`{"1": "Pedagogie", "2": "Santé"}` — les tags sont les VALEURS) ou dictionnaire de présence
 * (`{"Pedagogie": true}` — les tags sont les CLÉS). Un rendu qui itère `tags.map` plante sur ces
 * formes ; tout consommateur de chips passe donc par ici. Dédoublonné, ordre préservé, vides écartés.
 */
export function normalizeTags(raw: unknown): string[] {
  let values: unknown[] = [];
  if (Array.isArray(raw)) values = raw;
  else if (typeof raw === "string") values = [raw];
  else if (raw && typeof raw === "object") {
    const entries = Object.values(raw as Record<string, unknown>);
    const parValeurs = entries.length > 0 && entries.every((v) => typeof v === "string");
    values = parValeurs ? entries : Object.keys(raw as Record<string, unknown>);
  }
  return [...new Set(values.filter((t): t is string => typeof t === "string" && t.trim() !== ""))];
}
