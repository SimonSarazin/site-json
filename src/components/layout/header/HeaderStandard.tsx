import { useState } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
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
  ChevronDown,
  ShoppingCart,
} from "lucide-react";
import { useLoadNamespace } from "@/hooks/useLoadNamespace";
import { useT } from "@/hooks/useT";
import "@/components/layout/i18n";
import { Header } from "@/types/site-schema";
import NavLink from "../NavLink";
import LangSwitch from "./LangSwitch";
import MobileMenuSheet from "./MobileMenuSheet";
import MobileMenuBrand from "./MobileMenuBrand";
import { useCocolight } from "@/hooks/useCocolight";
import { AuthMenu } from "@/modules/auth";
import { EnhancedNavItemType } from "@/types/site";
import { cn } from "@/lib/utils";
import { AnnouncementBanner } from "../AnnouncementBanner";
import ToggleButtonTheme from "../ToggleButtonTheme";
import { OptimizedImage } from "@/components/ui/OptimizedImage";
import HeaderLogo from "./HeaderLogo";
import { logoHeightClass, logoSizePx } from "./logoSize";
import NotificationBell from "@/modules/notification/components/NotificationBell";
import CommandTriggerButton from "@/modules/commandPalette/components/CommandTriggerButton";

interface NavItemProps {
  item: EnhancedNavItemType;
  mobile?: boolean;
  onNavigate?: () => void;
}

// Helper to render megamenu columns
function MegaMenuContent({ megaMenu, onNavigate }: { megaMenu: EnhancedNavItemType['megaMenu']; onNavigate?: () => void; }) {
  const t = useT("components/layout");
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
                <NavLink
                  to={link.path ?? link.href}
                  className={cn(buttonVariants({ variant: "ghost" }), "justify-start w-full")}
                  onClick={() => onNavigate?.()}
                >
                  {link.icon && <DynamicIcon name={link.icon as IconName} className="w-4 h-4 mr-2" />}
                  {t(link.label)}
                </NavLink>
              </li>
            ))}
          </ul>
          {col.featured && (
            <Card className="mt-4">
              {col.featured.image && <OptimizedImage src={col.featured.image} alt={t(col.featured.title)} width={400} className="w-full h-32 object-cover rounded-t" />}
              <CardContent>
                <CardTitle>{t(col.featured.title)}</CardTitle>
                <CardDescription>{t(col.featured.description)}</CardDescription>
                <NavLink
                  to={col.featured?.href}
                  className={cn(buttonVariants({ size: "sm" }))}
                >
                  {t('En savoir plus')}
                </NavLink>
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
              <NavLink
                to={child.path ?? child.href}
                className="flex items-center gap-2 w-full text-left"
                onClick={handleNavigate}
              >
                {child.icon && <DynamicIcon name={child.icon as IconName} className="w-4 h-4" />}
                <div className="flex flex-col w-full">
                  <span>{t(child.label)}</span>
                  {child.description && <span className="text-xs text-muted-foreground">{t(child.description)}</span>}
                </div>
                {child.badge && <Badge className="text-xs px-2 py-0.5 ml-auto">{t(child.badge.text)}</Badge>}
              </NavLink>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  // Simple link
  return (
    <NavLink
      to={item.path ?? item.href}
      className={cn(buttonVariants({ variant: "ghost" }), "flex items-center gap-2", mobile && "w-full justify-start")}
      onClick={handleNavigate}
    >
      {item.icon && <DynamicIcon name={item.icon as IconName} className="w-4 h-4" />}
      {t(item.label)}
      {item.badge && <Badge className="text-xs px-2 py-0.5">{t(item.badge.text)}</Badge>}
    </NavLink>
  );
}


interface HeaderStandardProps {
  header: Header;
}

export function HeaderStandard({ header }: HeaderStandardProps) {
  useLoadNamespace("components/layout");

  const headerBg = header.transparent ? 'bg-transparent' : 'bg-background/95 backdrop-blur-sm supports-backdrop-filter:bg-background/60';
  const headerHeight = {
    sm: 'h-12',
    md: 'h-16',
    lg: 'h-20'
  }[header.height];

  return (
    <header role="navigation" className={cn('border-b', headerBg, header.sticky && 'sticky top-0 z-50')} style={{}}>
      {header.announcement && <AnnouncementBanner {...header.announcement} />}
      <div className={cn('container mx-auto px-4 sm:px-6 lg:px-8', headerHeight)}>
        <div className="flex items-center justify-between h-full">
          {/* Logo */}
          <NavLink to={header.path || "/"} className="flex items-center gap-2">
            <HeaderLogo header={header} imageClassName={`${logoHeightClass(header.logoSize)} w-auto rounded`} iconClassName="h-8 w-8" imageHeight={logoSizePx(header.logoSize)} />
          </NavLink>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-1">
            {header.nav.map((item, idx) => (<NavItem key={idx} item={item} />))}
          </nav>

          {/* Utilities & Mobile Trigger */}
          <div className="flex items-center gap-2">
            {header.utilities.themeSwitch && <ToggleButtonTheme />}
            {header.utilities.langSwitch && <LangSwitch />}
            {header.utilities.search && <CommandTriggerButton />}
            {header.utilities.cart && <Button variant="ghost" size="sm"><ShoppingCart className="h-4 w-4" /></Button>}
            {header.utilities.notifications && <NotificationBell />}
            {header.utilities.auth && (
              <div className="hidden md:flex items-center">
                <AuthMenu layout="menu" density="normal" showName loginVariant="ghost" />
              </div>
            )}
            <MobileMenuSheet brand={(close) => <MobileMenuBrand header={header} onNavigate={close} />}>
              {(close) => (
                <>
                  {header.nav.map((item, idx) => (<NavItem key={idx} item={item} mobile onNavigate={close} />))}
                  {header.utilities.auth && (
                    <AuthMenu layout="stack" onAction={close} loginVariant="ghost" />
                  )}
                </>
              )}
            </MobileMenuSheet>
          </div>
        </div>
      </div>
    </header>
  );
}

export default HeaderStandard;
