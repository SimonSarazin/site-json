import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { EntityTypes, SearchEntity } from "@communecter/cocolight-api-client";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { FieldPath, FieldValues, Resolver, UseFormReturn } from "react-hook-form";
import "@/modules/profil/i18n";
import { useT } from "@/hooks/useT";
import { useLoadNamespace } from "@/hooks/useLoadNamespace";
import { DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import { addPoiSchema, type AddPoiFormData } from "../../schemaForm";
import { usePoiEquipementMatches } from "../../hooks/usePoiEquipementMatches";
import { EditLocationTab } from "../profile-edit/EditLocationTab";
import {
	FormFieldName,
	FormFieldTags,
	ParentInfoReadonly,
	FormFieldText,
	FormFieldNumber,
	FormFieldSwitch,
	FormFieldSelectObject,
	FormFieldCheckboxGroup,
	FormFieldDate,
	ImageUploadField,
	FormFieldUrlList,
} from "../profile-edit/fields";
import { useCocolight } from "@/hooks/useCocolight";
import PoiDetailSSBE from "@/modules/search/components/detailsMode/PoiDetailSSBE";
import {
	STEP_ORDER,
	STEP_TITLE_KEYS,
	type StepKey,
	type PoiEquipementScope,
	PSHS_FIELDS,
	isFilled,
} from "./poiEquipement";

type EquipListField =
	| "equip_type_name"
	| "equip_type_famille"
	| "equip_prop_type"
	| "equip_nature"
	| "equip_sol"
	| "equip_loc_type"
	| "equip_utilisateur"
	| "aps_name";

/**
 * Données soumises par le formulaire : les champs du POI + le fichier image
 * recadré. Le hook pose `_imageFile` dans le draft (`profil_avatar`) ; `save()`
 * le route vers le bloc PROFIL_IMAGE (cf. `TiersLieuxSubmitPayload._logoFile`).
 */
export interface PoiEquipementSubmitPayload extends AddPoiFormData {
	_imageFile?: File | null;
}

/**
 * Payload d'ÉDITION : un patch **partiel** (seuls les champs réellement modifiés
 * sont envoyés, cf. `buildEditPatch`). La lib ne met alors à jour que ce qui change
 * — on ne re-pousse pas les dates/adresse non touchées (faux positifs du diff lib
 * dus à la normalisation) et on ne corrompt pas l'adresse (sous-champs non modélisés).
 */
export type PoiEquipementEditPayload = Partial<AddPoiFormData> & { _imageFile?: File | null };

/** Champs d'adresse traités comme un bloc atomique dans le patch d'édition. */
const ADDRESS_PATCH_KEYS = [
	"addressCountry", "addressLocality", "localityId", "postalCode", "streetAddress",
	"codeInsee", "level1", "level1Name", "level2", "level2Name",
	"level3", "level3Name", "level4", "level4Name",
] as const;

/** Égalité de valeurs de form (string/number/bool/array/objet) pour le diff d'édition. */
const isSameValue = (a: unknown, b: unknown) =>
	JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

interface PoiEquipementFormProps {
	mode: "add" | "edit";
	/** Valeurs initiales (createEmptyDefaults en add, buildEditDefaults en edit). */
	defaultValues: AddPoiFormData;
	scope: PoiEquipementScope;
	parent?: EntityTypes | null;
	/** Image de profil existante (édition) — affichée en aperçu tant qu'aucune nouvelle n'est choisie. */
	existingImageUrl?: string;
	/** Appelé après validation finale ; le wrapper modal lance la mutation + ferme.
	 *  En édition, `data` est un patch partiel (champs modifiés) ; en ajout, complet. */
	onSubmit: (data: PoiEquipementEditPayload) => Promise<void>;
	isSubmitting: boolean;
}

/**
 * Formulaire wizard (4 étapes) d'ajout/édition d'un POI équipement, présentationnel
 * (ne connaît ni mutation ni Dialog) — à l'image de `TiersLieuxForm`. Monté dans la
 * `DialogContent` d'`AddPoiEquipementModal` ; se remonte à chaque ouverture, donc
 * `useForm(defaultValues)` repart toujours frais (pas de reset manuel à l'ouverture).
 */
export function PoiEquipementForm({
	mode,
	defaultValues,
	scope,
	parent,
	existingImageUrl,
	onSubmit,
	isSubmitting,
}: PoiEquipementFormProps) {
	useLoadNamespace("modules/profil");
	const t = useT("modules/profil");
	const isEditMode = mode === "edit";
	const { entity } = useCocolight();

	// Image de profil : recadrage 1:1 façon avatar, posée dans le draft au submit
	// (`profil_avatar`) → routée vers le bloc PROFIL_IMAGE par `save()`.
	const [imageFile, setImageFile] = useState<File | null>(null);

	const [activeStep, setActiveStep] = useState<StepKey>("general");
	const [stepAttempted, setStepAttempted] = useState<Record<StepKey, boolean>>({
		general: false,
		legal: false,
		structure: false,
		usage: false,
	});
	const [detailItem, setDetailItem] = useState<SearchEntity | null>(null);
	const [detailOpen, setDetailOpen] = useState(false);

	const serverLists = entity?.serverData?.lists as
		| Partial<Record<EquipListField, unknown>>
		| undefined;

	const getListOptions = (field: EquipListField) => {
		const values = serverLists?.[field];
		if (!Array.isArray(values)) {
			return [] as string[];
		}
		return values.filter((value): value is string => typeof value === "string");
	};

	const form = useForm<AddPoiFormData>({
		resolver: zodResolver(addPoiSchema) as Resolver<AddPoiFormData>,
		defaultValues,
	});

	const equipLong = form.watch("equip_long");
	const equipLarg = form.watch("equip_larg");
	const equipSurf = form.watch("equip_surf");
	const instPartBool = form.watch("inst_part_bool");
	const equipPmrAcc = form.watch("equip_pmr_acc");
	const [
		name,
		equipTypeName,
		addressCountry,
		addressLocality,
		postalCode,
		streetAddress,
		apsName,
	] = form.watch([
		"name",
		"equip_type_name",
		"addressCountry",
		"addressLocality",
		"postalCode",
		"streetAddress",
		"aps_name",
	]);

	const {
		matches,
		isLoading: isMatchesLoading,
		isError: isMatchesError,
		isSearched: isMatchesSearched,
	} = usePoiEquipementMatches({
		postalCode: postalCode ?? "",
		equipTypeName: equipTypeName ?? "",
		streetAddress: streetAddress ?? "",
		scope,
	});

	const isGeneralStepIncomplete =
		!isFilled(name) ||
		!isFilled(equipTypeName) ||
		!isFilled(addressCountry) ||
		!isFilled(addressLocality) ||
		!isFilled(postalCode) ||
		!isFilled(streetAddress);
	const isUsageStepIncomplete = !Array.isArray(apsName) || apsName.length === 0;
	const stepHasMissingRequired = (step: StepKey) => {
		switch (step) {
			case "general":
				return stepAttempted.general && isGeneralStepIncomplete;
			case "usage":
				return stepAttempted.usage && isUsageStepIncomplete;
			default:
				return false;
		}
	};

	// Champs validés par étape : sert à (1) marquer d'un badge l'onglet fautif —
	// visible depuis n'importe quel onglet — et (2) sauter au 1er onglet en erreur
	// au submit. Sinon une erreur sur un onglet inactif (caché) reste invisible.
	// Même logique que `TiersLieuxForm`.
	const STEP_REQUIRED_FIELDS: Record<StepKey, string[]> = {
		general: ["name", "equip_type_name", "addressCountry", "addressLocality", "postalCode", "streetAddress"],
		legal: [],
		structure: [],
		usage: ["aps_name"],
	};
	const stepHasErrors = (step: StepKey) =>
		STEP_REQUIRED_FIELDS[step].some(
			(field) => !!(form.formState.errors as Record<string, unknown>)[field]
		);

	// Surface = longueur × largeur (auto-calculée, en `number`).
	useEffect(() => {
		if (typeof equipLong !== "number" || typeof equipLarg !== "number") {
			if (equipSurf !== undefined) {
				form.setValue("equip_surf", undefined, { shouldDirty: true });
			}
			return;
		}

		const computed = equipLong * equipLarg;
		if (computed !== equipSurf) {
			form.setValue("equip_surf", computed, { shouldDirty: true });
		}
	}, [equipLong, equipLarg, equipSurf, form]);

	useEffect(() => {
		if (!detailOpen) {
			setDetailItem(null);
		}
	}, [detailOpen]);

	// Le match provient de `usePoiEquipementMatches` (→ `useSearchQuery`) : c'est
	// déjà une entité `Poi` typée et complète (projetée sur POI_DETAIL_FIELDS).
	const handleOpenDetails = (poiEntry: SearchEntity) => {
		setDetailItem(poiEntry);
		setDetailOpen(true);
	};

	// En édition : ne renvoyer que les champs réellement modifiés (diff vs valeurs
	// initiales `defaultValues`, dans la **même** représentation normalisée). Les
	// champs non touchés ne sont pas réassignés → la lib les voit inchangés → pas
	// d'update (ni de drop de l'adresse).
	const buildEditPatch = (current: AddPoiFormData): PoiEquipementEditPayload => {
		const initial = defaultValues as Record<string, unknown>;
		const values = current as Record<string, unknown>;
		const patch: Record<string, unknown> = {};
		for (const key of Object.keys(values)) {
			if (!isSameValue(values[key], initial[key])) patch[key] = values[key];
		}
		// Adresse atomique : si un champ d'adresse change, renvoyer tout le bloc + geo
		// (sinon `transformFormDataWithAddress` reconstruirait une adresse partielle).
		if (ADDRESS_PATCH_KEYS.some((k) => !isSameValue(values[k], initial[k]))) {
			for (const k of ADDRESS_PATCH_KEYS) patch[k] = values[k];
			patch.geo = values.geo;
			patch.geoPosition = values.geoPosition;
		}

		return patch as PoiEquipementEditPayload;
	};

	const handleFinalSubmit = async (data: AddPoiFormData) => {
		if (activeStep !== "usage") return;

		setStepAttempted((prev) => ({ ...prev, usage: true }));
		form.clearErrors();

		const requiredAddressFields = ["addressCountry", "addressLocality", "postalCode", "streetAddress"] as const;
		for (const fieldName of requiredAddressFields) {
			if (!isFilled(data[fieldName])) {
				form.setError(fieldName, { message: "validation.required" });
				setActiveStep("general");
				toast.error(t("AddPoiEquipement.validationFailed", "Veuillez corriger les champs en erreur."));
				return;
			}
		}

		// Retire les URLs vides (entrées ajoutées mais non remplies).
		const cleaned: AddPoiFormData = {
			...data,
			urls: Array.isArray(data.urls) ? data.urls.filter((url) => url.trim().length > 0) : data.urls,
		};
		const payload = isEditMode ? buildEditPatch(cleaned) : cleaned;
		await onSubmit({ ...payload, _imageFile: imageFile });
	};

	// Échec de validation Zod : l'erreur peut être sur un onglet inactif (caché).
	// On saute au 1er onglet fautif + toast — sinon le submit échoue en silence.
	const handleInvalidSubmit = () => {
		const firstErrorStep = STEP_ORDER.find((step) => stepHasErrors(step));
		if (firstErrorStep) setActiveStep(firstErrorStep);
		toast.error(t("AddPoiEquipement.validationFailed", "Veuillez corriger les champs en erreur."));
	};

	const onFormSubmit = form.handleSubmit(handleFinalSubmit, handleInvalidSubmit);

	const handleNext = async () => {
		setStepAttempted((prev) => ({ ...prev, [activeStep]: true }));

		const isValid = await form.trigger();
		if (!isValid) return;

		if (activeStep === "general") {
			const requiredAddressFields = ["addressCountry", "addressLocality", "postalCode", "streetAddress"] as const;
			for (const fieldName of requiredAddressFields) {
				if (!isFilled(form.getValues(fieldName))) {
					form.setError(fieldName, { message: "validation.required" });
					return;
				}
			}
		}

		const currentIndex = STEP_ORDER.indexOf(activeStep);
		const nextStep = STEP_ORDER[currentIndex + 1];
		if (nextStep) {
			setStepAttempted((prev) => ({ ...prev, [activeStep]: false }));
			setActiveStep(nextStep);
		}
	};

	const handlePrevious = () => {
		const currentIndex = STEP_ORDER.indexOf(activeStep);
		const previousStep = STEP_ORDER[currentIndex - 1];
		if (previousStep) {
			setActiveStep(previousStep);
		}
	};

	const activeStepIndex = STEP_ORDER.indexOf(activeStep);
	const canSubmit = activeStep === "usage";

	return (
		<>
			<DialogHeader>
				<DialogTitle>{isEditMode ? t("AddPoiEquipement.title.edit") : t("AddPoiEquipement.title.add")}</DialogTitle>
				<DialogDescription>
					{isEditMode ? t("AddPoiEquipement.description.edit") : t("AddPoiEquipement.description.add")}
				</DialogDescription>
			</DialogHeader>

			<Form {...form}>
				<form
					onSubmit={(event) => {
						if (activeStep !== "usage") {
							event.preventDefault();
							return;
						}
						void onFormSubmit(event);
					}}
					className="flex-1 flex flex-col min-h-0"
				>
					<div className="flex items-center justify-between gap-4 rounded-lg border border-border/60 bg-background/60 px-4 py-3">
						<div>
							<div className="text-xs uppercase tracking-wide text-muted-foreground">
								{t("AddPoiEquipement.stepIndicator", undefined, {
									index: activeStepIndex + 1,
									total: STEP_ORDER.length,
								})}
							</div>
							<div className="text-sm font-medium text-foreground">{t(STEP_TITLE_KEYS[activeStep])}</div>
						</div>
						<div className="flex flex-wrap items-center justify-end gap-2">
							{STEP_ORDER.map((step, index) => (
								<Button
									key={step}
									type="button"
									variant={step === activeStep ? "default" : "outline"}
									size="sm"
									className={step === activeStep ? "relative h-8 rounded-full px-3" : "relative h-8 w-8 rounded-full p-0"}
									onClick={() => setActiveStep(step)}
									aria-label={t("AddPoiEquipement.stepAria", undefined, { index: index + 1 })}
								>
									<span className="text-xs font-semibold">{index + 1}</span>
									{step === activeStep && <span className="ml-2 text-xs font-medium">{t(STEP_TITLE_KEYS[step])}</span>}
									{(stepHasErrors(step) || stepHasMissingRequired(step)) && (
										<span
											className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-destructive"
											aria-hidden="true"
										/>
									)}
								</Button>
							))}
						</div>
					</div>

					<div className="mt-4 flex-1 overflow-y-auto pr-4 space-y-6">
						{activeStep === "general" && (
							<div className="space-y-4">
								<ParentInfoReadonly parent={parent} />
								<FormFieldName control={form.control} required showDescription />

								<div className="grid gap-4 sm:grid-cols-2">
									<FormFieldSelectObject
										control={form.control}
										name="equip_type_name"
										label={t("AddPoiEquipement.fields.equipTypeName")}
										required
										options={getListOptions("equip_type_name")}
										placeholder={t("AddPoiEquipement.placeholders.selectType")}
										placeholderSearch={t("AddPoiEquipement.placeholders.searchType")}
									/>
									<FormFieldSelectObject
										control={form.control}
										name="equip_type_famille"
										label={t("AddPoiEquipement.fields.equipTypeFamille")}
										options={getListOptions("equip_type_famille")}
										placeholder={t("AddPoiEquipement.placeholders.selectFamille")}
										placeholderSearch={t("AddPoiEquipement.placeholders.searchFamille")}
									/>
								</div>

								<ImageUploadField
									value={imageFile}
									onChange={setImageFile}
									existingUrl={existingImageUrl}
									aspect={1}
									label={t("AddPoiEquipement.fields.image")}
									hint={t("AddPoiEquipement.fields.imageHint")}
								/>

								<div className="rounded-xl border border-border/60 bg-background/40 p-4 space-y-4">
									<div className="text-sm font-medium">{t("AddPoiEquipement.fields.address")} *</div>
									<EditLocationTab form={form as unknown as UseFormReturn<FieldValues>} />
								</div>

								{(isMatchesLoading || isMatchesError || matches.length > 0 || isMatchesSearched) && (
									<div className="rounded-lg border border-border/60 bg-muted/30 p-3 space-y-2">
										<div className="text-sm font-medium">
											<span className="font-bold text-primary">{matches.length}</span> {t("AddPoiEquipement.matches.title")}
										</div>
										{isMatchesLoading && (
											<div className="flex items-center gap-2 text-xs text-muted-foreground">
												<Loader2 className="h-4 w-4 animate-spin" />
												{t("AddPoiEquipement.matches.loading")}
											</div>
										)}
										{isMatchesError && (
											<div className="text-xs text-destructive">{t("AddPoiEquipement.matches.error")}</div>
										)}
										{!isMatchesLoading && !isMatchesError && matches.length === 0 && isMatchesSearched && (
											<div className="text-xs text-muted-foreground">{t("AddPoiEquipement.matches.empty")}</div>
										)}
										{matches.length > 0 && (
											<div className="space-y-2">
												{matches.map((match, index) => {
													const serverData = match.serverData;
													const address = serverData.address;
													const addressLine = [
														address?.streetAddress,
														address?.postalCode,
														address?.addressLocality,
													]
														.map((value) => (typeof value === "string" ? value.trim() : ""))
														.filter((value) => value.length > 0)
														.join(", ");
													const displayName =
														serverData.name && serverData.name.trim().length > 0
															? serverData.name
															: t("AddPoiEquipement.matches.noName");
													const idValue = serverData.id || `${displayName}-${index}`;
													return (
														<button
															key={idValue}
															type="button"
															className="w-full rounded-md border border-border/60 bg-background/60 p-3 text-left transition hover:bg-background"
															onClick={() => {
																void handleOpenDetails(match);
															}}
														>
															<div className="text-sm font-semibold text-foreground">{displayName}</div>
															<div className="text-xs text-muted-foreground">
																{addressLine || t("AddPoiEquipement.matches.addressUnknown")}
															</div>
														</button>
													);
												})}
											</div>
										)}
									</div>
								)}
							</div>
						)}

						{activeStep === "legal" && (
							<div className="space-y-4">
								<div className="grid gap-4 sm:grid-cols-2">
									<FormFieldText
										control={form.control}
										name="equip_prop_nom"
										label={t("AddPoiEquipement.fields.proprietaireNom")}
									/>
									<FormFieldSelectObject
										control={form.control}
										name="equip_prop_type"
										label={t("AddPoiEquipement.fields.proprietaireType")}
										options={getListOptions("equip_prop_type")}
										placeholder={t("AddPoiEquipement.placeholders.selectType")}
										placeholderSearch={t("AddPoiEquipement.placeholders.searchType")}
									/>
								</div>

								<div className="grid gap-4 sm:grid-cols-3">
									<FormFieldDate control={form.control} name="inst_date_creation" label={t("AddPoiEquipement.fields.dateCreation")} />
									<FormFieldDate control={form.control} name="inst_enqu_date" label={t("AddPoiEquipement.fields.dateEnquete")} />
									<FormFieldDate control={form.control} name="equip_maj_date" label={t("AddPoiEquipement.fields.dateMaj")} />
								</div>

								<FormFieldText control={form.control} name="inst_nom" label={t("AddPoiEquipement.fields.institutionNom")} />
								<FormFieldText control={form.control} name="categorie" label={t("AddPoiEquipement.fields.categorie")} />
								<FormFieldText control={form.control} name="equip_gest_type" label={t("AddPoiEquipement.fields.gestionnaireType")} />

								<FormFieldSwitch control={form.control} name="inst_part_bool" label={t("AddPoiEquipement.fields.partenariatDisponible")} />

								{instPartBool && (
									<FormFieldTags
										control={form.control}
										name={"inst_part_type" as FieldPath<AddPoiFormData>}
										label={t("AddPoiEquipement.fields.partenariatType")}
										searchable={false}
									/>
								)}
							</div>
						)}

						{activeStep === "structure" && (
							<div className="space-y-6">
								<div className="grid gap-4 sm:grid-cols-2">
									<FormFieldSelectObject
										control={form.control}
										name="equip_nature"
										label={t("AddPoiEquipement.fields.nature")}
										options={getListOptions("equip_nature")}
										placeholder={t("AddPoiEquipement.placeholders.selectNature")}
										placeholderSearch={t("AddPoiEquipement.placeholders.searchType")}
									/>
									<FormFieldSelectObject
										control={form.control}
										name="equip_sol"
										label={t("AddPoiEquipement.fields.sol")}
										options={getListOptions("equip_sol")}
										placeholder={t("AddPoiEquipement.placeholders.selectSol")}
										placeholderSearch={t("AddPoiEquipement.placeholders.searchType")}
									/>
								</div>

								<div className="grid gap-4 sm:grid-cols-3">
									<FormFieldNumber control={form.control} name="equip_long" label={t("AddPoiEquipement.fields.longueur")} />
									<FormFieldNumber control={form.control} name="equip_larg" label={t("AddPoiEquipement.fields.largeur")} />
									<FormFieldNumber control={form.control} name="equip_surf" label={t("AddPoiEquipement.fields.surface")} />
								</div>

								<div className="grid gap-4 sm:grid-cols-2">
									<FormFieldText control={form.control} name="inst_acc_handi_type" label={t("AddPoiEquipement.fields.handicapType")} />
									<FormFieldText control={form.control} name="inst_trans_type" label={t("AddPoiEquipement.fields.transportType")} />
								</div>

								<div className="grid gap-3 sm:grid-cols-2">
									<FormFieldSwitch control={form.control} name="inst_acc_handi_bool" label={t("AddPoiEquipement.fields.accessibleHandicap")} />
									<FormFieldSwitch control={form.control} name="inst_trans_bool" label={t("AddPoiEquipement.fields.accessibleTransport")} />
									<FormFieldSwitch control={form.control} name="equip_eclair" label={t("AddPoiEquipement.fields.eclairage")} />
									<FormFieldSwitch control={form.control} name="equip_douche" label={t("AddPoiEquipement.fields.doucheAccessible")} />
								</div>

								<FormFieldSwitch control={form.control} name="equip_pmr_acc" label={t("AddPoiEquipement.fields.pmrAcces")} />

								{equipPmrAcc && (
									<div className="space-y-4">
										<div className="text-sm font-medium">{t("AddPoiEquipement.sections.pmr")}</div>
										<div className="grid gap-3 sm:grid-cols-2">
											<FormFieldSwitch control={form.control} name="equip_pmr_chem" label={t("AddPoiEquipement.fields.pmrChem")} />
											<FormFieldSwitch control={form.control} name="equip_pmr_douche" label={t("AddPoiEquipement.fields.pmrDouche")} />
											<FormFieldSwitch control={form.control} name="equip_pmr_trib" label={t("AddPoiEquipement.fields.pmrTrib")} />
											<FormFieldSwitch control={form.control} name="equip_pmr_vest" label={t("AddPoiEquipement.fields.pmrVest")} />
											<FormFieldSwitch control={form.control} name="equip_pmr_sanit" label={t("AddPoiEquipement.fields.pmrSanit")} />
										</div>
									</div>
								)}

								<FormFieldCheckboxGroup
									control={form.control}
									name="equip_loc_type"
									label={t("AddPoiEquipement.fields.locauxComplementaires")}
									options={getListOptions("equip_loc_type")}
								/>

								<div className="space-y-4">
									<div className="text-sm font-medium">{t("AddPoiEquipement.sections.pshs")}</div>
									<div className="grid gap-3 sm:grid-cols-2">
										{PSHS_FIELDS.map((pshs) => (
											<FormFieldSwitch
												key={pshs.name}
												control={form.control}
												name={pshs.name as FieldPath<AddPoiFormData>}
												label={t(pshs.labelKey)}
											/>
										))}
									</div>
								</div>
							</div>
						)}

						{activeStep === "usage" && (
							<div className="space-y-6">
								<FormFieldUrlList
									control={form.control}
									name="urls"
									label={t("AddPoiEquipement.fields.siteInternet")}
									placeholder={t("AddPoiEquipement.fields.siteInternetPlaceholder")}
									addLabel={t("AddPoiEquipement.buttons.addUrl")}
									removeLabel={t("AddPoiEquipement.buttons.removeUrl")}
								/>

								<FormFieldCheckboxGroup
									control={form.control}
									name="equip_utilisateur"
									label={t("AddPoiEquipement.fields.typesUtilisateurs")}
									options={getListOptions("equip_utilisateur")}
								/>

								<FormFieldSwitch control={form.control} name="equip_acc_libre" label={t("AddPoiEquipement.fields.accesLibre")} />

								<FormFieldSelectObject
									control={form.control}
									name="aps_name"
									label={t("AddPoiEquipement.fields.sportsPratiques")}
									required
									multiple
									options={getListOptions("aps_name")}
									placeholder={t("AddPoiEquipement.placeholders.selectSport")}
									placeholderSearch={t("AddPoiEquipement.placeholders.searchSport")}
								/>
							</div>
						)}
					</div>

					<DialogFooter className="mt-6 pt-4 border-t border-border">
						<div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
							<Button type="button" variant="outline" onClick={handlePrevious} disabled={activeStep === "general" || isSubmitting}>
								{t("AddPoiEquipement.buttons.previous")}
							</Button>
							<div className="flex items-center gap-2">
								{canSubmit ? (
									<Button type="submit" onClick={() => form.clearErrors()} disabled={isSubmitting}>
										{isSubmitting ? (
											<>
												<Loader2 className="mr-2 h-4 w-4 animate-spin" />
												{t("ProfileEdit.saving")}
											</>
										) : isEditMode ? (
											t("ProfileEdit.save")
										) : (
											t("AddEntity.create")
										)}
									</Button>
								) : (
									<Button
										type="button"
										onClick={(event) => {
											event.preventDefault();
											void handleNext();
										}}
										disabled={isSubmitting}
									>
										{t("AddPoiEquipement.buttons.next")}
									</Button>
								)}
							</div>
						</div>
					</DialogFooter>
				</form>
			</Form>

			{detailItem && (
				<PoiDetailSSBE
					openDetails={detailOpen}
					setOpenDetails={setDetailOpen}
					item={detailItem}
				/>
			)}
		</>
	);
}

export default PoiEquipementForm;
