import type { LucideIcon } from "lucide-react";
import {
  Globe,
  MessageCircle,
  CalendarDays,
  FolderKanban,
  Video,
  Cloud,
  Users,
  FolderOpen,
  BarChart2,
  Ticket,
  UserCheck,
} from "lucide-react";

export interface ToolCategoryMeta {
  label: string;
  Icon: LucideIcon;
}

/**
 * Catégories d'outils numériques d'un lieu, stockées dans la propriété
 * `ourTools` de l'organisation (`{ [catégorie]: [{ name, url? }] }`). Les clés
 * et labels sont alignés sur le legacy `co2/views/pod/yourTools.php`.
 * Partagé par l'affichage (`ProfileTiersLieuxInfo`) et l'éditeur
 * (`OurToolsEditDialog`).
 */
export const TOOLS_MAP: Record<string, ToolCategoryMeta> = {
  site: { label: "Site", Icon: Globe },
  chat: { label: "Chat entre membres", Icon: MessageCircle },
  agenda: { label: "Agenda événementiel", Icon: CalendarDays },
  projectManagement: { label: "Gestion de projet", Icon: FolderKanban },
  videoPlatform: { label: "Plateforme vidéo", Icon: Video },
  cloud: { label: "Cloud", Icon: Cloud },
  annuaire: { label: "Annuaire", Icon: Users },
  fileSharing: { label: "Partage de fichiers et édition", Icon: FolderOpen },
  survey: { label: "Sondage / enquête", Icon: BarChart2 },
  reservation: { label: "Système de réservation", Icon: Ticket },
  membership: { label: "Gestion des adhésions", Icon: UserCheck },
};

/** Ordre d'affichage / de sélection des catégories. */
export const TOOL_CATEGORY_KEYS = Object.keys(TOOLS_MAP);

export interface ToolItem {
  name: string;
  url?: string;
}

/** Shape de la propriété `ourTools`. */
export type OurTools = Record<string, ToolItem[]>;

/** Ligne d'édition à plat : une catégorie + un outil ({name, url}). */
export interface ToolRow {
  id: number;
  category: string;
  name: string;
  url: string;
}

/** `ourTools` (groupé par catégorie) → lignes à plat éditables (id = index). */
export function parseRows(raw: unknown): ToolRow[] {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return [];
  const rows: ToolRow[] = [];
  for (const [category, items] of Object.entries(raw as Record<string, unknown>)) {
    if (!(category in TOOLS_MAP) || !Array.isArray(items)) continue;
    for (const it of items as ToolItem[]) {
      rows.push({ id: rows.length, category, name: it?.name ?? "", url: it?.url ?? "" });
    }
  }
  return rows;
}

/**
 * Lignes à plat → `ourTools` (regroupé).
 * - Préserve les catégories de `raw` **hors** TOOLS_MAP (non gérées par
 *   l'éditeur) : `updateField` fait un `$set` de tout `ourTools`, donc sans ça
 *   une clé inconnue en base serait écrasée (le legacy, lui, les préserve).
 * - Garde une ligne dès qu'elle a un nom OU une url (le legacy autorise les
 *   entrées url-only).
 */
export function rowsToOurTools(rows: ToolRow[], raw: unknown): OurTools {
  const out: OurTools = {};
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    for (const [category, items] of Object.entries(raw as Record<string, unknown>)) {
      if (!(category in TOOLS_MAP) && Array.isArray(items)) {
        out[category] = items as ToolItem[];
      }
    }
  }
  for (const r of rows) {
    const name = r.name.trim();
    const url = r.url.trim();
    if ((!name && !url) || !(r.category in TOOLS_MAP)) continue;
    const item: ToolItem = { name };
    if (url) item.url = url;
    (out[r.category] ??= []).push(item);
  }
  return out;
}
