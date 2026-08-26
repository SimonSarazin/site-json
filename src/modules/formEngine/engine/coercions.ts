/**
 * Coercions de type GÉNÉRIQUES du moteur (formEngine) — fonctions pures + enregistrement comme transforms
 * nommés (`coerce:*`) dans le registre. Évitent la duplication des coerceurs « type » par entité
 * (avant : `poi:toString`/`tl:pickNumberString`/… ré-implémentaient la même chose). Les descripteurs
 * référencent désormais les clés génériques `coerce:string|number|bool|stringArray|dateYMD`.
 *
 * Importé en side-effect par le barrel formEngine → les `coerce:*` sont enregistrés dès le chargement du
 * moteur (avant tout seedEntity/buildPayload). Les transforms DOMAINE (adresse, social, geo, openingHours,
 * entityRef…) restent dans leur module métier (profil) — eux ne sont pas génériques.
 */
import { format } from "date-fns";
import { registerTransform } from "./transforms";

/** string → string ; number → String(n) ; sinon "". */
export const coerceString = (value: unknown): string => {
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  return "";
};

/** number fini → number ; string numérique → number ; vide/non-fini → undefined (champ omis). */
export const coerceNumber = (value: unknown): number | undefined => {
  if (typeof value === "number") return Number.isFinite(value) ? value : undefined;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed === "") return undefined;
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
};

/** boolean → tel quel ; number → (===1) ; string ∈ {true,1,oui,yes} (insensible casse) ; sinon false. */
export const coerceBool = (value: unknown): boolean => {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value === 1;
  if (typeof value === "string") return ["true", "1", "oui", "yes"].includes(value.trim().toLowerCase());
  return false;
};

/** array → strings non vides ; string → split("," ) trim filtré ; sinon []. */
export const coerceStringArray = (value: unknown): string[] => {
  if (Array.isArray(value)) return value.filter((e): e is string => typeof e === "string" && e.trim().length > 0);
  if (typeof value === "string") return value.split(",").map((e) => e.trim()).filter((e) => e.length > 0);
  return [];
};

/** Date / string ISO → "YYYY-MM-DD" via date-fns `format` (LOCALE-aware) ; sinon "". (≠ coerce:dateYMDutc, UTC pur.) */
export const coerceDateYMDlocale = (value: unknown): string => {
  const date = value instanceof Date ? value : typeof value === "string" && value.trim() ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? format(date, "yyyy-MM-dd") : "";
};

// ── Coerceurs « truthy/default » : passe-plat de la valeur si truthy, sinon un défaut typé.
// Ils NE coercent PAS le type de la valeur truthy (à la différence de coerce:string/number) — ce sont les
// équivalents littéraux des idiomes legacy `v || ""` / `v || undefined` / `Array.isArray(v) ? v : []`.

/** truthy → v tel quel ; falsy → "" (idiome legacy `v || ""`). Ne stringifie PAS un nombre truthy. */
export const coerceOrEmpty = (value: unknown): unknown => value || "";

/** truthy → v tel quel ; falsy → undefined (clé omise). `v || undefined` ≡ `v ? v : undefined` (prouvé byte-identique). */
export const coerceOrUndef = (value: unknown): unknown => value || undefined;

/** truthy → Number(v) (peut être NaN si non-numérique) ; falsy → undefined (clé omise). Ex-`tl:numOrUndef`
 *  (générique : champs surface… ≠ coerce:number qui valide la finitude). */
export const coerceNumOrUndef = (value: unknown): number | undefined => (value ? Number(value) : undefined);

/** string → v ; sinon "" (string-ONLY, STRICT : NE coerce PAS les nombres → distinct de coerce:string). */
export const coerceStringStrict = (value: unknown): string => (typeof value === "string" ? value : "");

/** array → tel quel ; sinon [] (idiome `Array.isArray(v) ? v : []`). */
export const coerceArrayOrEmpty = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

/** Boolean(v) — truthiness LÂCHE/simple (≠ coerce:bool qui interprète "true"/"oui"/1 sur les strings). */
export const coerceBoolLoose = (value: unknown): boolean => Boolean(value);

/** truthy → ISO complet `new Date(v).toISOString()` ; falsy → "". */
export const coerceDateISO = (value: unknown): string => (value ? new Date(value as string).toISOString() : "");

