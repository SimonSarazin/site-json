import { useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { EntityTypes, GlobalAutocompleteCostumData, SearchEntity } from "@communecter/cocolight-api-client";
import { Loader2 } from "lucide-react";
import type { FieldPath, FieldValues, Resolver, UseFormReturn } from "react-hook-form";
import { useT } from "@/hooks/useT";
import { useDebounce } from "@/hooks/useDebounce";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { SelectObject } from "@/components/ui/select-objet";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { useMutationWithToast } from "@/hooks/useMutationWithToast";
import { addPoiSchema, type AddPoiFormData } from "../../schemaForm";
import { useAddPoi } from "../../hooks/useAddMutations";
import { transformFormDataWithAddress } from "../../hooks/mutationUtils";
import { TranslatedFormMessage } from "../profile-edit/fields/TranslatedFormMessage";
import { EditLocationTab } from "../profile-edit/EditLocationTab";
import { FormFieldName, FormFieldTags, ParentInfoReadonly } from "../profile-edit/fields";
import { useCocolight } from "@/hooks/useCocolight";
import PoiDetailSSBE from "@/modules/search/components/detailsMode/PoiDetailSSBE";

const STEP_ORDER = ["general", "legal", "structure", "usage"] as const;
type StepKey = (typeof STEP_ORDER)[number];

const STEP_TITLES: Record<StepKey, string> = {
	general: "Informations generales",
	legal: "Caracteristiques juridiques",
	structure: "Caracteristiques structurantes",
	usage: "Caracteristiques d'usages",
};

const EQUIP_UTILISATEUR_OPTIONS = [
	"Individuel(s)",
	"famille(s)",
	"Scolaires",
	"universites",
	"Clubs sportifs",
	"comites",
	"ligues",
	"federations",
	"Autre - association(s) et groupes divers",
];

const EQUIP_LOC_TYPE_OPTIONS = [
	"Reception / Accueil",
	"Bureau(x) Club(s)",
	"Buvette",
	"Club(s) house",
	"Infirmerie",
	"Local de rangement",
	"Salle(s) de reunion / cours",
	"Centre medico-sportif",
	"Local controle anti-dopage",
	"Autre",
];

const POI_DETAIL_FIELDS = [
	"name",
	"equip_type_name",
	"equip_type_famille",
	"categorie",
	"enqueteStatut",
	"equip_nature",
	"equip_sol",
	"equip_surf",
	"equip_larg",
	"equip_long",
	"aps_name",
	"inst_nom",
	"equip_prop_nom",
	"equip_prop_type",
	"equip_gest_type",
	"inst_acc_handi_bool",
	"inst_acc_handi_type",
	"equip_pmr_acc",
	"equip_pmr_chem",
	"equip_pmr_douche",
	"equip_pmr_sanit",
	"equip_pmr_trib",
	"equip_pmr_vest",
	"equip_pshs_aire",
	"equip_pshs_chem",
	"equip_pshs_sanit",
	"equip_pshs_trib",
	"equip_pshs_vest",
	"equip_pshs_sign",
	"equip_acc_libre",
	"inst_trans_bool",
	"inst_trans_type",
	"equip_eclair",
	"equip_douche",
	"inst_part_bool",
	"inst_part_type",
	"equip_loc_type",
	"equip_utilisateur",
	"inst_date_creation",
	"inst_enqu_date",
	"equip_maj_date",
	"address",
	"geo",
	"geoPosition",
	"parent",
	"profilImageUrl",
	"profileImageUrl",
	"profilMediumImageUrl",
	"profilThumbImageUrl",
	"image",
] as const;

const PSHS_FIELDS = [
	{ name: "equip_pshs_aire", label: "Aire de jeu" },
	{ name: "equip_pshs_sanit", label: "Sanitaires" },
	{ name: "equip_pshs_trib", label: "Tribunes" },
	{ name: "equip_pshs_sign", label: "Accueil / Signaletique" },
	{ name: "equip_pshs_vest", label: "Vestiaires" },
	{ name: "equip_pshs_chem", label: "Cheminements" },
] as const;

const SearchableSelect = SelectObject;

const createEmptyDefaults = (): AddPoiFormData => ({
	name: "",
	type: "recoveryCenter",
	description: "",
	tags: [],
	urls: [],
	addressCountry: "RE",
	addressLocality: "",
	localityId: "",
	postalCode: "",
	streetAddress: "",
	inst_acc_handi_bool: false,
	inst_trans_bool: false,
	equip_type_name: "",
	equip_type_famille: "",
	inst_date_creation: "",
	inst_enqu_date: "",
	equip_maj_date: "",
	equip_nature: "",
	equip_sol: "",
	equip_surf: "",
	equip_eclair: false,
	categorie: "",
	aps_name: [],
	equip_acc_libre: false,
	inst_acc_handi_type: "",
	inst_trans_type: "",
	inst_part_bool: false,
	inst_part_type: [],
	equip_prop_nom: "",
	equip_prop_type: "",
	equip_gest_type: "",
	equip_pmr_acc: false,
	equip_pmr_chem: false,
	equip_pmr_douche: false,
	equip_pmr_sanit: false,
	equip_pmr_trib: false,
	equip_pmr_vest: false,
	equip_pshs_aire: false,
	equip_pshs_chem: false,
	equip_pshs_sanit: false,
	equip_pshs_trib: false,
	equip_pshs_vest: false,
	equip_pshs_sign: false,
	equip_larg: "",
	equip_long: "",
	equip_douche: false,
	equip_loc_type: [],
	equip_utilisateur: [],
	inst_nom: "",
});

const toStringValue = (value: unknown): string => {
	if (typeof value === "string") return value;
	if (typeof value === "number") return String(value);
	return "";
};

const toBooleanValue = (value: unknown): boolean => {
	if (typeof value === "boolean") return value;
	if (typeof value === "number") return value === 1;
	if (typeof value === "string") {
		return ["true", "1", "oui", "yes"].includes(value.trim().toLowerCase());
	}
	return false;
};

const toStringArray = (value: unknown): string[] => {
	if (Array.isArray(value)) {
		return value.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0);
	}
	if (typeof value === "string") {
		return value
			.split(",")
			.map((entry) => entry.trim())
			.filter((entry) => entry.length > 0);
	}
	return [];
};

