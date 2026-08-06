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
import { AuthMenu } from "@/modules/auth";
import ToggleButtonTheme from "@/components/layout/ToggleButtonTheme";
import NotificationBell from "@/modules/notification/components/NotificationBell";
import CommandTriggerButton from "@/modules/commandPalette/components/CommandTriggerButton";
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
// Recherche : seul l'état icône seule (<md) est concerné — au-delà, le champ
// « Ctrl+K » garde son propre fond clair et reste lisible tel quel.
const SEARCH_BTN = "max-md:text-white/90 max-md:hover:text-white";

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

  const navVisibility = useVisibilityList(header.nav.map((item) => item.visibility));
  const navItemsToDisplay = header.nav.filter((_, idx) => navVisibility[idx]);

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
      {/* Bandeau wordmark — dans le flux. `min-h` (PAS `h`) : l'ampleur ~50vh du
          design desktop est garantie, mais le bandeau S'ÉTEND si son contenu est
          plus grand (petit écran, sous-titre long) au lieu de le couper. */}
      <header className="relative bg-neutral-800 bg-cover bg-center" style={bgStyle}>
        <div aria-hidden className="absolute inset-0 pointer-events-none dark:bg-black/55" />
        {/* `pb-24` : réserve les 56px que la barre (en marge négative, cf. plus bas)
            superpose au bas du bandeau + 2.5rem de respiration — le wordmark ne
            passe jamais sous la barre. */}
        <div className="relative flex min-h-[50vh] flex-col items-center justify-center px-4 pt-10 pb-24">
          <NavLink to={header.path || "/"} className="flex flex-col sm:flex-row items-center gap-4 sm:gap-10 lg:gap-20 text-center sm:text-left cursor-pointer group">
            <HeaderLogo
              header={header}
              isOverlay
              iconTone="white"
              imageClassName="h-20 w-20 sm:h-35 sm:w-35 lg:h-60 lg:w-60 shrink-0 object-contain transition-transform group-hover:scale-110"
              iconClassName="w-20 h-20 sm:w-35 sm:h-35 lg:w-60 lg:h-60 shrink-0 transition-transform group-hover:scale-110"
              imageHeight={200}
            />
            {(header.logoTitle || header.logoSubtitle) && (
              <span className="flex flex-col items-center sm:items-start leading-tight">
                {header.logoTitle && (
                  // Le saut à la taille desktop (9xl) attend `lg:` (1024px), pas `md:` (768px) :
                  // sur les largeurs tablette, 9xl ferait déborder le wordmark de l'écran.
                  <span className="font-display text-5xl sm:text-6xl lg:text-9xl font-serif mb-2 sm:mb-5">
                    {header.logoTitleAccent ? (
                      <>
                        {/* Wordmark 2 segments, couleurs FIXES quel que soit le mode (contrairement
                            au sous-titre/nav, adaptatifs) : `logoTitle` en `header.textColor`
                            (repli noir) + contour blanc fixe (`-webkit-text-stroke`, non
                            supporté nativement par Tailwind — d'où le style inline),
                            `logoTitleAccent` en blanc fixe. */}
                        <span
                          className="text-(--header-text)"
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
                  <span className="whitespace-pre-line text-base sm:text-xl lg:text-5xl font-medium text-white mt-1 sm:mt-3">{t(header.logoSubtitle)}</span>
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
          <div className="absolute inset-0 bg-black/35 dark:bg-black/55" />
        </div>

        <div className="relative mx-auto max-w-[100rem] px-4">
          <div className="grid grid-cols-[auto_1fr_auto] items-center gap-4 h-14">
            {/* Colonne logo : toujours montée, sa largeur transitionne 0 → taille
                réelle quand la barre se colle (un montage/démontage conditionnel
                ferait sauter le nombre de colonnes de la grille, non animable). */}
            <NavLink
              to={header.path || "/"}
              className={cn(
                "relative flex items-center shrink-0 overflow-hidden justify-self-start group transition-all duration-300 ease-out",
                stuck ? "w-11 sm:w-13 opacity-100 scale-100" : "w-0 opacity-0 scale-75 pointer-events-none"
              )}
            >
              <HeaderLogo
                header={header}
                iconTone="white"
                imageClassName="h-11 w-11 sm:h-13 sm:w-13 relative shrink-0 object-contain transition-transform group-hover:scale-110"
                iconClassName="w-11 h-11 sm:w-13 sm:h-13 relative shrink-0 transition-transform group-hover:scale-110"
                imageHeight={52}
              />
            </NavLink>

            <div className="hidden xl:flex items-center justify-center gap-12">
              {navItemsToDisplay.map((item, idx) => {
                const isActive = isNavItemActive(item.path);
                const hasChildren = !!item.children?.length;
                return (
                  <div key={idx} className="relative group">
                    <NavLink
                      to={item.path ?? item.href}
                      ariaCurrent={isActive ? "page" : undefined}
                      className={cn(
                        "font-display transition-all relative inline-flex items-center gap-1.5 whitespace-nowrap font-serif",
                        stuck ? "text-xl" : "text-2xl",
                        isActive
                          ? "text-white"
                          : "text-white/90 hover:text-white"
                      )}
                    >
                      <NavIcon icon={item.icon} />
                      {t(item.label)}
                      {item.badge && <Badge className="text-xs px-2 py-0.5">{t(item.badge.text)}</Badge>}
                      {hasChildren && <ChevronDown className="w-3 h-3" />}
                      <span className={cn("absolute -bottom-1 left-0 h-0.5 bg-white transition-all", isActive ? "w-full" : "w-0 group-hover:w-full")}></span>
                    </NavLink>
                    {hasChildren && item.children && (
                      <div className="absolute left-1/2 top-full z-60 mt-2 w-screen max-w-2xl -translate-x-1/2 -translate-y-1 rounded-xl border border-border bg-popover p-8 text-popover-foreground opacity-0 invisible shadow-2xl transition-all duration-200 group-hover:translate-y-0 group-hover:opacity-100 group-hover:visible">
                        <div className="grid grid-cols-2 gap-6">
                          {item.children.map((sub, i) => (
                            <NavLink key={i} to={sub.path ?? sub.href} className="block">
                              <h4 className="flex items-center gap-1.5 font-serif text-popover-foreground mb-2"><NavIcon icon={sub.icon} />{t(sub.label)}</h4>
                              <p className="text-muted-foreground text-xs leading-relaxed">
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
              {header.utilities?.search && <CommandTriggerButton className={SEARCH_BTN} />}
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
              {header.utilities?.search && <CommandTriggerButton className={SEARCH_BTN} />}
              {header.utilities?.themeSwitch !== false && (
                <ClientOnly fallback={<div className="w-8 h-8" />}>
                  {() => <ToggleButtonTheme className={THEME_BTN} />}
                </ClientOnly>
              )}
              {navItemsToDisplay.length > 0 && (
                <MobileMenuSheet
                  breakpoint="xl"
                  triggerClassName="text-white/90 hover:text-white"
                  brand={(close) => <MobileMenuBrand header={header} onNavigate={close} />}
                >
                  {(close) => (
                    <>
                      <MobileNavItems
                        items={navItemsToDisplay}
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
