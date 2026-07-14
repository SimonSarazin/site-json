// Alias de colonnes CSV PLATES repliées sous `address{}` (le backend verifyData/geocodage ne lit QUE
// `address` imbriquée — une colonne plate `postalCode` serait ignorée en silence : adresse+geo perdues).
const ADDRESS_KEYS: Record<string, string> = {
  postalCode: "postalCode",
  addressLocality: "addressLocality",
  city: "addressLocality",
  ville: "addressLocality",
  streetAddress: "streetAddress",
  adresse: "streetAddress",
  addressCountry: "addressCountry",
  codeInsee: "codeInsee",
};

/**
 * Met en forme une ligne CSV plate pour l'API d'import :
 * - `headerToAttr` (optionnel) : traduit l'EN-TÊTE CSV → attribut technique AVANT tout traitement
 *   (rôle du `col` de `costum.import.mapping` : « Sol » → `equip_sol`). Une en-tête mappée à `""`
 *   (ou absente de la map, quand une map est fournie) est IGNORÉE — comme le legacy `infoCreateData` ;
 * - clés pointées `address.postalCode` → objets imbriqués (dépliage générique) ;
 * - alias plats d'adresse (`postalCode`, `city`, …) → repliés sous `address{}` ;
 * - `tags` chaîne → tableau (séparateurs `,` ou `;`) ;
 * - valeurs vides ("") retirées (Papa.parse produit "" pour les cellules vides → bruit).
 *
 * Le CAST des types (ARRAY/INT/FLOAT) reste au BACKEND (attributesWithTypes ← import.mapping).
 */
export function shapeImportRow(
  row: Record<string, unknown>,
  headerToAttr?: Record<string, string>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [rawKey, rawValIn] of Object.entries(row)) {
    // Traduction en-tête → attribut (si une map est fournie) : hors map ou mappé à "" → colonne ignorée.
    let key = rawKey.trim();
    if (headerToAttr) {
      const mapped = headerToAttr[key] ?? headerToAttr[rawKey];
      if (!mapped) continue;
      key = mapped.trim();
    }
    // REVIEW LOW : trim des valeurs string (espaces parasites des CSV Excel → résolution de commune ratée).
    const rawVal = typeof rawValIn === "string" ? rawValIn.trim() : rawValIn;
    if (!key || rawVal === "" || rawVal == null) continue;
    // 1) clés pointées → imbrication générique
    if (key.includes(".")) {
      const parts = key.split(".");
      let cur = out;
      for (let i = 0; i < parts.length - 1; i++) {
        const p = parts[i];
        if (typeof cur[p] !== "object" || cur[p] === null) cur[p] = {};
        cur = cur[p] as Record<string, unknown>;
      }
      cur[parts[parts.length - 1]] = rawVal;
      continue;
    }
    // 2) alias adresse plats → address{}
    const addrKey = ADDRESS_KEYS[key];
    if (addrKey) {
      const addr = (out.address ?? {}) as Record<string, unknown>;
      addr[addrKey] = rawVal;
      out.address = addr;
      continue;
    }
    // 3) tags CSV → array
    if (key === "tags" && typeof rawVal === "string") {
      out.tags = rawVal.split(/[;,]/).map((t) => t.trim()).filter(Boolean);
      continue;
    }
    out[key] = rawVal;
  }
  // addressCountry par défaut si une adresse est présente sans pays (REQUIS par la résolution cities :
  // sans pays le backend ne résout pas → importdata supprime address+geo faute de localityId). ⚠ Les
  // communes d'outre-mer sont stockées sous leur code ISO PROPRE (RE/GP/MQ/GF/YT), pas "FR" — un défaut
  // FR aveugle casse p.ex. Saint-Pierre 97410 (n'existe qu'en RE). On dérive donc du code postal.
  const addr = out.address as Record<string, unknown> | undefined;
  if (addr && Object.keys(addr).length > 0 && !addr.addressCountry) {
    addr.addressCountry = countryFromPostalCode(String(addr.postalCode ?? ""));
  }
  return out;
}

/** Code pays ISO depuis le code postal : DOM → code dédié (base cities), sinon FR. */
function countryFromPostalCode(cp: string): string {
  if (/^971/.test(cp)) return "GP"; // Guadeloupe
  if (/^972/.test(cp)) return "MQ"; // Martinique
  if (/^973/.test(cp)) return "GF"; // Guyane
  if (/^974/.test(cp)) return "RE"; // La Réunion
  if (/^976/.test(cp)) return "YT"; // Mayotte
  return "FR";
}
