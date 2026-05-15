import {
	MapPin,
	Calendar,
	CheckCircle2,
	Building2,
	Accessibility,
	Bus,
	Shield,
	UtensilsCrossed,
	BedDouble,
	Tag,
} from "lucide-react";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

import { SearchCardProps } from "../../schema";

interface Poi {
	name: string;
	category: string;
	installation?: string;
	familleEquipement?: string;
	enqueteStatut?: string;
	dateCreation?: string;
	address: {
		streetAddress?: string;
		postalCode?: string;
		addressLocality?: string;
	};
	handicap?: string;
	transportCommun?: string;
	hebergement?: string;
	restaurant?: string;
	gardiennage?: string;
}

const isTrue = (v?: string) => {
	if (!v) return false;
	const normalized = v.trim().toLowerCase();
	return normalized === "true" || normalized === "1";
};

function formatDateFr(dateStr?: string): string | null {
	if (!dateStr) return null;
	const d = new Date(dateStr);
	if (Number.isNaN(d.getTime())) return null;

	return d.toLocaleDateString("fr-FR", {
		day: "numeric",
		month: "long",
		year: "numeric",
	});
}

function yearsAgo(dateStr?: string): number | null {
	if (!dateStr) return null;
	const d = new Date(dateStr);
	if (Number.isNaN(d.getTime())) return null;
	return new Date().getFullYear() - d.getFullYear();
}

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
					? "border-primary/20 bg-teal-light text-primary"
					: "border-border bg-muted/40 text-muted-foreground/50 line-through decoration-muted-foreground/30"
			}`}
		>
			<Icon className="h-3.5 w-3.5 shrink-0" />
			<span className="truncate">{label}</span>
		</div>
	);
}

function toStringValue(value: unknown): string | undefined {
	if (typeof value === "string") return value;
	if (typeof value === "number" || typeof value === "boolean") {
		return String(value);
	}
	if (value instanceof Date) {
		return value.toISOString();
	}
	if (value && typeof value === "object") {
		const localized = value as Record<string, unknown>;
		const preferred = localized.fr ?? localized.en;
		if (typeof preferred === "string") return preferred;
	}
	return undefined;
}

function toPoi(item: SearchCardProps["item"]): Poi {
	const entityData = ((item ?? {}) as unknown) as Record<string, unknown>;
	const serverData = (item?.serverData ?? {}) as Record<string, unknown>;
	const address =
		((serverData.address ?? entityData.address) as
			| Record<string, unknown>
			| undefined) ?? {};

	return {
		name: toStringValue(serverData.name ?? entityData.name) ?? "",
		category:
			toStringValue(serverData.category ?? entityData.category) ??
			toStringValue(
				serverData.familleEquipement ?? entityData.familleEquipement,
			) ??
			"",
		installation: toStringValue(
			serverData.installation ?? entityData.installation,
		),
		familleEquipement: toStringValue(
			serverData.familleEquipement ?? entityData.familleEquipement,
		),
		enqueteStatut: toStringValue(
			serverData.enqueteStatut ?? entityData.enqueteStatut,
		),
		dateCreation: toStringValue(
			serverData.dateCreation ??
				entityData.dateCreation ??
				serverData.created ??
				entityData.created,
		),
		address: {
			streetAddress: toStringValue(address.streetAddress),
			postalCode: toStringValue(address.postalCode),
			addressLocality: toStringValue(address.addressLocality),
		},
		handicap: toStringValue(serverData.handicap ?? entityData.handicap),
		transportCommun: toStringValue(
			serverData.transportCommun ?? entityData.transportCommun,
		),
		hebergement: toStringValue(serverData.hebergement ?? entityData.hebergement),
		restaurant: toStringValue(serverData.restaurant ?? entityData.restaurant),
		gardiennage: toStringValue(serverData.gardiennage ?? entityData.gardiennage),
	};
}

export default function CardPoiSSBE({ item, onClick }: SearchCardProps) {
	const poi = toPoi(item);

	const formattedDate = formatDateFr(poi.dateCreation);
	const yearsSinceCreation = yearsAgo(poi.dateCreation);

	const cityLine = [poi.address.postalCode, poi.address.addressLocality]
		.filter(Boolean)
		.join(" ");

	function getPoiImage(category?: string, name?: string) {
		const text = (category || name || "POI").trim().slice(0, 2).toUpperCase();
		const colors = ["#60a5fa", "#34d399", "#f97316", "#ef4444", "#a78bfa", "#f59e0b"];
		const hash = (category || name || "").split("").reduce((s, c) => s + c.charCodeAt(0), 0);
		const color = colors[Math.abs(hash) % colors.length];
		const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='112' height='112' viewBox='0 0 112 112'><rect width='112' height='112' fill='${color}' rx='56'/><text x='50%' y='50%' dominant-baseline='central' text-anchor='middle' font-size='40' font-family='Arial, Helvetica, sans-serif' fill='white'>${text}</text></svg>`;
		return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
	}

	const serverData = (item?.serverData ?? {}) as Record<string, unknown>;
	const serverImage = toStringValue(
		(serverData.profilImageUrl as unknown) ?? (serverData.profileImageUrl as unknown) ?? (serverData.image as unknown),
	);
	const imageSrc = serverImage ?? getPoiImage(poi.category, poi.name);

	return (
		<Card
			onClick={onClick}
			className="flex h-full cursor-pointer flex-col overflow-hidden border-l-4 transition-shadow hover:shadow-md"
			style={{ borderLeftColor: "var(--card-border-left)" }}
		>
			<CardHeader className="space-y-2 pb-3">
				<div className="flex items-start gap-3">
					<div className="relative shrink-0">
						<img
							src={imageSrc}
							alt={poi.category || poi.name}
							loading="lazy"
							width={56}
							height={56}
							className="h-14 w-14 rounded-full object-cover ring-2 ring-primary/20 shadow-sm"
						/>
					</div>
					<div className="min-w-0 flex-1">
						<h3 className="truncate text-base font-semibold leading-tight text-foreground">
							{poi.name}
						</h3>
						<div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
							<Tag className="h-3 w-3" />
							<span className="truncate">{poi.category}</span>
						</div>
					</div>
					{poi.enqueteStatut === "Validé" && (
						<Badge
							variant="secondary"
							className="shrink-0 gap-1 bg-success-light text-success"
							style={{ color: "var(--badge-valid)" }}
						>
							<CheckCircle2 className="h-3 w-3" />
							Validé
						</Badge>
					)}
				</div>

				{poi.installation && (
					<div className="flex items-center gap-1.5 text-xs text-muted-foreground">
						<Building2 className="h-3.5 w-3.5 shrink-0" />
						<span className="truncate">{poi.installation}</span>
					</div>
				)}
			</CardHeader>

			<Separator />

			<CardContent className="flex flex-1 flex-col gap-4">
				<div className="flex gap-2.5 rounded-md bg-teal-light/60 p-2.5">
					<MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
					<div className="min-w-0 flex-1 space-y-0.5 text-xs">
						{poi.address.streetAddress && (
							<p className="font-medium text-foreground">
								{poi.address.streetAddress}
							</p>
						)}
						{cityLine && <p className="text-muted-foreground">{cityLine}</p>}
					</div>
				</div>

				<div>
					<p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
						Sur place
					</p>
					<div className="grid grid-cols-2 gap-1.5">
						<Feature
							label="Accès PMR"
							active={isTrue(poi.handicap)}
							Icon={Accessibility}
						/>
						<Feature
							label="Bus"
							active={isTrue(poi.transportCommun)}
							Icon={Bus}
						/>
						<Feature
							label="Restaurant"
							active={isTrue(poi.restaurant)}
							Icon={UtensilsCrossed}
						/>
						<Feature
							label="Hébergement"
							active={isTrue(poi.hebergement)}
							Icon={BedDouble}
						/>
						<Feature
							label="Gardiennage"
							active={isTrue(poi.gardiennage)}
							Icon={Shield}
						/>
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
								Il y a {yearsSinceCreation} ans
							</span>
						)}
					</div>
				)}
			</CardContent>
		</Card>
	);
}
