import { Suspense, useEffect, useMemo, useRef } from "react";
import { lazy } from "vite-preload";
import { MessagesSquare } from "lucide-react";
import type { EntityTypes } from "@communecter/cocolight-api-client";
import { Button } from "@/components/ui/button";
import { useLoadNamespace } from "@/hooks/useLoadNamespace";
import { useT } from "@/hooks/useT";
import { useDiscussionSpaceQuery, useSpaceLauncher, type SpaceRef } from "@/modules/comment/launch";

/**
 * La modale n'arrive qu'à l'ouverture : le fil, le composer et le rendu markdown ne sont pas le
 * prix d'une fiche qu'on ne fait que lire. Le bouton, lui, ne tient qu'à l'entrée légère du module.
 *
 * `lazy` vient de `vite-preload` (pas `React.lazy`), comme partout dans le dépôt : il enregistre le
 * morceau auprès du rendu serveur, et il donne `preload()` — ce dont le bouton se sert, au survol
 * et au focus. Précédent : `AacDepositButton`.
 *
 * La fiche, elle, n'est pas dans le HTML du serveur : il sert la carte de chargement, et le bouton
 * n'existe qu'après hydratation (mesuré le 09/10). Un lien vers un fil ouvre donc sa modale une
 * fois la fiche chargée et le code de la modale arrivé — pas dès le premier affichage.
 */
const SpaceModal = lazy(() => import("@/modules/comment/components/panel/SpaceModal"));

export interface CommunDiscussionControlProps {
    /** Le commun : c'est lui qui porte l'espace de discussion. */
    answerId: string;
    /** Son titre, tel que la fiche l'a résolu — repris en tête de la modale. */
    communTitle?: string | null;
    /** L'organisation de l'appel : on y cherche d'abord les personnes à mentionner. */
    scopeEntity?: EntityTypes | null;
}

/**
 * Le bouton « Discussion » de la fiche d'un commun, et l'espace qu'il ouvre.
 *
 * Parité legacy : c'est le bouton « Commentaires » de `campDetail.php`, qui ouvre l'ESPACE du
 * commun — son fil général, un fil par question de l'appel ouverte aux commentaires, ses lignes
 * de dépense commentées et ses discussions supplémentaires (doc/38, espace d'un commun).
 *
 * Il s'affiche pour TOUT LE MONDE, visiteur non connecté compris : l'espace se lit sans session,
 * comme dans le legacy ; écrire invite à se connecter, dans le fil lui-même.
 *
 * Une adresse `?discussion=…` qui désigne un fil de CE commun ouvre la modale dès le premier
 * rendu du bouton, sans clic — c'est le lien qu'on partage, et celui d'une notification.
 */
export function CommunDiscussionControl({ answerId, communTitle, scopeEntity }: CommunDiscussionControlProps) {
    useLoadNamespace("modules/aac");
    const t = useT("modules/aac");
    const space = useMemo<SpaceRef>(() => ({ type: "answers", id: answerId }), [answerId]);
    const launcher = useSpaceLauncher(space);
    // Un compteur, pas une veille : relu à l'ouverture de la modale, qui partage cette entrée de cache.
    const { total, unread } = useDiscussionSpaceQuery(space);

    /**
     * À la fermeture, le focus revient au bouton — par la croix, par Échap ou par « retour ».
     *
     * Radix le rendrait à son `DialogTrigger`, et la modale n'en a pas : elle s'ouvre aussi par une
     * adresse, sans clic. Sans ceci le focus tombait sur `<body>` (mesuré au navigateur le 07/10),
     * et qui navigue au clavier reprenait la page par son début.
     */
    const boutonRef = useRef<HTMLButtonElement>(null);
    const etaitOuverte = useRef(false);
    useEffect(() => {
        // Sans défilement : le bouton est celui qu'on vient de quitter, la page n'a pas à bouger.
        if (etaitOuverte.current && !launcher.open) boutonRef.current?.focus({ preventScroll: true });
        etaitOuverte.current = launcher.open;
    }, [launcher.open]);

    return (
        <>
            <Button
                ref={boutonRef}
                variant="outline"
                size="sm"
                className="gap-2"
                // Ce que le bouton ouvre est un dialogue : le lecteur d'écran l'annonce avant le clic.
                aria-haspopup="dialog"
                onClick={() => launcher.openAt()}
                // Le code de la modale est préchauffé dès qu'on vise le bouton : au clic elle
                // s'ouvre sans attendre son téléchargement (même geste que l'agenda).
                onMouseEnter={() => { void SpaceModal.preload(); }}
                onFocus={() => { void SpaceModal.preload(); }}
                data-commun-discussion
            >
                <MessagesSquare className="size-3.5" aria-hidden />
                {String(t("detail.discussion.cta"))}
                {total > 0 && (
                    <span className="text-muted-foreground tabular-nums" data-commun-discussion-total>
                        <span aria-hidden>{total}</span>
                        <span className="sr-only">{String(t("detail.discussion.messages", undefined, { count: total }))}</span>
                    </span>
                )}
                {unread > 0 && (
                    <span
                        className="bg-primary text-primary-foreground min-w-5 rounded-full px-1.5 py-0.5 text-center text-[0.6875rem] leading-none font-semibold tabular-nums"
                        data-commun-discussion-unread
                    >
                        <span aria-hidden>{unread > 99 ? "99+" : unread}</span>
                        <span className="sr-only">{String(t("detail.discussion.unread", undefined, { count: unread }))}</span>
                    </span>
                )}
            </Button>

            {/* Montée seulement ouverte : fermée, ni ses requêtes ni son code ne sont chargés. */}
            {launcher.open && (
                <Suspense fallback={null}>
                    <SpaceModal
                        open
                        onOpenChange={next => { if (!next) launcher.close(); }}
                        space={space}
                        title={communTitle}
                        target={launcher.target}
                        onSelect={launcher.select}
                        scopeEntity={scopeEntity}
                    />
                </Suspense>
            )}
        </>
    );
}
