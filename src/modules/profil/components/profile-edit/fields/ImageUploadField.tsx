import { useEffect, useMemo, useRef, useState } from "react";
import { Crop, Loader2, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { ImageCropDialog } from "@/modules/news";
import { Button } from "@/components/ui/button";
import { useT } from "@/hooks/useT";
import { lightenImage } from "@/utils/imageUtils";

interface ImageUploadFieldProps {
	/** Fichier choisi (recadré, ou entier sous `allowOriginal`) ou `null`. */
	value: File | null;
	onChange: (file: File | null) => void;
	/** Image existante affichée en aperçu tant qu'aucune nouvelle n'est choisie (édition). */
	existingUrl?: string;
	/** Image existante marquée pour suppression (édition) → masque l'aperçu existant. */
	existingDeleted?: boolean;
	/** Demande de suppression de l'image EXISTANTE (✕ sans nouveau fichier). */
	onRemoveExisting?: () => void;
	/** Ratio de recadrage imposé (défaut 1:1, comme l'avatar). */
	aspect?: number;
	/**
	 * Opt-in : l'image déposée est gardée ENTIÈRE (allégée si elle est lourde), et un bouton « Recadrer »
	 * permet ensuite de la cadrer — toujours depuis l'original. Absent (défaut), le recadrage reste
	 * obligatoire au dépôt : le comportement historique des sites.
	 */
	allowOriginal?: boolean;
	shape?: "square" | "circle";
	label?: string;
	hint?: string;
}

/**
 * Champ d'upload d'image partagé (POI équipement, tiers-lieux…) : sélection →
 * recadrage via `ImageCropDialog` (même flux que `ProfileImageUpload`/l'avatar du
 * header) → renvoie le `File` recadré via `onChange` ; sous `allowOriginal`, l'image
 * part entière et le recadrage devient facultatif. Contrôlé : ne porte aucune
 * mutation ; le formulaire transmet le fichier au hook (`profil_avatar`).
 */
export function ImageUploadField({
	value,
	onChange,
	existingUrl,
	existingDeleted = false,
	onRemoveExisting,
	aspect = 1,
	shape = "square",
	allowOriginal = false,
	label,
	hint,
}: ImageUploadFieldProps) {
	const t = useT("modules/profil");
	const inputRef = useRef<HTMLInputElement>(null);
	const [cropOpen, setCropOpen] = useState(false);
	const [cropSrc, setCropSrc] = useState<string | null>(null);
	const [pendingName, setPendingName] = useState("image");
	// `allowOriginal` : fichier déposé, gardé intact pour que chaque recadrage reparte de lui — recadrer une
	// version déjà recadrée la réduirait et la recompresserait à chaque passe.
	const [originalFile, setOriginalFile] = useState<File | null>(null);
	const [preparing, setPreparing] = useState(false);

	// Aperçu : objectURL du fichier choisi (révoqué à chaque changement / au démontage)
	// sinon image existante.
	const objectUrl = useMemo(() => (value ? URL.createObjectURL(value) : null), [value]);
	useEffect(() => {
		if (!objectUrl) return;
		return () => URL.revokeObjectURL(objectUrl);
	}, [objectUrl]);
	// Aperçu : nouveau fichier > image existante (sauf si marquée supprimée).
	const preview = objectUrl ?? (existingDeleted ? null : existingUrl) ?? null;
	// ✕ visible si : un nouveau fichier, OU une image existante non supprimée MAIS uniquement si
	// l'appelant a câblé la suppression de l'existante (`onRemoveExisting`) — sinon pas de ✕ mort.
	const canRemove = Boolean(value) || Boolean(existingUrl && !existingDeleted && onRemoveExisting);

	const openPicker = () => inputRef.current?.click();

	const openCrop = (file: File) => {
		setPendingName(file.name || "image");
		const reader = new FileReader();
		reader.onloadend = () => {
			setCropSrc(reader.result as string);
			setCropOpen(true);
		};
		reader.readAsDataURL(file);
	};

	const closeCrop = () => {
		setCropOpen(false);
		setCropSrc(null);
		if (inputRef.current) inputRef.current.value = "";
	};

	/** Transmet l'image au formulaire ; sous `allowOriginal`, allégée d'abord (cf. `lightenImage`). */
	const commit = (file: File) => {
		if (!allowOriginal) {
			onChange(file);
			return;
		}
		setPreparing(true);
		void lightenImage(file).then((light) => {
			onChange(light);
			setPreparing(false);
		});
	};

	const handleFile = (file: File) => {
		if (!file.type.startsWith("image/")) {
			toast.error(t("ImageUploadField.imageOnly"));
			return;
		}
		if (allowOriginal) {
			setOriginalFile(file);
			commit(file);
			return;
		}
		openCrop(file);
	};

	const handleCrop = (blob: Blob) => {
		const file = new File([blob], pendingName, { type: blob.type || "image/png" });
		commit(file);
		closeCrop();
	};

	/** Retour à l'image entière, sans la redéposer. */
	const handleUseOriginal = () => {
		if (originalFile) commit(originalFile);
		closeCrop();
	};

	// Recadrer une image déjà enregistrée n'est pas proposé : chargée d'un autre domaine, elle rendrait le
	// canvas inexportable. Il faut la redéposer.
	const cropSource = allowOriginal ? (originalFile ?? value) : null;

	const removeImage = () => {
		setOriginalFile(null);
		if (value) {
			onChange(null); // retire le nouveau fichier choisi (revient à l'existante)
		} else if (existingUrl && !existingDeleted) {
			onRemoveExisting?.(); // marque l'image EXISTANTE pour suppression
		}
		if (inputRef.current) inputRef.current.value = "";
	};

	const rounded = shape === "circle" ? "rounded-full" : "rounded-xl";

	return (
		<div className="space-y-3">
			{(label || hint) && (
				<div>
					{label && <div className="text-sm font-medium">{label}</div>}
					{hint && <p className="text-xs text-muted-foreground">{hint}</p>}
				</div>
			)}
			<div className="flex justify-center">
				{preparing ? (
					<div className={`flex h-40 w-40 flex-col items-center justify-center gap-2 border-2 border-border bg-muted/30 text-center ${rounded}`}>
						<Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
						<p className="px-2 text-xs text-muted-foreground">{t("ImageUploadField.preparing")}</p>
					</div>
				) : preview ? (
					<div className="group relative cursor-pointer" onClick={openPicker}>
						<div className={`h-40 w-40 overflow-hidden border-2 border-border bg-muted shadow-sm ${rounded}`}>
							{/* Image gardée entière : l'aperçu la montre entière, sinon il ferait croire à un rognage. */}
							<img src={preview} alt={label ?? ""} className={`h-full w-full ${allowOriginal ? "object-contain" : "object-cover"}`} />
						</div>
						{canRemove && (
							<button
								type="button"
								onClick={(event) => {
									event.stopPropagation();
									removeImage();
								}}
								className="absolute -top-2 -right-2 rounded-full bg-destructive p-1.5 text-destructive-foreground shadow-lg transition hover:scale-110"
								aria-label={t("ImageUploadField.remove")}
							>
								<X className="h-4 w-4" />
							</button>
						)}
					</div>
				) : (
					<div
						className={`flex h-40 w-40 cursor-pointer flex-col items-center justify-center border-2 border-dashed border-border bg-muted/30 text-center transition hover:border-primary/50 hover:bg-muted/50 ${rounded}`}
						onClick={openPicker}
						onDragOver={(event) => event.preventDefault()}
						onDrop={(event) => {
							event.preventDefault();
							const file = event.dataTransfer.files?.[0];
							if (file) handleFile(file);
						}}
					>
						<Upload className="mb-2 h-8 w-8 text-muted-foreground" />
						<p className="px-2 text-xs text-muted-foreground">{t("ImageUploadField.dropHint")}</p>
					</div>
				)}
			</div>
			{cropSource && !preparing && (
				<div className="flex justify-center">
					<Button type="button" variant="outline" size="sm" onClick={() => openCrop(cropSource)}>
						<Crop />
						{t("ImageUploadField.crop")}
					</Button>
				</div>
			)}
			<input
				ref={inputRef}
				type="file"
				accept="image/*"
				className="hidden"
				onChange={(event) => {
					const file = event.target.files?.[0];
					if (file) handleFile(file);
					event.target.value = "";
				}}
			/>
			{cropSrc && (
				<ImageCropDialog
					open={cropOpen}
					onOpenChange={setCropOpen}
					imageUrl={cropSrc}
					aspect={aspect}
					// Sans original en main (champ remonté entre-temps), il n'y a pas d'image entière à reprendre.
					onUseOriginal={allowOriginal && originalFile ? handleUseOriginal : undefined}
					onCrop={(blob) => handleCrop(blob)}
				/>
			)}
		</div>
	);
}

export default ImageUploadField;
