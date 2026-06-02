import type { ReactNode } from "react";
import type { LocalizedString } from "@/types/locale-schema";
import type { Api, Organization, Project, User } from "@communecter/cocolight-api-client";
import type { SiteConfig } from "@/types/site";

export type CommandId = string;
export type CommandGroupId = string;

/** Un libellé soit fixe (déjà localisé / clé) soit localisable par locale. */
export type LocalizedText = string | LocalizedString;

/**
 * Contexte de LECTURE passé à `source.getCommands`. Résolu une seule fois par
 * `useCommands` (qui appelle les hooks React). Les sources sont des fonctions
 * PURES de ce contexte — elles ne consomment aucun hook directement.
 */
export interface CommandReadContext {
  /** Texte courant de l'input (débouncé). */
  query: string;
  me: User | null;
  locale: string;
  pathname: string;
  config: SiteConfig;
  /** Thème courant (next-themes) — `undefined` au SSR. */
  theme?: string;
  /** Entité costum chargée (pour la recherche backend) — `null` si non résolue. */
  entity: Organization | Project | null;
}

/**
 * Contexte d'EXÉCUTION passé à `command.perform`. Résolu par `CommandPalette`
 * au moment du `onSelect` — porte les capacités impératives (navigation,
 * thème, langue, API) que les sources ne peuvent pas obtenir elles-mêmes.
 */
export interface CommandRunContext {
  navigate: (to: string) => void;
  close: () => void;
  me: User | null;
  locale: string;
  theme?: string;
  setTheme: (theme: string) => void;
  setLocale: (locale: string) => void;
  api: Api | null;
}

export interface Command {
  /** Identifiant unique (ex: `nav:/about`, `action:toggle-theme`, `profil:<id>`). */
  id: CommandId;
  label: LocalizedText;
  description?: LocalizedText;
  /** Termes additionnels indexés pour le filtrage (en plus du label). */
  keywords?: string[];
  icon?: ReactNode;
  group: CommandGroupId;
  /** Raccourci affiché à droite (ex: `["⌘", "H"]`). Purement décoratif ici. */
  shortcut?: string[];
  perform: (ctx: CommandRunContext) => void | Promise<void>;
}

export interface CommandGroup {
  id: CommandGroupId;
  heading: LocalizedText;
  /** Ordre d'affichage (bas = en premier). Défaut implicite : 100. */
  order?: number;
}

export interface CommandSource {
  /** Identifiant unique de la source (ex: `core:navigation`, `profil:entities`). */
  namespace: string;
  /**
   * `true` → `getCommands` renvoie une Promise et n'est exécutée qu'à
   * l'ouverture ET `query.length >= 2`, via React Query (débounce + cache).
   */
  async?: boolean;
  /** Groupes déclarés par la source (métadonnées : heading, ordre). */
  groups?: CommandGroup[];
  getCommands: (ctx: CommandReadContext) => Command[] | Promise<Command[]>;
}
