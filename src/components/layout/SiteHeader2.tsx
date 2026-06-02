import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
} from "@/components/ui/navigation-menu";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Menu as MenuIcon, ShoppingCart } from "lucide-react";
import { useLoadNamespace } from "@/hooks/useLoadNamespace";
import { useT } from "@/hooks/useT";
import { useLocalization } from "@/hooks/useLocalization";
import { useSite } from "@/hooks/useSite";
import { useNavigate } from "react-router";
import { useCocolight } from "@/hooks/useCocolight";
import { AnnouncementBanner } from "./AnnouncementBanner";
import ToggleButtonTheme from "./ToggleButtonTheme";
import { ClientOnly } from "./ClientOnly";
import { EnhancedNavItemType } from "@/types/site";
import { cn } from "@/lib/utils";
import { DynamicIcon, IconName } from "lucide-react/dynamic";
import { OptimizedImage } from "@/components/ui/OptimizedImage";
import NotificationBell from "@/modules/notification/components/NotificationBell";
import CommandTriggerButton from "@/modules/commandPalette/components/CommandTriggerButton";

export function SiteHeader2() {
  const { config } = useSite();
  useLoadNamespace("components/layout");
  const t = useT("components/layout");
  const { currentLocale, setLocale, availableLocales } = useLocalization();
  const navigate = useNavigate();
  const { me, api } = useCocolight();
  const [mobileOpen, setMobileOpen] = useState(false);

  const { header } = config;

  // Filtrer selon les rôles de l'utilisateur
  const filteredNav = header.nav.filter((item) => {
    if (!item.roles || item.roles.length === 0) return true;
    const userRoles = me?.serverData?.roles || {};
    return item.roles.some((r) => userRoles[r] === true);
  });

  const handleLogoClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    navigate("/");
  };

  const handleLogout = () => {
    if (!api) return;
    try {
      api.logout();
      navigate("/");
    } catch (err) {
      console.error("Erreur lors de la déconnexion:", err);
    }
  };

  return (
    <header
      role="navigation"
      className={cn(
        "border-b bg-background/95 backdrop-blur-sm supports-backdrop-filter:bg-background/60",
        header.sticky && "sticky top-0 z-50"
      )}
    >
      {header.announcement && <AnnouncementBanner {...header.announcement} />}
      <div className="container mx-auto px-4 py-4">
        {/* Desktop */}
        <nav className="hidden lg:flex items-center justify-between">
          <div className="flex items-center gap-6">
            <a href="#" onClick={handleLogoClick} className="flex items-center gap-2">
              <OptimizedImage
                src={header.logo ?? ""}
                alt={header.logoAlt ? t(header.logoAlt) : ""}
                height={32}
                className="h-8 w-auto rounded"
              />
              {header.logoAlt && (
                <span className="text-lg font-semibold tracking-tight">
                  {t(header.logoAlt)}
                </span>
              )}
            </a>
            <NavigationMenu viewport={false}>
              <NavigationMenuList>
                {filteredNav.map((item) =>
                  renderMenuItem(item, t, navigate)
                )}
              </NavigationMenuList>
            </NavigationMenu>
          </div>

          <div className="flex items-center gap-2">
            {header.utilities.themeSwitch && <ToggleButtonTheme />}
            {header.utilities.langSwitch && availableLocales.length > 1 && (
              <NavigationMenu>
                <NavigationMenuList>
                  <NavigationMenuItem>
                    <NavigationMenuTrigger>
                      {currentLocale.toUpperCase()}
                    </NavigationMenuTrigger>
                    <NavigationMenuContent>
                      {availableLocales.map((loc) => (
                        <NavigationMenuLink asChild key={loc}>
                          <a onClick={() => setLocale(loc)}>
                            {loc.toUpperCase()}
                          </a>
                        </NavigationMenuLink>
                      ))}
                    </NavigationMenuContent>
                  </NavigationMenuItem>
                </NavigationMenuList>
              </NavigationMenu>
            )}

            {header.utilities.search && <CommandTriggerButton />}

            {header.utilities.cart && (
              <Button variant="ghost" size="sm">
                <ShoppingCart className="h-4 w-4" />
              </Button>
            )}

            {header.utilities.notifications && <NotificationBell />}

            {header.utilities.auth && (
              <ClientOnly
                fallback={
                  <Button variant="ghost" size="sm" disabled>
                    {t("…")}
                  </Button>
                }
              >
                {() =>
                  me?.isConnected ? (
                    <NavigationMenu>
                      <NavigationMenuList>
                        <NavigationMenuItem>
                          <NavigationMenuTrigger>
                            {me.serverData?.name || me.serverData?.email ||
                              t("Mon compte")}
                          </NavigationMenuTrigger>
                          <NavigationMenuContent>
                            <NavigationMenuLink asChild>
                              <a onClick={() => navigate("/profile")}> 
                                {t("Profil")}
                              </a>
                            </NavigationMenuLink>
                            <NavigationMenuLink asChild>
                              <a onClick={handleLogout}>
                                {t("Se déconnecter")}
                              </a>
                            </NavigationMenuLink>
                          </NavigationMenuContent>
                        </NavigationMenuItem>
                      </NavigationMenuList>
                    </NavigationMenu>
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => navigate("/login")}
                    >
                      {t("Se connecter")}
                    </Button>
                  )
                }
              </ClientOnly>
            )}
          </div>
        </nav>

        {/* Mobile */}
        <div className="flex lg:hidden items-center justify-between">
          <a href="#" onClick={handleLogoClick}>
            <OptimizedImage
              src={header.logo ?? ""}
              alt={header.logoAlt ? t(header.logoAlt) : ""}
              height={32}
              className="h-8 w-auto rounded"
            />
          </a>
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon">
                <MenuIcon className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-64">
              <SheetHeader>
                <SheetTitle>
                  <a href="#" onClick={handleLogoClick}>
                    <OptimizedImage
                      src={header.logo ?? ""}
                      alt={header.logoAlt ? t(header.logoAlt) : ""}
                      height={32}
                      className="h-8 w-auto rounded"
                    />
                  </a>
                </SheetTitle>
              </SheetHeader>
              <div className="flex flex-col gap-4 p-4">
                <Accordion type="single" collapsible className="w-full">
                  {filteredNav.map((item) =>
                    renderMobileItem(item, t, navigate, setMobileOpen)
                  )}
                </Accordion>
                <div className="flex flex-col gap-2">
                  {header.utilities.auth &&
                    (me?.isConnected ? (
                      <>
                        <Button asChild variant="outline">
                          <a
                            href="#"
                            onClick={() => {
                              navigate("/profile");
                              setMobileOpen(false);
                            }}
                          >
                            {t("Profil")}
                          </a>
                        </Button>
                        <Button asChild>
                          <a
                            href="#"
                            onClick={() => {
                              handleLogout();
                              setMobileOpen(false);
                            }}
                          >
                            {t("Se déconnecter")}
                          </a>
                        </Button>
                      </>
                    ) : (
                      <Button asChild>
                        <a
                          href="#"
                          onClick={() => {
                            navigate("/login");
                            setMobileOpen(false);
                          }}
                        >
                          {t("Se connecter")}
                        </a>
                      </Button>
                    ))}
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}

