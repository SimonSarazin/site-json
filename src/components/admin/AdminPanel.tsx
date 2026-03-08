import { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router";
import { useSite } from "@/hooks/useSite";
import { useCocolight } from "@/hooks/useCocolight";
import type { Section, SiteConfig } from "@/types/site-schema";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Settings, Trash2, Pencil, Plus, ArrowLeft, Save,
  FileText, Layers, Navigation, PanelBottom, Link as LinkIcon,
} from "lucide-react";
import { toast } from "sonner";
import ZodAutoForm from "./zod-auto-form/ZodAutoForm";
import { getSectionPropsSchema, createDefaultValue, resolveType } from "./zod-auto-form/schema-utils";
import { Section as SectionSchema, SiteConfig as SiteConfigSchema, Header as HeaderSchema, Footer as FooterSchema } from "@/types/site-schema";
import { ObjectFields } from "./zod-auto-form/ZodAutoForm";
import { SortableList } from "./SortableList";
import SECTION_META from "./section-meta";
import { IconField } from "./zod-auto-form/fields/IconField";

const HeaderFieldsSchema = HeaderSchema.omit({ nav: true });
const FooterFieldsSchema = FooterSchema.omit({ columns: true });

const ADDABLE_SECTIONS: { type: string; label: string; desc: string; image: string }[] = SectionSchema.options
  .map((opt: import("zod").ZodTypeAny) => {
    const d = opt._def as any;
    const type = (d.shape.type as import("zod").ZodLiteral<string>).value;
    const meta = SECTION_META[type];
    return { type, label: meta?.label ?? type, desc: meta?.desc ?? "", image: meta?.image ?? "" };
  })
  .sort((a: { label: string }, b: { label: string }) => a.label.localeCompare(b.label));

type View =
  | { mode: "pages" }
  | { mode: "sections"; pageIndex: number }
  | { mode: "editSection"; pageIndex: number; sectionIndex: number }
  | { mode: "addPage" }
  | { mode: "header" }
  | { mode: "editNavItem"; navIndex: number }
  | { mode: "footer" }
  | { mode: "editFooterColumn"; columnIndex: number }
  | { mode: "settings" }
  | { mode: "editSetting"; settingKey: string };

const SETTING_ENTRIES: { key: string; label: string; icon: string }[] = (() => {
  const shape = (SiteConfigSchema._def as any).shape as Record<string, import("zod").ZodTypeAny>;
  const skip = new Set(["pages", "header", "footer", "version", "generated"]);
  return Object.keys(shape)
    .filter((k) => !skip.has(k))
    .map((k) => ({
      key: k,
      label: k.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^./, (c) => c.toUpperCase()),
      icon: k,
    }));
})();

type NavItem = any;
type FooterColumn = any;
type FooterLink = any;

