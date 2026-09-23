import { useState, type FormEvent } from "react";
import { ampliSlug, isUnusableAmpliName } from "@communecter/cocolight-api-client";

import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { useT } from "@/hooks/useT";
import { useCreateAmpli } from "../hooks/useAmpliAdmin";
import type { AmpliModel } from "../types";

interface AmpliCreateDialogProps {
    /** Les amplis déjà déclarés — sert UNIQUEMENT à détecter la collision de slug. */
    amplis: AmpliModel[];
    open: boolean;
    onOpenChange: (open: boolean) => void;
    /** Appelé avec le slug renvoyé par le serveur, une fois l'ampli créé. */
    onCreated: (slug: string) => void;
}

/** Une saisie libre → la liste de mots-clés attendue par le serveur. */
function parseTags(input: string): string[] {
    return input
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean);
}

/**
 * Création d'un ampli depuis l'annuaire — réservée aux admins du costum
 * (`useCanManageAmplis`), le serveur revérifiant le droit de son côté.
 *
 * Trois champs seulement : le formulaire de dépôt et ses cinq questions sont
 * créés PAR LE SERVEUR (mode A de `createAmpli`), donc rien à câbler ici.
 *
 * L'identifiant est calculé à la saisie par le miroir exact du calcul serveur
 * (`ampliSlug`, SDK) : il est montré, et une collision BLOQUE l'envoi — le
 * legacy, lui, écraserait l'ampli existant sans prévenir.
 */
export function AmpliCreateDialog({ amplis, open, onOpenChange, onCreated }: AmpliCreateDialogProps) {
    const t = useT("modules/ampli");
    const create = useCreateAmpli();

    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [tags, setTags] = useState("");

    const trimmed = name.trim();
    const slug = ampliSlug(name);
    const unusable = trimmed !== "" && isUnusableAmpliName(name);
    const duplicate = trimmed !== "" && !unusable && amplis.some((ampli) => ampli.slug === slug);
    const error = unusable
        ? String(t("AmpliList.create.invalidName"))
        : duplicate
            ? String(t("AmpliList.create.duplicate", undefined, { slug }))
            : null;

    const handleOpenChange = (next: boolean) => {
        if (!next) {
            setName("");
            setDescription("");
            setTags("");
        }
        onOpenChange(next);
    };

    const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (trimmed === "" || error !== null || create.isPending) return;

        create.mutate(
            { name: trimmed, description: description.trim(), tags: parseTags(tags) },
            { onSuccess: (result) => { handleOpenChange(false); onCreated(result.slug); } },
        );
    };

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>{String(t("AmpliList.create.title"))}</DialogTitle>
                    <DialogDescription>{String(t("AmpliList.create.description"))}</DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4" noValidate>
                    <div className="space-y-2">
                        <Label htmlFor="ampli-create-name">{String(t("AmpliList.create.nameLabel"))}</Label>
                        <Input
                            id="ampli-create-name"
                            value={name}
                            onChange={(event) => setName(event.target.value)}
                            placeholder={String(t("AmpliList.create.namePlaceholder"))}
                            autoComplete="off"
                            aria-invalid={error !== null}
                            aria-describedby={error !== null ? "ampli-create-error" : "ampli-create-slug"}
                        />
                        {error !== null ? (
                            <p id="ampli-create-error" role="alert" className="text-sm text-destructive">
                                {error}
                            </p>
                        ) : (
                            <p id="ampli-create-slug" className="text-sm text-muted-foreground">
                                {trimmed === ""
                                    ? String(t("AmpliList.create.nameHint"))
                                    : String(t("AmpliList.create.slugHint", undefined, { slug }))}
                            </p>
                        )}
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="ampli-create-description">
                            {String(t("AmpliList.create.descriptionLabel"))}
                        </Label>
                        <Textarea
                            id="ampli-create-description"
                            value={description}
                            onChange={(event) => setDescription(event.target.value)}
                            placeholder={String(t("AmpliList.create.descriptionPlaceholder"))}
                            rows={3}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="ampli-create-tags">{String(t("AmpliList.create.tagsLabel"))}</Label>
                        <Input
                            id="ampli-create-tags"
                            value={tags}
                            onChange={(event) => setTags(event.target.value)}
                            placeholder={String(t("AmpliList.create.tagsPlaceholder"))}
                            autoComplete="off"
                            aria-describedby="ampli-create-tags-hint"
                        />
                        <p id="ampli-create-tags-hint" className="text-sm text-muted-foreground">
                            {String(t("AmpliList.create.tagsHint"))}
                        </p>
                    </div>

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
                            {String(t("AmpliList.create.cancel"))}
                        </Button>
                        <Button type="submit" disabled={trimmed === "" || error !== null || create.isPending}>
                            {create.isPending && <Spinner />}
                            {String(t("AmpliList.create.submit"))}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

export default AmpliCreateDialog;
