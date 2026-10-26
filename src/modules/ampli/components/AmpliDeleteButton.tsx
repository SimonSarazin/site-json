import { useState } from "react";
import { Trash2 } from "lucide-react";

import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useT } from "@/hooks/useT";
import { useRemoveAmpli } from "../hooks/useAmpliAdmin";
import { ampliTitle } from "../lib/costumAmpli";
import type { AmpliModel } from "../types";

/**
 * Suppression d'un ampli depuis sa carte — réservée aux admins du costum
 * (`useCanManageAmplis`), le serveur revérifiant le droit de son côté.
 *
 * Confirmation obligatoire : l'action est irréversible et emporte les pages Co
 * de l'ampli. Ce que le legacy NE supprime PAS — le formulaire de dépôt et les
 * propositions déjà déposées — est dit dans le dialogue, pas caché.
 *
 * `relative z-10` : la carte de l'annuaire est cliquable en entier via un lien
 * étiré (`after:inset-0`) qui passerait sinon PAR-DESSUS ce bouton.
 */
export function AmpliDeleteButton({ ampli }: { ampli: AmpliModel }) {
    const t = useT("modules/ampli");
    const remove = useRemoveAmpli();
    const [open, setOpen] = useState(false);
    const name = ampliTitle(ampli);

    return (
        <>
            <Button
                type="button"
                variant="ghost"
                size="icon"
                className="relative z-10 shrink-0 text-muted-foreground hover:text-destructive"
                aria-label={String(t("AmpliList.delete.label", undefined, { name }))}
                onClick={() => setOpen(true)}
            >
                <Trash2 className="h-4 w-4" />
            </Button>

            <AlertDialog open={open} onOpenChange={setOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            {String(t("AmpliList.delete.title", undefined, { name }))}
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            {String(t("AmpliList.delete.description"))}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>{String(t("AmpliList.delete.cancel"))}</AlertDialogCancel>
                        <AlertDialogAction
                            disabled={remove.isPending}
                            // `onSelect` fermerait la modale AVANT la réponse du serveur :
                            // on garde la main pour ne fermer qu'au succès.
                            onClick={(event) => {
                                event.preventDefault();
                                remove.mutate(ampli, { onSuccess: () => setOpen(false) });
                            }}
                        >
                            {remove.isPending && <Spinner />}
                            {String(t("AmpliList.delete.confirm"))}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}

export default AmpliDeleteButton;