/** truthy → "YYYY-MM-DD" extrait de l'ISO UTC `…toISOString().split("T")[0]` ; falsy → "".
 *  UTC pur (≠ coerce:dateYMDlocale, date-fns `format` locale-aware). */
export const coerceDateYMDutc = (value: unknown): string =>
  value ? new Date(value as string).toISOString().split("T")[0] : "";

/**
 * booléen → **CHAÎNE** `"true"` / `"false"` (write). Pendant écriture de `coerce:bool` (lecture).
 *
 * Nécessaire pour les champs costum que le legacy stocke en chaîne : ses formulaires postent en
 * `form-urlencoded`, donc PHP reçoit `"true"` et l'écrit tel quel (ex. `displayAuth` de l'Institut
 * Bleu, dont l'annuaire filtre sur `displayAuth: "true"`). Écrire un booléen JSON à la place
 * romprait la parité : la fiche ne serait plus trouvée par les requêtes existantes.
 */
export const coerceBoolString = (value: unknown): string => (coerceBool(value) ? "true" : "false");

/**
 * Tableau → **CHAÎNE CSV** `"A, B, C"` (write). Pendant écriture EXACT de `coerce:stringArray`, qui
 * lit `"A, B, C"` → `["A","B","C"]`.
 *
 * La moitié lecture existait seule : un `multiselect`/`checkboxGroup`/`tags` posé sur un champ costum
 * chargeait bien la valeur stockée, puis la RENVOYAIT en tableau — contre un contrat qui dit `string`.
 * Mesuré sur `equipementsSportifs974` : 3 031 fiches en chaîne contre 30 en tableau, ces 30 issues d'un
 * import à convention divergente. C'est cet écart qui a fait typer 4 champs `array` par le scanner
 * d'artefact (échantillon de 150 documents), puis cassé création ET édition quand la régénération du
 * 30/07 a rétabli `string`.
 *
 * Séparateur `","` SANS espace (décision 2026-08-13) : la colonne réelle est mixte — 2 989 fiches
 * `"A,B"` contre 2 767 `"A, B"` — et la lecture (`split(",")` + trim) absorbe les deux à l'identique :
 * le choix est purement une forme stockée. On écrit la forme MAJORITAIRE ; l'édition d'une fiche
 * « avec espaces » la normalise vers `","` au premier save, à valeurs identiques. LIMITE connue : un libellé contenant des virgules
 * INTERNES (mesuré : `Vtt (Cross Country, Descente, Trial, Rallye, Four Cross)`, porté par 86 fiches)
 * est éclaté par le split si la fiche est ÉDITÉE — la préservation exigerait un split conscient de
 * l'enum, non implémenté.
 */
export const coerceCsv = (value: unknown): string | string[] => {
  if (!Array.isArray(value)) return coerceString(value);
  const vals = value.map((v) => String(v).trim()).filter((v) => v.length > 0);
  // SÉCURITÉ : la virgule est le SÉPARATEUR — une valeur qui en contient éclaterait en plusieurs à la
  // relecture (split). Mesuré : le libellé de liste `Vtt (Cross Country, Descente, …)`, porté par
  // 86 fiches, était éclaté en 5 morceaux par tout round-trip. Plutôt que d'ALTÉRER la valeur
  // (remplacer la virgule casserait `"1,5 km"` et ferait diverger le libellé de son enum → facettes
  // muettes), on bascule sur la forme TABLEAU — légitime au contrat (`oneOf[string,array]` des deux
  // côtés, précisément parce que le legacy stocke les deux) et hors de portée du split : la valeur
  // reste EXACTE. CSV quand c'est sûr, array quand le CSV serait destructeur.
  if (vals.some((v) => v.includes(","))) return vals;
  return vals.join(",");
};

/**
 * booléen → **CHAÎNE MAJUSCULE** `"TRUE"` / `"FALSE"` (write).
 *
 * La forme d'un « booléen » costum n'est pas universelle : elle est celle que l'import a posée. Sur
 * `equipementsSportifs974`, `inst_acc_handi_bool` compte 1 408 `"FALSE"` et 1 193 `"TRUE"` — et déjà
 * 29 `"true"`/`"false"` minuscules, écrits par le même import divergent que les 30 tableaux. Écrire en
 * minuscule ajouterait une TROISIÈME forme à la colonne ; or c'est exactement ce mélange de conventions
 * qui a fait dérailler le typage de l'artefact. D'où un transform explicite plutôt qu'une constante
 * globale : cf. `coerceBoolOuiNon` pour un costum qui a fait un autre choix.
 */
