import { useLoadNamespace } from "@/hooks/useLoadNamespace";
import { useT } from "@/hooks/useT";
import { Header } from "@/types/site-schema";
import { useLocation } from "react-router";
import { useScrollAware, useScrollToTopOnRouteChange, useNavItemActive } from "./useHeaderBehavior";
import NavLink from "../NavLink";
import LangSwitch from "./LangSwitch";
import MobileMenuSheet from "./MobileMenuSheet";
import { ClientOnly } from "../ClientOnly";
import { IconOrSvg } from "@/components/ui/icon-or-svg";
import { AuthMenu } from "@/modules/auth";
import ToggleButtonTheme from "@/components/layout/ToggleButtonTheme";
import NotificationBell from "@/modules/notification/components/NotificationBell";
import CommandTriggerButton from "@/modules/commandPalette/components/CommandTriggerButton";

interface HeaderUnderlineNavProps {
    header: Header;
}

export default function HeaderUnderlineNav({ header }: HeaderUnderlineNavProps) {
    useLoadNamespace("components/layout");
    const t = useT("components/layout");
    const location = useLocation();

    const isNavItemActive = useNavItemActive();

    useScrollToTopOnRouteChange();

    const isScrolled = useScrollAware();

    return (
        <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${(isScrolled || location.pathname !== '/') ? 'bg-header-bar backdrop-blur-md shadow-deep' : 'bg-transparent'}`}>
            <div className="container mx-auto px-4">
                <div className="flex items-center justify-between h-20">
                    <NavLink to={header.path || "/"} className="flex items-center gap-3 cursor-pointer group">
                        {header.logo ? (
                            <img
                                src={`/${header.logo}`}
                                alt={header.logoAlt ? t(header.logoAlt) : ""}
                                className="h-8 w-8 object-contain group-hover:scale-110 transition-transform"
                            />
                        ) : header.logoIcon ? (
                            <IconOrSvg
                                value={header.logoIcon}
                                className="w-8 h-8 text-primary group-hover:scale-110 transition-transform"
                            />
                        ) : null}
                        {header.logoTitle && (
                            <span className="text-xl font-bold text-white">{t(header.logoTitle)}</span>
                        )}
                    </NavLink>

                    <div className="hidden md:flex items-center gap-8">
                        {header.nav.map((item, idx) => {
                            const isActive = isNavItemActive(item.path);
                            return (
                                <NavLink
                                    key={idx}
                                    to={item.path}
                                    ariaCurrent={isActive ? "page" : undefined}
                                    className={`text-lg transition-colors font-medium relative group ${isActive ? 'text-primary' : 'text-white hover:text-primary'}`}
                                >
                                    {t(item.label)}
                                    <span className={`absolute -bottom-1 left-0 h-0.5 bg-primary transition-all ${isActive ? 'w-full' : 'w-0 group-hover:w-full'}`}></span>
                                </NavLink>
                            );
                        })}

                        {header.piggyBank && (
                            <NavLink
                                to={header.piggyBank.path}
                                className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/20 hover:bg-primary/30 text-primary transition-all group"
                            >
                                {header.piggyBank.icon ? (
                                    <IconOrSvg
                                        value={header.piggyBank.icon}
                                        className="w-5 h-5 group-hover:scale-110 transition-transform"
                                    />
                                ) : null}
                                {header.piggyBank.amount && (
                                    <span className="font-semibold text-sm">{header.piggyBank.amount}</span>
                                )}
                            </NavLink>
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
                            <LangSwitch triggerClassName="text-muted-foreground hover:text-primary hover:bg-primary/10" />
                        )}
                    </div>

                    <div className="hidden md:block">
                        {header.utilities?.auth && (
                            <AuthMenu layout="menu" density="normal" showName loginVariant="solid" loginClassName="shadow-glow" loginLabel={header.ctaButton?.label} />
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

                    <div className="md:hidden flex items-center gap-2">
                        {header.utilities?.notifications && <NotificationBell />}
                        {header.utilities?.search && <CommandTriggerButton />}
                        {header.utilities?.themeSwitch !== false && (
                            <ClientOnly fallback={<div className="w-8 h-8" />}>
                                {() => <ToggleButtonTheme />}
                            </ClientOnly>
                        )}
                        <MobileMenuSheet triggerClassName="text-muted-foreground hover:text-primary">
                            {(close) => (
                                <>
                                    {header.nav.map((item, idx) => {
                                        const isActive = isNavItemActive(item.path);
                                        return (
                                            <NavLink
                                                key={idx}
                                                to={item.path}
                                                ariaCurrent={isActive ? "page" : undefined}
                                                className={`block py-2 transition-colors ${isActive ? 'text-primary font-medium' : 'text-muted-foreground hover:text-primary'}`}
                                                onClick={close}
                                            >
                                                {t(item.label)}
                                            </NavLink>
                                        );
                                    })}

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
                                        <LangSwitch triggerClassName="w-full justify-start text-muted-foreground hover:text-primary hover:bg-primary/10" />
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
                    </div>
                </div>
            </div>

        </nav>
    );
}
