import { useEffect, useMemo, useRef, useState } from "react";
import { Upload, X } from "lucide-react";
import { toast } from "sonner";
import { ImageCropDialog } from "@/modules/news";
import { useT } from "@/hooks/useT";

interface ImageUploadFieldProps {
	/** Fichier choisi (déjà recadré) ou `null`. */
	value: File | null;
	onChange: (file: File | null) => void;
	/** Image existante affichée en aperçu tant qu'aucune nouvelle n'est choisie (édition). */
	existingUrl?: string;
	/** Ratio de recadrage imposé (défaut 1:1, comme l'avatar). */
	aspect?: number;
	shape?: "square" | "circle";
	label?: string;
	hint?: string;
}

/**
 * Champ d'upload d'image partagé (POI équipement, tiers-lieux…) : sélection →
 * recadrage via `ImageCropDialog` (même flux que `ProfileImageUpload`/l'avatar du
 * header) → renvoie le `File` recadré via `onChange`. Contrôlé : ne porte aucune
 * mutation ; le formulaire transmet le fichier au hook (`profil_avatar`).
 */
export function ImageUploadField({
	value,
	onChange,
	existingUrl,
	aspect = 1,
	shape = "square",
	label,
	hint,
}: ImageUploadFieldProps) {
	const t = useT("modules/profil");
	const inputRef = useRef<HTMLInputElement>(null);
	const [cropOpen, setCropOpen] = useState(false);
	const [cropSrc, setCropSrc] = useState<string | null>(null);
	const [pendingName, setPendingName] = useState("image");

	// Aperçu : objectURL du fichier choisi (révoqué à chaque changement / au démontage)
	// sinon image existante.
	const objectUrl = useMemo(() => (value ? URL.createObjectURL(value) : null), [value]);
	useEffect(() => {
		if (!objectUrl) return;
		return () => URL.revokeObjectURL(objectUrl);
	}, [objectUrl]);
	const preview = objectUrl ?? existingUrl ?? null;

	const openPicker = () => inputRef.current?.click();

	const handleFile = (file: File) => {
		if (!file.type.startsWith("image/")) {
			toast.error(t("ImageUploadField.imageOnly"));
			return;
		}
		setPendingName(file.name || "image");
		const reader = new FileReader();
		reader.onloadend = () => {
			setCropSrc(reader.result as string);
			setCropOpen(true);
		};
		reader.readAsDataURL(file);
	};

	const handleCrop = (blob: Blob) => {
		const file = new File([blob], pendingName, { type: blob.type || "image/png" });
		onChange(file);
		setCropOpen(false);
		setCropSrc(null);
		if (inputRef.current) inputRef.current.value = "";
	};

	const removeImage = () => {
		onChange(null);
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
				{preview ? (
					<div className="group relative cursor-pointer" onClick={openPicker}>
						<div className={`h-40 w-40 overflow-hidden border-2 border-border bg-muted shadow-sm ${rounded}`}>
							<img src={preview} alt={label ?? ""} className="h-full w-full object-cover" />
						</div>
						{value && (
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
					onCrop={(blob) => handleCrop(blob)}
				/>
			)}
		</div>
	);
}

export default ImageUploadField;