function SectionPicker({ value, onChange, onAdd }: { value: string; onChange: (v: string) => void; onAdd: () => void }) {
  const [open, setOpen] = useState(false);
  const [hovered, setHovered] = useState<typeof ADDABLE_SECTIONS[number] | null>(null);
  const [search, setSearch] = useState("");

  const filtered = search
    ? ADDABLE_SECTIONS.filter((s) =>
      s.label.toLowerCase().includes(search.toLowerCase()) ||
      s.type.toLowerCase().includes(search.toLowerCase()) ||
      s.desc.toLowerCase().includes(search.toLowerCase())
    )
    : ADDABLE_SECTIONS;

  return (
    <div className="relative">
      {open && (
        <div className="absolute bottom-full left-0 right-0 mb-1 z-50">
          <div className="bg-popover border rounded-md shadow-lg flex flex-col max-h-[60vh]">
            <div className="p-2 border-b">
              <Input
                placeholder="Rechercher..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-7 text-xs"
                autoFocus
              />
            </div>
            <div className="overflow-y-auto flex-1 p-1">
              {filtered.map((s) => (
                <button
                  key={s.type}
                  className={`w-full text-left px-3 py-1.5 rounded text-xs hover:bg-accent transition-colors flex items-center gap-2 ${value === s.type ? "bg-accent font-medium" : ""
                    }`}
                  onMouseEnter={() => setHovered(s)}
                  onMouseLeave={() => setHovered(null)}
                  onClick={() => { onChange(s.type); setOpen(false); setSearch(""); }}
                >
                  {s.image && <img src={s.image} alt="" className="w-8 h-5 rounded object-cover shrink-0" />}
                  <span className="truncate">{s.label}</span>
                </button>
              ))}
              {filtered.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-4">Aucun résultat</p>
              )}
            </div>
          </div>
        </div>
      )}

      {open && hovered && (
        <div className="fixed z-50 w-96 bg-popover border rounded-md shadow-xl overflow-hidden"
          style={{ right: 508, bottom: 80 }}>
          {hovered.image && (
            <img src={hovered.image} alt={hovered.label} className="w-full h-60 object-cover" />
          )}
          <div className="p-3">
            <div className="text-sm font-semibold">{hovered.label}</div>
            <div className="text-xs text-muted-foreground leading-tight mt-1">{hovered.desc}</div>
          </div>
        </div>
      )}

      {/* Bouton unique : sélection + ajout */}
      <div className="flex gap-2">
        <Button
          variant="outline"
          className="flex-1 justify-start text-left font-normal"
          onClick={() => setOpen(!open)}
        >
          {value ? <Badge variant="secondary">{value}</Badge> : <span className="text-muted-foreground">Type de section...</span>}
        </Button>
        <Button size="icon" onClick={() => { onAdd(); setOpen(false); }} disabled={!value}>
          <Plus className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

export default function AdminPanel() {
  const { me, entity } = useCocolight();
  const isAdmin = me?.isConnected && entity?.isAdmin?.();

  const { config, setConfig } = useSite();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [addType, setAddType] = useState<string>("");
  const [newPagePath, setNewPagePath] = useState("/nouvelle-page");
  const [newPageTitle, setNewPageTitle] = useState("");
  const [sheetOpen, setSheetOpen] = useState(false);

  const currentPageIndex = Math.max(
    config.pages.findIndex((p) => p.path === pathname),
    0
  );
  const [view, setView] = useState<View>({ mode: "sections", pageIndex: currentPageIndex });

  useEffect(() => {
    if (view.mode === "sections" || view.mode === "editSection") {
      setView({ mode: "sections", pageIndex: currentPageIndex });
    }
  }, [pathname]); 

  useEffect(() => {
    if (!sheetOpen) return;
    const style = document.createElement("style");
    style.id = "admin-hover-highlight";
    style.textContent = `
      [data-section-index].admin-highlight {
        outline: 2px dashed var(--primary);
        outline-offset: 4px;
        margin-top: 6px;
        margin-bottom: 6px;
        position: relative;
        z-index: 10;
      }
      [data-section-index].admin-highlight::after {
        content: attr(data-section-type) " #" attr(data-section-index);
        position: absolute;
        top: -14px;
        left: 8px;
        background: var(--primary);
        color: var(--primary-foreground);
        font-size: 11px;
        font-weight: 500;
        padding: 2px 8px;
        border-radius: 4px;
        z-index: 50;
        pointer-events: none;
      }
    `;
    document.head.appendChild(style);
    return () => { style.remove(); };
  }, [sheetOpen]);

  // if (!isAdmin) return null;
  function highlightSection(index: number | null) {
    document.querySelectorAll("[data-section-index].admin-highlight").forEach((el) => el.classList.remove("admin-highlight"));
    if (index === null) return;
    const el = document.querySelector<HTMLElement>(`[data-section-index="${index}"]`);
    if (el) {
      el.classList.add("admin-highlight");
      el.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }

  function patch(partial: Partial<SiteConfig>) {
    setConfig({ ...config, ...partial });
  }

  const header = config.header;
  const footer = config.footer;
  const nav: NavItem[] = header?.nav ?? [];
  const columns: FooterColumn[] = footer?.columns ?? [];


  function updateSections(pageIdx: number, fn: (s: Section[]) => Section[]) {
    patch({
      pages: config.pages.map((p, i) =>
        i === pageIdx ? { ...p, sections: fn(p.sections) } : p
      ),
    });
  }

  function removeSection(pageIdx: number, idx: number) {
    updateSections(pageIdx, (s) => s.filter((_, i) => i !== idx));
    if (view.mode === "editSection" && view.sectionIndex === idx)
      setView({ mode: "sections", pageIndex: pageIdx });
  }

  function addSection(pageIdx: number) {
    if (!addType) return;
    const schema = getSectionPropsSchema(addType);
    const defaultProps = schema ? createDefaultValue(schema) : {};
    updateSections(pageIdx, (s) => [...s, { type: addType, props: defaultProps } as Section]);
    setAddType("");
  }

  function updateSectionProps(pageIdx: number, idx: number, newProps: unknown) {
    updateSections(pageIdx, (s) =>
      s.map((sec, i) => (i === idx ? { ...sec, props: newProps } as Section : sec))
    );
  }


  function addPage() {
    if (!newPagePath || !newPageTitle) return;
    const pagePath = newPagePath.startsWith("/") ? newPagePath : `/${newPagePath}`;
    const newPage = { path: pagePath, title: { fr: newPageTitle }, layout: "default" as const, sections: [] as Section[] };
    const newNavItem = { label: { fr: newPageTitle }, path: pagePath };
    patch({
      pages: [...config.pages, newPage],
      header: header ? { ...header, nav: [...nav, newNavItem] } : header,
    });
    toast.success(`Page "${newPageTitle}" créée`);
    setNewPagePath("/nouvelle-page");
    setNewPageTitle("");
    setView({ mode: "sections", pageIndex: config.pages.length });
  }

  function removePage(idx: number) {
    if (config.pages.length <= 1) { toast.error("Impossible de supprimer la dernière page"); return; }
    const removedPath = config.pages[idx].path;
    patch({
      pages: config.pages.filter((_, i) => i !== idx),
      header: header ? { ...header, nav: nav.filter((item: NavItem) => item.path !== removedPath) } : header,
    });
    setView({ mode: "pages" });
    toast.success("Page supprimée");
  }



  function updateNav(newNav: NavItem[]) {
    if (!header) return;
    patch({ header: { ...header, nav: newNav } });
  }

  function addNavItem() {
    updateNav([...nav, { label: { fr: "Nouveau lien" }, path: "/" }]);
  }

  function removeNavItem(idx: number) {
    updateNav(nav.filter((_: NavItem, i: number) => i !== idx));
    if (view.mode === "editNavItem" && view.navIndex === idx)
      setView({ mode: "header" });
  }

  function updateNavItem(idx: number, item: NavItem) {
    updateNav(nav.map((n: NavItem, i: number) => (i === idx ? item : n)));
  }


  function updateFooter(newFooter: typeof footer) {
    patch({ footer: newFooter });
  }

  function updateColumns(newCols: FooterColumn[]) {
    if (!footer) return;
    updateFooter({ ...footer, columns: newCols });
  }

  function addFooterColumn() {
    updateColumns([...columns, { title: { fr: "Nouvelle colonne" }, links: [] }]);
  }

  function removeFooterColumn(idx: number) {
    updateColumns(columns.filter((_: FooterColumn, i: number) => i !== idx));
    if (view.mode === "editFooterColumn" && view.columnIndex === idx)
      setView({ mode: "footer" });
  }

  function updateColumn(idx: number, col: FooterColumn) {
    updateColumns(columns.map((c: FooterColumn, i: number) => (i === idx ? col : c)));
  }


  async function saveConfig() {
    if (import.meta.hot) {
      import.meta.hot.send("config-save", config);
      toast.success("Config sauvegardée");
    } else {
      try {
        const res = await fetch("/api/admin/config-save", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(config),
        });
        if (!res.ok) throw new Error((await res.json()).error || res.statusText);
        toast.success("Config sauvegardée");
      } catch (e) {
        toast.error(`Erreur: ${(e as Error).message}`);
      }
    }
  }


  function renderContent() {
    if ((view.mode === "sections" || view.mode === "editSection") && !config.pages[view.pageIndex])
      return renderPagesView();

    switch (view.mode) {
      case "pages": return renderPagesView();
      case "addPage": return renderAddPageView();
      case "sections": return renderSectionsView(view.pageIndex);
      case "editSection": return renderEditSectionView(view.pageIndex, view.sectionIndex);
      case "header": return renderHeaderView();
      case "editNavItem": return renderEditNavItemView(view.navIndex);
      case "footer": return renderFooterView();
      case "editFooterColumn": return renderEditFooterColumnView(view.columnIndex);
      case "settings": return renderSettingsView();
      case "editSetting": return renderEditSettingView(view.settingKey);
    }
  }


  function renderPagesView() {
    return (
      <div className="flex flex-col h-full min-h-0">
        <SheetHeader className="p-4 border-b shrink-0">
          <SheetTitle className="text-sm">
            Admin <Badge variant="outline" className="ml-2">{config.pages.length} pages</Badge>
          </SheetTitle>
        </SheetHeader>

        <ScrollArea className="flex-1 min-h-0">
          <div className="p-2 space-y-1">
            {header && (
              <div
                className="flex items-center gap-2 p-2 rounded-md border bg-card hover:bg-accent/50 transition-colors cursor-pointer"
                onClick={() => setView({ mode: "header" })}
              >
                <Navigation className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-sm font-medium">Header / Navigation</span>
                <Badge variant="secondary" className="text-[10px] ml-auto">{nav.length} liens</Badge>
              </div>
            )}
            {footer && (
              <div
                className="flex items-center gap-2 p-2 rounded-md border bg-card hover:bg-accent/50 transition-colors cursor-pointer"
                onClick={() => setView({ mode: "footer" })}
              >
                <PanelBottom className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-sm font-medium">Footer</span>
                <Badge variant="secondary" className="text-[10px] ml-auto">{columns.length} colonnes</Badge>
              </div>
            )}
            <div
              className="flex items-center gap-2 p-2 rounded-md border bg-card hover:bg-accent/50 transition-colors cursor-pointer"
              onClick={() => setView({ mode: "settings" })}
            >
              <Settings className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-sm font-medium">Paramètres du site</span>
              <Badge variant="secondary" className="text-[10px] ml-auto">{SETTING_ENTRIES.length}</Badge>
            </div>
          </div>

          <div className="px-4 py-1">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Pages</p>
          </div>

          <div className="p-2 space-y-1">
            {config.pages.map((page, idx) => {
              const isCurrent = page.path === pathname;
              return (
              <div key={page.path}
                className={`flex items-center gap-1 p-2 rounded-md border transition-colors cursor-pointer ${
                  isCurrent
                    ? "bg-accent-foreground hover:bg-accent/50 border-primary"
                    : "bg-card hover:bg-accent/50"
                }`}
                onClick={() => setView({ mode: "sections", pageIndex: idx })}
              >
                <FileText className={`h-3.5 w-3.5 shrink-0 text-muted-foreground`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {page.title?.fr || page.path}
                  </p>
                  <p className="text-xs text-muted-foreground">{page.path}</p>
                </div>
                <Badge variant="secondary" className="text-[10px] shrink-0">{page.sections.length}</Badge>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button size="icon" variant="ghost"
                      className="h-7 w-7 text-destructive hover:text-destructive shrink-0"
                      onClick={(e) => e.stopPropagation()}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Supprimer cette page ?</AlertDialogTitle>
                      <AlertDialogDescription>
                        La page <strong>{page.path}</strong> sera supprimée.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Annuler</AlertDialogCancel>
                      <AlertDialogAction onClick={() => removePage(idx)}>Supprimer</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            );
            })}
          </div>
        </ScrollArea>

        <div className="p-4 border-t space-y-2 shrink-0">
          <Button className="w-full" variant="outline" onClick={() => setView({ mode: "addPage" })}>
            <Plus className="h-4 w-4 mr-2" /> Ajouter une page
          </Button>
          <Button className="w-full" onClick={saveConfig}>
            <Save className="h-4 w-4 mr-2" /> Sauvegarder
          </Button>
        </div>
      </div>
    );
  }


  function renderAddPageView() {
    return (
      <div className="flex flex-col h-full min-h-0">
        <SheetHeader className="p-4 border-b shrink-0">
          <div className="flex items-center gap-2">
            <Button size="icon" variant="ghost" onClick={() => setView({ mode: "pages" })}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <SheetTitle className="text-sm">Nouvelle page</SheetTitle>
          </div>
        </SheetHeader>
        <div className="p-4 space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Titre (fr)</Label>
            <Input value={newPageTitle} onChange={(e) => setNewPageTitle(e.target.value)} placeholder="Ma nouvelle page" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Chemin (URL)</Label>
            <Input value={newPagePath} onChange={(e) => setNewPagePath(e.target.value)} placeholder="/ma-page" />
          </div>
          <Button className="w-full" onClick={addPage} disabled={!newPagePath || !newPageTitle}>
            <Plus className="h-4 w-4 mr-2" /> Créer la page
          </Button>
        </div>
      </div>
    );
  }


  function renderSectionsView(pageIdx: number) {
    const page = config.pages[pageIdx];
    if (!page) return null;

    return (
      <div className="flex flex-col h-full min-h-0">
        <SheetHeader className="p-4 border-b shrink-0">
          <div className="flex items-center gap-2">
            <Button size="icon" variant="ghost" onClick={() => setView({ mode: "pages" })}>
              <Layers className="h-4 w-4" />
            </Button>
            <SheetTitle className="text-sm truncate">
              {page.title?.fr || page.path}
              <Badge variant="outline" className="ml-2">{page.sections.length}</Badge>
              {page.path === pathname && <span className="ml-1.5 inline-flex items-center rounded-full bg-background text-white text-[9px] font-semibold px-1.5 py-0 leading-4">ici</span>}
            </SheetTitle>
            {page.path !== pathname && (
              <Button size="sm" variant="ghost" className="ml-auto text-xs" onClick={() => navigate(page.path)}>
                Voir
              </Button>
            )}
          </div>
        </SheetHeader>

        <ScrollArea className="flex-1 min-h-0">
          <div className="p-2">
            <SortableList
              items={page.sections}
              getId={(s, i) => s.id ?? `section-${i}`}
              onReorder={(newSections) =>
                updateSections(pageIdx, () => newSections)
              }
              renderItem={(section, idx) => (
                <div className="flex items-center gap-1 p-2 rounded-md border bg-card hover:border-primary/50 transition-colors"
                  onMouseEnter={() => highlightSection(idx)}
                  onMouseLeave={() => highlightSection(null)}>
                  <div className="flex-1 min-w-0">
                    <Badge variant="secondary" className="text-xs">{section.type}</Badge>
                    {section.id && <span className="text-xs text-muted-foreground ml-1">#{section.id}</span>}
                  </div>
                  <Button size="icon" variant="ghost" className="h-7 w-7"
                    onClick={() => setView({ mode: "editSection", pageIndex: pageIdx, sectionIndex: idx })}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive">
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Supprimer cette section ?</AlertDialogTitle>
                        <AlertDialogDescription>La section <strong>{section.type}</strong> sera supprimée.</AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Annuler</AlertDialogCancel>
                        <AlertDialogAction onClick={() => removeSection(pageIdx, idx)}>Supprimer</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              )}
            />
          </div>
        </ScrollArea>

        <div className="p-4 border-t space-y-2 shrink-0">
          <SectionPicker value={addType} onChange={setAddType} onAdd={() => addSection(pageIdx)} />
          <Button className="w-full" onClick={saveConfig}>
            <Save className="h-4 w-4 mr-2" /> Sauvegarder
          </Button>
        </div>
      </div>
    );
  }


  function renderEditSectionView(pageIdx: number, sectionIdx: number) {
    const page = config.pages[pageIdx];
    const section = page?.sections[sectionIdx];
    if (!page || !section) return null;
    const propsSchema = getSectionPropsSchema(section.type);

    return (
      <div className="flex flex-col h-full min-h-0">
        <SheetHeader className="p-4 border-b shrink-0">
          <div className="flex items-center gap-2">
            <Button size="icon" variant="ghost" onClick={() => setView({ mode: "sections", pageIndex: pageIdx })}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <SheetTitle className="text-sm">
              Édition : <Badge variant="secondary">{section.type}</Badge>
            </SheetTitle>
          </div>
        </SheetHeader>
        <div className="flex-1 min-h-0 p-4 overflow-y-auto flex flex-col">
          {propsSchema ? (
            <ZodAutoForm schema={propsSchema} value={section.props as Record<string, unknown>}
              onChange={(newProps) => updateSectionProps(pageIdx, sectionIdx, newProps)} />
          ) : (
            <p className="text-xs text-muted-foreground">Aucun schéma trouvé pour "{section.type}".</p>
          )}
        </div>
      </div>
    );
  }


  function renderHeaderView() {
    if (!header) return null;

    const { nav: _nav, ...headerFieldsValue } = header as Record<string, unknown> & { nav: unknown };

    return (
      <div className="flex flex-col h-full min-h-0">
        <SheetHeader className="p-4 border-b shrink-0">
          <div className="flex items-center gap-2">
            <Button size="icon" variant="ghost" onClick={() => setView({ mode: "pages" })}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <SheetTitle className="text-sm">Header & Navigation</SheetTitle>
          </div>
        </SheetHeader>

        <div className="flex-1 min-h-0 overflow-y-auto">
          <div className="p-4 space-y-4">
            <ObjectFields
              schema={HeaderFieldsSchema}
              value={headerFieldsValue as Record<string, unknown>}
              onChange={(v) => patch({ header: { ...header, ...v } })}
              compact
            />

            <div className="space-y-2 pt-2 border-t">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Liens de navigation <Badge variant="outline" className="ml-2">{nav.length}</Badge>
              </p>
              <SortableList
                items={nav}
                getId={(_: NavItem, i: number) => `nav-${i}`}
                onReorder={updateNav}
                renderItem={(item: NavItem, idx: number) => (
                  <div className="flex items-center gap-1 p-2 rounded-md border bg-card"
                    onMouseEnter={() => highlightSection(null)}
                  >
                    <LinkIcon className="h-3 w-3 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{item.label?.fr || "—"}</p>
                      <p className="text-xs text-muted-foreground truncate">{item.path || item.href || "—"}</p>
                    </div>
                    <Button size="icon" variant="ghost" className="h-7 w-7"
                      onClick={() => setView({ mode: "editNavItem", navIndex: idx })}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive">
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Supprimer ce lien ?</AlertDialogTitle>
                          <AlertDialogDescription>Le lien &quot;{item.label?.fr}&quot; sera supprimé du menu.</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Annuler</AlertDialogCancel>
                          <AlertDialogAction onClick={() => removeNavItem(idx)}>Supprimer</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                )}
              />
              <Button className="w-full" variant="outline" size="sm" onClick={addNavItem}>
                <Plus className="h-4 w-4 mr-2" /> Ajouter un lien
              </Button>
            </div>
          </div>
        </div>

        <div className="p-4 border-t shrink-0">
          <Button className="w-full" onClick={saveConfig}>
            <Save className="h-4 w-4 mr-2" /> Sauvegarder
          </Button>
        </div>
      </div>
    );
  }


  function renderEditNavItemView(navIdx: number) {
    const item = nav[navIdx];
    if (!item) return renderHeaderView();

    function update(partial: Partial<NavItem>) {
      updateNavItem(navIdx, { ...item, ...partial });
    }

    return (
      <div className="flex flex-col h-full min-h-0">
        <SheetHeader className="p-4 border-b shrink-0">
          <div className="flex items-center gap-2">
            <Button size="icon" variant="ghost" onClick={() => setView({ mode: "header" })}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <SheetTitle className="text-sm">Lien : {item.label?.fr || "—"}</SheetTitle>
          </div>
        </SheetHeader>
        <div className="flex-1 min-h-0 overflow-y-auto p-4">
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Label (fr)</Label>
              <Input value={item.label?.fr ?? ""} onChange={(e) => update({ label: { ...item.label, fr: e.target.value } })} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Label (en) <span className="text-muted-foreground">(optionnel)</span></Label>
              <Input value={item.label?.en ?? ""} onChange={(e) => update({ label: { ...item.label, en: e.target.value || undefined } })} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Chemin (route interne)</Label>
              <Input value={item.path ?? ""} onChange={(e) => update({ path: e.target.value || undefined })} placeholder="/about" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">URL externe <span className="text-muted-foreground">(optionnel)</span></Label>
              <Input value={item.href ?? ""} onChange={(e) => update({ href: e.target.value || undefined })} placeholder="https://example.com" />
            </div>
            <IconField
              label="Icône"
              fieldKey="icon"
              value={item.icon}
              onChange={(v) => update({ icon: v as string | undefined })}
              isOptional
              compact
            />
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Description <span className="text-muted-foreground">(optionnel)</span></Label>
              <Input value={(item as any).description?.fr ?? ""} onChange={(e) => update({ description: e.target.value ? { fr: e.target.value } : undefined } as any)} placeholder="Description du lien" />
            </div>
          </div>
        </div>
        <div className="p-4 border-t shrink-0">
          <Button className="w-full" onClick={saveConfig}>
            <Save className="h-4 w-4 mr-2" /> Sauvegarder
          </Button>
        </div>
      </div>
    );
  }


  function renderFooterView() {
    if (!footer) return null;

    const { columns: _cols, ...footerFieldsValue } = footer as Record<string, unknown> & { columns: unknown };

    return (
      <div className="flex flex-col h-full min-h-0">
        <SheetHeader className="p-4 border-b shrink-0">
          <div className="flex items-center gap-2">
            <Button size="icon" variant="ghost" onClick={() => setView({ mode: "pages" })}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <SheetTitle className="text-sm">
              Footer <Badge variant="outline" className="ml-2">{columns.length} colonnes</Badge>
            </SheetTitle>
          </div>
        </SheetHeader>

        <ScrollArea className="flex-1 min-h-0">
          <div className="p-4 border-b">
            <ObjectFields
              schema={FooterFieldsSchema}
              value={footerFieldsValue as Record<string, unknown>}
              onChange={(v) => updateFooter({ ...footer, ...v })}
              compact
            />
          </div>

          <div className="p-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-2 py-1">
              Colonnes
            </p>
            <SortableList
              items={columns}
              getId={(_: FooterColumn, i: number) => `col-${i}`}
              onReorder={updateColumns}
              renderItem={(col: FooterColumn, idx: number) => (
                <div className="flex items-center gap-1 p-2 rounded-md border bg-card">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{col.title?.fr || "—"}</p>
                    <p className="text-xs text-muted-foreground">{col.links?.length ?? 0} liens</p>
                  </div>
                  <Button size="icon" variant="ghost" className="h-7 w-7"
                    onClick={() => setView({ mode: "editFooterColumn", columnIndex: idx })}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive">
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Supprimer cette colonne ?</AlertDialogTitle>
                        <AlertDialogDescription>La colonne "{col.title?.fr}" sera supprimée.</AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Annuler</AlertDialogCancel>
                        <AlertDialogAction onClick={() => removeFooterColumn(idx)}>Supprimer</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              )}
            />
          </div>
        </ScrollArea>

        <div className="p-4 border-t space-y-2 shrink-0">
          <Button className="w-full" variant="outline" onClick={addFooterColumn}>
            <Plus className="h-4 w-4 mr-2" /> Ajouter une colonne
          </Button>
          <Button className="w-full" onClick={saveConfig}>
            <Save className="h-4 w-4 mr-2" /> Sauvegarder
          </Button>
        </div>
      </div>
    );
  }


  function renderEditFooterColumnView(colIdx: number) {
    const col = columns[colIdx];
    if (!col) return renderFooterView();
    const links: FooterLink[] = col.links ?? [];

    function updateCol(partial: Partial<FooterColumn>) {
      updateColumn(colIdx, { ...col, ...partial });
    }

    function updateLink(linkIdx: number, partial: Partial<FooterLink>) {
      updateCol({
        links: links.map((l: FooterLink, i: number) => (i === linkIdx ? { ...l, ...partial } : l)),
      });
    }

    function addLink() {
      updateCol({ links: [...links, { href: "#", label: { fr: "Nouveau lien" } }] });
    }

    function removeLink(linkIdx: number) {
      updateCol({ links: links.filter((_: FooterLink, i: number) => i !== linkIdx) });
    }

    return (
      <div className="flex flex-col h-full min-h-0">
        <SheetHeader className="p-4 border-b shrink-0">
          <div className="flex items-center gap-2">
            <Button size="icon" variant="ghost" onClick={() => setView({ mode: "footer" })}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <SheetTitle className="text-sm">Colonne : {col.title?.fr || "—"}</SheetTitle>
          </div>
        </SheetHeader>

        <ScrollArea className="flex-1 min-h-0">
          <div className="p-4 border-b space-y-1.5">
            <Label className="text-xs font-medium">Titre de la colonne (fr)</Label>
            <Input value={col.title?.fr ?? ""}
              onChange={(e) => updateCol({ title: { ...col.title, fr: e.target.value } })} />
          </div>

          <div className="p-2">
            <SortableList
              items={links}
              getId={(_: FooterLink, i: number) => `link-${i}`}
              onReorder={(newLinks: FooterLink[]) => updateCol({ links: newLinks })}
              renderItem={(link: FooterLink, idx: number) => (
                <div className="p-2 rounded-md border bg-card space-y-2">
                  <div className="flex items-center gap-1">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">{link.label?.fr || "—"}</p>
                      <p className="text-[10px] text-muted-foreground truncate">{link.href}</p>
                    </div>
                    <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive" onClick={() => removeLink(idx)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                  <div className="space-y-1.5">
                    <Input className="h-7 text-xs" value={link.label?.fr ?? ""} placeholder="Label"
                      onChange={(e) => updateLink(idx, { label: { ...link.label, fr: e.target.value } })} />
                    <Input className="h-7 text-xs" value={link.href ?? ""} placeholder="URL"
                      onChange={(e) => updateLink(idx, { href: e.target.value })} />
                  </div>
                </div>
              )}
            />
          </div>
        </ScrollArea>

        <div className="p-4 border-t space-y-2 shrink-0">
          <Button className="w-full" variant="outline" onClick={addLink}>
            <Plus className="h-4 w-4 mr-2" /> Ajouter un lien
          </Button>
          <Button className="w-full" onClick={saveConfig}>
            <Save className="h-4 w-4 mr-2" /> Sauvegarder
          </Button>
        </div>
      </div>
    );
  }

  function renderSettingsView() {
    return (
      <div className="flex flex-col h-full min-h-0">
        <SheetHeader className="p-4 border-b shrink-0">
          <div className="flex items-center gap-2">
            <Button size="icon" variant="ghost" onClick={() => setView({ mode: "pages" })}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <SheetTitle className="text-sm">Paramètres du site</SheetTitle>
          </div>
        </SheetHeader>

        <ScrollArea className="flex-1 min-h-0">
          <div className="p-2 space-y-1">
            {SETTING_ENTRIES.map(({ key, label }) => {
              const val = (config as any)[key];
              const isEmpty = val === undefined || val === null;
              return (
                <div
                  key={key}
                  className="flex items-center gap-2 p-2 rounded-md border bg-card hover:bg-accent/50 transition-colors cursor-pointer"
                  onClick={() => setView({ mode: "editSetting", settingKey: key })}
                >
                  <Layers className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <span className="text-sm font-medium flex-1">{label}</span>
                  {isEmpty && (
                    <Badge variant="outline" className="text-[10px] text-muted-foreground">vide</Badge>
                  )}
                  <Pencil className="h-3 w-3 text-muted-foreground" />
                </div>
              );
            })}
          </div>
        </ScrollArea>

        <div className="p-4 border-t shrink-0">
          <Button className="w-full" onClick={saveConfig}>
            <Save className="h-4 w-4 mr-2" /> Sauvegarder
          </Button>
        </div>
      </div>
    );
  }

  function renderEditSettingView(settingKey: string) {
    const shape = (SiteConfigSchema._def as any).shape as Record<string, import("zod").ZodTypeAny>;
    const fieldSchema = shape[settingKey];
    if (!fieldSchema) return null;

    const currentValue = (config as any)[settingKey];
    const label = settingKey.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^./, (c) => c.toUpperCase());

    const { innerSchema } = resolveType(fieldSchema);
    const isObject = innerSchema._def?.type === "object";

    return (
      <div className="flex flex-col h-full min-h-0">
        <SheetHeader className="p-4 border-b shrink-0">
          <div className="flex items-center gap-2">
            <Button size="icon" variant="ghost" onClick={() => setView({ mode: "settings" })}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <SheetTitle className="text-sm truncate">{label}</SheetTitle>
          </div>
        </SheetHeader>

        <div className="flex-1 min-h-0 overflow-y-auto">
          <div className="p-4">
            {isObject ? (
              <ZodAutoForm
                schema={innerSchema}
                value={(currentValue as Record<string, unknown>) ?? {}}
                onChange={(v) => patch({ [settingKey]: v })}
              />
            ) : (
              <ZodAutoForm
                schema={fieldSchema}
                value={{ [settingKey]: currentValue }}
                onChange={(v) => patch({ [settingKey]: v[settingKey] })}
              />
            )}
          </div>
        </div>

        <div className="p-4 border-t shrink-0">
          <Button className="w-full" onClick={saveConfig}>
            <Save className="h-4 w-4 mr-2" /> Sauvegarder
          </Button>
        </div>
      </div>
    );
  }


  return (
    <Sheet modal={false} open={sheetOpen} onOpenChange={setSheetOpen}>
      <SheetTrigger asChild>
        <Button size="icon" variant="outline"
          className="fixed bottom-4 right-4 z-[9999] h-12 w-12 rounded-full shadow-lg bg-background border-2">
          <Settings className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-[500px] sm:max-w-[500px] p-0 h-full flex flex-col overflow-hidden" noOverlay>
        {renderContent()}
      </SheetContent>
    </Sheet>
  );
}
