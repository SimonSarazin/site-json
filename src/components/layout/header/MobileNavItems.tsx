import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { useT } from "@/hooks/useT";
import { cn } from "@/lib/utils";
import { Header } from "@/types/site-schema";
import NavLink from "../NavLink";
import NavIcon from "./NavIcon";
import { Badge } from "@/components/ui/badge";

type HeaderNavItem = Header["nav"][number];

/** Palette de teinte du menu mobile. `default` = surface claire (tokens de thème) ;
 *  `onColor` = panneau sombre/teinté (texte blanc) — ex. HeaderTransparentDark, qui
 *  force `contentClassName="bg-header-bar text-white"`, où `text-foreground` serait illisible. */
type Tone = "default" | "onColor";

const PALETTE: Record<Tone, {
  parent: string;
  parentActive: string;
  group: string;
  child: string;
  childActive: string;
  desc: string;
  chevron: string;
  border: string;
}> = {
  default: {
    parent: "text-foreground hover:text-primary",
    parentActive: "text-primary",
    group: "text-foreground",
    child: "text-muted-foreground hover:text-foreground",
    childActive: "text-primary",
    desc: "text-muted-foreground",
    chevron: "text-muted-foreground hover:text-foreground",
    border: "border-border/40",
  },
  onColor: {
    parent: "text-white/90 hover:text-white",
    parentActive: "text-white",
    group: "text-white",
    child: "text-white/70 hover:text-white",
    childActive: "text-white",
    desc: "text-white/60",
    chevron: "text-white/70 hover:text-white",
    border: "border-white/15",
  },
};

interface MobileNavItemsProps {
  items: HeaderNavItem[];
  /** "sections" (groupes déployés, enfants toujours visibles — défaut) ou
   *  "accordion" (groupes pliables via chevron). */
  display?: "sections" | "accordion";
  /** Teinte : `default` (surface claire) ou `onColor` (panneau sombre, texte blanc). */
  tone?: Tone;
  /** Ferme le Sheet à la navigation. */
  onNavigate: () => void;
  /** État actif d'un chemin (cf. useNavItemActive). */
  isActive: (path?: string) => boolean;
}

/** Cible de navigation d'un item : route interne `path`, sinon lien externe `href`
 *  (NavLink détecte http(s) → `target=_blank`). L'état actif, lui, ne porte que sur `path`. */
const navTarget = (item: HeaderNavItem) => item.path ?? item.href;

/** Un parent est un LIEN s'il a une cible réelle ; "#"/vide → groupe pur (non-cliquable). */
const isLink = (to?: string) => !!to && to !== "#";

/**
 * Rend les items de nav (y compris leurs `children`) dans le menu MOBILE.
 * Réutilisable par les headers (la sous-nav était absente du menu mobile de
 * plusieurs d'entre eux → sous-pages inaccessibles sur téléphone).
 *
 * Deux modes (`display`) + distinction lien/groupe : un parent avec `path` réel
 * reste navigable ; un parent sans path (ou "#") sert d'en-tête/toggle de groupe.
 */
export default function MobileNavItems({ items, display = "sections", tone = "default", onNavigate, isActive }: MobileNavItemsProps) {
  const t = useT("components/layout");
  const [openIdx, setOpenIdx] = useState<number | null>(null);
  const c = PALETTE[tone];

  const renderChild = (child: HeaderNavItem, i: number) => {
    const active = isActive(child.path);
    return (
      <NavLink
        key={i}
        to={navTarget(child)}
        ariaCurrent={active ? "page" : undefined}
        onClick={onNavigate}
        className={cn(
          "flex items-start gap-2 py-1.5 text-sm transition-colors",
          active ? cn(c.childActive, "font-medium") : c.child,
        )}
      >
        <NavIcon icon={child.icon} className="h-4 w-4 shrink-0 mt-0.5" />
        <span className="flex flex-col">
          <span className="flex items-center gap-2">
            {t(child.label)}
            {child.badge && <Badge className="text-xs px-1.5 py-0">{t(child.badge.text)}</Badge>}
          </span>
          {child.description && (
            <span className={cn("text-xs", c.desc)}>{t(child.description)}</span>
          )}
        </span>
      </NavLink>
    );
  };

  return (
    <>
      {items.map((item, idx) => {
        const children = item.children;
        const active = isActive(item.path);

        // Sans enfants → lien simple (comportement historique).
        if (!children?.length) {
          return (
            <NavLink
              key={idx}
              to={navTarget(item)}
              ariaCurrent={active ? "page" : undefined}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-2 py-2 transition-colors",
                active ? cn(c.childActive, "font-medium") : c.child,
              )}
            >
              <NavIcon icon={item.icon} />
              {t(item.label)}
              {item.badge && <Badge className="ml-auto text-xs px-2 py-0.5">{t(item.badge.text)}</Badge>}
            </NavLink>
          );
        }

        const parentLink = isLink(navTarget(item));

        // ── Accordéon ─────────────────────────────────────────────────────
        if (display === "accordion") {
          const open = openIdx === idx;
          const toggle = () => setOpenIdx(open ? null : idx);
          return (
            <div key={idx} className={cn("border-b last:border-0", c.border)}>
              <div className="flex items-center">
                {parentLink ? (
                  <NavLink
                    to={navTarget(item)}
                    ariaCurrent={active ? "page" : undefined}
                    onClick={onNavigate}
                    className={cn(
                      "flex flex-1 items-center gap-2 py-2 transition-colors",
                      active ? cn(c.parentActive, "font-medium") : c.parent,
                    )}
                  >
                    <NavIcon icon={item.icon} />
                    {t(item.label)}
                  </NavLink>
                ) : (
                  <button
                    type="button"
                    onClick={toggle}
                    className={cn("flex flex-1 items-center gap-2 py-2 text-left font-medium", c.group)}
                  >
                    <NavIcon icon={item.icon} />
                    {t(item.label)}
                  </button>
                )}
                <button
                  type="button"
                  onClick={toggle}
                  aria-expanded={open}
                  aria-label={t(item.label)}
                  className={cn("p-2", c.chevron)}
                >
                  <ChevronDown className={cn("h-4 w-4 transition-transform", open && "rotate-180")} />
                </button>
              </div>
              {open && <div className="ml-6 pb-1">{children.map(renderChild)}</div>}
            </div>
          );
        }

        // ── Sections (défaut) : en-tête + enfants toujours visibles ────────
        return (
          <div key={idx} className="py-1">
            {parentLink ? (
              <NavLink
                to={navTarget(item)}
                ariaCurrent={active ? "page" : undefined}
                onClick={onNavigate}
                className={cn(
                  "flex items-center gap-2 py-2 font-semibold transition-colors",
                  active ? c.parentActive : c.parent,
                )}
              >
                <NavIcon icon={item.icon} />
                {t(item.label)}
              </NavLink>
            ) : (
              <div className={cn("flex items-center gap-2 py-2 font-semibold", c.group)}>
                <NavIcon icon={item.icon} />
                {t(item.label)}
              </div>
            )}
            <div className={cn("ml-6 border-l pl-3", c.border)}>{children.map(renderChild)}</div>
          </div>
        );
      })}
    </>
  );
}
