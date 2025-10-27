import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardTitle } from "@/components/ui/card";
import { DynamicIcon, IconName } from "lucide-react/dynamic";
import {
  Menu,
  Globe,
  ChevronDown,
  User,
  LogOut,
  Search,
  ShoppingCart,
  Bell,
} from "lucide-react";
import { useLoadNamespace } from "@/hooks/useLoadNamespace";
import { useT } from "@/hooks/useT";
import { useLocalization } from "@/hooks/useLocalization";
import "@/components/layout/i18n";
import { useSite } from "@/hooks/useSite";
import { useNavigate } from "react-router";
import { useCocolight } from "@/hooks/useCocolight";
import { AnnouncementBanner } from "./AnnouncementBanner";
import { EnhancedNavItemType } from "@/types/site";
import { cn } from "@/lib/utils";
import ToggleButtonTheme from "./ToggleButtonTheme";
import { ClientOnly } from "./ClientOnly";

interface NavItemProps {
  item: EnhancedNavItemType;
  mobile?: boolean;
  onNavigate?: () => void;
}

// Helper to render megamenu columns
function MegaMenuContent({ megaMenu, onNavigate }: { megaMenu: EnhancedNavItemType['megaMenu']; onNavigate?: () => void; }) {
  const t = useT("components/layout");
  const navigate = useNavigate();
  if (!megaMenu) return null;
  const gridCols = {
    sm: 'grid-cols-1',
    md: 'grid-cols-2',
    lg: 'grid-cols-3',
    xl: 'grid-cols-4',
    full: 'grid-cols-5'
  }[megaMenu.width || 'lg'];

  return (
    <DropdownMenuContent className={cn("p-6 bg-background", gridCols)} align="start">
      {megaMenu.columns.map((col, i) => (
        <div key={i}>
          {col.title && <h3 className="mb-2 font-semibold">{t(col.title)}</h3>}
          <ul className="space-y-1">
            {col.links.map((link, j) => (
              <li key={j}>
                <Button
                  variant="ghost"
                  className="justify-start w-full"
                  onClick={() => {
                    if (link.path) navigate(link.path);
                    else if (link.href) window.open(link.href, '_blank');
                    onNavigate?.();
                  }}
                >
                  {link.icon && <DynamicIcon name={link.icon as IconName} className="w-4 h-4 mr-2" />}
                  {t(link.label)}
                </Button>
              </li>
            ))}
          </ul>
          {col.featured && (
            <Card className="mt-4">
              {col.featured.image && <img src={col.featured.image} alt={t(col.featured.title)} className="w-full h-32 object-cover rounded-t" />}
              <CardContent>
                <CardTitle>{t(col.featured.title)}</CardTitle>
                <CardDescription>{t(col.featured.description)}</CardDescription>
                <Button
                  size="sm"
                  onClick={() => col.featured?.href && window.open(col.featured.href, '_blank')}
                >
                  {t('En savoir plus')}
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      ))}
    </DropdownMenuContent>
  );
}

function NavItem({ item, mobile = false, onNavigate }: NavItemProps) {
  useLoadNamespace("components/layout");
  const t = useT("components/layout");
  const navigate = useNavigate();
  const { me } = useCocolight();
  const [open, setOpen] = useState(false);

  // role-based filtering
  if (item.roles && item.roles.length) {
    const userRoles = me?.serverData?.roles || {};
    if (!item.roles.some(r => userRoles[r] === true)) return null;
  }

  const handleNavigate = () => {
    onNavigate?.();
  };

  // Mega menu
  if (item.megaMenu) {
    return (
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className={cn("flex items-center gap-2", mobile && "w-full justify-start")}>
            {item.icon && <DynamicIcon name={item.icon as IconName} className="w-4 h-4" />}
            {t(item.label)}
            <ChevronDown className="w-4 h-4" />
          </Button>
        </DropdownMenuTrigger>
        <MegaMenuContent megaMenu={item.megaMenu} onNavigate={handleNavigate} />
      </DropdownMenu>
    );
  }

  // Classic dropdown
  if (item.children && item.children.length) {
    return (
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className={cn("flex items-center gap-2", mobile && "w-full justify-start") }>
            {item.icon && <DynamicIcon name={item.icon as IconName} className="w-4 h-4" />}
            <div className="flex flex-col">
              <span>{t(item.label)}</span>
              {item.description && <span className="text-xs text-muted-foreground">{t(item.description)}</span>}
            </div>
            <ChevronDown className="w-4 h-4" />
            {item.badge && <Badge className="text-xs px-2 py-0.5">{t(item.badge.text)}</Badge>}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56">
          {item.children.map((child, idx) => (
            <DropdownMenuItem key={idx} asChild>
              <button
                className="flex items-center gap-2 w-full text-left"
                onClick={() => {
                  if (child.path) navigate(child.path);
                  else if (child.href) window.open(child.href, '_blank');
                  handleNavigate();
                }}
              >
                {child.icon && <DynamicIcon name={child.icon as IconName} className="w-4 h-4" />}
                <div className="flex flex-col w-full">
                  <span>{t(child.label)}</span>
                  {child.description && <span className="text-xs text-muted-foreground">{t(child.description)}</span>}
                </div>
                {child.badge && <Badge className="text-xs px-2 py-0.5 ml-auto">{t(child.badge.text)}</Badge>}
              </button>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  // Simple link
  return (
    <Button
      variant="ghost"
      className={cn("flex items-center gap-2", mobile && "w-full justify-start")}
      onClick={(e) => {
        e.preventDefault();
        if (item.path) navigate(item.path);
        else if (item.href) window.open(item.href, '_blank');
        handleNavigate();
      }}
    >
      {item.icon && <DynamicIcon name={item.icon as IconName} className="w-4 h-4" />}
      {t(item.label)}
      {item.badge && <Badge className="text-xs px-2 py-0.5">{t(item.badge.text)}</Badge>}
    </Button>
  );
}

export function SiteHeader() {
  const { config } = useSite();
  useLoadNamespace("components/layout");
  const t = useT("components/layout");
  const { currentLocale, setLocale, availableLocales } = useLocalization();
  const navigate = useNavigate();
  const { me, api } = useCocolight();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const { header } = config;

  const headerBg = header.transparent ? 'bg-transparent' : 'bg-background/95 backdrop-blur-sm supports-backdrop-filter:bg-background/60';
  const headerHeight = {
    sm: 'h-12',
    md: 'h-16',
    lg: 'h-20'
  }[header.height];

  const handleLogoClick = (e: React.MouseEvent) => {
    e.preventDefault();
    navigate('/');
  };
  const handleLogout = () => {
    if (!api) return;
    try { api.logout(); navigate('/'); }
    catch (err) { console.error('Logout error', err); }
  };

  return (
    <header role="navigation" className={cn('border-b', headerBg, header.sticky && 'sticky top-0 z-50')} style={{}}>
      {header.announcement && <AnnouncementBanner {...header.announcement} />}
      <div className={cn('container mx-auto px-4 sm:px-6 lg:px-8', headerHeight)}>
        <div className="flex items-center justify-between h-full">
          {/* Logo */}
          <button onClick={handleLogoClick} className="flex items-center gap-2">
            <img src={header.logo} alt={header.logoAlt ? t(header.logoAlt) : 'Logo'} className="h-8 w-auto rounded" />
          </button>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-1">
            {header.nav.map((item, idx) => (<NavItem key={idx} item={item} />))}
          </nav>

          {/* Utilities & Mobile Trigger */}
          <div className="flex items-center gap-2">
            {header.utilities.themeSwitch && <ToggleButtonTheme />}
            {header.utilities.langSwitch && availableLocales.length > 1 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="gap-2">
                    <Globe className="h-4 w-4" />{currentLocale.toUpperCase()}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  {availableLocales.map(loc => (
                    <DropdownMenuItem key={loc} onClick={() => setLocale(loc)} className={loc === currentLocale ? 'bg-accent' : ''}>
                      {loc.toUpperCase()}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            {header.utilities.search && <Button variant="ghost" size="sm"><Search className="h-4 w-4" /></Button>}
            {header.utilities.cart && <Button variant="ghost" size="sm"><ShoppingCart className="h-4 w-4" /></Button>}
            {header.utilities.notifications && <Button variant="ghost" size="sm"><Bell className="h-4 w-4" /></Button>}
            {header.utilities.auth && (
              <ClientOnly fallback={<div className="hidden md:flex items-center"><Button variant="ghost" disabled size="sm">…</Button></div>}>
                {() => (
                  <div className="hidden md:flex items-center">
                    {me?.isConnected ? (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="gap-2">
                            <User className="h-4 w-4" />
                            <span>{me.serverData?.name || me.serverData?.email || t('Mon compte')}</span>
                            <ChevronDown className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56">
                          <DropdownMenuItem onClick={() => navigate('/profile')}><User className="mr-2 h-4 w-4" />{t('Profil')}</DropdownMenuItem>
                          <DropdownMenuItem onClick={handleLogout}><LogOut className="mr-2 h-4 w-4" />{t('Se déconnecter')}</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    ) : (
                      <Button variant="ghost" size="sm" onClick={() => navigate('/login')}>{t('Se connecter')}</Button>
                    )}
                  </div>
                )}
              </ClientOnly>
            )}
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild><Button variant="ghost" size="sm" className="md:hidden"><Menu className="h-4 w-4" /><span className="sr-only">{t('Toggle menu')}</span></Button></SheetTrigger>
              <SheetContent side="right" className="w-72">
                <SheetTitle className="sr-only">{t('Mobile Menu')}</SheetTitle>
                <div className="flex flex-col gap-4 py-4">
                  {header.nav.map((item, idx) => (<NavItem key={idx} item={item} mobile onNavigate={() => setMobileMenuOpen(false)} />))}
                  {header.utilities.auth && (
                    <div className="pt-4 border-t">
                      {me?.isConnected ? (
                        <>
                          <Button variant="ghost" className="w-full justify-start" onClick={() => { navigate('/profile'); setMobileMenuOpen(false); }}><User className="mr-2 h-4 w-4" />{t('Profil')}</Button>
                          <Button variant="ghost" className="w-full justify-start" onClick={() => { handleLogout(); setMobileMenuOpen(false); }}><LogOut className="mr-2 h-4 w-4" />{t('Se déconnecter')}</Button>
                        </>
                      ) : (
                        <Button variant="ghost" className="w-full justify-start" onClick={() => { navigate('/login'); setMobileMenuOpen(false); }}>{t('Se connecter')}</Button>
                      )}
                    </div>
                  )}
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>
    </header>
  );
}