export const coerceBoolUpper = (value: unknown): string => (coerceBool(value) ? "TRUE" : "FALSE");

/**
 * booléen → **CHAÎNE** `"Oui"` / `"Non"` (write) — la forme d'`affiliate` chez sportSanteBienetre
 * (95 `"Oui"` / 69 `"Non"`, contre 15 `"true"`/`"false"` déjà écrits par ailleurs).
 */
export const coerceBoolOuiNon = (value: unknown): string => (coerceBool(value) ? "Oui" : "Non");

/**
 * nombre → **CHAÎNE** (write) ; vide → `undefined` (clé OMISE, pas `""`).
 *
 * Les champs numériques costum sont stockés en chaîne comme les autres (mesuré : `equip_larg` 3 061
 * chaînes, `equip_surf` 3 063, ZÉRO nombre natif) — le widget `number` renvoyait un nombre JS.
 *
 * L'omission du vide est le point délicat, et la raison de ne pas réutiliser `coerce:string` : celui-ci
 * rend `""` pour `undefined`, et `""` est précisément la manière dont le serveur EFFACE un champ
 * (`prepElementData` accumule les vides dans `unset`). Un champ numérique facultatif laissé intact
 * effacerait donc la valeur existante à chaque édition.
 */
export const coerceNumString = (value: unknown): string | undefined => {
  if (value === undefined || value === null || value === "") return undefined;
  return typeof value === "number" ? String(value) : String(value);
};

/**
 * Tableau d'entrées structurées → seules les lignes RENSEIGNÉES (write).
 *
 * Un `fieldArray` pré-rempli propose des lignes toutes faites (ex. les 4 réseaux sociaux de l'Institut
 * Bleu) ; celles que l'utilisateur ne complète pas n'ont aucune raison d'être écrites. Sans ce filtre le
 * formulaire FABRIQUE du vide : mesuré sur institutBleu, 142 des 246 entrées `otherSociaNetworks`
 * stockées n'ont pas de lien, et 21 organisations sur 73 n'en ont AUCUNE de renseignée.
 *
 * Une ligne est gardée dès qu'au moins un de ses champs porte autre chose que du blanc — on ne présume
 * donc pas quel champ fait foi.
 */
export const coerceFilledEntries = (value: unknown): unknown[] => {
  if (!Array.isArray(value)) return [];
  const rempli = (v: unknown): boolean =>
    typeof v === "string" ? v.trim() !== "" : v !== null && v !== undefined && v !== "";
  return value.filter((ligne) => {
    if (ligne === null || typeof ligne !== "object" || Array.isArray(ligne)) return rempli(ligne);
    return Object.values(ligne as Record<string, unknown>).some(rempli);
  });
};

registerTransform("coerce:string", coerceString);
registerTransform("coerce:number", coerceNumber);
registerTransform("coerce:bool", coerceBool);
registerTransform("coerce:stringArray", coerceStringArray);
registerTransform("coerce:dateYMDlocale", coerceDateYMDlocale);
registerTransform("coerce:orEmpty", coerceOrEmpty);
registerTransform("coerce:orUndef", coerceOrUndef);
registerTransform("coerce:numOrUndef", coerceNumOrUndef);
registerTransform("coerce:stringStrict", coerceStringStrict);
registerTransform("coerce:arrayOrEmpty", coerceArrayOrEmpty);
registerTransform("coerce:boolLoose", coerceBoolLoose);
registerTransform("coerce:dateISO", coerceDateISO);
registerTransform("coerce:dateYMDutc", coerceDateYMDutc);
registerTransform("coerce:boolString", coerceBoolString);
registerTransform("coerce:csv", coerceCsv);
registerTransform("coerce:boolUpper", coerceBoolUpper);
registerTransform("coerce:boolOuiNon", coerceBoolOuiNon);
registerTransform("coerce:numString", coerceNumString);
registerTransform("coerce:filledEntries", coerceFilledEntries);
