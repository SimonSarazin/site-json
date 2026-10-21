import { useId, useRef, useState, type KeyboardEvent } from "react";
import { Image as ImageIcon } from "lucide-react";
import { useT } from "@/hooks/useT";
import { getBaseUrl } from "@/lib/constant/common";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ACCEPTED_IMAGE_TYPES, MAX_IMAGE_BYTES, isAcceptedImage } from "../lib/commentImages";
import { classifyImageSource } from "../lib/inlineImages";
import type { InlineImage } from "./editor/editorTypes";

export interface ComposerInlineImageProps {
  readonly disabled?: boolean;
  /** Téléverse le fichier et rend l'adresse à écrire. Absent (visiteur…) : seule l'adresse se propose. */
  readonly onUpload?: (file: File) => Promise<string>;
  readonly onInsert: (image: InlineImage) => void;
  /** Refermée, la fenêtre rend la main au texte — pas au bouton : on reprend la phrase. */
  readonly onClosed: () => void;
}

type Source = "import" | "address";

type Envoi =
  | { readonly etat: "repos" }
  | { readonly etat: "envoi"; readonly nom: string }
  | { readonly etat: "pret"; readonly src: string; readonly nom: string }
  | { readonly etat: "refus"; readonly motif: "type" | "size" | "server" };

const REPOS: Envoi = { etat: "repos" };

/** Une adresse tapée : complète, en `http(s)` — l'onglet n'accepte pas un chemin qu'on devine. */
function adresseTapee(valeur: string): string | null {
  const adresse = valeur.trim();
  return /^https?:\/\//i.test(adresse) && classifyImageSource(adresse, getBaseUrl()).kind !== "refused" ? adresse : null;
}

/**
 * Le bouton « Image » de la barre d'outils : une image DANS le texte, en plus des images jointes
 * (décision de l'user du 14/10/2026). Deux onglets, comme le legacy (`markdown-editor.js`,
 * `wrapImage`) : importer un fichier, ou donner l'adresse d'une image en ligne — que les lecteurs
 * n'afficheront qu'au clic, puisqu'elle vient d'un autre site (`CommentMarkdown`). Une description,
 * exigée comme dans le legacy, la dit à qui ne la voit pas ; un fichier importé la propose d'office
 * (son nom, sans extension).
 *
 * Un champ, pas un dialogue de plus — comme le lien. Pas de `<form>` : son envoi remonterait à un
 * formulaire hôte ; Entrée insère.
 */
