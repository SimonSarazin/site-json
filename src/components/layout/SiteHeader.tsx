import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from '@/components/ui/sheet';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { Menu, Moon, Sun, Globe, ChevronDown, User, LogOut } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useLocalization } from '@/contexts/LocalizationContext';
import { useSite } from '@/contexts/SiteContext';
import { useRouterContext } from '@/contexts/RouterContext';
import { useCocolight } from '@/hooks/useCocolight';
import { NavItem as NavItemType } from '@/types/site';
import { cn } from '@/lib/utils';

interface NavItemProps {
  item: NavItemType;
  mobile?: boolean;
  onNavigate?: () => void;
}

function NavItem({ item, mobile = false, onNavigate }: NavItemProps) {
  const { t } = useLocalization();
  const { navigate } = useRouterContext();
  const [isOpen, setIsOpen] = useState(false);

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    
    if (item.path) {
      navigate(item.path);
      onNavigate?.();
    } else if (item.href) {
      if (item.href.startsWith('http') || item.href.startsWith('//')) {
        window.open(item.href, '_blank', 'noopener,noreferrer');
      } else {
        window.location.href = item.href;
      }
      onNavigate?.();
    }
  };

  const hasChildren = item.children && item.children.length > 0;

  if (hasChildren) {
    return (
      <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
        <DropdownMenuTrigger asChild>
          <Button 
            variant="ghost" 
            className={cn(
              "flex items-center gap-2",
              mobile && "w-full justify-start"
            )}
          >
            {item.icon && <span className="w-4 h-4" />}
            {t(item.label)}
            <ChevronDown className="w-4 h-4" />
            {item.badge && (
              <Badge variant="secondary" className="text-xs">
                {t(item.badge.text)}
              </Badge>
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56">
          {item.children.map((child, index) => (
            <DropdownMenuItem key={index} asChild>
              <button
                className="flex items-center gap-2 w-full text-left"
                onClick={(e) => {
                  e.preventDefault();
                  if (child.path) {
                    navigate(child.path);
                  } else if (child.href) {
                    if (child.href.startsWith('http') || child.href.startsWith('//')) {
                      window.open(child.href, '_blank', 'noopener,noreferrer');
                    } else {
                      window.location.href = child.href;
                    }
                  }
                  onNavigate?.();
                }}
              >
                {child.icon && <span className="w-4 h-4" />}
                {t(child.label)}
                {child.badge && (
                  <Badge variant="secondary" className="text-xs ml-auto">
                    {t(child.badge.text)}
                  </Badge>
                )}
              </button>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return (
    <Button
      variant="ghost"
      className={cn(
        "flex items-center gap-2",
        mobile && "w-full justify-start"
      )}
      onClick={handleClick}
    >
      {item.icon && <span className="w-4 h-4" />}
      {t(item.label)}
      {item.badge && (
        <Badge variant="secondary" className="text-xs">
          {t(item.badge.text)}
        </Badge>
      )}
    </Button>
  );
}

export function SiteHeader() {
  const { config } = useSite();
  const { t, currentLocale, setLocale, availableLocales } = useLocalization();
  const { setTheme, theme } = useTheme();
  const { navigate } = useRouterContext();
  const { me, userApi, loading } = useCocolight();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const { header } = config;

  console.log('me', me?.isConnected);
  
  const handleLogoClick = (e: React.MouseEvent) => {
    e.preventDefault();
    navigate('/');
  };

  const handleLogout = async () => {
    try {
      await userApi.logout();
      navigate('/');
    } catch (error) {
      console.error('Erreur lors de la déconnexion:', error);
    }
  };

  return (
    <header className={cn(
      "border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60",
      header.sticky && "sticky top-0 z-50"
    )}>
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-2">
            <button onClick={handleLogoClick} className="flex items-center gap-2">
              <img 
                src={header.logo} 
                alt={header.logoAlt ? t(header.logoAlt) : 'Logo'} 
                className="h-8 w-auto rounded"
              />
            </button>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-1">
            {header.nav.map((item, index) => (
              <NavItem key={index} item={item} />
            ))}
          </nav>

          {/* Utilities */}
          <div className="flex items-center gap-2">
            {/* Theme Switch */}
            {header.utilities.themeSwitch && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              >
                <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
                <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
                <span className="sr-only">Toggle theme</span>
              </Button>
            )}

            {/* Language Switch */}
            {header.utilities.langSwitch && availableLocales.length > 1 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="gap-2">
                    <Globe className="h-4 w-4" />
                    {currentLocale.toUpperCase()}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  {availableLocales.map((locale) => (
                    <DropdownMenuItem
                      key={locale}
                      onClick={() => setLocale(locale)}
                      className={locale === currentLocale ? 'bg-accent' : ''}
                    >
                      {locale.toUpperCase()}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            {/* Mobile Menu */}
            {/* Auth Button */}
            {header.utilities.auth && !loading && (
              <div className="hidden md:flex items-center">
                {me?.isConnected ? (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="gap-2">
                        <User className="h-4 w-4" />
                        <span>{me?.serverData?.name || me?.serverData?.email || 'Mon compte'}</span>
                        <ChevronDown className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56">
                      <DropdownMenuItem onClick={() => navigate('/profile')}>
                        <User className="mr-2 h-4 w-4" />
                        Profil
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={handleLogout}>
                        <LogOut className="mr-2 h-4 w-4" />
                        Se déconnecter
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                ) : (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => navigate('/login')}
                  >
                    Se connecter
                  </Button>
                )}
              </div>
            )}

            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="sm" className="md:hidden">
                  <Menu className="h-4 w-4" />
                  <span className="sr-only">Toggle menu</span>
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-72">
                <SheetTitle className="sr-only">Mobile Menu</SheetTitle>
                <div className="flex flex-col gap-4 py-4">
                  {header.nav.map((item, index) => (
                    <NavItem 
                      key={index} 
                      item={item} 
                      mobile 
                      onNavigate={() => setMobileMenuOpen(false)}
                    />
                  ))}
                  
                  {/* Auth in mobile menu */}
                  {header.utilities.auth && !loading && (
                    <div className="pt-4 border-t">
                      {me?.isConnected ? (
                        <div className="space-y-2">
                          <Button
                            variant="ghost"
                            className="w-full justify-start"
                            onClick={() => {
                              navigate('/profile');
                              setMobileMenuOpen(false);
                            }}
                          >
                            <User className="mr-2 h-4 w-4" />
                            Profil
                          </Button>
                          <Button
                            variant="ghost"
                            className="w-full justify-start"
                            onClick={() => {
                              handleLogout();
                              setMobileMenuOpen(false);
                            }}
                          >
                            <LogOut className="mr-2 h-4 w-4" />
                            Se déconnecter
                          </Button>
                        </div>
                      ) : (
                        <Button
                          variant="ghost"
                          className="w-full justify-start"
                          onClick={() => {
                            navigate('/login');
                            setMobileMenuOpen(false);
                          }}
                        >
                          Se connecter
                        </Button>
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