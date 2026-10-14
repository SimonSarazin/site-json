import { useEffect, useRef, useState } from "react";
import { useLoadNamespace } from "@/hooks/useLoadNamespace";
import { useT } from "@/hooks/useT";
import { Header } from "@/types/site-schema";
import { ChevronDown } from "lucide-react";
import HeaderLogo from "./HeaderLogo";
import { ClientOnly } from "../ClientOnly";
import NavLink from "../NavLink";
import LangSwitch from "./LangSwitch";
import MobileMenuSheet from "./MobileMenuSheet";
import MobileMenuBrand from "./MobileMenuBrand";
import MobileNavItems from "./MobileNavItems";
import NavIcon from "./NavIcon";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AuthMenu } from "@/modules/auth";
import ToggleButtonTheme from "@/components/layout/ToggleButtonTheme";
import NotificationBell from "@/modules/notification/components/NotificationBell";
import { useScrollToTopOnRouteChange, useNavItemActive } from "./useHeaderBehavior";
import { useVisibilityList } from "@/lib/visibility/useVisibility";
import { cn } from "@/lib/utils";

interface HeaderStackedProps {
  header: Header;
}

// La barre de ce header est TOUJOURS sombre (image + voile), quel que soit le
// mode clair/sombre du site : tout son chrome est donc en blanc fixe (nav,
// LangSwitch…). Ces classes alignent les boutons icône sur cette règle — leur
// style par défaut (`text-muted-foreground`, pensé pour des headers clairs)
// les rendait invisibles en mode CLAIR sur le fond sombre.
// Thème : icône seule → blanc fixe dans les deux modes (même teinte que LangSwitch).
const THEME_BTN = "text-white/90 hover:text-white hover:bg-white/10 dark:hover:bg-white/10";

/**
 * Header 2 étages sur fond image : un bandeau wordmark (logo + titre/sous-titre)
 * suivi d'une barre de nav. Le bandeau est une section NORMALE du flux ; seule la
 * barre est `sticky` — en scrollant, le bandeau sort de l'écran naturellement et
 * la barre se colle en haut, où le logo compact apparaît à gauche de la nav.
 *
 * Pourquoi PAS un bloc `fixed` unique dont on anime la hauteur (mécanique
 * d'origine, abandonnée) : elle imposait des hauteurs figées découplées du
 * contenu — `h-[calc(50vh-5.5rem)]` + `overflow-hidden` CLIPPAIT logo et
 * sous-titre sur les petits écrans (Nexus 5 : 232px pour ~280px de contenu),
 * le spacer 50vh→h-14 non animé faisait bondir le contenu de ~370px, et l'image
 * de fond recadrée en tranche de 56px laissait transparaître la page à travers
 * ses zones semi-transparentes (canal alpha du watercolor). Ici : hauteur =
 * max(min-h, contenu) — jamais de clipping —, pas de spacer, et la barre porte
 * son propre fond opaque.
 *
 * Comportement identique sur TOUTES les pages : `stuck` ne dépend que de la
 * position de la barre (sentinelle IntersectionObserver), jamais de la route.
 */
/**
 * Plancher du bandeau à partir de `xl:`, piloté par `header.height`. Classes écrites EN TOUTES
 * LETTRES : le JIT Tailwind ne génère pas une classe construite dynamiquement (même contrainte que
 * `SPLIT_LAYOUTS` dans SearchProStatic).
 *
 * `lg` (défaut du schéma : `md`) garde le 50vh d'origine — moitié bandeau / moitié section suivante
 * au premier écran. `sm` vise le QUART de l'écran, pour une accueil où c'est le CONTENU qui doit
 * occuper le premier écran, pas la marque. Dans tous les cas le bandeau S'ÉTEND si son contenu
 * dépasse le plancher : jamais de clipping (cf. la mécanique abandonnée, plus bas).
 *
 * Le plancher n'est donc PAS une hauteur garantie, et il ne suffit pas à lui seul : `pt-6` + `pb-16`
 * (la réserve des 56px de la barre, incompressible) posent déjà 88px, auxquels s'ajoute le bloc
 * logo/wordmark/sous-titre. C'est la taille de la MARQUE, réglée du même cran juste en dessous, qui
 * fait réellement descendre le bandeau. Plancher bas de ce composant, mesuré : ~190px avec une
 * marque minimale — viser moins reviendrait à supprimer le bandeau, pas à le régler.
 */
