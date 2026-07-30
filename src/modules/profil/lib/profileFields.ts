import { resolveServerDataPath, toFacetTokens } from "@/modules/search/lib/dropdownFilters";
import type { ProfileField } from "../schema";

/** Une ligne prête à rendre : le champ déclaré + ses valeurs non vides. */
export interface ProfileFieldRow {
  field: ProfileField;
  /** Valeurs affichables. Pour `socialLinks`, chaque token est déjà une URL. */
  tokens: string[];
  /** Libellés parallèles à `tokens` (ex. « LinkedIn » pour une URL). */
  labels?: string[];
}

/**
 * Entrées d'une liste `otherSociaNetworks` du legacy : `{ type, link }`.
 *
 * ⚠️ Les données réelles contiennent des entrées où `type` **et** `link` sont des
 * TABLEAUX parallèles (`{type:["Instagram","TikTok"], link:[url1,url2]}` — saisie
 * legacy non normalisée) : on les aplatit au lieu de les perdre.
 */
function socialTokens(value: unknown): { tokens: string[]; labels: string[] } {
  if (!Array.isArray(value)) return { tokens: [], labels: [] };
  const tokens: string[] = [];
  const labels: string[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== "object") continue;
    const { link, type } = entry as { link?: unknown; type?: unknown };
    const links = Array.isArray(link) ? link : [link];
    const types = Array.isArray(type) ? type : [type];
    links.forEach((href, index) => {
      if (typeof href !== "string" || href.trim() === "") return;
      const label = types[index] ?? (Array.isArray(type) ? undefined : type);
      tokens.push(href.trim());
      labels.push(typeof label === "string" && label.trim() !== "" ? label.trim() : href.trim());
    });
  }
  return { tokens, labels };
}

/**
 * Construit les lignes rendues par la section `profile-fields` : résout chaque
 * `field` (dot-path `serverData`), normalise la valeur en tokens et **écarte les
 * champs vides**. Fonction pure — testée par `profileFields.test.ts`.
 */
export function buildProfileFieldRows(
  serverData: Record<string, unknown> | undefined,
  fields: ProfileField[],
): ProfileFieldRow[] {
  const rows: ProfileFieldRow[] = [];
  for (const field of fields) {
    const raw = resolveServerDataPath(serverData, field.field);
    if (field.format === "socialLinks") {
      const { tokens, labels } = socialTokens(raw);
      if (tokens.length > 0) rows.push({ field, tokens, labels });
      continue;
    }
    const tokens = toFacetTokens(raw);
    if (tokens.length > 0) rows.push({ field, tokens });
  }
  return rows;
}

/** `href` d'un token selon le format déclaré (`undefined` = texte simple). */
export function fieldHref(format: ProfileField["format"], token: string): string | undefined {
  switch (format) {
    case "email":
      return `mailto:${token}`;
    case "tel":
      return `tel:${token.replace(/\s+/g, "")}`;
    case "link":
    case "socialLinks":
      return /^https?:\/\//i.test(token) ? token : `https://${token}`;
    default:
      return undefined;
  }
}
