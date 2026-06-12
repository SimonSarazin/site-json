import { useLoadNamespace } from "@/hooks/useLoadNamespace";
import { useT } from "@/hooks/useT";
import { Header } from "@/types/site-schema";
import { ChevronDown } from "lucide-react";
import { Link } from "react-router";

import NavLink from "../NavLink";
import LangSwitch from "./LangSwitch";
import MobileMenuSheet from "./MobileMenuSheet";
import MobileMenuBrand from "./MobileMenuBrand";
import { ClientOnly } from "../ClientOnly";
import { AuthMenu } from "@/modules/auth";
import { OptimizedImage } from "@/components/ui/OptimizedImage";
import ToggleButtonTheme from "@/components/layout/ToggleButtonTheme";
import NotificationBell from "@/modules/notification/components/NotificationBell";
import CommandTriggerButton from "@/modules/commandPalette/components/CommandTriggerButton";

interface HeaderMegaMenuProps {
    header: Header;
}

export default function HeaderMegaMenu({ header }: HeaderMegaMenuProps) {
    useLoadNamespace("components/layout");
    const t = useT("components/layout");
    const nav = header.nav;

    return (
        <header className={`${header.transparent ? "bg-transparent" : "bg-background"} rounded-b-2xl border-b border-border ${header.sticky ? "sticky top-0 z-50" : ""}`}>
            <nav className="container mx-auto py-3 sm:py-4 px-4 sm:px-6">
                <div className="flex items-center justify-between">
                    <div className="flex items-center shrink-0 gap-2 sm:gap-3">
                        <Link to={header.path || "/"} className="flex items-center shrink-0">
                            {header.logo && (
                                <OptimizedImage
                                    src={`/${header.logo}`}
                                    alt={header.logoAlt ? t(header.logoAlt) : ""}
                                    width={207}
                                    height={48}
                                    className="h-6 xs:h-8 sm:h-9 w-auto max-w-28 xs:max-w-32 sm:max-w-40 object-contain"
                                />
                            )}
                        </Link>
                    </div>

                    {/* Menu desktop */}
                    <div className="hidden xl:flex items-center space-x-1.5 text-sm font-medium ml-8 min-w-0">
                        {nav.map((item, idx) => {
                            const hasChildren = !!item.children?.length;

                            return (
                                <div key={idx} className="relative group">
                                    <button type="button" className="hover:text-primary text-foreground transition flex items-center gap-1 truncate w-auto cursor-pointer">
                                        {t(item.label)}
                                        {hasChildren && <ChevronDown className="w-3 h-3" />}
                                    </button>


                                    {hasChildren && item.children && (
                                        <div className="absolute left-1/2 -translate-x-1/2 top-full mt-2 w-screen max-w-2xl bg-popover text-popover-foreground rounded-xl shadow-2xl border border-border opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 p-8 z-60">
                                            {item.featured ? (
                                                <div className="grid grid-cols-3 gap-8">
                                                    <NavLink to={item.path} className="text-primary font-semibold flex items-center gap-2">
                                                        <div className="flex flex-col items-center justify-center border-r border-border pr-6">
                                                            <div className="w-20 h-20 bg-accent rounded-full flex items-center justify-center mb-4">
                                                                <svg className="w-8 h-8 text-accent-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                                                </svg>
                                                            </div>
                                                            <h3 className="font-bold text-popover-foreground text-center mb-2">
                                                                {item.children[0] && t(item.children[0].label)}
                                                            </h3>
                                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                                                            </svg>
                                                        </div>
                                                    </NavLink>


                                                    <div className="col-span-2 grid grid-cols-2 gap-6">
                                                        {item.children.slice(1).map((sub, i) => (
                                                            <NavLink key={i} to={sub.path} className="block hover:bg-accent rounded-lg p-2 -m-2 transition">
                                                                <h4 className="font-bold text-popover-foreground mb-2">{t(sub.label)}</h4>
                                                                <p className="text-muted-foreground text-xs leading-relaxed">
                                                                    {sub.description ? t(sub.description) : ""}
                                                                </p>
                                                            </NavLink>
                                                        ))}
                                                    </div>
                                                </div>
                                            ) : item.children.length > 2 ? (
                                                <div className="grid grid-cols-2 gap-6">
                                                    {item.children.map((sub, i) => (
                                                        <NavLink key={i} to={sub.path} className="block hover:bg-accent rounded-lg p-2 -m-2 transition">
                                                            <h4 className="font-bold text-popover-foreground mb-2">{t(sub.label)}</h4>
                                                            <p className="text-muted-foreground text-xs leading-relaxed">
                                                                {sub.description ? t(sub.description) : ""}
                                                            </p>
                                                        </NavLink>
                                                    ))}
                                                </div>
                                            ) : (
                                                <div className="space-y-4">
                                                    {item.children.map((sub, i) => (
                                                        <NavLink key={i} to={sub.path} className="block hover:bg-accent rounded-lg p-2 -m-2 transition">
                                                            <h4 className="font-bold text-popover-foreground mb-2">{t(sub.label)}</h4>
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
                    </div>

                    <div className="hidden xl:flex items-center space-x-4 text-sm shrink-0 ml-4">
                        {header.utilities?.search && <CommandTriggerButton />}
                        {header.utilities?.notifications && <NotificationBell />}

                        {header.utilities?.themeSwitch !== false && (
                            <ClientOnly fallback={<div className="w-10 h-10" />}>
                                {() => <ToggleButtonTheme />}
                            </ClientOnly>
                        )}

                        {header.utilities?.langSwitch && <LangSwitch />}

                        {header.utilities?.auth && (
                            <AuthMenu layout="menu" density="compact" showName={false} showDropdownHeader loginVariant="solid" />
                        )}
                    </div>

                    <div className="xl:hidden flex items-center gap-1 xs:gap-2 shrink-0 ml-3">
                        {header.utilities?.search && <CommandTriggerButton />}
                        {header.utilities?.notifications && <NotificationBell />}
                        {header.utilities?.themeSwitch !== false && (
                            <ClientOnly fallback={<div className="w-7 h-7 xs:w-8 xs:h-8" />}>
                                {() => <ToggleButtonTheme />}
                            </ClientOnly>
                        )}
                        {header.utilities?.langSwitch && <LangSwitch triggerClassName="gap-0.5 xs:gap-1 px-1.5 xs:px-2 h-8" />}
                        <MobileMenuSheet
                            breakpoint="xl"
                            triggerClassName="text-foreground hover:text-primary"
                            brand={(close) => <MobileMenuBrand header={header} onNavigate={close} />}
                        >
                            {(close) => (
                                <>
                                    {nav.map((item, idx) => (
                                        <div key={idx} className="space-y-2">
                                            <div className="font-semibold text-foreground">{t(item.label)}</div>
                                            {item.children && (
                                                <div className="pl-4 space-y-2">
                                                    {item.children.map((sub, i) => (
                                                        <NavLink
                                                            key={i}
                                                            to={sub.path}
                                                            className="block text-sm text-muted-foreground hover:text-primary transition"
                                                            onClick={close}
                                                        >
                                                            {t(sub.label)}
                                                        </NavLink>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    ))}

                                    {header.utilities?.auth && (
                                        <AuthMenu layout="stack" onAction={close} loginVariant="solid" />
                                    )}
                                </>
                            )}
                        </MobileMenuSheet>
                    </div>
                </div>
            </nav>

        </header>
    );
}