const PLANCHER_BANDEAU = {
  sm: "xl:min-h-[25vh]",
  md: "xl:min-h-[37.5vh]",
  lg: "xl:min-h-[50vh]",
} as const;

/**
 * Taille de la marque (wordmark) à partir de `xl:`, même clé que le plancher. Le LOGO n'a pas de
 * HAUTEUR de rendu ici : il s'aligne tout seul sur la hauteur du bloc titre+sous-titre voisin (CSS
 * Grid + `items-stretch`, cf. plus bas) — un plafond de taille en dur aurait fini par diverger du
 * wordmark qu'il doit accompagner, à chaque changement de preset ou de longueur de sous-titre.
 * `px` reste : c'est la résolution SOURCE demandée à `/img` (optimisation), volontairement bien
 * AU-DESSUS de toute hauteur de rendu réaliste pour ce preset (×2 par le srcSet 2x déjà) — sinon le
 * logo est servi plus petit qu'affiché et l'agrandissement CSS le floute (mesuré : 80px demandés,
 * rendu jusqu'à 132px).
 *
 * Le plancher SEUL ne réduit rien : la hauteur du bandeau vaut `max(plancher, contenu)`, et à
 * `xl:h-40` + wordmark `text-7xl` le contenu mesure ~290px — il dépassait donc un plancher à 25vh
 * (225px sur un écran de 900) et le bandeau restait à 32% de l'écran. Demander un bandeau plus court
 * implique un wordmark plus petit (donc un logo plus petit, qui en découle) ; les deux se règlent
 * d'un seul cran.
 * Mobile/tablette inchangés (classes `sm:` communes) : là, le bandeau suit déjà son contenu.
 */
const MARQUE_BANDEAU = {
  sm: { wordmark: "xl:text-4xl xl:mb-1", sous: "xl:text-lg", mt: "xl:mt-1", gap: "xl:gap-7", px: 200 },
  md: { wordmark: "xl:text-6xl xl:mb-2", sous: "xl:text-2xl", mt: "xl:mt-2", gap: "xl:gap-10", px: 260 },
  lg: { wordmark: "xl:text-7xl xl:mb-3", sous: "xl:text-3xl", mt: "xl:mt-3", gap: "xl:gap-12", px: 340 },
} as const;

