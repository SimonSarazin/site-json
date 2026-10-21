/**
 * Onglets de navigation d'une page Ampli.
 *
 * Source unique : la barre d'onglets (`AmpliTabs`), le switch de rendu
 * (`AmpliSectionRenderer`) et le SEO (`AmpliSeo`) parlent des mêmes clés, qui
 * sont AUSSI les segments d'URL déclarés dans `routes.tsx`.
 *
 * Pas d'onglet « Messages » : les messages vivent dans la page d'accueil
 * (section `AmpliMessages`), pas dans une route à part.
 */
export const AMPLI_TABS = [
    { key: "home", labelKey: "AmpliTemplateDefault.tabs.home" },
    { key: "community", labelKey: "AmpliTemplateDefault.tabs.network" },
    { key: "stats", labelKey: "AmpliTemplateDefault.tabs.stats" },
    { key: "news", labelKey: "AmpliTemplateDefault.tabs.news" },
] as const;

export type AmpliTabKey = (typeof AMPLI_TABS)[number]["key"];

/** URL d'un onglet — `home` est la route index, sans segment. */
export function ampliTabPath(slug: string, tab: AmpliTabKey): string {
    return tab === "home" ? `/ampli/${slug}` : `/ampli/${slug}/${tab}`;
}