export function ComposerInlineImage({ disabled, onUpload, onInsert, onClosed }: ComposerInlineImageProps) {
  const t = useT("modules/comment");
  const [open, setOpen] = useState(false);
  const [source, setSource] = useState<Source>(onUpload ? "import" : "address");
  const [envoi, setEnvoi] = useState<Envoi>(REPOS);
  const [adresse, setAdresse] = useState("");
  const [description, setDescription] = useState("");
  const fichier = useRef<HTMLInputElement>(null);
  // Le dernier envoi lancé : la réponse d'un envoi dépassé (autre fichier choisi, fenêtre refermée) est ignorée.
  const essai = useRef(0);
  const ids = { description: useId(), adresse: useId(), statut: useId(), aide: useId() };

  const tapee = adresseTapee(adresse);
  const src = source === "import" ? (envoi.etat === "pret" ? envoi.src : null) : tapee;
  const pret = src !== null && description.trim() !== "";
  const tierce = source === "address" && tapee !== null && classifyImageSource(tapee, getBaseUrl()).kind === "remote";

  const basculer = (ouvrir: boolean) => {
    setOpen(ouvrir);
    if (ouvrir) return;
    essai.current += 1;
    setSource(onUpload ? "import" : "address");
    setEnvoi(REPOS);
    setAdresse("");
    setDescription("");
  };

  const choisir = async (file: File | undefined) => {
    if (!file || !onUpload) return;
    const numero = ++essai.current;
    if (!isAcceptedImage(file)) return setEnvoi({ etat: "refus", motif: "type" });
    if (file.size > MAX_IMAGE_BYTES) return setEnvoi({ etat: "refus", motif: "size" });
    setEnvoi({ etat: "envoi", nom: file.name });
    setDescription(courante => courante.trim() !== "" ? courante : file.name.replace(/\.[^./]+$/, ""));
    try {
      const adresseRendue = await onUpload(file);
      if (numero === essai.current) setEnvoi({ etat: "pret", src: adresseRendue, nom: file.name });
    } catch {
      if (numero === essai.current) setEnvoi({ etat: "refus", motif: "server" });
    }
  };

  const inserer = () => {
    if (!pret || src === null) return;
    onInsert({ src, alt: description.trim() });
    basculer(false);
  };

  const entree = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    inserer();
  };

  const statut = envoi.etat === "envoi" ? t("composer.inlineImage.uploading", undefined, { name: envoi.nom })
    : envoi.etat === "pret" ? t("composer.inlineImage.ready", undefined, { name: envoi.nom })
    : envoi.etat === "refus" ? (envoi.motif === "server" ? t("composer.inlineImage.failed") : t(`images.rejected.${envoi.motif}`))
    : t("composer.inlineImage.formats");

  const champAdresse = (
    <div className="space-y-1.5">
      <Label htmlFor={ids.adresse}>{t("composer.inlineImage.url")}</Label>
      <Input
        id={ids.adresse}
        type="url"
        inputMode="url"
        autoComplete="off"
        placeholder="https://"
        value={adresse}
        className="h-8"
        aria-describedby={adresse.trim() !== "" ? ids.aide : undefined}
        aria-invalid={adresse.trim() !== "" && tapee === null}
        onChange={event => setAdresse(event.target.value)}
        onKeyDown={entree}
      />
      {adresse.trim() !== "" && tapee === null ? (
        <p id={ids.aide} className="text-xs text-destructive">{t("composer.inlineImage.refused")}</p>
      ) : tierce ? (
        <p id={ids.aide} className="text-xs text-muted-foreground">{t("composer.inlineImage.remoteHint")}</p>
      ) : null}
    </div>
  );

  return (
    <Popover open={open} onOpenChange={basculer}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          disabled={disabled}
          className="size-7 rounded-full text-muted-foreground"
          aria-label={String(t("composer.inlineImage.label"))}
          title={String(t("composer.inlineImage.label"))}
          // Le clic ne vole pas le focus au champ : l'image se pose là où l'on écrivait.
          onMouseDown={event => event.preventDefault()}
        >
          <ImageIcon className="size-3.5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        data-inline-image=""
        className="w-80 space-y-3 p-3"
        align="start"
        onCloseAutoFocus={event => { event.preventDefault(); onClosed(); }}
      >
        {onUpload ? (
          <Tabs value={source} onValueChange={valeur => setSource(valeur === "address" ? "address" : "import")}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="import">{t("composer.inlineImage.import")}</TabsTrigger>
              <TabsTrigger value="address">{t("composer.inlineImage.address")}</TabsTrigger>
            </TabsList>
            <TabsContent value="import" className="space-y-1.5 pt-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={envoi.etat === "envoi"}
                aria-describedby={ids.statut}
                onClick={() => fichier.current?.click()}
              >
                {t("composer.inlineImage.choose")}
              </Button>
              {/* `sr-only` et non `hidden` : un champ masqué par `display:none` n'est pas activable au clavier partout. */}
              <input
                ref={fichier}
                type="file"
                accept={ACCEPTED_IMAGE_TYPES.join(",")}
                className="sr-only"
                tabIndex={-1}
                aria-hidden
                onChange={event => {
                  void choisir(event.target.files?.[0]);
                  // Le même fichier, choisi de nouveau après un refus, doit redéclencher le choix.
                  event.target.value = "";
                }}
              />
              <p
                id={ids.statut}
                role="status"
                className={envoi.etat === "refus" ? "text-xs text-destructive" : "text-xs text-muted-foreground"}
              >
                {statut}
              </p>
            </TabsContent>
            <TabsContent value="address" className="pt-1">{champAdresse}</TabsContent>
          </Tabs>
        ) : champAdresse}

        <div className="space-y-1.5">
          <Label htmlFor={ids.description}>{t("composer.inlineImage.alt")}</Label>
          <Input
            id={ids.description}
            value={description}
            className="h-8"
            placeholder={String(t("composer.inlineImage.altHint"))}
            onChange={event => setDescription(event.target.value)}
            onKeyDown={entree}
          />
        </div>

        <div className="flex justify-end">
          <Button type="button" size="sm" disabled={!pret} onClick={inserer}>
            {t("composer.inlineImage.insert")}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
