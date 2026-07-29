import { useLoadNamespace } from "@/hooks/useLoadNamespace";
import { useT } from "@/hooks/useT";
import { Header } from "@/types/site-schema";
import { ChevronDown } from "lucide-react";
import { IconOrSvg } from "@/components/ui/icon-or-svg";
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
import { PiggyBankHeaderButton } from "@/modules/cagnotte/components/PiggyBankHeaderButton";
import NotificationBell from "@/modules/notification/components/NotificationBell";
import CommandTriggerButton from "@/modules/commandPalette/components/CommandTriggerButton";
import { useScrollAware, useScrollToTopOnRouteChange, useNavItemActive, useHeaderOpaqueAtRest } from "./useHeaderBehavior";
import { logoSquareClass, logoSizePx } from "./logoSize";
import { useVisibilityList } from "@/lib/visibility/useVisibility";
import PledgeHeaderButton from "@/modules/cagnotte/components/PledgeHeaderButton";

interface HeaderTransparentScrollProps {
    header: Header;
    /** La page courante débute-t-elle par un héro ? (fourni par SiteHeader). Pilote `transparentMode: "auto"`. */
    pageHasHero?: boolean;
}


type HeaderNavItem = Header['nav'][number];

export default function HeaderTransparentScroll({ header, pageHasHero = false }: HeaderTransparentScrollProps) {
    useLoadNamespace("components/layout");
    const t = useT("components/layout");
    const isNavItemActive = useNavItemActive();

    const isPathInsideNav = (items: HeaderNavItem[]): boolean => {
        return items.some(item => {
            if (isNavItemActive(item.path)) return true;
            if (item.children?.length) {
                return isPathInsideNav(item.children);
            }
            return false;
        });
    };

    useScrollToTopOnRouteChange();

    const isScrolled = useScrollAware();
    // Opaque au repos (selon transparentMode / opaqueOnPaths / overlayOnPaths / page-héro),
    // OU dès qu'on scrolle. L'overlay transparent n'est gardé que si rien ne force l'opaque.
    const opaqueAtRest = useHeaderOpaqueAtRest(header, pageHasHero);
    const opaque = isScrolled || opaqueAtRest;

    const shouldHideNav = Boolean(
        header.navVisibleOnlyForListedPages && !isPathInsideNav(header.nav)
    );

    const secondaryNavItems = header.secondaryNav ?? [];
    const shouldHideSecondaryNav = Boolean(
        secondaryNavItems.length > 0
        && header.secondaryNavVisibleOnlyForListedPages
        && !isPathInsideNav(secondaryNavItems)
    );

    const navSource = !shouldHideNav
        ? header.nav
        : (!shouldHideSecondaryNav ? secondaryNavItems : []);

    // Filtre les entrées par condition de visibilité (auth/routes/permissions).
    // SSR : les items dépendant de l'auth sont masqués jusqu'à l'hydratation.
    const navVisibility = useVisibilityList(navSource.map((item) => item.visibility));
    const navItemsToDisplay = navSource.filter((_, idx) => navVisibility[idx]);

    return (
        <>
        {/* État transparent : léger scrim dégradé issu du thème (pas de blanc en dur)
            — sans lui, le texte en tokens de contenu est posé directement sur le héros
            et le contraste n'est jamais garanti (clair comme sombre). */}
        <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${opaque ? 'bg-background/90 backdrop-blur-md shadow-deep' : 'bg-linear-to-b from-background/70 via-background/30 to-transparent'}`}>
            <div className="container mx-auto px-4">
                <div className="flex items-center justify-between h-20">
                    {/* min-w-0 + truncate : le titre ne wrappe JAMAIS (un titre
                        long déborderait de la barre h-20 sur mobile et
                        recouvrirait le contenu) — il s'ellipse. */}
                    <NavLink to={header.path || "/"} className="flex min-w-0 items-center gap-3 cursor-pointer group">
                        <HeaderLogo
                            header={header}
                            isOverlay={!opaque}
                            iconTone="primary"
                            imageClassName={`${logoSquareClass(header.logoSize)} shrink-0 object-contain group-hover:scale-110 transition-transform`}
                            iconClassName="w-8 h-8 shrink-0 group-hover:scale-110 transition-transform"
                            imageHeight={logoSizePx(header.logoSize)}
                        />
                        {(header.logoTitle || header.logoSubtitle) && (
                            <span className="flex min-w-0 flex-col leading-tight">
                                {header.logoTitle && (
                                    <span className="truncate text-base font-bold text-foreground sm:text-lg">{t(header.logoTitle)}</span>
                                )}
                                {header.logoSubtitle && (
                                    <span className={`truncate text-xs font-medium ${opaque ? 'text-muted-foreground' : 'text-foreground/80'}`}>{t(header.logoSubtitle)}</span>
                                )}
                            </span>
                        )}
                    </NavLink>

                    <div className="hidden xl:flex items-center gap-8">
                        {navItemsToDisplay.map((item, idx) => {
                            const isActive = isNavItemActive(item.path);
                            const hasChildren = !!item.children?.length;
                            return (
                                <div key={idx} className="relative group">
                                    {/* `path ?? href` : parité avec `MobileNavItems.navTarget` — un item
                                        de nav peut être un lien EXTERNE (`href` seul, ex. WordPress) ;
                                        sans le repli, NavLink recevait undefined → <span> inerte. */}
                                    <NavLink
                                        to={item.path ?? item.href}
                                        ariaCurrent={isActive ? "page" : undefined}
                                        className={`transition-colors font-medium relative group inline-flex items-center gap-1.5 whitespace-nowrap ${isActive ? 'text-primary' : opaque ? 'text-muted-foreground hover:text-foreground' : 'text-foreground/90 hover:text-foreground'}`}
                                    >
                                        <NavIcon icon={item.icon} />
                                        {t(item.label)}
                                        {item.badge && <Badge className="text-xs px-2 py-0.5">{t(item.badge.text)}</Badge>}
                                        {hasChildren && <ChevronDown className="w-3 h-3" />}
                                        <span className={`absolute -bottom-1 left-0 h-0.5 bg-primary transition-all ${isActive ? 'w-full' : 'w-0 group-hover:w-full'}`}></span>
                                    </NavLink>
                                    {hasChildren && item.children && (
                                        <div className="absolute left-1/2 -translate-x-1/2 top-full mt-2 w-screen max-w-2xl bg-popover text-popover-foreground rounded-xl shadow-2xl border border-border opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 p-8 z-60">
                                            {item.children.length > 2 ? (
                                                <div className="grid grid-cols-2 gap-6">
                                                    {item.children.map((sub, i) => (
                                                        <NavLink key={i} to={sub.path ?? sub.href} className="block">
                                                            <h4 className="flex items-center gap-1.5 font-bold text-popover-foreground mb-2"><NavIcon icon={sub.icon} />{t(sub.label)}</h4>
                                                            <p className="text-muted-foreground text-xs leading-relaxed">
                                                                {sub.description ? t(sub.description) : ""}
                                                            </p>
                                                        </NavLink>
                                                    ))}
                                                </div>
                                            ) : (
                                                <div className="space-y-4">
                                                    {item.children.map((sub, i) => (
                                                        <NavLink key={i} to={sub.path ?? sub.href} className="block">
                                                            <h4 className="flex items-center gap-1.5 font-bold text-popover-foreground mb-2"><NavIcon icon={sub.icon} />{t(sub.label)}</h4>
                                                            <p className="text-muted-foreground text-xs leading-relaxed">
                                                                {sub.description ? t(sub.description) : ""}
                                                            </p>
                                                        </NavLink>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })}

                        {header.utilities?.piggyBank && (
                            // ClientOnly : la cagnotte est member-only (le composant lit `me`
                            // pour décider de rendre ou pas). Sans ClientOnly, SSR rend le bouton
                            // (me=null → null), client le rend après auth → hydration mismatch
                            // (cf. PiggyBankHeaderButton:if (!me?.id) return null).
                            <ClientOnly>
                                {() => <PiggyBankHeaderButton />}
                            </ClientOnly>
                        )}

                        {header.utilities?.pledge && (
                            // Bouton pour ouvrir la modale de paiement des promesses de financement
                            <ClientOnly>
                                {() => <PledgeHeaderButton />}
                            </ClientOnly>
                        )}

                        {header.urgenceButton && (
                            <NavLink
                                to={header.urgenceButton.path}
                                className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-accent/20 hover:bg-accent/30 text-primary transition-all group"
                            >
                                {header.urgenceButton.icon ? (
                                    <IconOrSvg
                                        value={header.urgenceButton.icon}
                                        className="w-5 h-5 group-hover:scale-110 transition-transform"
                                    />
                                ) : null}
                                <span className="font-semibold text-sm">{t(header.urgenceButton.label)}</span>
                            </NavLink>
                        )}

                        {header.utilities?.notifications && <NotificationBell />}
                        {header.utilities?.search && <CommandTriggerButton />}

                        {header.utilities?.themeSwitch !== false && (
                            <ClientOnly fallback={<div className="w-10 h-10" />}>
                                {() => <ToggleButtonTheme />}
                            </ClientOnly>
                        )}

                        {header.utilities?.langSwitch && (
                            <LangSwitch triggerClassName={`${opaque ? 'text-muted-foreground' : 'text-foreground/90'} hover:text-foreground hover:bg-muted dark:hover:bg-muted`} />
                        )}
                    </div>

                    <div className="hidden xl:block">
                        {header.utilities?.auth && (
                            <AuthMenu layout="menu" density="compact" showDropdownHeader loginVariant="solid" loginClassName="shadow-glow" loginLabel={header.ctaButton?.label} />
                        )}
                        {!header.utilities?.auth && header.ctaButton && (
                            <NavLink
                                to={header.ctaButton.path}
                                className="px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-md font-medium shadow-glow transition-all"
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
                                triggerClassName={`${opaque ? 'text-muted-foreground' : 'text-foreground/90'} hover:text-foreground`}
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

                                        {header.urgenceButton && (
                                            <NavLink
                                                to={header.urgenceButton.path}
                                                className="w-full flex items-center justify-between p-3 rounded-lg bg-accent/20 border border-accent/30 text-accent hover:bg-accent/30 transition-colors"
                                                onClick={close}
                                            >
                                                <span className="flex items-center gap-2">
                                                    {header.urgenceButton.icon ? (
                                                        <IconOrSvg
                                                            value={header.urgenceButton.icon}
                                                            className="w-5 h-5"
                                                        />
                                                    ) : null}
                                                    <span className="font-medium">{t(header.urgenceButton.label)}</span>
                                                </span>
                                            </NavLink>
                                        )}

                                        {header.utilities?.langSwitch && (
                                            <LangSwitch triggerClassName="w-full justify-start text-muted-foreground hover:text-foreground hover:bg-muted dark:hover:bg-muted" />
                                        )}

                                        {header.utilities?.auth && (
                                            <AuthMenu layout="stack" onAction={close} loginVariant="solid" loginClassName="shadow-glow" loginLabel={header.ctaButton?.label} />
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

        </nav>
        {/* Barre opaque au repos (transparent:false, ou auto sur page sans héro, ou
            opaqueOnPaths) → l'overlay n'a aucun sens : on pousse le contenu sous la barre
            (sinon le haut de la page passe dessous). Overlay (héro plein écran) → pas de spacer. */}
        {opaqueAtRest && <div aria-hidden className="h-20" />}
        </>
    );
}
