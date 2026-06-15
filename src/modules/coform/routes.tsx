import { QueryClient } from "@tanstack/react-query";
import { LoaderFunctionArgs, RouteObject } from "react-router";
import type { ModuleRouteFactory } from "@/lib/modules";
import CoFormPage from "./pages/CoFormPage.tsx";
import CoFormAnswerPage from "./pages/CoFormAnswerPage.tsx";
import CoFormPlacePage from "./pages/CoFormPlacePage.tsx";

const coformLoader = async ({ params }: LoaderFunctionArgs, queryClient?: QueryClient) => {
    if (!queryClient) return null;

    const formId = params.formId;
    if (!formId) {
        throw new Response("Not Found", { status: 404 });
    }

    try {
        return {
            formId,
        };
    } catch (error) {
        console.error('Erreur lors du chargement du formulaire:', error);
        throw new Response('Not Found', { status: 404 });
    }
};

const coformAnswerLoader = async ({ params, request }: LoaderFunctionArgs) => {
    const formId = params.formId;
    const answerId = params.answerId;

    if (!formId || !answerId) {
        throw new Response("Not Found", { status: 404 });
    }

    const url = new URL(request.url);
    const mode = (url.searchParams.get("mode") as "edit" | "readonly") || "readonly";

    return { formId, answerId, mode };
};

/**
 * Routes du module CoForm
 *
 * Ces routes sont dynamiquement injectées dans le router principal
 * via le système de découverte de modules (src/lib/modules.ts)
 *
 * Convention :
 * - /coform/:formId                           → formulaire dynamique
 * - /coform/:formId/answer/:answerId?mode=... → consultation / édition d'une réponse
 * - /coform/:formId/place                     → vue collaborative liste des lieux
 * - /coform/:formId/place/:placeId            → vue collaborative édition par lieu
 *
 * @param queryClient - Client React Query pour le pré-chargement SSR
 * @returns Liste des routes du module coform
 */
export const routes: ModuleRouteFactory = (queryClient?: QueryClient): RouteObject[] => [
    {
        path: "coform/:formId",
        element: <CoFormPage />,
        loader: (args) => coformLoader(args, queryClient),
    },
    {
        path: "coform/:formId/answer/:answerId",
        element: <CoFormAnswerPage />,
        loader: (args) => coformAnswerLoader(args),
    },
    {
        path: "coform/:formId/place",
        element: <CoFormPlacePage />,
        loader: (args) => coformLoader(args, queryClient),
    },
    {
        path: "coform/:formId/place/:placeId",
        element: <CoFormPlacePage />,
        loader: (args) => coformLoader(args, queryClient),
    },
];
