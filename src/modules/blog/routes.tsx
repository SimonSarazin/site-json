import type { LoaderFunctionArgs } from "react-router";
import type { QueryClient } from "@tanstack/react-query";
import ArticlePage from "./pages/ArticlePage";
import type { ModuleRouteFactory } from "@/lib/modules";
import { prefetchArticleById, prefetchArticleBySlug } from "./prefetch/prefetchArticle";

/** Prefetch SSR de l'article par slug (SEO). Best-effort : un échec ne casse pas le rendu (fallback client). */
const articleLoader = async ({ params }: LoaderFunctionArgs, queryClient?: QueryClient) => {
  if (!queryClient) return null; // client → skip (le hook fetch)
  const slug = params.slug;
  if (slug) { try { await prefetchArticleBySlug(queryClient, slug); } catch { /* SSR best-effort */ } }
  return null;
};

/** Prefetch SSR de l'article par id — SEO/contenu server-side pour les ~82% d'articles sans slug. Best-effort. */
const articleByIdLoader = async ({ params }: LoaderFunctionArgs, queryClient?: QueryClient) => {
  if (!queryClient) return null; // client → skip (le hook fetch)
  const id = params.id;
  if (id) { try { await prefetchArticleById(queryClient, id); } catch { /* SSR best-effort */ } }
  return null;
};

/**
 * Routes du module blog : le DÉTAIL d'un article. La LISTE (`/blog`) est une page config portant la
 * section `articleFeed` (SiteRenderer). `/blog/id/:id` sert les ~82% d'articles sans slug (prefetch SSR par id).
 */
export const routes: ModuleRouteFactory = (queryClient) => [
  { path: "blog/id/:id", element: <ArticlePage />, loader: (args) => articleByIdLoader(args, queryClient) },
  { path: "blog/:slug", element: <ArticlePage />, loader: (args) => articleLoader(args, queryClient) },
];
