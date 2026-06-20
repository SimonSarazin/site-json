import { useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { EntityTypes, Poi } from "@communecter/cocolight-api-client";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useCocolight } from "@/hooks/useCocolight";
import { SEARCH_QUERY_KEYS } from "@/modules/search/constants/queryKeys";
import { useAddPoi, useUpdatePoi } from "../../hooks/useAddMutations";
import { createEmptyDefaults, buildEditDefaults, resolvePoiEquipementScope } from "./poiEquipement";
import { PoiEquipementForm, type PoiEquipementSubmitPayload, type PoiEquipementEditPayload } from "./PoiEquipementForm";

interface AddPoiEquipementModalProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	mode?: "add" | "edit";
	poi?: EntityTypes | null;
	parent?: EntityTypes | null;
}

/**
 * Wrapper Dialog mince (add + edit) autour de `PoiEquipementForm` — à l'image
 * d'`AddTiersLieuxModal`/`EditTiersLieuxModal` autour de `TiersLieuxForm`. Porte
 * la résolution du scope, les valeurs initiales (createEmptyDefaults vs
 * buildEditDefaults) et les mutations (`useAddPoi`/`useUpdatePoi`) ; le wizard et
 * les champs vivent dans le form. Le mode `edit` inline est légitime : l'édition
 * est déclenchée depuis `PoiDetailSSBE` (search) ou le bouton « Modifier » du
 * profil (via `editModalRegistry` → `"edit-poi-equipement"`).
 */
export function AddPoiEquipementModal({
	open,
	onOpenChange,
	mode = "add",
	poi,
	parent,
}: AddPoiEquipementModalProps) {
	const { entity } = useCocolight();
	const queryClient = useQueryClient();
	const isEditMode = mode === "edit" && Boolean(poi);

	// Scope (parent/source/type) dérivé de l'entité du costum — pas d'une config.
	// `scope.sourceKey` = slug de l'entité porteuse = slug du costum (= clé registry lib).
	const scope = useMemo(() => resolvePoiEquipementScope(entity), [entity]);
	// On reste sur la liste après ajout (pas de redirection vers /profil/{slug}).
	// `costumSlug` → la lib (me.costum(slug).poi) injecte le contexte costum et le backend pose `source` :
	// plus besoin de bricoler `source` manuellement côté site-json.
	const addMutation = useAddPoi(parent, undefined, {
		navigateOnSuccess: false,
		costumSlug: scope.sourceKey,
	});
	const updateMutation = useUpdatePoi(poi ?? null);

	const defaultValues = useMemo(
		() => (isEditMode ? buildEditDefaults(poi as Poi | null) : createEmptyDefaults(scope)),
		[isEditMode, poi, scope]
	);

	// Aperçu de l'image de profil existante en édition (lu sur `serverData` typé).
	const existingImageUrl = useMemo(() => {
		if (!isEditMode) return undefined;
		const sd = (poi as Poi).serverData;
		return (
			sd.profilMediumImageUrl ||
			sd.profilImageUrl ||
			sd.profilThumbImageUrl ||
			undefined
		);
	}, [isEditMode, poi]);

	const handleSubmit = async (data: PoiEquipementEditPayload) => {
		try {
			if (isEditMode) {
				// `data` = patch partiel (champs modifiés) — cf. PoiEquipementForm.buildEditPatch.
				await updateMutation.mutateAsync(data);
			} else {
				// En ajout, le form envoie un payload complet (cast sûr).
				await addMutation.mutateAsync(data as PoiEquipementSubmitPayload);
			}
			// Les mutations n'invalident que les clés profil. On rafraîchit ici la
			// recherche : la liste `searchProStatic` (préfixe `searchCostumStatic`,
			// cf. SearchProStatic.tsx) + la détection de doublons du form
			// (`poi-equipement-matches`, cf. usePoiEquipementMatches.ts).
			await Promise.all([
				queryClient.invalidateQueries({ queryKey: SEARCH_QUERY_KEYS.RESULTS_PREFIX("searchCostumStatic") }),
				queryClient.invalidateQueries({ queryKey: SEARCH_QUERY_KEYS.RESULTS_PREFIX("poi-equipement-matches") }),
			]);
			onOpenChange(false);
		} catch {
			// Le toast d'erreur est déjà émis par useMutationWithToast
		}
	};

	const isSaving = isEditMode ? updateMutation.isPending : addMutation.isPending;

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-[840px] max-h-[90vh] flex flex-col">
				<PoiEquipementForm
					mode={isEditMode ? "edit" : "add"}
					defaultValues={defaultValues}
					scope={scope}
					parent={parent}
					existingImageUrl={existingImageUrl}
					onSubmit={handleSubmit}
					isSubmitting={isSaving}
				/>
			</DialogContent>
		</Dialog>
	);
}

export default AddPoiEquipementModal;
