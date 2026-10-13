import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { lazy } from "vite-preload";
import { MessagesSquare } from "lucide-react";
import type { EntityTypes } from "@communecter/cocolight-api-client";
import { Button } from "@/components/ui/button";
import { useLoadNamespace } from "@/hooks/useLoadNamespace";
import { useT } from "@/hooks/useT";
import { cn } from "@/lib/utils";
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

/** Préchauffe le code de la modale. Un échec n'est rien ici : l'import sera retenté à l'ouverture. */
function prechauffer() {
    void SpaceModal.preload().catch(() => undefined);
}

/**
 * Tenu à l'écran par `Suspense` tant que le code de la modale n'est pas arrivé. Il ne montre rien :
 * il dit au bouton qu'on l'attend.
 */
function ModaleAttendue({ onChange }: { onChange: (attendue: boolean) => void }) {
    useEffect(() => {
        onChange(true);
        return () => onChange(false);
    }, [onChange]);
    return null;
}

export interface CommunDiscussionControlProps {
    /** Le commun : c'est lui qui porte l'espace de discussion. */
    answerId: string;
    /** Son titre, tel que la fiche l'a résolu — repris en tête de la modale. */
    communTitle?: string | null;
    /** L'entité où chercher d'abord les personnes à mentionner — la fiche passe celle du site. */
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
    // Un compteur, pas une veille. La modale partage cette entrée de cache : ouverte, c'est elle qui
    // la relit — tout de suite si elle a plus de trente secondes, puis à intervalle.
    const { total, unread } = useDiscussionSpaceQuery(space);
    // Ouverte par l'adresse ou par un clic, la modale peut se faire attendre (son code se télécharge) :
    // le bouton le dit, plutôt que de rester muet.
    const [modaleAttendue, setModaleAttendue] = useState(false);

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
                className={cn("gap-2", modaleAttendue && "cursor-progress")}
                // Ce que le bouton ouvre est un dialogue : le lecteur d'écran l'annonce avant le clic.
                aria-haspopup="dialog"
                aria-busy={modaleAttendue || undefined}
                onClick={() => launcher.openAt()}
                // Le code de la modale est préchauffé dès qu'on vise le bouton : au clic elle
                // s'ouvre sans attendre son téléchargement (même geste que l'agenda).
                onMouseEnter={prechauffer}
                onFocus={prechauffer}
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

            {/* Montée seulement ouverte : fermée, elle ne rend rien et ne demande rien. Son code, lui,
                arrive à la première ouverture — ou avant, préchauffé au survol et au focus. */}
            {launcher.open && (
                <Suspense fallback={<ModaleAttendue onChange={setModaleAttendue} />}>
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
