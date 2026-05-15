import { Building2, FileText, User, UserPlus } from "lucide-react";
import { useReactiveProperty } from "@/hooks/useReactiveProperty";
import { useFormatProfileEntity } from "../../../hooks/useFormatProfileEntity";
import { useProfileSetup } from "../../../hooks/useProfileSetup";
import type { ProfileSsbeAboutSection } from "../../../schema";

interface ProfileSsbeAboutProps {
	section: ProfileSsbeAboutSection;
}

function toText(value: unknown): string | null {
	if (typeof value !== "string") return null;
	const trimmed = value.trim();
	return trimmed.length > 0 ? trimmed : null;
}

function firstNonEmpty(...values: Array<string | null | undefined>): string | null {
	for (const value of values) {
		if (value && value.trim().length > 0) {
			return value;
		}
	}
	return null;
}

function toBoolean(value: unknown): boolean {
	if (typeof value === "boolean") return value;
	if (typeof value === "string") {
		const normalized = value.trim().toLowerCase();
		return normalized === "true" || normalized === "1" || normalized === "yes" || normalized === "oui";
	}
	if (typeof value === "number") return value === 1;
	return false;
}

function toStringArray(value: unknown): string[] {
	if (Array.isArray(value)) {
		return value
			.map((item) => toText(item))
			.filter((item): item is string => item !== null);
	}

	const textValue = toText(value);
	if (!textValue) return [];

	if (textValue.includes(",")) {
		return textValue
			.split(",")
			.map((item) => item.trim())
			.filter((item) => item.length > 0);
	}

	return [textValue];
}

function SectionCard({
	icon: Icon,
	title,
	children,
}: {
	icon: React.ElementType;
	title: string;
	children: React.ReactNode;
}) {
	return (
		<div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
			<div
				className="flex items-center justify-between px-4 py-2.5"
				style={{ background: "var(--card-header-gradient)" }}
			>
				<div className="flex items-center gap-2 text-primary-foreground font-semibold text-sm">
					<Icon className="w-4 h-4" />
					{title}
				</div>
			</div>
			<div className="px-5 py-4">{children}</div>
		</div>
	);
}

function Field({
	label,
	value,
	valueClassName = "text-foreground",
}: {
	label: string;
	value: React.ReactNode;
	valueClassName?: string;
}) {
	return (
		<div className="space-y-1">
			<p className="text-xs font-semibold text-primary uppercase tracking-wide">{label}</p>
			<p className={`text-sm ${valueClassName}`}>{value}</p>
		</div>
	);
}

