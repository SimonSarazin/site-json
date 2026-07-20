import { useEffect } from "react";
import { useLoadNamespace } from "@/hooks/useLoadNamespace";
import { useT } from "@/hooks/useT";
import type { Header } from "@/types/site-schema";
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
import HeaderLogo from "./HeaderLogo";
import { logoSquareClass, logoSizePx } from "./logoSize";
import NotificationBell from "@/modules/notification/components/NotificationBell";
import CommandTriggerButton from "@/modules/commandPalette/components/CommandTriggerButton";
import { useNavItemActive } from "./useHeaderBehavior";

interface HeaderMinimalProps {
    header: Header;
}

export default function HeaderMinimal({ header }: HeaderMinimalProps) {
    useLoadNamespace("components/layout");
    const t = useT("components/layout");
    const isNavItemActive = useNavItemActive();

    useEffect(() => {
        const body = document.body;
        body.classList.remove("opacity-0", "translate-y-10");
    }, []);

    return (
        <>
            <nav className="fixed top-0 left-0 right-0 z-40 border-b border-gray-100 bg-background/90 backdrop-blur-md transition-colors duration-300">
                <div className="max-w-[1900px] mx-auto px-8 md:px-12 lg:px-16 py-5 flex justify-between items-center">

                    <div className="flex items-center gap-3">
                        <NavLink to={header.path || "/"} className="flex items-center gap-3 group">
                            <HeaderLogo header={header} iconTone="primary" imageClassName={`${logoSquareClass(header.logoSize)} object-contain`} iconClassName="w-8 h-8" imageHeight={logoSizePx(header.logoSize)} />

                            {header.logoTitle && (
                                <span className="font-bold uppercase tracking-[0.2em] text-foreground text-xs hidden md:block group-hover:text-primary transition-colors">
                                    {t(header.logoTitle)}
                                </span>
                            )}
                        </NavLink>
                    </div>

                    <div className="hidden md:flex items-center gap-8 text-sm font-bold uppercase tracking-[0.15em]">
                        {header.nav?.map((item, idx) => (
                            <NavLink
                                key={idx}
                                to={item.path}
                                className="inline-flex items-center gap-1.5 hover:text-primary transition-colors text-foreground"
                            >
                                <NavIcon icon={item.icon} />
                                {t(item.label)}
                                {item.badge && <Badge className="text-xs px-2 py-0.5 normal-case tracking-normal">{t(item.badge.text)}</Badge>}
                            </NavLink>
                        ))}

                        {header.utilities?.notifications && <NotificationBell />}
                        {header.utilities?.search && <CommandTriggerButton />}

                        {header.utilities?.langSwitch && (
                            <LangSwitch triggerClassName="text-foreground hover:text-primary transition-colors" />
                        )}

                        {header.utilities?.themeSwitch !== false && (
                            <ClientOnly fallback={<div className="w-4 h-4" />}>
                                {() => <ToggleButtonTheme />}
                            </ClientOnly>
                        )}

                        {header.utilities?.auth && (
                            <AuthMenu
                                layout="menu"
                                density="compact"
                                showName
                                loginVariant="ghost"
                                loginLabel={header.ctaButton?.label}
                            />
                        )}
                    </div>

                    <div className="md:hidden flex items-center gap-4">
                         {header.utilities?.notifications && <NotificationBell />}
                         {header.utilities?.search && <CommandTriggerButton />}
                         {header.utilities?.themeSwitch !== false && (
                            <ClientOnly fallback={<div className="w-4 h-4" />}>
                                {() => <ToggleButtonTheme />}
                            </ClientOnly>
                        )}
                        <MobileMenuSheet
                            triggerClassName="text-foreground"
                            brand={(close) => <MobileMenuBrand header={header} onNavigate={close} />}
                        >
                            {(close) => (
                                <>
                                    <MobileNavItems
                                        items={header.nav ?? []}
                                        display={header.mobileNavDisplay}
                                        onNavigate={close}
                                        isActive={isNavItemActive}
                                    />

                                    {header.utilities?.auth && (
                                        <AuthMenu
                                            layout="stack"
                                            onAction={close}
                                            loginVariant="ghost"
                                            loginLabel={header.ctaButton?.label}
                                        />
                                    )}
                                </>
                            )}
                        </MobileMenuSheet>
                    </div>
                </div>
            </nav>
        </>
    )
}
