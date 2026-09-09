import { MouseEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Building2, Calendar, ChevronDown, ChevronUp, FileText, Mail, MapPin, User } from "lucide-react";
import { SearchCardProps } from "../../schema";
import { useT } from "@/hooks/useT";
import { useLoadNamespace } from "@/hooks/useLoadNamespace";
import { parseCoformAnswer, getStatusStyle, isCoformAnswerManager } from "../../lib/coformAnswer";
import { useNavigate } from "react-router";
import { useEntityBySlugQuery } from "@/hooks/useEntityBySlugQuery";
import { useCocolight } from "@/hooks/useCocolight";
import { useHydrated } from "@/hooks/useHydrated";
import { SwitchDetailsMode } from "../SwitchDetailsMode";

export default function CardAnswer({ item, onClick, card }: SearchCardProps) {
	useLoadNamespace("modules/search");
	const t = useT("modules/search");
	const [showAllSchedules, setShowAllSchedules] = useState(false);
	const serverData = item?.serverData as Record<string, unknown> | undefined;


	const a = parseCoformAnswer(serverData ?? {});

	/**
	 * « Fiche structure » : navigation vers `/profil/:slug` (DÉFAUT, comportement historique) ou
	 * ouverture EN MODALE — au choix du site, via `card.structureAction.kind`.
	 *
	 * L'usager est en train de comparer des créneaux : l'envoyer sur une page de profil lui fait
	 * perdre sa liste, ses filtres et sa position de défilement, pour une information qu'il veut
	 * seulement consulter au passage. C'est exactement le geste que `/structure` offre déjà sur ses
	 * propres cartes (`preview.type: "structure"` en `dialog`) — on le rend DISPONIBLE ici, sans
	 * l'imposer : un site qui ne pose pas la clé garde exactement son comportement.
	 *
	 * La carte ne porte qu'un SOUS-DOCUMENT de la structure (nom, e-mail, image) : la fiche a besoin
	 * de l'entité complète. Elle n'est donc chargée QU'AU CLIC, et seulement en mode modale —
	 * une liste de 12 créneaux ne déclenche aucune requête tant que personne ne demande.
	 */
	const navigate = useNavigate();
	const enModale = card?.structureAction?.kind === "preview";
	const [ficheOuverte, setFicheOuverte] = useState(false);
	const { data: structure, isLoading: structureEnCours } = useEntityBySlugQuery({
		slug: enModale && ficheOuverte ? a.structure.slug : undefined,
	});

	/**
	 * QUI voit le bouton — `card.structureAction.audience` : absent/`all` (DÉFAUT côté code) =
	 * tout le monde, comportement historique ; `managers` = les gestionnaires du créneau
	 * (super-admin plateforme, admin du costum porteur, admin validé de la structure
	 * organisatrice DE CE créneau).
	 *
	 * MÊME prédicat que le bouton « Modifier » du détail, à dessein : la fiche structure est un
	 * outil de gestion (affiliation, représentant légal, documents), pas une information utile à
	 * qui compare des créneaux. Deux règles séparées dériveraient — cf. `isCoformAnswerManager`.
	 *
	 * ⚠️ Pertinence d'UI, PAS une frontière de sécurité : `/profil/:slug` et `/structure` restent
	 * des routes publiques, et le slug comme l'e-mail de la structure partent déjà dans le HTML
	 * servi à tout visiteur (l'e-mail est d'ailleurs affiché en clair juste au-dessus du bouton).
	 *
	 * ⚠️ `hydrated` est OBLIGATOIRE : `/creneaux` est prérendue côté serveur, où `me` vaut
	 * toujours `null`, alors que le 1er render client d'un gestionnaire a DÉJÀ son `me`. Sans la
	 * garde, le HTML serveur et le 1er render client divergeraient. Avec, les deux rendent « pas
	 * de bouton », qui apparaît après hydratation chez les seuls ayants droit — même patron que
	 * `useAdminAccess` / `useVisibility`.
	 *
	 * Le court-circuit garantit qu'un site NON opté-in ne dépend ni de `hydrated` ni de `me` :
	 * rendu strictement inchangé pour tout le parc.
	 */
	const { me, entity } = useCocolight();
	const hydrated = useHydrated();
	const reserveAuxGestionnaires = card?.structureAction?.audience === "managers";
	const voitFicheStructure =
		!reserveAuxGestionnaires || (hydrated && isCoformAnswerManager(serverData, { me, entity }));

	const ouvrirFicheStructure = (event: MouseEvent<HTMLButtonElement>) => {
		event.stopPropagation();
		// Garde au point d'entrée, pas au montage de la modale : démonter `SwitchDetailsMode`
		// sans remettre `ficheOuverte` à false désynchroniserait l'état et l'UI.
		if (!voitFicheStructure || !a.structure.slug) return;
		if (enModale) setFicheOuverte(true);
		else navigate(`/profil/${a.structure.slug}`);
	};

	const handleOpenActivityDetails = (event: MouseEvent<HTMLButtonElement>) => {
		event.stopPropagation();
		// Détail ouvert via le handler fourni par SearchCard/SearchListView.
		// (L'ancien fallback `dispatchEvent("openDetails")` n'a plus de listener
		//  depuis la migration MapLibre — SearchCard passe toujours `onClick`.)
		onClick?.();
	};

	const title = a.title ?? t("coformAnswer.noTitle");
	const description = a.description ?? t("coformAnswer.noDescription");
	const structureName = a.structure.name ?? t("coformAnswer.noName");

	const MAX_VISIBLE_SCHEDULES = 2;
	const hasMoreSchedules = a.schedules.length > MAX_VISIBLE_SCHEDULES;
	const visibleSchedules = showAllSchedules ? a.schedules : a.schedules.slice(0, MAX_VISIBLE_SCHEDULES);

	return (
		<article
			onClick={onClick}
			className={`rounded-xl bg-card shadow-md border border-border overflow-hidden transition-shadow hover:shadow-lg cursor-pointer ${a.typeLabel.toLowerCase()}-card`}
		>
			<div
				className="px-5 py-4 flex items-center justify-between gap-3 header-gradient"
				style={{ background: "var(--card-header-gradient)" }}
			>
				<h2 className="text-sm font-bold tracking-wide uppercase text-primary-foreground line-clamp-2">
					{title}
					{a.schedules.length > 0 && (
						<Calendar className="inline-block ml-2 w-4 h-4 opacity-80" />
					)}
				</h2>

				<div className="flex items-center gap-2 shrink-0">
					{a.typeLabel && (
						<Badge className="rounded-full border-0 bg-badge-type text-primary-foreground hover:bg-badge-type">
							{a.typeLabel}
						</Badge>
					)}
					<Badge className={`rounded-full border-0 ${getStatusStyle(a.status)}`}>
						{a.stateRaw || t("coformAnswer.validated")}
					</Badge>
				</div>
			</div>

			<div className="px-5 py-4 space-y-3 border-l-4 border-card-border-left">
				<p className="text-sm text-muted-foreground leading-relaxed line-clamp-3">
					{description}
				</p>

				{(a.instructorFirstName || a.instructorLastName) && (
					<div className="flex items-center gap-2 text-sm font-medium text-foreground">
						<User className="w-4 h-4 text-primary" />
						<span>
							{t("coformAnswer.by")} {a.instructorFirstName} {a.instructorLastName}
						</span>
					</div>
				)}

				{a.entityAddress && (
					<div className="flex items-start gap-2 text-sm text-muted-foreground">
						<MapPin className="w-4 h-4 mt-0.5 text-primary shrink-0" />
						<span className="line-clamp-2">{a.entityAddress}</span>
					</div>
				)}

				{a.schedules.length > 0 && (
					<div className="space-y-2">
						{/* Jour en libellé + une puce par plage (qui wrappe) : un jour à
						    plusieurs plages ne forme plus une pilule géante multi-lignes. */}
						<div className="space-y-1.5">
							{visibleSchedules.map((schedule) => (
								<div key={schedule.dayKey} className="flex flex-wrap items-center gap-1.5">
									<span className="inline-flex items-center gap-1 text-xs font-semibold text-foreground">
										<Calendar className="w-3.5 h-3.5 text-primary" />
										{t("days." + schedule.dayKey)}
									</span>
									{schedule.times.map((time, i) => (
										<span
											key={i}
											className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground border border-border"
										>
											{time}
										</span>
									))}
								</div>
							))}
						</div>

						{hasMoreSchedules && (
							<Button
								type="button"
								variant="ghost"
								size="sm"
								onClick={(event) => {
									event.stopPropagation();
									setShowAllSchedules((value) => !value);
								}}
								className="h-auto gap-1 px-0 py-0 text-xs font-medium text-primary hover:bg-transparent hover:underline"
							>
								{showAllSchedules ? (
									<>
										{t("coformAnswer.showLess")} <ChevronUp className="w-3.5 h-3.5" />
									</>
								) : (
									<>
										{t("coformAnswer.moreSlots", undefined, {
											count: a.schedules.length - MAX_VISIBLE_SCHEDULES,
										})}{" "}
										<ChevronDown className="w-3.5 h-3.5" />
									</>
								)}
							</Button>
						)}
					</div>
				)}
			</div>

			<div className="px-5 py-4 border-t border-border flex flex-col gap-4">
				<div className="flex items-center gap-3">
					<Avatar className="w-10 h-10">
						{a.structure.imageUrl && (
							<AvatarImage src={a.structure.imageUrl} alt={structureName} className="object-cover" />
						)}
						<AvatarFallback className="bg-muted">
							<Building2 className="w-5 h-5 text-muted-foreground" />
						</AvatarFallback>
					</Avatar>
					<div className="min-w-0">
						<p className="text-sm font-semibold text-foreground uppercase truncate">
							{structureName}
						</p>
						{a.structure.email && (
							<p className="text-xs text-muted-foreground flex items-center gap-1 truncate">
								<Mail className="w-3 h-3 shrink-0" />
								{a.structure.email}
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
						{t("coformAnswer.activitySheet")}
					</Button>

					{/* Masqué (et non `disabled`) hors audience : un bouton grisé inviterait à
					    demander un droit, là où la fiche n'a simplement rien à dire à l'usager. */}
					{voitFicheStructure && (
						<Button
							variant="secondary"
							className="inline-flex items-center gap-1.5 rounded-md bg-btn-structure px-4 py-2 text-xs font-semibold text-primary-foreground transition-colors hover:text-foreground"
							disabled={!a.structure.slug || structureEnCours}
							onClick={ouvrirFicheStructure}
						>
							<Building2 className="w-3.5 h-3.5" />
							{t("coformAnswer.structureSheet")}
						</Button>
					)}
				</div>
			</div>

			{/* Fiche structure en modale — même preview que les cartes de /structure. Montée
			    seulement une fois l'entité chargée : `SwitchDetailsMode` attend un item réel. */}
			{enModale && ficheOuverte && structure && (
				<SwitchDetailsMode
					openDetails={ficheOuverte}
					setOpenDetails={setFicheOuverte}
					item={structure as never}
					card={{ detailsMode: "dialog" }}
					preview={{ type: "structure" }}
				/>
			)}
		</article>
	);
}