export default function ProfileSsbeAbout({ section }: ProfileSsbeAboutProps) {
	const { entity } = useProfileSetup();
	const { name, description, shortDescription, email, mobile, tags } = useFormatProfileEntity(entity);

	const statusActor = useReactiveProperty<string>(entity.serverData, "statusActor");
	const sigle = useReactiveProperty<string>(entity.serverData, "sigle");
	const affiliate = useReactiveProperty<unknown>(entity.serverData, "affiliate");
	const affiliateTo = useReactiveProperty<string>(entity.serverData, "affiliateTo");
	const legalStatus = useReactiveProperty<string>(entity.serverData, "legalStatus");
	const thematic = useReactiveProperty<unknown>(entity.serverData, "thematic");

	const representativeTitle = useReactiveProperty<string>(entity.serverData, "representativeTitle");
	const otherRepresentativeTitle = useReactiveProperty<string>(entity.serverData, "otherRepresentativeTitle");
	const representativeCivility = useReactiveProperty<string>(entity.serverData, "representativeCivility");
	const representativeFirstName = useReactiveProperty<string>(entity.serverData, "representativeFirstName");
	const representativeName = useReactiveProperty<string>(entity.serverData, "representativeName");
	const representativeEmail = useReactiveProperty<string>(entity.serverData, "representativeEmail");
	const representativeTelephone = useReactiveProperty<string>(entity.serverData, "representativeTelephone");

	const responsableSameAsRepresent = useReactiveProperty<unknown>(entity.serverData, "responsableSameAsRepresent");
	const personInChargeTitle = useReactiveProperty<string>(entity.serverData, "personInChargeTitle");
	const otherPersonInChargeTitle = useReactiveProperty<string>(entity.serverData, "otherPersonInChargeTitle");
	const personInChargeCivility = useReactiveProperty<string>(entity.serverData, "personInChargeCivility");
	const personInChargeFirstName = useReactiveProperty<string>(entity.serverData, "personInChargeFirstName");
	const personInChargeName = useReactiveProperty<string>(entity.serverData, "personInChargeName");
	const personInChargeEmail = useReactiveProperty<string>(entity.serverData, "personInChargeEmail");
	const personInChargeTelephone = useReactiveProperty<string>(entity.serverData, "personInChargeTelephone");

	const serverData = entity.serverData as Record<string, unknown>;
	const representativeObj = serverData.representative as Record<string, unknown> | undefined;
	const responsibleObj = serverData.responsable as Record<string, unknown> | undefined;

	const descriptionText = firstNonEmpty(description, shortDescription, "Non renseigne");
	const nameWithSigle = firstNonEmpty(name, toText(serverData.name), "Non renseigne");
	const displayName = sigle ? `${nameWithSigle} (${sigle})` : nameWithSigle;
	const statusText = firstNonEmpty(statusActor, "Non renseigne");
	const affiliateText = toBoolean(affiliate) ? "Oui" : "Non";
	const affiliateToText = firstNonEmpty(affiliateTo, "Non renseigne");
	const legalStatusText = firstNonEmpty(legalStatus, "Non renseigne");
	const thematicValues = toStringArray(thematic);
	const domains = thematicValues.length > 0 ? thematicValues.join(", ") : tags.length > 0 ? tags.join(", ") : "Non renseigne";

	const representativeDisplayName = firstNonEmpty(
		[representativeCivility, representativeFirstName, representativeName].filter(Boolean).join(" ").trim(),
		representativeName,
		toText(representativeObj?.name),
		"Non renseigne",
	);
	const representativeDisplayTitle = firstNonEmpty(otherRepresentativeTitle, representativeTitle, "Non renseigne");
	const representativeDisplayEmail = firstNonEmpty(
		representativeEmail,
		toText(representativeObj?.email),
		email,
		"Non renseigne",
	);
	const representativeDisplayPhone = firstNonEmpty(
		representativeTelephone,
		toText(representativeObj?.phone),
		mobile,
		"Non renseigne",
	);

	const responsibleSameAsRepresentative = toBoolean(responsableSameAsRepresent);
	const responsibleDisplayTitle = responsibleSameAsRepresentative
		? representativeDisplayTitle
		: firstNonEmpty(otherPersonInChargeTitle, personInChargeTitle, "Non renseigne");

	const responsibleDisplayName = responsibleSameAsRepresentative
		? representativeDisplayName
		: firstNonEmpty(
			[personInChargeCivility, personInChargeFirstName, personInChargeName].filter(Boolean).join(" ").trim(),
			personInChargeName,
			toText(responsibleObj?.name),
			representativeDisplayName,
			"Non renseigne",
		);
	const responsibleDisplayEmail = responsibleSameAsRepresentative
		? representativeDisplayEmail
		: firstNonEmpty(personInChargeEmail, toText(responsibleObj?.email), representativeDisplayEmail, "Non renseigne");
	const responsibleDisplayPhone = responsibleSameAsRepresentative
		? representativeDisplayPhone
		: firstNonEmpty(personInChargeTelephone, toText(responsibleObj?.phone), representativeDisplayPhone, "Non renseigne");

	if (section.hidden === true) {
		return null;
	}

	return (
		<div className="space-y-5 mb-6">
			<SectionCard icon={FileText} title="Description">
				<p className="text-sm italic text-muted-foreground">{descriptionText}</p>
			</SectionCard>

			<SectionCard icon={Building2} title="Informations Generales">
				<div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-5">
					<Field label="Nom" value={displayName} />
					<Field
						label="Statut"
						value={
							<span className="inline-flex items-center rounded-full bg-secondary px-2.5 py-0.5 text-xs font-semibold text-secondary-foreground">
								{statusText}
							</span>
						}
					/>
					<Field label="Affilie" value={affiliateText} />
					<Field label="Affilie a" value={affiliateToText} />
					<Field label="Statut juridique" value={legalStatusText} />
					<Field label="Domaines" value={domains} />
				</div>
			</SectionCard>

			<div className="grid grid-cols-1 md:grid-cols-2 gap-5">
				<SectionCard icon={User} title="Representant">
					<div className="space-y-4">
						<Field label="Titre" value={representativeDisplayTitle} />
						<Field label="Nom" value={representativeDisplayName} />
						<Field
							label="Email"
							value={
								representativeDisplayEmail !== "Non renseigne" ? (
									<a href={`mailto:${representativeDisplayEmail}`} className="text-accent hover:underline break-all">
										{representativeDisplayEmail}
									</a>
								) : (
									representativeDisplayEmail
								)
							}
						/>
						<Field label="Telephone" value={representativeDisplayPhone} />
					</div>
				</SectionCard>

				<SectionCard icon={UserPlus} title="Responsable">
					<div className="space-y-4">
						<Field label="Titre" value={responsibleDisplayTitle} />
						<Field label="Nom" value={responsibleDisplayName} />
						<Field
							label="Email"
							value={
								responsibleDisplayEmail !== "Non renseigne" ? (
									<a href={`mailto:${responsibleDisplayEmail}`} className="text-accent hover:underline break-all">
										{responsibleDisplayEmail}
									</a>
								) : (
									responsibleDisplayEmail
								)
							}
						/>
						<Field label="Telephone" value={responsibleDisplayPhone} />
					</div>
				</SectionCard>
			</div>
		</div>
	);
}
