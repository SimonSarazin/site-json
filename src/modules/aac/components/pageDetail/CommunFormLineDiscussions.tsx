import { useCallback, type ReactNode } from "react";
import { MilestoneLineSlotContext, type MilestoneLineSlot } from "@/modules/coform/contexts/MilestoneLineSlotContext";
import { resolveSavedDepenseKey } from "@/modules/cagnotte/utils/depenseKey";
import { CommunMilestoneDiscussionButton } from "./CommunMilestoneDiscussionButton";
import { formMilestoneOpener } from "./communDiscussion";

/** L'input du formulaire qui porte la liste des dépenses d'un commun : `answers.<étape>.depense`. */
const DEPENSE_FIELD = "depense";

export interface CommunFormLineDiscussionsProps {
    /** Le commun édité : c'est son espace de discussion qui s'ouvre. */
    answerId: string;
    /** Ses dépenses telles que le DOCUMENT les porte — pas la liste que le formulaire édite. */
    savedDepenses: unknown;
    /**
     * La fiche lit-elle ses dépenses là où l'espace de discussion les connaît (`aapStep1`) ? Sinon,
     * par la clé seule, une ligne ouvrirait le fil d'une autre : aucun bouton (comme sur la fiche).
     */
    enabled: boolean;
    /** Le formulaire d'édition. */
    children: ReactNode;
}

/**
 * Pose le bouton « Discuter » sur chaque ligne de dépense du FORMULAIRE d'édition d'un commun.
 *
 * Parité legacy : « Commenter » sur chaque carte de la liste des dépenses, dans le formulaire
 * (`newDepenseList.php`) — le même fil que le palier de la fiche (doc/38, fils d'une ligne de
 * dépense).
 *
 * Le formulaire édite sa liste avant de l'enregistrer : seule une ligne qui EXISTE au document, et
 * qu'on y retrouve à coup sûr, reçoit un bouton (`resolveSavedDepenseKey`). Une ligne qu'on vient
 * d'ajouter n'en a pas — il n'y a pas encore de ligne dont discuter ; une ligne décalée par un
 * retrait garde le sien, celui de SA clé.
 *
 * Il ne monte rien de plus : la modale est celle de la fiche (`CommunDiscussionControl`), qui
 * s'ouvre par-dessus le formulaire, sur le fil de la ligne. Le formulaire reste ouvert dessous,
 * saisie comprise.
 *
 * ⚠️ `savedDepenses` doit rester le document TEL QU'IL EST ENREGISTRÉ pendant toute la saisie. C'est
 * vrai tant que le formulaire n'enregistre qu'à sa soumission finale (`submitMode="final"`, le
 * défaut de `CoFormModal`) : la fiche relit alors la réponse. Un formulaire qui enregistrerait
 * étape par étape rendrait ces dépenses périmées dès le premier retrait enregistré — et une ligne
 * retrouvée par son identifiant porterait l'ancienne clé, donc le fil d'une autre.
 */
export function CommunFormLineDiscussions({ answerId, savedDepenses, enabled, children }: CommunFormLineDiscussionsProps) {
    const slot = useCallback<MilestoneLineSlot>(({ answerId: edited, fieldName, lines, index, name }) => {
        // Le champ des dépenses de CE commun, et de lui seul : un autre formulaire rendu sous le même
        // hôte, ou une réponse pas encore enregistrée, n'a rien à retrouver dans ces dépenses.
        if (!enabled || edited !== answerId || fieldName !== DEPENSE_FIELD) return null;
        const lineKey = resolveSavedDepenseKey(savedDepenses, lines, index);
        if (lineKey === null) return null;
        return (
            <CommunMilestoneDiscussionButton
                answerId={answerId}
                lineKey={lineKey}
                name={name}
                opener={formMilestoneOpener(lineKey)}
                compact
                className="shrink-0"
            />
        );
    }, [answerId, savedDepenses, enabled]);

    return <MilestoneLineSlotContext.Provider value={slot}>{children}</MilestoneLineSlotContext.Provider>;
}