const buildEditDefaults = (poi: EntityTypes | null | undefined): AddPoiFormData => {
	const defaults = createEmptyDefaults();
	if (!poi) return defaults;

	const entityData = (poi ?? {}) as unknown as Record<string, unknown>;
	const serverData = (poi?.serverData ?? {}) as Record<string, unknown>;
	const address = (serverData.address ?? entityData.address) as Record<string, unknown> | undefined;
	const getField = (field: string) => serverData[field] ?? entityData[field];

	const resolvedType = toStringValue(getField("type"));

	return {
		...defaults,
		name: toStringValue(getField("name")) || defaults.name,
		type: (resolvedType || defaults.type) as AddPoiFormData["type"],
		description: toStringValue(getField("description")) || defaults.description,
		tags: toStringArray(getField("tags")),
		urls: toStringArray(getField("urls")),
		addressCountry: toStringValue(address?.addressCountry) || defaults.addressCountry,
		addressLocality: toStringValue(address?.addressLocality),
		localityId: toStringValue(address?.localityId),
		postalCode: toStringValue(address?.postalCode),
		streetAddress: toStringValue(address?.streetAddress),
		inst_acc_handi_bool: toBooleanValue(getField("inst_acc_handi_bool")),
		inst_trans_bool: toBooleanValue(getField("inst_trans_bool")),
		equip_type_name: toStringValue(getField("equip_type_name")),
		equip_type_famille: toStringValue(getField("equip_type_famille")),
		inst_date_creation: toStringValue(getField("inst_date_creation")),
		inst_enqu_date: toStringValue(getField("inst_enqu_date")),
		equip_maj_date: toStringValue(getField("equip_maj_date")),
		equip_nature: toStringValue(getField("equip_nature")),
		equip_sol: toStringValue(getField("equip_sol")),
		equip_surf: toStringValue(getField("equip_surf")),
		equip_eclair: toBooleanValue(getField("equip_eclair")),
		categorie: toStringValue(getField("categorie")),
		aps_name: toStringArray(getField("aps_name")),
		equip_acc_libre: toBooleanValue(getField("equip_acc_libre")),
		inst_acc_handi_type: toStringValue(getField("inst_acc_handi_type")),
		inst_trans_type: toStringValue(getField("inst_trans_type")),
		inst_part_bool: toBooleanValue(getField("inst_part_bool")),
		inst_part_type: toStringArray(getField("inst_part_type")),
		equip_prop_nom: toStringValue(getField("equip_prop_nom")),
		equip_prop_type: toStringValue(getField("equip_prop_type")),
		equip_gest_type: toStringValue(getField("equip_gest_type")),
		equip_pmr_acc: toBooleanValue(getField("equip_pmr_acc")),
		equip_pmr_chem: toBooleanValue(getField("equip_pmr_chem")),
		equip_pmr_douche: toBooleanValue(getField("equip_pmr_douche")),
		equip_pmr_sanit: toBooleanValue(getField("equip_pmr_sanit")),
		equip_pmr_trib: toBooleanValue(getField("equip_pmr_trib")),
		equip_pmr_vest: toBooleanValue(getField("equip_pmr_vest")),
		equip_pshs_aire: toBooleanValue(getField("equip_pshs_aire")),
		equip_pshs_chem: toBooleanValue(getField("equip_pshs_chem")),
		equip_pshs_sanit: toBooleanValue(getField("equip_pshs_sanit")),
		equip_pshs_trib: toBooleanValue(getField("equip_pshs_trib")),
		equip_pshs_vest: toBooleanValue(getField("equip_pshs_vest")),
		equip_pshs_sign: toBooleanValue(getField("equip_pshs_sign")),
		equip_larg: toStringValue(getField("equip_larg")),
		equip_long: toStringValue(getField("equip_long")),
		equip_douche: toBooleanValue(getField("equip_douche")),
		equip_loc_type: toStringArray(getField("equip_loc_type")),
		equip_utilisateur: toStringArray(getField("equip_utilisateur")),
		inst_nom: toStringValue(getField("inst_nom")),
	};
};

