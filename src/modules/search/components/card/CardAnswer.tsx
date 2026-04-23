import { MouseEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import { Building2, Calendar, ChevronDown, ChevronUp, FileText, Mail, MapPin, User } from "lucide-react";
import { SearchCardProps } from "../../schema";
import { useCocolight } from "@/hooks/useCocolight";
import { useNavigate } from "react-router";

type ActivityStatus = "Valide" | "En attente" | "En cours" | "Refuse";

type Schedule = {
	day: string;
	times: string[];
};

type StructureData = {
	name: string;
	email: string;
	imageUrl?: string;
	slug?: string;
};

function normalizeStatus(rawStatus: string): ActivityStatus {
	if (rawStatus === "En attente" || rawStatus === "En cours") {
		return rawStatus;
	}
	if (rawStatus === "Refuse" || rawStatus === "Réfusé") {
		return "Refuse";
	}
	return "Valide";
}

function getStatusStyle(status: ActivityStatus) {
	switch (status) {
		case "Valide":
			return "bg-badge-valid text-primary-foreground";
		case "En attente":
			return "bg-badge-waiting text-primary-foreground";
		case "En cours":
			return "bg-badge-in-progress text-primary-foreground";
		case "Refuse":
			return "bg-badge-refused text-primary-foreground";
		default:
			return "bg-badge-valid text-primary-foreground";
	}
}

function normalizeTypeLabel(rawType: string): string {
	switch (rawType) {
		case "Sport santé sur ordonnance - SSsO":
			return "SSsO";
		case "Sport santé pour tous - SSpT":
			return "SSpT";
		default:
			return rawType;
	}
}

function translateDayToFrench(day: string): string {
	const dayMap: Record<string, string> = {
		monday: "Lundi",
		tuesday: "Mardi",
		wednesday: "Mercredi",
		thursday: "Jeudi",
		friday: "Vendredi",
		saturday: "Samedi",
		sunday: "Dimanche"
	};

	return dayMap[day.trim().toLowerCase()] ?? day;
}
export default function CardAnswer({ item, onClick }: SearchCardProps) {
	const [showAllSchedules, setShowAllSchedules] = useState(false);
	const navigate = useNavigate();
	const serverData = item?.serverData as Record<string, unknown> | undefined;
    const { entity } = useCocolight();
    const slug = entity?.serverData?.slug;

	const handleOpenActivityDetails = (event: MouseEvent<HTMLButtonElement>) => {
		event.stopPropagation();

		if (typeof onClick === "function") {
			onClick();
			return;
		}

		window.dispatchEvent(new CustomEvent("openDetails", { detail: item }));
	};
	
	const keyPrefix = slug ?? "sportSanteBienetre";
	const fieldKey = (suffix: string) => `${keyPrefix}${suffix}`;
	
	const title = (serverData?.name as string | undefined)
		?? (serverData?.[fieldKey("2172025_854_0mdegc9sgox76p87n27")] as string | undefined)
		?? "(Pas de titre)";

	const addr = serverData?.address as Record<string, unknown> | undefined;
	const addressStr = [addr?.streetAddress, addr?.postalCode, addr?.addressLocality]
		.filter(Boolean)
		.join(" ");

	const description = (serverData?.[fieldKey("2172025_854_0mdeggo91owe8t9ovl4p")] as string | undefined)
		?? "(Pas de description)";
	const typeRaw = (serverData?.sportSanteBienetre2172025_854_0mdn1cs8on3yru1p80lq as string | undefined) ?? "";
	const type = normalizeTypeLabel(typeRaw);
	const stateRaw = (serverData?.[fieldKey("2172025_854_0mdn1jcq445i0mb9bap7")] as string | undefined) ?? "";
	const status = normalizeStatus(stateRaw);
	const statusStyle = getStatusStyle(status);

	const instructorFirstName =
		(serverData?.[fieldKey("2172025_854_0mdmz5fbxxtvelsircg9")] as string | undefined) ?? "";
	const instructorLastName =
		(serverData?.[fieldKey("2172025_854_0mdmz4qoaelvlcpten8w")] as string | undefined) ?? "";

	const scheduleRaw = (serverData?.[fieldKey("2172025_854_0mdefmehl5baa207uud6")] as unknown[]) ?? [];
	const groupedSchedules: Record<string, string[]> = {};

	scheduleRaw.forEach((entry) => {
		const slot = entry as Record<string, unknown>;
		const day = typeof slot.day === "string" ? translateDayToFrench(slot.day) : "";
		if (!day) return;

		const startHour = String(slot.startHour ?? "");
		const startMinute = String(slot.startMinute ?? "");
		const endHour = String(slot.endHour ?? "");
		const endMinute = String(slot.endMinute ?? "");
		const timeRange = `${startHour}H${startMinute} - ${endHour}H${endMinute}`;

		if (!groupedSchedules[day]) {
			groupedSchedules[day] = [];
		}
		groupedSchedules[day].push(timeRange);
	});

	const schedules: Schedule[] = Object.entries(groupedSchedules).map(([day, times]) => ({ day, times }));
	const MAX_VISIBLE_SCHEDULES = 2;
	const hasMoreSchedules = schedules.length > MAX_VISIBLE_SCHEDULES;
	const visibleSchedules = showAllSchedules ? schedules : schedules.slice(0, MAX_VISIBLE_SCHEDULES);

	const structureRaw = serverData?.structure as Record<string, unknown> | undefined;
	const structure: StructureData = {
		name: (structureRaw?.name as string | undefined) ?? "(Pas de nom)",
		email: (structureRaw?.email as string | undefined) ?? "",
		imageUrl: structureRaw?.profilImageUrl as string | undefined,
		slug: structureRaw?.slug as string | undefined,
	};
	return (
		<article
			onClick={onClick}
			className="rounded-xl bg-card shadow-md border border-border overflow-hidden transition-shadow hover:shadow-lg cursor-pointer"
		>
			<div
				className="px-5 py-4 flex items-center justify-between gap-3"
				style={{ background: "var(--card-header-gradient)" }}
			>
				<h2 className="text-sm font-bold tracking-wide uppercase text-primary-foreground line-clamp-2">
					{title}
					{schedules.length > 0 && (
						<Calendar className="inline-block ml-2 w-4 h-4 opacity-80" />
					)}
				</h2>

				<div className="flex items-center gap-2 shrink-0">
					{type && (
						<span className="rounded-full bg-badge-type px-3 py-0.5 text-xs font-semibold text-primary-foreground">
							{type}
						</span>
					)}
					<span className={`rounded-full px-3 py-0.5 text-xs font-semibold ${statusStyle}`}>
						{stateRaw || "Validé"}
					</span>
				</div>
			</div>

			<div className="px-5 py-4 space-y-3 border-l-4 border-card-border-left">
				<p className="text-sm text-muted-foreground leading-relaxed line-clamp-3">
					{description}
				</p>

				{(instructorFirstName || instructorLastName) && (
					<div className="flex items-center gap-2 text-sm font-medium text-foreground">
						<User className="w-4 h-4 text-primary" />
						<span>
							Par : {instructorFirstName} {instructorLastName}
						</span>
					</div>
				)}

				{addressStr && (
					<div className="flex items-start gap-2 text-sm text-muted-foreground">
						<MapPin className="w-4 h-4 mt-0.5 text-primary shrink-0" />
						<span className="line-clamp-2">{addressStr}</span>
					</div>
				)}

				{schedules.length > 0 && (
					<div className="space-y-2">
						<div className="flex flex-wrap gap-2">
							{visibleSchedules.map((schedule) => (
								<span
									key={schedule.day}
									className="inline-flex items-center gap-1.5 rounded-full bg-schedule-tag-bg px-3 py-1 text-xs font-medium text-schedule-tag-fg border border-border"
								>
									<Calendar className="w-3.5 h-3.5" />
									{schedule.day} {schedule.times.join(" / ")}
								</span>
							))}
						</div>

						{hasMoreSchedules && (
							<button
								type="button"
								onClick={(event) => {
									event.stopPropagation();
									setShowAllSchedules((value) => !value);
								}}
								className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
							>
								{showAllSchedules ? (
									<>
										Voir moins <ChevronUp className="w-3.5 h-3.5" />
									</>
								) : (
									<>
										+{schedules.length - MAX_VISIBLE_SCHEDULES} créneaux <ChevronDown className="w-3.5 h-3.5" />
									</>
								)}
							</button>
						)}
					</div>
				)}

			</div>

			<div className="px-5 py-4 border-t border-border flex flex-col gap-4">
				<div className="flex items-center gap-3">
					<div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center overflow-hidden">
						{structure.imageUrl ? (
							<img
								src={structure.imageUrl}
								alt={structure.name}
								className="w-full h-full object-cover"
							/>
						) : (
							<Building2 className="w-5 h-5 text-muted-foreground" />
						)}
					</div>
					<div className="min-w-0">
						<p className="text-sm font-semibold text-foreground uppercase truncate">
							{structure.name}
						</p>
						{structure.email && (
							<p className="text-xs text-muted-foreground flex items-center gap-1 truncate">
								<Mail className="w-3 h-3 shrink-0" />
								{structure.email}
							</p>
						)}
					</div>
				</div>

				<div className="flex flex-wrap gap-2 justify-center w-full">
					<Button
						className="inline-flex items-center gap-1.5 rounded-md bg-btn-activity px-4 py-2 text-xs font-semibold text-primary-foreground transition-colors hover:opacity-90"
						onClick={handleOpenActivityDetails}
					>
						<FileText className="w-3.5 h-3.5" />
						Fiche d'activité
					</Button>

					<Button
						variant="secondary"
						className="inline-flex items-center gap-1.5 rounded-md bg-btn-structure px-4 py-2 text-xs font-semibold text-primary-foreground transition-colors hover:opacity-90"
						onClick={(event) => {
							event.stopPropagation();
							if (structure.slug) {
								navigate(`/profil/${structure.slug}`);
							}
						}}
					>
						<Building2 className="w-3.5 h-3.5" />
						Fiche structure
					</Button>
				</div>
			</div>
		</article>
	);
}
