/**
 * Les squelettes de la fiche d'un commun, un par forme de bloc : ils distinguent « pas encore de
 * donnée » de « pas de donnée », et occupent la place du bloc pour que l'arrivée du contenu ne
 * fasse pas sauter la page.
 *
 * Markup STABLE — aucune valeur aléatoire ni date : ces blocs sont rendus au premier rendu client
 * d'une page servie en SSR, où toute divergence coûte un avertissement d'hydratation.
 */
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/**
 * Corps générique d'une `<Section>` en attente. Le titre et l'ancre restent rendus par
 * l'appelant, ce qui garde le sommaire et l'`IntersectionObserver` stables.
 */
export function SectionBodySkeleton({ rows = 3 }: { rows?: number }) {
    return (
        <div className="space-y-3" aria-busy="true">
            {Array.from({ length: rows }, (_, index) => (
                <Skeleton key={index} className="h-20 rounded-lg" />
            ))}
        </div>
    );
}

/** Cartes de palier repliées (cf. `FinancingMilestoneCard`). */
export function MilestoneCardsSkeleton({ count = 2 }: { count?: number }) {
    return (
        <div className="grid gap-4" aria-busy="true">
            {Array.from({ length: count }, (_, index) => (
                <div
                    key={index}
                    className="bg-surface border border-border rounded-lg p-5 sm:p-6 flex items-center gap-4 sm:gap-8"
                >
                    <div className="min-w-0 flex-1 space-y-2">
                        <Skeleton className="h-2.5 w-20" />
                        <Skeleton className="h-4 w-2/3" />
                    </div>
                    <div className="hidden sm:block w-64 shrink-0 ml-auto space-y-2">
                        <Skeleton className="h-3 w-full" />
                        <Skeleton className="h-1.5 w-full" />
                        <Skeleton className="h-2.5 w-24 ml-auto" />
                    </div>
                    <Skeleton className="size-5 shrink-0 rounded-full" />
                </div>
            ))}
        </div>
    );
}

/** Lignes d'une liste sobre (libellé à gauche, montant à droite) : rendu `list` des dépenses et des cofinanceurs. */
export function ListRowsSkeleton({ count = 3 }: { count?: number }) {
    return (
        <ul className="divide-y divide-border" aria-busy="true">
            {Array.from({ length: count }, (_, index) => (
                <li key={index} className="flex items-center justify-between gap-3 py-2.5">
                    <Skeleton className="h-4 w-2/5" />
                    <Skeleton className="h-4 w-16" />
                </li>
            ))}
        </ul>
    );
}

/**
 * Lignes du tableau des cofinanceurs. L'en-tête est conservé par l'appelant :
 * seules les lignes sont en attente.
 */
export function CofinancersRowsSkeleton({ count = 3 }: { count?: number }) {
    return (
        <>
            {Array.from({ length: count }, (_, index) => (
                <tr key={index} aria-busy="true">
                    <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                            <Skeleton className="size-8 shrink-0 rounded-md" />
                            <Skeleton className="h-4 w-32" />
                        </div>
                    </td>
                    <td className="py-3.5 px-4 hidden sm:table-cell">
                        <Skeleton className="h-4 w-20" />
                    </td>
                    <td className="py-3.5 px-4">
                        <Skeleton className="h-4 w-16 ml-auto" />
                    </td>
                </tr>
            ))}
        </>
    );
}

/**
 * Entrées du sommaire. Sans elles, la liste s'allongeait après coup : les entrées
 * « Objectifs » et « Membres du projet » dépendent de la phase du commun, résolue par
 * l'enveloppe de financement.
 */
export function TocEntriesSkeleton({ count = 3 }: { count?: number }) {
    return (
        <div aria-busy="true">
            {Array.from({ length: count }, (_, index) => (
                <div key={index} className="flex items-center gap-2.5 px-3 py-2 border-l-2 border-transparent">
                    <Skeleton className="size-3.5 shrink-0 rounded-sm" />
                    <Skeleton className="h-4 w-28" />
                </div>
            ))}
        </div>
    );
}

/**
 * La phase du commun en attente, aux dimensions d'une pastille de statut.
 *
 * Tant que l'enveloppe n'a pas répondu, on ignore s'il existe un projet : ni « Phase
 * proposition », ni « Ouvrir le projet », ni « Générer » / « Associer » dans « ⋯ ». Proposer une
 * action fausse puis la remplacer est pire qu'attendre : l'utilisateur pouvait cliquer dessus, et
 * générer un second projet, irréversible, sur un commun qui en a déjà un.
 */
export function StatusPillSkeleton({ className }: { className?: string }) {
    return <Skeleton className={cn("h-6 w-28 rounded-full", className)} aria-busy="true" />;
}
