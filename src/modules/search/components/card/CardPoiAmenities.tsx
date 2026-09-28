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
import { toValidDate } from "@/helpers/formatDate";
import { isTrue } from "../../lib/poiAmenities";
import { SearchCardProps } from "../../schema";

function Feature({
	label,
	active,
	Icon,
	compact,
}: {
	label: string;
	active: boolean;
	Icon: typeof Accessibility;
	compact?: boolean;
}) {
	return (
		<div
			className={cn(
				"flex items-center gap-1.5 rounded-md border transition-colors",
				compact ? "px-1.5 py-0.5 text-[11px]" : "px-2 py-1.5 text-xs",
				active
					? "border-primary/20 bg-primary/10 text-primary"
					: "border-border bg-muted/40 text-muted-foreground/50 line-through decoration-muted-foreground/30",
			)}
		>
			<Icon className={cn("shrink-0", compact ? "h-3 w-3" : "h-3.5 w-3.5")} />
			<span className="truncate">{label}</span>
		</div>
	);
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
	// Densité (`card.compact`) : MÊMES informations, moins de hauteur — vignette,
	// interlignes et puces réduits. Pensé pour une colonne étroite (liste
	// latérale d'un split) ; rien n'est masqué, une carte dense reste lisible.
	const compact = card?.compact === true;

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

	const createdDate = toValidDate(serverData.inst_date_creation ?? serverData.created);
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
			<CardHeader className={cn(compact ? "space-y-1.5 pb-2" : "space-y-2 pb-3")}>
				<div className={cn("flex items-start", compact ? "gap-2" : "gap-3")}>
					<div className="relative shrink-0">
						<OptimizedImage
							src={imageSrc}
							alt={categorie || name}
							width={compact ? 40 : 56}
							height={compact ? 40 : 56}
							className={cn(
								"rounded-full object-cover ring-2 ring-primary/20 shadow-sm",
								compact ? "h-10 w-10" : "h-14 w-14",
							)}
						/>
					</div>
					<div className="min-w-0 flex-1">
						<h3
							className={cn(
								"truncate font-semibold leading-tight text-foreground",
								compact ? "text-sm" : "text-base",
							)}
						>
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

			<CardContent className={cn("flex flex-1 flex-col", compact ? "gap-2" : "gap-4")}>
				<div
					className={cn(
						"flex rounded-md bg-primary/5",
						compact ? "gap-2 p-2" : "gap-2.5 p-2.5",
					)}
				>
					<MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
					<div className="min-w-0 flex-1 space-y-0.5 text-xs">
						{streetAddress && <p className="font-medium text-foreground">{streetAddress}</p>}
						{cityLine && <p className="text-muted-foreground">{cityLine}</p>}
					</div>
				</div>

				<div>
					<p
						className={cn(
							"text-[11px] font-semibold uppercase tracking-wider text-muted-foreground",
							compact ? "mb-1" : "mb-2",
						)}
					>
						{t("CardPoiAmenities.amenities")}
					</p>
					<div className={cn("grid grid-cols-2", compact ? "gap-1" : "gap-1.5")}>
						<Feature compact={compact} label={t("CardPoiAmenities.pmrAccess")} active={isTrue(serverData.inst_acc_handi_bool)} Icon={Accessibility} />
						<Feature compact={compact} label={t("CardPoiAmenities.publicTransport")} active={isTrue(serverData.inst_trans_bool)} Icon={Bus} />
						<Feature compact={compact} label={t("CardPoiAmenities.lighting")} active={isTrue(serverData.equip_eclair)} Icon={Lightbulb} />
						<Feature compact={compact} label={t("CardPoiAmenities.showers")} active={isTrue(serverData.equip_douche)} Icon={Droplet} />
						<Feature compact={compact} label={t("CardPoiAmenities.freeAccess")} active={isTrue(serverData.equip_acc_libre)} Icon={DoorOpen} />
					</div>
				</div>

				{formattedDate && (
					<div
						className={cn(
							"mt-auto flex items-center justify-between border-t border-border text-xs text-muted-foreground",
							compact ? "pt-2" : "pt-3",
						)}
					>
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
