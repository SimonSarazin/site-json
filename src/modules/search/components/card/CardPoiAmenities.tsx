import {
	MapPin,
	Calendar,
	Building2,
	Accessibility,
	Bus,
	Tag,
	Lightbulb,
	Droplet,
	DoorOpen,
} from "lucide-react";
import { format } from "date-fns";
import type { Poi } from "@communecter/cocolight-api-client";
import getDateFnsLocale from "@/dateFns";
import "@/modules/search/i18n";
import { useT } from "@/hooks/useT";
import { useLoadNamespace } from "@/hooks/useLoadNamespace";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { OptimizedImage } from "@/components/ui/OptimizedImage";
import { cn } from "@/lib/utils";
import { useInstallationFilter } from "../../hooks/useInstallationFilter";
import { SearchCardProps } from "../../schema";

/** Champ costum d'accessibilité stocké en `"1"`/`"oui"`/`true` → booléen. */
const isTrue = (value: unknown): boolean => {
	if (typeof value === "boolean") return value;
	if (typeof value === "number") return value === 1;
	if (typeof value === "string") {
		const n = value.trim().toLowerCase();
		return n === "true" || n === "1" || n === "oui" || n === "yes";
	}
	return false;
};

function Feature({
	label,
	active,
	Icon,
}: {
	label: string;
	active: boolean;
	Icon: typeof Accessibility;
}) {
	return (
		<div
			className={`flex items-center gap-1.5 rounded-md border px-2 py-1.5 text-xs transition-colors ${
				active
					? "border-primary/20 bg-primary/10 text-primary"
					: "border-border bg-muted/40 text-muted-foreground/50 line-through decoration-muted-foreground/30"
			}`}
		>
			<Icon className="h-3.5 w-3.5 shrink-0" />
			<span className="truncate">{label}</span>
		</div>
	);
}

/**
 * `serverData` expose les dates en `Date` (entités revifiées, normalisées par la
 * lib) ou en string ISO (après hydratation SSR où les `Date` JSON sont sérialisées).
 * On gère Date + string ISO — sans heuristique epoch.
 */
function toDate(value: unknown): Date | null {
	if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
	if (typeof value === "string" && value.trim().length > 0) {
		const date = new Date(value.trim());
		return Number.isNaN(date.getTime()) ? null : date;
	}
	return null;
}