const toggleArrayValue = (values: string[] | undefined, value: string) => {
	const current = Array.isArray(values) ? values : [];
	return current.includes(value)
		? current.filter((item) => item !== value)
		: [...current, value];
};

interface AddPoiEquipementModalProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	mode?: "add" | "edit";
	poi?: EntityTypes | null;
	parent?: EntityTypes | null;
}

function isFilled(value: unknown): boolean {
	return typeof value === "string" ? value.trim().length > 0 : !!value;
}

function resolvePoiId(value: unknown): string | undefined {
	if (!value || typeof value !== "object") return undefined;
	const record = value as Record<string, unknown>;
	const directId = record.id;
	if (typeof directId === "string" || typeof directId === "number") return String(directId);
	const rawId = record._id;
	if (typeof rawId === "string" || typeof rawId === "number") return String(rawId);
	if (rawId && typeof rawId === "object") {
		const rawRecord = rawId as Record<string, unknown>;
		const nestedId = rawRecord.$oid ?? rawRecord.$id ?? rawRecord._str ?? rawRecord.$numberLong;
		if (typeof nestedId === "string" || typeof nestedId === "number") return String(nestedId);
	}
	const serverData = record.serverData as Record<string, unknown> | undefined;
	if (serverData) {
		const serverId = resolvePoiId(serverData);
		if (serverId) return serverId;
	}
	return undefined;
}