function renderMenuItem(
  item: EnhancedNavItemType,
  t: (val: Record<string, string>) => string,
  navigate: (path: string) => void
) {
  if (item.children && item.children.length > 0) {
    return (
      <NavigationMenuItem key={t(item.label)}>
        <NavigationMenuTrigger>{t(item.label)}</NavigationMenuTrigger>
        <NavigationMenuContent className="bg-popover text-popover-foreground">
          {item.children.map((child) => (
            <NavigationMenuLink asChild key={t(child.label)}>
                  <a
      className="flex flex-row gap-4 rounded-md p-3 leading-none no-underline transition-colors outline-none select-none hover:bg-muted hover:text-accent-foreground"
                      href={child.href || child.path || "#"}
                onClick={(e) => {
                  e.preventDefault();
                  if (child.path) navigate(child.path);
                  else if (child.href) window.open(child.href, "_blank");
                }}
    >
      <div className="text-foreground">
        {/* Icône dynamique */}
            {child.icon && (
              <DynamicIcon name={child.icon as IconName} className="w-4 h-4" />
            )}
      </div>
      <div>
        <div className="text-sm font-semibold">{t(child.label)}</div>
        {child.description && (
          <p className="text-sm leading-snug text-muted-foreground">
            {t(child.description)}
          </p>
        )}
      </div>
    </a>
            </NavigationMenuLink>
          ))}
        </NavigationMenuContent>
      </NavigationMenuItem>
    );
  }
  return (
    <NavigationMenuItem key={t(item.label)}>
      <NavigationMenuLink asChild>
        <a
          href={item.href || item.path || "#"}
          onClick={(e) => {
            e.preventDefault();
            if (item.path) navigate(item.path);
            else if (item.href) window.open(item.href, "_blank");
          }}
          className="group inline-flex h-10 w-max items-center justify-center rounded-md bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-muted hover:text-accent-foreground"
        >
          {t(item.label)}
        </a>
      </NavigationMenuLink>
    </NavigationMenuItem>
  );
}

function renderMobileItem(
  item: EnhancedNavItemType,
  t: (val: Record<string, string>) => string,
  navigate: (path: string) => void,
  close: (open: boolean) => void
) {
  if (item.children && item.children.length > 0) {
    return (
      <AccordionItem key={t(item.label)} value={t(item.label)} className="border-b">
        <AccordionTrigger className="text-md py-0 font-semibold hover:no-underline">{t(item.label)}</AccordionTrigger>
        <AccordionContent className="mt-2">
          {item.children.map((child) => (
                <a
                key={t(child.label)}
      className="flex flex-row gap-4 rounded-md p-3 leading-none no-underline transition-colors outline-none select-none hover:bg-muted hover:text-accent-foreground"
      href={child.href || child.path || "#"}
              onClick={(e) => {
                e.preventDefault();
                if (child.path) navigate(child.path);
                else if (child.href) window.open(child.href, "_blank");
                close(false);
              }}
    >
      <div className="text-foreground">{item.icon}</div>
      <div>
        <div className="text-sm font-semibold">{t(child.label)}</div>
        {child.description && (
          <p className="text-sm leading-snug text-muted-foreground">
            {t(child.description)}
          </p>
        )}
      </div>
    </a>
          ))}
        </AccordionContent>
      </AccordionItem>
    );
  }
  return (
    <a
      key={t(item.label)}
      href={item.href || item.path || "#"}
      onClick={(e) => {
        e.preventDefault();
        if (item.path) navigate(item.path);
        else if (item.href) window.open(item.href, "_blank");
        close(false);
      }}
      className="text-md font-semibold"
    >
      {t(item.label)}
    </a>
  );
}