export default function HeaderStacked({ header }: HeaderStackedProps) {
  useLoadNamespace("components/layout");
  const t = useT("components/layout");
  const isNavItemActive = useNavItemActive();

  useScrollToTopOnRouteChange();

  // `stuck` = la barre est collée au bord haut (le bandeau est entièrement sorti
  // de l'écran). Détecté par une sentinelle posée au BAS du bandeau plutôt qu'un
  // seuil de scroll en px : aucun besoin de connaître la hauteur (variable) du
  // bandeau, et pas de faux positif pendant qu'il est encore partiellement visible.
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [stuck, setStuck] = useState(false);
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => setStuck(!entry.isIntersecting));
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const marque = MARQUE_BANDEAU[header.height ?? "md"];

  const navVisibility = useVisibilityList(header.nav.map((item) => item.visibility));
  const visibleNavItems = header.nav.filter((_, idx) => navVisibility[idx]);
  // `placement: "actions"` sort l'entrée du menu centré (barre desktop du header `stacked` UNIQUEMENT,
  // le menu mobile garde la liste complète — cf. `EnhancedNavItemType.placement`) pour la poser dans le
  // groupe d'actions de droite, à la place d'un bouton de header (la loupe qui remplace « Ctrl+K »).
  const navItemsToDisplay = visibleNavItems.filter((item) => item.placement !== "actions");
  const actionNavItems = visibleNavItems.filter((item) => item.placement === "actions");

  // Fond partagé bandeau/barre. `bg-neutral-800` SOUS l'image : l'image peut avoir
  // un canal alpha partiellement transparent (cf. bug du texte fantôme) — les
  // « trous » montrent un fond sombre neutre (texte blanc lisible) au lieu du
  // contenu de la page. Sert aussi de repli quand `backgroundImage` est absent.
  // Fond de la barre une fois collée (image seule — `--header-text` ne sert
  // qu'au wordmark du bandeau).
  const bgImageStyle = header.backgroundImage
    ? { backgroundImage: `url(${header.backgroundImage})` }
    : undefined;

  const bgStyle = {
    ...bgImageStyle,
    // `header.textColor` ne pilote que le 1er segment du wordmark (logoTitle, cf.
    // plus bas) : sous-titre/nav sont blancs fixes, IDENTIQUES quel que soit le
    // mode clair/sombre (demande explicite — même couleur dans les deux modes,
    // celle du mode sombre). Le token reste utile en repli noir pour le wordmark.
    "--header-text": header.textColor || "#000000",
  } as React.CSSProperties;

  return (
    <>
      {/* Bandeau wordmark — dans le flux. Pas de `min-h` avant `xl:` : la hauteur suit son
          contenu (logo/titre/sous-titre) + son padding. `xl:` est choisi (PAS `lg:`) pour
          matcher exactement le breakpoint où la barre en dessous bascule du hamburger à la
          nav complète (`hidden xl:flex` / `xl:hidden`, cf. plus bas) — sinon, entre 1024 et
          1279px, le bandeau prendrait sa forme desktop (plancher + gros logo) au-dessus d'une
          barre encore en mode mobile, un décalage visuel constaté à l'écran. Le plancher lui-même
          vient de `header.height` (cf. `PLANCHER_BANDEAU`) : il valait 50vh en dur — moitié bandeau
          / moitié section suivante — jusqu'à ce qu'une accueil demande le quart d'écran. Le bandeau
          S'ÉTEND si son contenu dépasse ce plancher, jamais de clipping. */}
      <header className="relative bg-neutral-800 bg-cover bg-center" style={bgStyle}>
        <div aria-hidden className="absolute inset-0 pointer-events-none dark:bg-background/90" />
        {/* `pb-16` : réserve les 56px que la barre (en marge négative, cf. plus bas)
            superpose au bas du bandeau + une fine respiration — le wordmark ne
            passe jamais sous la barre. */}
        <div className={`relative flex flex-col items-center justify-center px-4 pt-4 pb-16 ${PLANCHER_BANDEAU[header.height ?? "md"]}`}>
          {/* `sm:grid` (au lieu de `flex`) : à partir de `sm:` (logo et titre/sous-titre en ligne), le
              logo doit REMPLIR la hauteur de la rangée au lieu d'être centré à sa taille naturelle —
              `items-stretch` + `aspect-square` sur l'image y suffisent EN GRID, pas en FLEX : en flex,
              la largeur `auto` d'un item étiré sur l'axe croisé ne se recalcule PAS depuis son
              `aspect-ratio` (elle reste celle du flex-basis posé AVANT l'étirement — mesuré : logo
              carré étiré en 80×132, pas 132×132, avec `h-auto`/`w-auto`/`aspect-square` pourtant posés).
              Le modèle de piste de CSS Grid, lui, résout largeur ET hauteur ENSEMBLE pour un item
              étiré avec ratio déclaré — d'où `grid-cols-[auto_1fr]` (colonne logo à sa largeur de
              contenu, colonne texte au reste).
              ⚠️ L'IMAGE elle-même ne doit PAS être l'item grid direct : son `min-height`/`min-width`
              implicites valent par défaut sa taille INTRINSÈQUE (`auto`), qui participe au calcul de
              hauteur de la rangée — en demandant un logo source plus grand pour la netteté
              (`marque.px`, cf. plus bas, nécessaire pour ne pas re-flouter un agrandissement CSS), sa
              taille intrinsèque dépassait celle du bloc titre+sous-titre et GONFLAIT toute la rangée à
              sa propre taille au lieu de s'aligner sur elle (mesuré : rangée et logo à 200px au lieu
              des 132px du texte ; `min-h-0`/`min-w-0` SEULS sur l'image n'y suffisent pas — la piste
              `auto` de la rangée reste sensible à la taille MAX-CONTENT de l'image). D'où le
              conteneur : lui seul est l'item grid (`sm:aspect-square sm:h-auto`, SANS contenu normal
              pour ne rien imposer), l'image y est `absolute inset-0` — sortie du flux, elle ne
              contribue plus du tout à la taille du conteneur, qui peut alors s'étirer librement sur la
              hauteur du texte voisin. Logo carré comme ailleurs dans ce header (vignette compacte
              `h-11 w-11` ci-dessous) : à revoir si un site au logo non carré adopte un jour ce header.
              Mobile (`flex-col`) inchangé : centré, pas de rangée à égaler. */}
          <NavLink to={header.path || "/"} className={`flex flex-col sm:grid sm:grid-cols-[auto_1fr] items-center sm:items-stretch gap-3 sm:gap-5 ${marque.gap} text-center sm:text-left cursor-pointer group`}>
            <div className="relative h-11 w-11 sm:h-auto sm:w-auto sm:aspect-square shrink-0">
              <HeaderLogo
                header={header}
                isOverlay
                iconTone="white"
                imageClassName="absolute inset-0 h-full w-full object-contain transition-transform group-hover:scale-110"
                iconClassName="absolute inset-0 h-full w-full transition-transform group-hover:scale-110"
                imageHeight={marque.px}
              />
            </div>
            {(header.logoTitle || header.logoSubtitle) && (
              <span className="flex flex-col items-center sm:items-start leading-tight">
                {header.logoTitle && (
                  <span className={`font-display text-2xl sm:text-2xl font-serif mb-1 sm:mb-1 ${marque.wordmark}`}>
                    {header.logoTitleAccent ? (
                      <>
                        {/* Wordmark 2 segments : `logoTitle` en `header.textColor` (repli noir)
                            + contour blanc fixe (`-webkit-text-stroke`, non supporté nativement
                            par Tailwind — d'où le style inline), `logoTitleAccent` en blanc fixe.
                            En SOMBRE, le remplissage passe sur `--accent` du thème : le voile du
                            chrome est teinté par `--background`, un `textColor` de la même famille
                            y devient invisible (lettres creuses, seul le contour dessinait). */}
                        <span
                          className="text-(--header-text) dark:text-accent"
                          style={{ WebkitTextStroke: "2px white", paintOrder: "stroke fill" }}
                        >
                          {t(header.logoTitle)}
                        </span>
                        <span className="text-white">{t(header.logoTitleAccent)}</span>
                      </>
                    ) : (
                      t(header.logoTitle)
                    )}
                  </span>
                )}
                {header.logoSubtitle && (
                  <span className={`whitespace-pre-line text-sm sm:text-sm font-medium text-white mt-1 sm:mt-1 ${marque.mt} ${marque.sous}`}>{t(header.logoSubtitle)}</span>
                )}
              </span>
            )}
          </NavLink>
        </div>
        {/* Sentinelle à `bottom-14` (= la position naturelle du HAUT de la barre,
            qui chevauche les 56 derniers px du bandeau via sa marge négative) :
            elle sort de l'écran par le haut exactement quand la barre se colle. */}
        <div ref={sentinelRef} aria-hidden className="absolute bottom-14 h-px w-px" />
      </header>

      {/* `-mt-14` : au repos, la barre SE SUPERPOSE aux 56 derniers px du bandeau,
          en transparence — l'image de fond est donc UN SEUL crop continu (celui du
          bandeau). Lui donner son propre `bg-cover` en permanence recadrait l'image
          une 2e fois pour sa boîte de 56px → « couture » visible à la jonction
          (même fond appliqué deux fois, cf. retour de recette). Son fond propre
          n'apparaît (fondu 200ms) que quand elle est collée en haut, où le bandeau
          n'est plus derrière elle. */}
      <nav className="sticky top-0 z-50 -mt-14">
        <div
          aria-hidden
          className={cn(
            "absolute inset-0 pointer-events-none transition-opacity duration-200",
            stuck ? "opacity-100" : "opacity-0"
          )}
        >
          {/* `bg-neutral-800` SOUS l'image : ses zones semi-transparentes (canal
              alpha) montrent un fond sombre neutre, jamais le contenu de la page. */}
          <div className="absolute inset-0 bg-neutral-800 bg-cover bg-center shadow-deep" style={bgImageStyle} />
          {/* Voile de lisibilité : la tranche d'image visible sur 56px n'est pas
              forcément une zone prévue pour du texte blanc. */}
          <div className="absolute inset-0 bg-black/35 dark:bg-background/90" />
        </div>

        <div className="relative mx-auto max-w-[100rem] px-4">
          {/* `1fr_auto_1fr` (et non `auto_1fr_auto`) : les deux colonnes de FLANC sont de MÊME largeur,
              quel que soit le contenu qu'elles portent (logo à gauche, groupe d'actions à droite —
              jamais la même largeur). Le menu (colonne du milieu, `auto`) se centre alors sur la BARRE
              ENTIÈRE, comme le logo/titre du bandeau au-dessus (centré sur la page) — avec l'ancien
              `auto_1fr_auto`, le menu ne se centrait que dans l'espace RESTANT après le logo, décalé
              vers la gauche dès que le groupe d'actions était plus large que le logo (systématique). */}
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4 h-14">
            {/* Colonne logo : toujours montée, sa largeur transitionne 0 → taille
                réelle quand la barre se colle (un montage/démontage conditionnel
                ferait sauter le nombre de colonnes de la grille, non animable). */}
            <NavLink
              to={header.path || "/"}
              className={cn(
                "relative flex items-center shrink-0 overflow-hidden justify-self-start group transition-all duration-300 ease-out",
                stuck ? "w-12 sm:w-14 opacity-100 scale-100" : "w-0 opacity-0 scale-75 pointer-events-none"
              )}
            >
              <HeaderLogo
                header={header}
                iconTone="white"
                imageClassName="h-12 w-12 sm:h-14 sm:w-14 relative shrink-0 object-contain transition-transform group-hover:scale-110"
                iconClassName="w-12 h-12 sm:w-14 sm:h-14 relative shrink-0 transition-transform group-hover:scale-110"
                imageHeight={56}
              />
            </NavLink>

            {/* Écart entre entrées resserré de `xl` à `2xl` : à 1280px, 6 entrées de premier niveau espacées de
                48px (`gap-12`) poussaient le groupe d'actions (recherche, thème, langue, connexion) 3px hors
                de l'écran — débordement horizontal mesuré sur toutes les pages. 24px jusqu'à 1535px, 48px au-delà :
                avec une 7ᵉ entrée en icône seule, 32px ne laissaient que 5px à 1280px en français, et le contenu
                dépassait de 20px sous une barre de défilement classique (17px). 24px en laissent 45 (28 avec la barre). */}
            {/* `relative` porté par la RANGÉE (et non par chaque entrée) : les panneaux de sous-menu se
                centrent sous le menu entier, jamais sous leur seule entrée. Centrés sur la 1re entrée, ils
                sortaient de l'écran par la gauche — 180 px coupés à 1280 px, 100 px à 1440 px. Le soulignement
                d'une entrée reste ancré sur son lien, qui porte déjà `relative`. */}
            <div className="relative hidden xl:flex items-center justify-center gap-6 2xl:gap-12">
              {navItemsToDisplay.map((item, idx) => {
                const isActive = isNavItemActive(item.path);
                const hasChildren = !!item.children?.length;
                // Icône seule (ex. la loupe vers la recherche) : le libellé reste le nom lu et l'infobulle.
                const iconOnly = !!(item.iconOnly && item.icon);
                return (
                  <div key={idx} className="group">
                    <NavLink
                      to={item.path ?? item.href}
                      ariaCurrent={isActive ? "page" : undefined}
                      aria-label={iconOnly ? t(item.label) : undefined}
                      title={iconOnly ? t(item.label) : undefined}
                      className={cn(
                        "font-display transition-all relative inline-flex items-center gap-1.5 whitespace-nowrap font-serif",
                        stuck ? "text-xl" : "text-2xl",
                        isActive
                          ? "text-white"
                          : "text-white/90 hover:text-white"
                      )}
                    >
                      <NavIcon icon={item.icon} className={iconOnly ? (stuck ? "size-5 shrink-0" : "size-6 shrink-0") : undefined} />
                      {!iconOnly && t(item.label)}
                      {item.badge && <Badge className="text-xs px-2 py-0.5">{t(item.badge.text)}</Badge>}
                      {hasChildren && <ChevronDown className="w-3 h-3" />}
                      <span className={cn("absolute -bottom-1 left-0 h-0.5 bg-white transition-all", isActive ? "w-full" : "w-0 group-hover:w-full")}></span>
                    </NavLink>
                    {hasChildren && item.children && (
                      <div className="absolute left-1/2 top-full z-60 mt-2 w-screen max-w-2xl -translate-x-1/2 -translate-y-1 rounded-xl border border-border bg-popover p-8 text-popover-foreground opacity-0 invisible shadow-2xl transition-all duration-200 group-hover:translate-y-0 group-hover:opacity-100 group-hover:visible">
                        <div className="grid grid-cols-2 gap-6">
                          {item.children.map((sub, i) => (
                            <NavLink key={i} to={sub.path ?? sub.href} className="block">
                              <h4 className="flex items-center gap-1.5 font-serif text-lg text-popover-foreground mb-2"><NavIcon icon={sub.icon} />{t(sub.label)}</h4>
                              <p className="text-muted-foreground text-sm leading-relaxed">
                                {sub.description ? t(sub.description) : ""}
                              </p>
                            </NavLink>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="flex items-center justify-end gap-2 justify-self-end">
            <div className="hidden xl:flex items-center gap-2">
              {header.utilities?.notifications && <NotificationBell />}
              {/* Entrées `placement: "actions"` (la loupe, à la place de l'ancien bouton « Ctrl+K ») :
                  icône seule, blanc fixe comme le reste du groupe. */}
              {actionNavItems.map((item, idx) => (
                <Button key={idx} asChild variant="ghost" size="icon" className={THEME_BTN} title={t(item.label)}>
                  <NavLink to={item.path ?? item.href} aria-label={t(item.label)}>
                    <NavIcon icon={item.icon} className="size-5 shrink-0" />
                  </NavLink>
                </Button>
              ))}
              {header.utilities?.themeSwitch !== false && (
                <ClientOnly fallback={<div className="w-10 h-10" />}>
                  {() => <ToggleButtonTheme className={THEME_BTN} />}
                </ClientOnly>
              )}
              {header.utilities?.langSwitch && (
                <LangSwitch triggerClassName="text-white/90 hover:text-white hover:bg-white/10 dark:hover:bg-white/10" />
              )}
              {header.utilities?.auth && (
                <AuthMenu layout="menu" density="compact" showDropdownHeader loginVariant="solid" loginLabel={header.ctaButton?.label} />
              )}
              {!header.utilities?.auth && header.ctaButton && (
                <NavLink
                  to={header.ctaButton.path}
                  className="px-4 py-2 bg-white text-foreground rounded-md font-medium shadow-glow transition-all"
                >
                  {t(header.ctaButton.label)}
                </NavLink>
              )}
            </div>

            <div className="xl:hidden flex items-center gap-2">
              {header.utilities?.notifications && <NotificationBell />}
              {actionNavItems.map((item, idx) => (
                <Button key={idx} asChild variant="ghost" size="icon" className={THEME_BTN} title={t(item.label)}>
                  <NavLink to={item.path ?? item.href} aria-label={t(item.label)}>
                    <NavIcon icon={item.icon} className="size-5 shrink-0" />
                  </NavLink>
                </Button>
              ))}
              {header.utilities?.themeSwitch !== false && (
                <ClientOnly fallback={<div className="w-8 h-8" />}>
                  {() => <ToggleButtonTheme className={THEME_BTN} />}
                </ClientOnly>
              )}
              {visibleNavItems.length > 0 && (
                <MobileMenuSheet
                  breakpoint="xl"
                  triggerClassName="text-white/90 hover:text-white"
                  brand={(close) => <MobileMenuBrand header={header} onNavigate={close} />}
                >
                  {(close) => (
                    <>
                      {/* Mobile : liste complète, `placement: "actions"` n'existe que pour la barre
                          desktop — pas de groupe d'actions séparé dans le menu déroulant. */}
                      <MobileNavItems
                        items={visibleNavItems}
                        display={header.mobileNavDisplay}
                        onNavigate={close}
                        isActive={isNavItemActive}
                      />
                      {header.utilities?.langSwitch && (
                        <LangSwitch triggerClassName="w-full justify-start text-muted-foreground hover:text-foreground hover:bg-muted dark:hover:bg-muted" />
                      )}
                      {header.utilities?.auth && (
                        <AuthMenu layout="stack" onAction={close} loginVariant="solid" loginLabel={header.ctaButton?.label} />
                      )}
                      {!header.utilities?.auth && header.ctaButton && (
                        <NavLink
                          to={header.ctaButton.path}
                          className="w-full mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-md font-medium text-center block"
                          onClick={close}
                        >
                          {t(header.ctaButton.label)}
                        </NavLink>
                      )}
                    </>
                  )}
                </MobileMenuSheet>
              )}
            </div>
            </div>
          </div>
        </div>
      </nav>
    </>
  );
}
