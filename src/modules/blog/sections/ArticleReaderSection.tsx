import "../i18n"; // side-effect : namespace i18n "modules/blog"
import { Suspense } from "react";
import { useT } from "@/hooks/useT";
import { useSite } from "@/hooks/useSite";
import { useHydrated } from "@/hooks/useHydrated";
import { Skeleton } from "@/components/ui/skeleton";
import { useArticle } from "../hooks/useArticle";
import { READER_VARIANTS } from "../variants/readers";
import type { ArticleReaderSectionProps } from "../schema";

const ReaderSkeleton = () => (
  <div className="mx-auto max-w-3xl space-y-4 px-4 py-8">
    <Skeleton className="h-10 w-3/4" />
    <Skeleton className="h-64 w-full rounded-xl" />
    <Skeleton className="h-40 w-full" />
  </div>
);

/** Contenu data-backed — monté APRÈS hydratation (île client, pas de SEO propre : le canonical reste /blog). */
function Inner({ props }: { props: ArticleReaderSectionProps }) {
  const t = useT("modules/blog");
  const { config } = useSite();
  const { article, isLoading, isError } = useArticle({ slug: props.slug, id: props.id });
  const Reader = READER_VARIANTS.get(props.readerVariant ?? config.blog?.readerVariant);

  if (isLoading) return <ReaderSkeleton />;
  if (isError || !article) {
    return <p className="mx-auto max-w-3xl px-4 py-10 text-center text-muted-foreground">{t("article.notFound")}</p>;
  }
  return (
    <Suspense fallback={<ReaderSkeleton />}>
      {/* Section EMBARQUÉE → pas de bouton retour par défaut (showBack pour l'activer). */}
      <Reader article={article} hideBack={!props.showBack} backTo={props.backTo} />
    </Suspense>
  );
}

/**
 * Section `articleReader` : affiche UN article précis (par `slug`/`id`) sur n'importe quelle page (data-backed,
 * réutilise `useArticle` + le registre `READER_VARIANTS`). À distinguer du `blogPost` STATIQUE. Île client.
 */
export default function ArticleReaderSection({ id, props }: { id?: string; props: ArticleReaderSectionProps }) {
  const hydrated = useHydrated();
  return (
    <section id={id} className="bg-background text-foreground">
      {hydrated ? <Inner props={props} /> : <ReaderSkeleton />}
    </section>
  );
}
