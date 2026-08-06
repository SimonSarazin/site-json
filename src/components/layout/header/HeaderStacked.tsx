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
import { useScrollAware, useScrollToTopOnRouteChange, useNavItemActive } from "./useHeaderBehavior";
import { useVisibilityList } from "@/lib/visibility/useVisibility";
import { cn } from "@/lib/utils";

interface HeaderStackedProps {
  header: Header;
}

/**
 * Header 2 sections sur fond image : section 1 = logo + titre/sous-titre,
 * plein écran (`50` moins la nav) et centrée horizontalement/verticalement ;
 * section 2 = nav. Au scroll, la section 1 collapse à 0 (transition de hauteur)
 * vers une barre compacte unique où le logo remonte à gauche de la nav et le
 * titre/sous-titre disparaissent (même mécanique que `HeaderTransparentScroll`,
 * cf. `useScrollAware`).
 *
 * Comportement identique sur TOUTES les pages (pas seulement l'accueil) :
 * `collapsed` ne dépend que du scroll (`useScrollAware`), jamais de la route.
 */
export default function HeaderStacked({ header }: HeaderStackedProps) {
  useLoadNamespace("components/layout");
  const t = useT("components/layout");
  const isNavItemActive = useNavItemActive();

  useScrollToTopOnRouteChange();
  const collapsed = useScrollAware();

  const navVisibility = useVisibilityList(header.nav.map((item) => item.visibility));
  const navItemsToDisplay = header.nav.filter((_, idx) => navVisibility[idx]);

  return (
    <>
      <nav
        className="fixed top-0 left-0 right-0 z-50 transition-all duration-200 bg-cover bg-center shadow-deep"
        style={{
          ...(header.backgroundImage ? { backgroundImage: `url(${header.backgroundImage})` } : undefined),
          // `header.textColor` ne pilote plus que le 1er segment du wordmark (logoTitle, cf.
          // plus bas) : sous-titre/nav sont désormais blancs fixes, IDENTIQUES quel que soit le
          // mode clair/sombre (demande explicite — même couleur dans les deux modes, celle du
          // mode sombre). Le token reste utile en repli noir pour le wordmark uniquement.
          "--header-text": header.textColor || "#000000",
        } as React.CSSProperties}
      >
        {/* Scrim additionnel une fois compacté : le nav reste lisible même si la
            zone visible de l'image de fond n'est pas celle prévue pour du texte.
            Toujours monté (jamais démonté) pour que l'opacité se transitionne au
            lieu de « sauter » à l'apparition/disparition. `pointer-events-none` :
            purement décoratif (`aria-hidden`), mais un `absolute` sans z-index
            passe quand même AU-DESSUS des enfants `position: static` de section 2
            dans l'ordre d'empilement CSS (indépendamment du DOM et de l'opacité)
            — sans ça, il interceptait tous les clics des boutons de la nav. */}
        <div
          aria-hidden
          className={cn("absolute inset-0 pointer-events-none transition-opacity duration-200", collapsed ? "opacity-100" : "opacity-0")}
        />

        {/* Section 1 : logo + titre/sous-titre côte à côte, plein écran (50
            moins la nav, h-14 = 3.5rem) et centrés horizontalement/verticalement.
            Toujours montée — le collapse au scroll transitionne la hauteur
            (50 → 0) plutôt qu'un montage/démontage React, qui ne peut pas
            être animé en CSS. */}
        <div
          className={cn(
            "overflow-hidden transition-[height] duration-500 ease-in-out",
            collapsed ? "h-0" : "h-[calc(50vh-5.5rem)]"
          )}
        >
          <div
            className={cn(
              "flex h-full flex-col items-center justify-center px-4 transition-opacity duration-400",
              collapsed ? "opacity-0" : "opacity-100 delay-200"
            )}
          >
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
                <span className="flex flex-col items-center sm:items-start leading-tight ">
                  {header.logoTitle && (
                    // Le saut à la taille desktop (9xl) attend `lg:` (1024px), pas `md:` (768px) :
                    // la hauteur du header (`50vh`) ne grandit pas avec la largeur, un saut trop tôt
                    // fait déborder/clipper le sous-titre sur les largeurs tablette (cf. bug remonté).
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
        </div>

        {/* Section 2 : nav — logo compact à gauche une fois scrollé. Padding bas
            généreux au repos (matché sur la maquette, cf. hauteur réservée par la
            section 1 ci-dessus) ; retiré une fois compactée pour ne pas alourdir
            la barre sticky. */}
        <div className={cn("mx-auto max-w-[100rem] px-4 transition-[padding] duration-300", collapsed ? "pb-0" : "pb-8")}>
          <div className="grid grid-cols-[auto_1fr_auto] items-center gap-4 h-14">
            {/* Colonne logo : toujours montée, mais sa largeur (donc celle de la
                piste "auto" qui la contient) transitionne de 0 → sa taille réelle.
                Contrairement à un montage/démontage conditionnel (qui forçait un
                saut discret du nombre de colonnes de la grille, non-animable en
                CSS), la piste suit en douceur la largeur du logo — et reste à ~0
                au repos, donc ne réserve quasiment aucun espace tant qu'on n'a
                pas scrollé. */}
            <NavLink
              to={header.path || "/"}
              className={cn(
                "relative flex items-center shrink-0 overflow-hidden justify-self-start group transition-all duration-300 ease-out",
                collapsed ? "w-11 sm:w-13 opacity-100 scale-100" : "w-0 opacity-0 scale-75 pointer-events-none"
              )}
            >
              <span aria-hidden className="absolute inset-0 -m-1.5 rounded-full bg-transparent" />
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
                        collapsed ? "text-xl" : "text-2xl",
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
              {header.utilities?.search && <CommandTriggerButton />}
              {header.utilities?.themeSwitch !== false && (
                <ClientOnly fallback={<div className="w-10 h-10" />}>
                  {() => <ToggleButtonTheme />}
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
              {header.utilities?.search && <CommandTriggerButton />}
              {header.utilities?.themeSwitch !== false && (
                <ClientOnly fallback={<div className="w-8 h-8" />}>
                  {() => <ToggleButtonTheme />}
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
      {/* Spacer : le header est `fixed`, il faut pousser le contenu sous lui.
          Hauteur = section 1 + section 2 (repos) ou barre compacte seule (scrollé).
          Au repos : section 1 = `calc(50vh - 5.5rem)`, section 2 = `h-14` (3.5rem) + `pb-8`
          (2rem) = 5.5rem → total = 50vh pile. Un `h-120` (480px) fixe ne matchait ça QUE sur un
          viewport de 960px de haut ; sur les autres hauteurs d'écran, l'espace réservé était trop
          court (le header, fixed, chevauchait le haut du contenu) ou trop long (bande vide entre
          le header et le contenu) — décalage dépendant de l'écran, cf. bug remonté. `h-[50vh]`
          matche exactement la hauteur réelle du header quel que soit le viewport. */}
      <div aria-hidden className={collapsed ? "h-14" : "h-[50vh]"} />
    </>
  );
}