export function AddPoiEquipementModal({
	open,
	onOpenChange,
	mode = "add",
	poi,
	parent,
}: AddPoiEquipementModalProps) {
	const t = useT("modules/profil");
	const isEditMode = mode === "edit" && Boolean(poi);
	const { entity, helper } = useCocolight();
	const addMutation = useAddPoi(parent);
	const updateMutation = useMutationWithToast<{ poi: EntityTypes }, AddPoiFormData>({
		mutationFn: async (data) => {
			if (!isEditMode || !poi) {
				throw new Error("No entity provided");
			}

			const transformedData = transformFormDataWithAddress(data);

			const isEmpty = (value: unknown): boolean => {
				if (value === undefined || value === null) return true;
				if (typeof value === "string" && value.trim() === "") return true;
				if (Array.isArray(value) && value.length === 0) return true;
				if (typeof value === "object" && Object.keys(value).length === 0 && value.constructor === Object) return true;
				return false;
			};

			// updateField appelle endpointApi.updatePathValue()
			for (const [path, value] of Object.entries(transformedData)) {
				if (isEmpty(value)) continue;
				await poi.updateField(path, value);
			}

			// Rafraîchir les données du POI depuis le serveur
			await poi.refresh();

			return { poi };
		},
		namespace: "modules/profil",
		successKey: "toast.profile.updateSuccess",
		errorKey: "toast.profile.updateError",
	});
	const [activeStep, setActiveStep] = useState<StepKey>("general");
	const [stepAttempted, setStepAttempted] = useState<Record<StepKey, boolean>>({
		general: false,
		legal: false,
		structure: false,
		usage: false,
	});
	const [matchingPois, setMatchingPois] = useState<SearchEntity[]>([]);
	const [isMatchingPoisLoading, setIsMatchingPoisLoading] = useState(false);
	const [matchingPoisError, setMatchingPoisError] = useState<Error | null>(null);
	const [matchingPoisSearched, setMatchingPoisSearched] = useState(false);
	const [detailItem, setDetailItem] = useState<SearchEntity | null>(null);
	const [detailOpen, setDetailOpen] = useState(false);
	const detailRequestId = useRef(0);

	const serverLists = entity?.serverData?.lists as
		| Partial<
			Record<
				| "equip_type_name"
				| "equip_type_famille"
				| "equip_prop_type"
				| "equip_nature"
				| "equip_sol"
				| "categorie",
				unknown
			>
		>
		| undefined;

	const getListOptions = (
		field:
			| "equip_type_name"
			| "equip_type_famille"
			| "equip_prop_type"
			| "equip_nature"
			| "equip_sol"
			| "categorie"
	) => {
		const values = serverLists?.[field];
		if (!Array.isArray(values)) {
			return [] as string[];
		}
		return values.filter((value): value is string => typeof value === "string");
	};

	const emptyDefaults = useMemo(() => createEmptyDefaults(), []);
	const form = useForm<AddPoiFormData>({
		resolver: zodResolver(addPoiSchema) as Resolver<AddPoiFormData>,
		defaultValues: emptyDefaults,
	});
	useEffect(() => {
		if (!open) return;
		if (isEditMode) {
			form.reset(buildEditDefaults(poi));
			setActiveStep("general");
			setStepAttempted({
				general: false,
				legal: false,
				structure: false,
				usage: false,
			});
			return;
		}
		form.reset(emptyDefaults);
		setActiveStep("general");
		setStepAttempted({
			general: false,
			legal: false,
			structure: false,
			usage: false,
		});
	}, [open, isEditMode, poi, form, emptyDefaults]);


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
	const debouncedPoiSearchKey = useDebounce(
		`${postalCode}|${streetAddress}|${equipTypeName}`,
		400
	);

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

	useEffect(() => {
		if (!isFilled(postalCode) || !isFilled(equipTypeName)) {
			setMatchingPois([]);
			setMatchingPoisError(null);
			setMatchingPoisSearched(false);
			setIsMatchingPoisLoading(false);
		}
	}, [postalCode, equipTypeName]);

	useEffect(() => {
		if (!entity || !helper) return;

		if (!isFilled(postalCode) || !isFilled(equipTypeName)) {
			return;
		}

		let isActive = true;

		const fetchMatchingPois = async () => {
			setIsMatchingPoisLoading(true);
			setMatchingPoisError(null);
			setMatchingPoisSearched(true);

			const filters: Record<string, unknown> = {
				"address.postalCode": postalCode,
				equip_type_name: equipTypeName,
				$or: {
					"source.key": "sportSanteBienetre",
					"source.keys": "sportSanteBienetre",
					"parent.6a04155ed047177b92399685": { $exists: true },
				},
				type: "recoveryCenter",
			};

			if (isFilled(streetAddress)) {
				filters["address.streetAddress"] = streetAddress;
			}

			const params: Partial<GlobalAutocompleteCostumData> = {
				name: "",
				searchType: ["poi"],
				indexMin: 0,
				indexStep: 50,
				notSourceKey: true,
				fields: [...POI_DETAIL_FIELDS],
				filters,
			};

			try {
				const result = await entity.searchCostum(params);
				const rawResults = Array.isArray(result?.results)
					? result.results
					: Object.values(result?.results ?? {});
				const transformed = rawResults.flatMap((entry) => {
					if (entry && typeof entry === "object" && "getEntityType" in entry) {
						return [entry as SearchEntity];
					}
					try {
						return [helper.fromEntityJSON(entry, entity) as SearchEntity];
					} catch {
						return [];
					}
				});

				if (isActive) {
					setMatchingPois(transformed);
				}
			} catch (error) {
				if (isActive) {
					setMatchingPois([]);
					setMatchingPoisError(error instanceof Error ? error : new Error("Unknown error"));
				}
			} finally {
				if (isActive) {
					setIsMatchingPoisLoading(false);
				}
			}
		};

		void fetchMatchingPois();

		return () => {
			isActive = false;
		};
	}, [debouncedPoiSearchKey, entity, helper]);

	useEffect(() => {
		if (!detailOpen) {
			setDetailItem(null);
		}
	}, [detailOpen]);

	useEffect(() => {
		const length = Number.parseFloat(equipLong || "");
		const width = Number.parseFloat(equipLarg || "");

		if (!Number.isFinite(length) || !Number.isFinite(width)) {
			if (equipSurf !== "") {
				form.setValue("equip_surf", "", { shouldDirty: true });
			}
			return;
		}

		const computed = String(length * width);
		if (computed !== equipSurf) {
			form.setValue("equip_surf", computed, { shouldDirty: true });
		}
	}, [equipLong, equipLarg, equipSurf, form]);

	const handleClose = () => {
		form.reset();
		setActiveStep("general");
		setDetailOpen(false);
		onOpenChange(false);
	};

	const handleOpenDetails = async (poi: SearchEntity) => {
		const requestId = ++detailRequestId.current;
		setDetailItem(poi);
		setDetailOpen(true);

		if (!entity || !helper) return;

		const poiId = resolvePoiId(poi);

		const pickEntry = (results: unknown[]) => {
			if (poiId) {
				const match = results.find((entry) => resolvePoiId(entry) === poiId);
				if (match) return match;
			}
			return results[0];
		};

		const fetchEntry = async (filters: Record<string, unknown>) => {
			const params: Partial<GlobalAutocompleteCostumData> = {
				name: "",
				searchType: ["poi"],
				indexMin: 0,
				indexStep: 50,
				notSourceKey: true,
				fields: [...POI_DETAIL_FIELDS],
				filters,
			};

			const result = await entity.searchCostum(params);
			const rawResults = Array.isArray(result?.results)
				? result.results
				: Object.values(result?.results ?? {});
			return pickEntry(rawResults);
		};

		let entry: unknown;

		if (poiId) {
			try {
				entry = await fetchEntry({ _id: poiId });
			} catch {
				entry = undefined;
			}
		}

		if (!entry) {
			const fallbackFilters: Record<string, unknown> = {
				"address.postalCode": postalCode,
				equip_type_name: equipTypeName,
				$or: {
					"source.key": "sportSanteBienetre",
					"source.keys": "sportSanteBienetre",
					"parent.6a04155ed047177b92399685": { $exists: true },
				},
				type: "recoveryCenter",
			};

			if (isFilled(streetAddress)) {
				fallbackFilters["address.streetAddress"] = streetAddress;
			}

			try {
				entry = await fetchEntry(fallbackFilters);
			} catch {
				entry = undefined;
			}
		}

		if (!entry || detailRequestId.current !== requestId) return;
		if (entry && typeof entry === "object" && "getEntityType" in entry) {
			setDetailItem(entry as SearchEntity);
			return;
		}
		try {
			setDetailItem(helper.fromEntityJSON(entry, entity) as SearchEntity);
		} catch {
			setDetailItem(poi);
		}
	};

	const handleSubmit = async (data: AddPoiFormData) => {
		try {
			if (isEditMode) {
				await updateMutation.mutateAsync(data);
			} else {
				await addMutation.mutateAsync(data);
			}
			form.reset(emptyDefaults);
			setActiveStep("general");
			onOpenChange(false);
		} catch {
			
		}
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
				return;
			}
		}

		await handleSubmit(data);
	};

	const onFormSubmit = form.handleSubmit(handleFinalSubmit);

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
	const isSaving = isEditMode ? updateMutation.isPending : addMutation.isPending;

	return (
		<Dialog open={open} onOpenChange={handleClose}>
			<DialogContent className="sm:max-w-[840px] max-h-[90vh] flex flex-col">
				<DialogHeader>
					<DialogTitle>{isEditMode ? "Editer un equipement" : "Ajouter un equipement"}</DialogTitle>
					<DialogDescription>
						{isEditMode
							? "Mettre a jour les informations de l'equipement."
							: "Completer les informations de l'equipement."}
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
									Étape {activeStepIndex + 1} / {STEP_ORDER.length}
								</div>
								<div className="text-sm font-medium text-foreground">{STEP_TITLES[activeStep]}</div>
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
										aria-label={`Étape ${index + 1}`}
									>
										<span className="text-xs font-semibold">{index + 1}</span>
										{step === activeStep && <span className="ml-2 text-xs font-medium">{STEP_TITLES[step]}</span>}
										{stepHasMissingRequired(step) && (
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
										<FormField
											control={form.control}
											name="equip_type_name"
											render={({ field }) => (
												<FormItem>
													<FormLabel>Type de l'equipement *</FormLabel>
													<SearchableSelect
														value={typeof field.value === "string" ? field.value : ""}
														onChange={(value) => field.onChange(typeof value === "string" ? value : "")}
														options={getListOptions("equip_type_name").map((option) => ({ id: option, label: option, value: option }))}
														placeholder="Selectionner un type"
														placeholderSearch="Rechercher un type"
													/>
													<TranslatedFormMessage />
												</FormItem>
											)}
										/>

										<FormField
											control={form.control}
											name="equip_type_famille"
											render={({ field }) => (
												<FormItem>
													<FormLabel>Famille d'equipement</FormLabel>
													<SearchableSelect
														value={typeof field.value === "string" ? field.value : ""}
														onChange={(value) => field.onChange(typeof value === "string" ? value : "")}
														options={getListOptions("equip_type_famille").map((option) => ({ id: option, label: option, value: option }))}
														placeholder="Selectionner une famille"
														placeholderSearch="Rechercher une famille"
													/>
													<TranslatedFormMessage />
												</FormItem>
											)}
										/>
									</div>

									<div className="rounded-xl border border-border/60 bg-background/40 p-4 space-y-4">
										<div className="text-sm font-medium">Adresse *</div>
										<EditLocationTab form={form as unknown as UseFormReturn<FieldValues>} />
									</div>

									{(isMatchingPoisLoading || matchingPoisError || matchingPois.length > 0 || matchingPoisSearched) && (
										<div className="rounded-lg border border-border/60 bg-muted/30 p-3 space-y-2">
											<div className="text-sm font-medium"><span className="font-bold text-primary">{matchingPois.length}</span> Equipement existants a la meme adresse</div>
											{isMatchingPoisLoading && (
												<div className="flex items-center gap-2 text-xs text-muted-foreground">
													<Loader2 className="h-4 w-4 animate-spin" />
													Recherche en cours...
												</div>
											)}
											{matchingPoisError && (
												<div className="text-xs text-destructive">
													Erreur lors de la recherche des POI.
												</div>
											)}
											{!isMatchingPoisLoading && !matchingPoisError && matchingPois.length === 0 && matchingPoisSearched && (
												<div className="text-xs text-muted-foreground">Aucun Equipement trouve.</div>
											)}
											{matchingPois.length > 0 && (
												<div className="space-y-2">
													{matchingPois.map((poi, index) => {
														const serverData = (poi?.serverData ?? {}) as Record<string, unknown>;
														const address = (serverData.address ?? {}) as Record<string, unknown>;
														const addressLine = [
															address.streetAddress,
															address.postalCode,
															address.addressLocality,
														]
															.map((value) => (typeof value === "string" ? value.trim() : ""))
															.filter((value) => value.length > 0)
															.join(", ");
														const name =
															typeof serverData.name === "string" && serverData.name.trim().length > 0
																? serverData.name
																: typeof (poi as { name?: string }).name === "string"
																	? (poi as { name?: string }).name
																	: "Sans nom";
														const idValue =
															typeof serverData.id === "string"
																? serverData.id
																: typeof serverData._id === "string"
																	? serverData._id
																	: `${name}-${index}`;
														return (
															<button
																key={idValue}
																type="button"
																className="w-full rounded-md border border-border/60 bg-background/60 p-3 text-left transition hover:bg-background"
																onClick={() => {
																	void handleOpenDetails(poi);
																}}
															>
																<div className="text-sm font-semibold text-foreground">{name}</div>
																<div className="text-xs text-muted-foreground">
																	{addressLine || "Adresse inconnue"}
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
										<FormField
											control={form.control}
											name="equip_prop_nom"
											render={({ field }) => (
												<FormItem>
													<FormLabel>Nom du proprietaire</FormLabel>
													<FormControl>
														<Input value={typeof field.value === "string" ? field.value : ""} onChange={field.onChange} onBlur={field.onBlur} ref={field.ref} name={field.name} />
													</FormControl>
													<TranslatedFormMessage />
												</FormItem>
											)}
										/>

										<FormField
											control={form.control}
											name="equip_prop_type"
											render={({ field }) => (
												<FormItem>
													<FormLabel>Type de proprietaire</FormLabel>
													<SearchableSelect
														value={typeof field.value === "string" ? field.value : ""}
														onChange={(value) => field.onChange(typeof value === "string" ? value : "")}
														options={getListOptions("equip_prop_type").map((option) => ({ id: option, label: option, value: option }))}
														placeholder="Selectionner un type"
														placeholderSearch="Rechercher un type"
													/>
													<TranslatedFormMessage />
												</FormItem>
											)}
										/>
									</div>

									<div className="grid gap-4 sm:grid-cols-3">
										<FormField
											control={form.control}
											name="inst_date_creation"
											render={({ field }) => (
												<FormItem>
													<FormLabel>Date de creation</FormLabel>
													<FormControl>
														<Input type="date" value={typeof field.value === "string" ? field.value : ""} onChange={field.onChange} onBlur={field.onBlur} ref={field.ref} name={field.name} />
													</FormControl>
													<TranslatedFormMessage />
												</FormItem>
											)}
										/>

										<FormField
											control={form.control}
											name="inst_enqu_date"
											render={({ field }) => (
												<FormItem>
													<FormLabel>Date d'enquete</FormLabel>
													<FormControl>
														<Input type="date" value={typeof field.value === "string" ? field.value : ""} onChange={field.onChange} onBlur={field.onBlur} ref={field.ref} name={field.name} />
													</FormControl>
													<TranslatedFormMessage />
												</FormItem>
											)}
										/>

										<FormField
											control={form.control}
											name="equip_maj_date"
											render={({ field }) => (
												<FormItem>
													<FormLabel>Date de mise a jour</FormLabel>
													<FormControl>
														<Input type="date" value={typeof field.value === "string" ? field.value : ""} onChange={field.onChange} onBlur={field.onBlur} ref={field.ref} name={field.name} />
													</FormControl>
													<TranslatedFormMessage />
												</FormItem>
											)}
										/>
									</div>
									<FormField
										control={form.control}
										name="inst_nom"
										render={({ field }) => (
											<FormItem>
												<FormLabel>Nom de l'institution</FormLabel>
												<FormControl>
													<Input value={typeof field.value === "string" ? field.value : ""} onChange={field.onChange} onBlur={field.onBlur} ref={field.ref} name={field.name} />
												</FormControl>
												<TranslatedFormMessage />
											</FormItem>
										)}
									/>

									<FormField
										control={form.control}
										name="categorie"
										render={({ field }) => (
											<FormItem>
												<FormLabel>Catégorie</FormLabel>
												<FormControl>
													<Input value={typeof field.value === "string" ? field.value : ""} onChange={field.onChange} onBlur={field.onBlur} ref={field.ref} name={field.name} />
												</FormControl>
												<TranslatedFormMessage />
											</FormItem>
										)}
									/>

									<FormField
										control={form.control}
										name="equip_gest_type"
										render={({ field }) => (
											<FormItem>
												<FormLabel>Type de gestionnaire</FormLabel>
												<FormControl>
													<Input value={typeof field.value === "string" ? field.value : ""} onChange={field.onChange} onBlur={field.onBlur} ref={field.ref} name={field.name} />
												</FormControl>
												<TranslatedFormMessage />
											</FormItem>
										)}
									/>

									<FormField
										control={form.control}
										name="inst_part_bool"
										render={({ field }) => (
											<FormItem className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
												<FormLabel className="m-0">Partenariat disponible</FormLabel>
												<FormControl>
													<Switch checked={Boolean(field.value)} onCheckedChange={field.onChange} />
												</FormControl>
											</FormItem>
										)}
									/>

									{instPartBool && (
										<FormField
											control={form.control}
											name="inst_part_type"
											render={({ field }) => (
												<FormItem>
													<FormLabel>Type de partenariat</FormLabel>
													<FormControl>
														<Input
															value={Array.isArray(field.value) ? field.value.join(", ") : ""}
															onChange={(event) => {
																const next = event.target.value
																	.split(",")
																	.map((item) => item.trim())
																	.filter((item) => item.length > 0);
															field.onChange(next);
															}}
															placeholder="Séparer les valeurs par une virgule"
														/>
													</FormControl>
													<TranslatedFormMessage />
												</FormItem>
											)}
										/>
									)}
								</div>
							)}

							{activeStep === "structure" && (
								<div className="space-y-6">
                                    <div className="grid gap-4 sm:grid-cols-2">
										<FormField
											control={form.control}
											name="equip_nature"
											render={({ field }) => (
												<FormItem>
													<FormLabel>Nature de l'equipement</FormLabel>
													<SearchableSelect
														value={typeof field.value === "string" ? field.value : ""}
														onChange={(value) => field.onChange(typeof value === "string" ? value : "")}
														options={getListOptions("equip_nature").map((option) => ({ id: option, label: option, value: option }))}
														placeholder="Selectionner une nature"
														placeholderSearch="Rechercher un type"
													/>
													<TranslatedFormMessage />
												</FormItem>
											)}
										/>

										<FormField
											control={form.control}
											name="equip_sol"
											render={({ field }) => (
												<FormItem>
													<FormLabel>Type de sol</FormLabel>
													<SearchableSelect
														value={typeof field.value === "string" ? field.value : ""}
														onChange={(value) => field.onChange(typeof value === "string" ? value : "")}
														options={getListOptions("equip_sol").map((option) => ({ id: option, label: option, value: option }))}
														placeholder="Selectionner un type de sol"
														placeholderSearch="Rechercher un type"
													/>
													<TranslatedFormMessage />
												</FormItem>
											)}
										/>
									</div>

									<div className="grid gap-4 sm:grid-cols-3">
										<FormField control={form.control} name="equip_long" render={({ field }) => (
											<FormItem>
												<FormLabel>Longueur</FormLabel>
												<FormControl><Input value={typeof field.value === "string" ? field.value : ""} onChange={field.onChange} onBlur={field.onBlur} ref={field.ref} name={field.name} /></FormControl>
												<TranslatedFormMessage />
											</FormItem>
										)} />
										<FormField control={form.control} name="equip_larg" render={({ field }) => (
											<FormItem>
												<FormLabel>Largeur</FormLabel>
												<FormControl><Input value={typeof field.value === "string" ? field.value : ""} onChange={field.onChange} onBlur={field.onBlur} ref={field.ref} name={field.name} /></FormControl>
												<TranslatedFormMessage />
											</FormItem>
										)} />
										<FormField control={form.control} name="equip_surf" render={({ field }) => (
											<FormItem>
												<FormLabel>Surface (calculee)</FormLabel>
												<FormControl><Input value={typeof field.value === "string" ? field.value : ""} onChange={field.onChange} onBlur={field.onBlur} ref={field.ref} name={field.name} /></FormControl>
												<TranslatedFormMessage />
											</FormItem>
										)} />
									</div>

									<div className="grid gap-4 sm:grid-cols-2">
										<FormField control={form.control} name="inst_acc_handi_type" render={({ field }) => (
											<FormItem>
												<FormLabel>Type de handicap pris en charge</FormLabel>
												<FormControl><Input value={typeof field.value === "string" ? field.value : ""} onChange={field.onChange} onBlur={field.onBlur} ref={field.ref} name={field.name} /></FormControl>
												<TranslatedFormMessage />
											</FormItem>
										)} />
										<FormField control={form.control} name="inst_trans_type" render={({ field }) => (
											<FormItem>
												<FormLabel>Moyen de transport disponible</FormLabel>
												<FormControl><Input value={typeof field.value === "string" ? field.value : ""} onChange={field.onChange} onBlur={field.onBlur} ref={field.ref} name={field.name} /></FormControl>
												<TranslatedFormMessage />
											</FormItem>
										)} />
									</div>

									<div className="grid gap-3 sm:grid-cols-2">
										<FormField control={form.control} name="inst_acc_handi_bool" render={({ field }) => (
											<FormItem className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
												<FormLabel className="m-0">Accessible aux personnes en situation de handicap</FormLabel>
												<FormControl><Switch checked={Boolean(field.value)} onCheckedChange={field.onChange} /></FormControl>
											</FormItem>
										)} />
										<FormField control={form.control} name="inst_trans_bool" render={({ field }) => (
											<FormItem className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
												<FormLabel className="m-0">Accessible en transport en commun</FormLabel>
												<FormControl><Switch checked={Boolean(field.value)} onCheckedChange={field.onChange} /></FormControl>
											</FormItem>
										)} />
										<FormField control={form.control} name="equip_eclair" render={({ field }) => (
											<FormItem className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
												<FormLabel className="m-0">Eclairage de l'aire</FormLabel>
												<FormControl><Switch checked={Boolean(field.value)} onCheckedChange={field.onChange} /></FormControl>
											</FormItem>
										)} />
                                        <FormField control={form.control} name="equip_douche" render={({ field }) => (
											<FormItem className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
												<FormLabel className="m-0">Douche accessible</FormLabel>
												<FormControl><Switch checked={Boolean(field.value)} onCheckedChange={field.onChange} /></FormControl>
											</FormItem>
										)} />
									</div>

									<FormField control={form.control} name="equip_pmr_acc" render={({ field }) => (
										<FormItem className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
											<FormLabel className="m-0">Acces PMR disponible</FormLabel>
											<FormControl><Switch checked={Boolean(field.value)} onCheckedChange={field.onChange} /></FormControl>
										</FormItem>
									)} />

									{equipPmrAcc && (
										<div className="space-y-4">
											<div className="text-sm font-medium">Accessibilite PMR</div>
											<div className="grid gap-3 sm:grid-cols-2">
												<FormField control={form.control} name="equip_pmr_chem" render={({ field }) => (
													<FormItem className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
														<FormLabel className="m-0">Cheminement PMR adapte</FormLabel>
														<FormControl><Switch checked={Boolean(field.value)} onCheckedChange={field.onChange} /></FormControl>
													</FormItem>
												)} />
												<FormField control={form.control} name="equip_pmr_douche" render={({ field }) => (
													<FormItem className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
														<FormLabel className="m-0">Douches accessibles PMR</FormLabel>
														<FormControl><Switch checked={Boolean(field.value)} onCheckedChange={field.onChange} /></FormControl>
													</FormItem>
												)} />
												<FormField control={form.control} name="equip_pmr_trib" render={({ field }) => (
													<FormItem className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
														<FormLabel className="m-0">Tribunes accessibles PMR</FormLabel>
														<FormControl><Switch checked={Boolean(field.value)} onCheckedChange={field.onChange} /></FormControl>
													</FormItem>
												)} />
												<FormField control={form.control} name="equip_pmr_vest" render={({ field }) => (
													<FormItem className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
														<FormLabel className="m-0">Vestiaires accessibles PMR</FormLabel>
														<FormControl><Switch checked={Boolean(field.value)} onCheckedChange={field.onChange} /></FormControl>
													</FormItem>
												)} />
                                                <FormField control={form.control} name="equip_pmr_sanit" render={({ field }) => (
													<FormItem className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
														<FormLabel className="m-0">Sanitaires accessibles PMR</FormLabel>
														<FormControl><Switch checked={Boolean(field.value)} onCheckedChange={field.onChange} /></FormControl>
													</FormItem>
												)} />
											</div>
										</div>
									)}

									<FormField
										control={form.control}
										name="equip_loc_type"
										render={({ field }) => (
											<FormItem>
												<FormLabel>Locaux complementaires</FormLabel>
												<div className="grid gap-2 sm:grid-cols-2">
													{EQUIP_LOC_TYPE_OPTIONS.map((option) => (
														<label key={option} className="flex items-center gap-2 text-sm">
															<Checkbox checked={Array.isArray(field.value) && field.value.includes(option)} onCheckedChange={() => field.onChange(toggleArrayValue(field.value as string[] | undefined, option))} />
															<span>{option}</span>
														</label>
													))}
												</div>
												<TranslatedFormMessage />
											</FormItem>
										)}
									/>

									<div className="space-y-4">
										<div className="text-sm font-medium">Accessibilite PSHS</div>
										<div className="grid gap-3 sm:grid-cols-2">
											{PSHS_FIELDS.map((config) => (
												<FormField
													key={config.name}
													control={form.control}
													name={config.name}
													render={({ field }) => (
														<FormItem className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
															<FormLabel className="m-0">{config.label}</FormLabel>
															<FormControl><Switch checked={Boolean(field.value)} onCheckedChange={field.onChange} /></FormControl>
														</FormItem>
													)}
												/>
											))}
										</div>
									</div>
								</div>
							)}

							{activeStep === "usage" && (
								<div className="space-y-6">
									<FormField control={form.control} name="urls" render={({ field }) => (
										<FormItem>
											<FormLabel>Site internet</FormLabel>
											<FormControl>
												<Input
													value={Array.isArray(field.value) ? field.value.join(", ") : ""}
													onChange={(event) => {
													const next = event.target.value.split(",").map((item) => item.trim()).filter((item) => item.length > 0);
													field.onChange(next);
												}}
												placeholder="https://"
												/>
											</FormControl>
											<TranslatedFormMessage />
										</FormItem>
									)} />

									<FormField control={form.control} name="equip_utilisateur" render={({ field }) => (
										<FormItem>
											<FormLabel>Types d'utilisateurs</FormLabel>
											<div className="grid gap-2 sm:grid-cols-2">
												{EQUIP_UTILISATEUR_OPTIONS.map((option) => (
													<label key={option} className="flex items-center gap-2 text-sm">
														<Checkbox checked={Array.isArray(field.value) && field.value.includes(option)} onCheckedChange={() => field.onChange(toggleArrayValue(field.value as string[] | undefined, option))} />
														<span>{option}</span>
													</label>
												))}
											</div>
											<TranslatedFormMessage />
										</FormItem>
									)} />

									<FormField control={form.control} name="equip_acc_libre" render={({ field }) => (
										<FormItem className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
											<FormLabel className="m-0">Acces libre</FormLabel>
											<FormControl><Switch checked={Boolean(field.value)} onCheckedChange={field.onChange} /></FormControl>
										</FormItem>
									)} />

									<FormFieldTags control={form.control} name={"aps_name" as FieldPath<AddPoiFormData>} label="Sports pratiques *" extendedTexts />
								</div>
							)}
						</div>

						<DialogFooter className="mt-6 pt-4 border-t border-border">
							<div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
								<Button type="button" variant="outline" onClick={handlePrevious} disabled={activeStep === "general" || isSaving}>
									Precedent
								</Button>
								<div className="flex items-center gap-2">
									{canSubmit ? (
											<Button type="submit" onClick={() => form.clearErrors()} disabled={isSaving}>
												{isSaving ? (
												<>
													<Loader2 className="mr-2 h-4 w-4 animate-spin" />
														{t("ProfileEdit.saving")}
												</>
											) : (
													isEditMode ? t("ProfileEdit.save") : t("AddEntity.create")
											)}
										</Button>
									) : (
										<Button
											type="button"
											onClick={(event) => {
												event.preventDefault();
												void handleNext();
											}}
											disabled={isSaving}
										>
											Suivant
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
			</DialogContent>
		</Dialog>
	);
}

export default AddPoiEquipementModal;