/** Placeholder déterministe (SSR-safe) : initiales sur fond coloré par hash. */
function getPoiImage(seed: string) {
	const text = (seed || "POI").trim().slice(0, 2).toUpperCase();
	const colors = ["#60a5fa", "#34d399", "#f97316", "#ef4444", "#a78bfa", "#f59e0b"];
	const hash = (seed || "").split("").reduce((s, c) => s + c.charCodeAt(0), 0);
	const color = colors[Math.abs(hash) % colors.length];
	const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='112' height='112' viewBox='0 0 112 112'><rect width='112' height='112' fill='${color}' rx='56'/><text x='50%' y='50%' dominant-baseline='central' text-anchor='middle' font-size='40' font-family='Arial, Helvetica, sans-serif' fill='white'>${text}</text></svg>`;
	return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export default function CardPoiAmenities({ item, onClick, card }: SearchCardProps) {
	useLoadNamespace("modules/search");
	const t = useT("modules/search");
	const instFilter = useInstallationFilter(card?.installationFilter);

	// La variante `poi-ssbe` n'est routée que pour des POI (registry `SearchCard`),
	// mais le switch runtime passe un `SearchEntity` → on narrow vers `Poi`.
	// `serverData` est alors typé (PoiItemNormalized) : champs de base typés, champs
	// costum (equip_*/inst_*) via l'index signature → lus sans cast `Record`.
	const serverData = (item as Poi).serverData;

	const name = serverData.name ?? "";
	const categorie =
		(serverData.equip_type_name as string | undefined) ||
		(serverData.categorie as string | undefined) ||
		(serverData.equip_type_famille as string | undefined) ||
		"";
	const installation = serverData.inst_nom as string | undefined;
	// On AFFICHE le libellé mais on FILTRE sur l'identifiant stable (cf.
	// `installationFilter.ts`). Absent en base sur quelques POI → texte simple.
	const instValueRaw = card?.installationFilter
		? serverData[card.installationFilter.groupKey ?? "inst_numero"]
		: undefined;
	const instValue =
		typeof instValueRaw === "string" && instValueRaw.trim() ? instValueRaw.trim() : undefined;
	const instClickable = instFilter.enabled && Boolean(instValue);

	const imageSrc =
		serverData.profilMediumImageUrl ||
		serverData.profilThumbImageUrl ||
		serverData.profilImageUrl ||
		(serverData.profileImageUrl as string | undefined) ||
		(serverData.image as string | undefined) ||
		getPoiImage(categorie || name);

	const streetAddress = serverData.address?.streetAddress;
	const cityLine = [serverData.address?.postalCode, serverData.address?.addressLocality]
		.filter(Boolean)
		.join(" ");

	const createdDate = toDate(serverData.inst_date_creation ?? serverData.created);
	const formattedDate = createdDate
		? format(createdDate, "d MMMM yyyy", { locale: getDateFnsLocale() })
		: null;
	const yearsSinceCreation = createdDate
		? new Date().getFullYear() - createdDate.getFullYear()
		: null;

	return (
		<Card
			onClick={onClick}
			className="flex h-full cursor-pointer flex-col overflow-hidden border-l-4 transition-shadow hover:shadow-md"
			style={{ borderLeftColor: "var(--card-border-left)" }}
		>
			<CardHeader className="space-y-2 pb-3">
				<div className="flex items-start gap-3">
					<div className="relative shrink-0">
						<OptimizedImage
							src={imageSrc}
							alt={categorie || name}
							width={56}
							height={56}
							className="h-14 w-14 rounded-full object-cover ring-2 ring-primary/20 shadow-sm"
						/>
					</div>
					<div className="min-w-0 flex-1">
						<h3 className="truncate text-base font-semibold leading-tight text-foreground">
							{name}
						</h3>
						<div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
							<Tag className="h-3 w-3" />
							<span className="truncate">{categorie}</span>
						</div>
					</div>
				</div>

				{installation && (
					<div className="flex items-center gap-1.5 text-xs text-muted-foreground">
						<Building2 className="h-3.5 w-3.5 shrink-0" />
						{instClickable ? (
							// stopPropagation : la <Card> parente porte onClick (ouvre le détail).
							<button
								type="button"
								onClick={(e) => {
									e.stopPropagation();
									instFilter.toggle(instValue!);
								}}
								aria-pressed={instFilter.isActive(instValue!)}
								aria-label={t("CardPoiAmenities.filterByInstallation", undefined, {
									name: installation,
								})}
								className={cn(
									"truncate underline-offset-2 hover:underline focus-visible:underline",
									instFilter.isActive(instValue!) && "font-medium text-primary",
								)}
							>
								{installation}
							</button>
						) : (
							<span className="truncate">{installation}</span>
						)}
					</div>
				)}
			</CardHeader>

			<Separator />

			<CardContent className="flex flex-1 flex-col gap-4">
				<div className="flex gap-2.5 rounded-md bg-primary/5 p-2.5">
					<MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
					<div className="min-w-0 flex-1 space-y-0.5 text-xs">
						{streetAddress && <p className="font-medium text-foreground">{streetAddress}</p>}
						{cityLine && <p className="text-muted-foreground">{cityLine}</p>}
					</div>
				</div>

				<div>
					<p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
						{t("CardPoiAmenities.amenities")}
					</p>
					<div className="grid grid-cols-2 gap-1.5">
						<Feature label={t("CardPoiAmenities.pmrAccess")} active={isTrue(serverData.inst_acc_handi_bool)} Icon={Accessibility} />
						<Feature label={t("CardPoiAmenities.publicTransport")} active={isTrue(serverData.inst_trans_bool)} Icon={Bus} />
						<Feature label={t("CardPoiAmenities.lighting")} active={isTrue(serverData.equip_eclair)} Icon={Lightbulb} />
						<Feature label={t("CardPoiAmenities.showers")} active={isTrue(serverData.equip_douche)} Icon={Droplet} />
						<Feature label={t("CardPoiAmenities.freeAccess")} active={isTrue(serverData.equip_acc_libre)} Icon={DoorOpen} />
					</div>
				</div>

				{formattedDate && (
					<div className="mt-auto flex items-center justify-between border-t border-border pt-3 text-xs text-muted-foreground">
						<div className="flex items-center gap-1.5">
							<Calendar className="h-3.5 w-3.5" />
							<span>{formattedDate}</span>
						</div>
						{yearsSinceCreation !== null && yearsSinceCreation > 0 && (
							<span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium">
								{t("CardPoiAmenities.yearsAgo", undefined, { count: yearsSinceCreation })}
							</span>
						)}
					</div>
				)}
			</CardContent>
		</Card>
	);
}
