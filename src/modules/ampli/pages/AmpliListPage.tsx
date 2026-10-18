import { useMemo, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router";
import { Helmet } from "@dr.pogodin/react-helmet";
import { Lightbulb, LinkIcon, Megaphone, Plus, Search, X } from "lucide-react";

import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useLoadNamespace } from "@/hooks/useLoadNamespace";
import { useLocalization } from "@/hooks/useLocalization";
import { useT } from "@/hooks/useT";
import { cn } from "@/lib/utils";
import { AmpliCreateDialog } from "../components/AmpliCreateDialog";
import { AmpliDeleteButton } from "../components/AmpliDeleteButton";
import { useCanManageAmplis } from "../hooks/useAmpliAdmin";
import { useAmpliAnswerCounts, type AmpliAnswerCount } from "../hooks/useAmpliAnswerCounts";
import { useAmplis } from "../hooks/useAmplis";
import { ampliTitle, collectAmpliTags, filterAmplis, resolveAmpliInput } from "../lib/costumAmpli";
import type { AmpliModel } from "../types";

/** Tags visibles sur une carte avant le « +N ». */
const VISIBLE_TAGS = 3;

function AmpliListCard({
    ampli,
    count,
    canManage,
}: {
    ampli: AmpliModel;
    count?: AmpliAnswerCount;
    /** Admin du costum : la carte porte alors la suppression de l'ampli. */
    canManage: boolean;
}) {
    const t = useT("modules/ampli");
    const title = ampliTitle(ampli);
    const visibleTags = ampli.tags.slice(0, VISIBLE_TAGS);
    const hiddenTags = ampli.tags.length - visibleTags.length;

    return (
        // `relative` + lien étiré (`after:inset-0`) : toute la carte est
        // cliquable, mais le nom accessible du lien reste le seul TITRE — un
        // lien qui engloberait la carte se ferait lire description et tags compris.
        <Card className="relative flex-row gap-4 p-4 transition-shadow hover:shadow-md focus-within:ring-2 focus-within:ring-ring">
            {/* Les entrées `costum.ampli` n'ont pas d'image : initiale aux
                couleurs du thème plutôt qu'une photo inventée. */}
            <div
                aria-hidden="true"
                className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-xl font-bold text-primary"
            >
                {title.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1 space-y-1.5">
                <h3 className="text-lg font-medium leading-tight text-foreground">
                    <Link
                        to={`/ampli/${ampli.slug}`}
                        className="outline-none after:absolute after:inset-0 after:content-['']"
                    >
                        {title}
                    </Link>
                </h3>
                {ampli.description && (
                    <p className="truncate text-sm text-muted-foreground">{ampli.description}</p>
                )}
                {count?.isLoading ? (
                    <Skeleton className="h-4 w-28" />
                ) : count?.count != null ? (
                    <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                        <Lightbulb className="h-3.5 w-3.5 shrink-0" />
                        {String(t(
                            count.count > 1 ? "AmpliList.proposals_other" : "AmpliList.proposals_one",
                            undefined,
                            { count: String(count.count) },
                        ))}
                    </p>
                ) : null}
                {visibleTags.length > 0 && (
                    <ul className="flex flex-wrap gap-1.5 pt-1">
                        {visibleTags.map((tag) => (
                            <li key={tag} className="rounded-full border border-border px-2.5 py-0.5 text-xs text-muted-foreground">
                                #{tag}
                            </li>
                        ))}
                        {hiddenTags > 0 && (
                            <li className="rounded-full border border-border px-2.5 py-0.5 text-xs text-muted-foreground">
                                {String(t("AmpliList.moreTags", undefined, { count: String(hiddenTags) }))}
                            </li>
                        )}
                    </ul>
                )}
            </div>
            {canManage && <AmpliDeleteButton ampli={ampli} />}
        </Card>
    );
}

/**
 * Page `/ampli` — tous les amplis déclarés dans `costum.ampli` du porteur.
 *
 * Deux colonnes (maquette de référence) : la liste filtrable à gauche, le
 * panneau de marque et l'accès direct par identifiant à droite. Montée
 * seulement quand `config.ampli === true` (cf. `routes.tsx`).
 */
export default function AmpliListPage() {
    useLoadNamespace("modules/ampli");
    const t = useT("modules/ampli");
    const { currentLocale } = useLocalization();
    const navigate = useNavigate();

    const { amplis, takenSlugs } = useAmplis();
    const canManage = useCanManageAmplis();
    const [createOpen, setCreateOpen] = useState(false);
    // Sur TOUS les amplis, pas la sélection filtrée : filtrer ne doit pas
    // relancer ni perdre de compteur.
    const counts = useAmpliAnswerCounts(amplis);
    const availableTags = useMemo(() => collectAmpliTags(amplis), [amplis]);

    const [query, setQuery] = useState("");
    const [activeTags, setActiveTags] = useState<string[]>([]);
    const visibleAmplis = useMemo(
        () => filterAmplis(amplis, { query, tags: activeTags }),
        [amplis, query, activeTags],
    );
    const hasFilters = query.trim() !== "" || activeTags.length > 0;

    const [slugInput, setSlugInput] = useState("");
    /** Saisie qui n'a désigné aucun ampli — affichée telle quelle dans l'erreur. */
    const [unknownSlug, setUnknownSlug] = useState<string | null>(null);

    const toggleTag = (tag: string) =>
        setActiveTags((current) => (current.includes(tag) ? current.filter((t) => t !== tag) : [...current, tag]));

    const clearFilters = () => {
        setQuery("");
        setActiveTags([]);
    };

    const handleJoin = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        // La liste est déjà en mémoire : un identifiant inconnu est signalé ICI,
        // plutôt que d'envoyer sur une page « ampli introuvable ».
        const target = resolveAmpliInput(amplis, slugInput);
        if (!target) {
            if (slugInput.trim() !== "") setUnknownSlug(slugInput.trim());
            return;
        }
        navigate(`/ampli/${target.slug}`);
    };

    return (
        <div className="min-h-screen flex flex-col bg-background">
            <Helmet htmlAttributes={{ lang: currentLocale }}>
                <title>{String(t("AmpliList.title"))}</title>
            </Helmet>
            <SiteHeader />
            <main className="flex-1">
                <div className="container mx-auto px-4 py-8 sm:px-6 md:py-12 lg:px-8">
                    <div className="grid grid-cols-1 items-start gap-10 lg:grid-cols-2 lg:gap-16">
                        {/* Panneau de marque + accès direct — PREMIER dans le DOM (et donc
                            sur mobile) : il porte le `<h1>` de la page. */}
                        <aside className="flex flex-col items-center text-center lg:sticky lg:top-24 lg:order-last lg:py-12">
                            <div className="mb-5 rounded-2xl bg-linear-to-br from-primary to-primary/60 p-4 text-primary-foreground shadow-md">
                                <Megaphone className="h-8 w-8" aria-hidden="true" />
                            </div>
                            <h1 className="text-3xl font-bold text-balance text-primary sm:text-4xl">
                                {String(t("AmpliHero.headline"))}
                            </h1>
                            <p className="mt-3 max-w-md text-pretty text-muted-foreground">
                                {String(t("AmpliHero.subhead"))}
                            </p>

                            <Card className="mt-8 w-full max-w-md gap-4 p-6 text-left">
                                <div className="text-center">
                                    <h2 className="flex items-center justify-center gap-2 text-xl font-semibold text-foreground">
                                        <LinkIcon className="h-5 w-5" aria-hidden="true" />
                                        {String(t("AmpliList.join.title"))}
                                    </h2>
                                    <p className="mt-1 text-sm text-muted-foreground">
                                        {String(t("AmpliList.join.description"))}
                                    </p>
                                </div>
                                <form onSubmit={handleJoin} className="space-y-3" noValidate>
                                    <label htmlFor="ampli-join-slug" className="sr-only">
                                        {String(t("AmpliList.join.label"))}
                                    </label>
                                    <Input
                                        id="ampli-join-slug"
                                        value={slugInput}
                                        onChange={(event) => {
                                            setSlugInput(event.target.value);
                                            setUnknownSlug(null);
                                        }}
                                        placeholder={String(t("AmpliList.join.placeholder"))}
                                        autoComplete="off"
                                        aria-invalid={unknownSlug !== null}
                                        aria-describedby={unknownSlug !== null ? "ampli-join-error" : undefined}
                                    />
                                    {unknownSlug !== null && (
                                        <p id="ampli-join-error" role="alert" className="text-sm text-destructive">
                                            {String(t("AmpliList.join.notFound", undefined, { slug: unknownSlug }))}
                                        </p>
                                    )}
                                    <Button type="submit" className="w-full">
                                        {String(t("AmpliList.join.button"))}
                                    </Button>
                                </form>
                            </Card>

                            <p className="mt-6 text-sm text-muted-foreground">{String(t("AmpliList.welcome"))}</p>

                            {/* Créer et supprimer touchent `costum.ampli` en base : réservé aux
                                admins du costum, et le serveur revérifie le droit. */}
                            {canManage && (
                                <>
                                    <Button variant="outline" className="mt-4 gap-2" onClick={() => setCreateOpen(true)}>
                                        <Plus className="h-4 w-4" />
                                        {String(t("AmpliList.create.open"))}
                                    </Button>
                                    <AmpliCreateDialog
                                        takenSlugs={takenSlugs}
                                        open={createOpen}
                                        onOpenChange={setCreateOpen}
                                        // L'entité porteuse est rechargée AVANT ce retour
                                        // (cf. `useCreateAmpli`) : la page de l'ampli tout juste
                                        // créé trouve son entrée dans `costum.ampli`.
                                        onCreated={(slug) => navigate(`/ampli/${slug}`)}
                                    />
                                </>
                            )}
                        </aside>

                        <section className="lg:order-first" aria-labelledby="ampli-list-title">
                            <h2 id="ampli-list-title" className="text-2xl font-bold text-foreground sm:text-3xl">
                                {String(t("AmpliList.title"))}
                            </h2>

                            {amplis.length === 0 ? (
                                <p className="mt-6 rounded-xl border border-dashed border-border p-8 text-center text-muted-foreground">
                                    {String(t("AmpliList.empty"))}
                                </p>
                            ) : (
                                <>
                                    <div className="relative mt-5">
                                        <Search
                                            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                                            aria-hidden="true"
                                        />
                                        <Input
                                            type="search"
                                            value={query}
                                            onChange={(event) => setQuery(event.target.value)}
                                            placeholder={String(t("AmpliList.searchPlaceholder"))}
                                            aria-label={String(t("AmpliList.searchLabel"))}
                                            className="pl-9"
                                        />
                                    </div>

                                    {availableTags.length > 0 && (
                                        <div className="mt-4">
                                            <p className="mb-2 text-sm text-muted-foreground">{String(t("AmpliList.filterByTags"))}</p>
                                            <div className="flex flex-wrap gap-2">
                                                {availableTags.map((tag) => {
                                                    const active = activeTags.includes(tag);
                                                    return (
                                                        <button
                                                            key={tag}
                                                            type="button"
                                                            aria-pressed={active}
                                                            onClick={() => toggleTag(tag)}
                                                            className={cn(
                                                                "rounded-full border px-3 py-1 text-xs transition-colors",
                                                                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                                                                active
                                                                    ? "border-primary bg-primary text-primary-foreground"
                                                                    : "border-border bg-background text-foreground hover:bg-muted",
                                                            )}
                                                        >
                                                            #{tag}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}

                                    {visibleAmplis.length === 0 ? (
                                        <div className="mt-6 rounded-xl border border-dashed border-border p-8 text-center">
                                            <p className="text-muted-foreground">{String(t("AmpliList.noResults"))}</p>
                                            {hasFilters && (
                                                <Button variant="outline" size="sm" className="mt-4 gap-2" onClick={clearFilters}>
                                                    <X className="h-4 w-4" />
                                                    {String(t("AmpliList.clearFilters"))}
                                                </Button>
                                            )}
                                        </div>
                                    ) : (
                                        <ul className="mt-6 space-y-4">
                                            {visibleAmplis.map((ampli) => (
                                                <li key={ampli.slug}>
                                                    <AmpliListCard
                                                        ampli={ampli}
                                                        count={counts[ampli.slug]}
                                                        canManage={canManage}
                                                    />
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </>
                            )}
                        </section>
                    </div>
                </div>
            </main>
            <SiteFooter />
        </div>
    );
}
