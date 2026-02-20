import { useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { useSite } from "@/hooks/useSite";
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
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Settings, Trash2, Pencil, Plus, ArrowLeft, Save,
  FileText, Layers, Navigation, PanelBottom, Link as LinkIcon,
} from "lucide-react";
import { toast } from "sonner";
import ZodAutoForm from "./zod-auto-form/ZodAutoForm";
import { getSectionPropsSchema, createDefaultValue, resolveType } from "./zod-auto-form/schema-utils";
import { Section as SectionSchema, SiteConfig as SiteConfigSchema } from "@/types/site-schema";
import { SortableList } from "./SortableList";

const ADDABLE_SECTIONS: { type: string; label: string }[] = SectionSchema.options
  .map((opt: import("zod").ZodTypeAny) => {
    const d = opt._def as any;
    const type = (d.shape.type as import("zod").ZodLiteral<string>).value;
    return { type, label: type };
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

export default function AdminPanel() {
  const { config, setConfig } = useSite();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [addType, setAddType] = useState<string>("");
  const [newPagePath, setNewPagePath] = useState("/nouvelle-page");
  const [newPageTitle, setNewPageTitle] = useState("");

  const currentPageIndex = Math.max(
    config.pages.findIndex((p) => p.path === pathname),
    0
  );
  const [view, setView] = useState<View>({ mode: "sections", pageIndex: currentPageIndex });


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


  function saveConfig() {
    if (import.meta.hot) {
      import.meta.hot.send("config-save", config);
      toast.success("Config sauvegardée");
    } else {
      toast.error("HMR non disponible");
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
            {config.pages.map((page, idx) => (
              <div key={page.path}
                className="flex items-center gap-1 p-2 rounded-md border bg-card hover:bg-accent/50 transition-colors cursor-pointer"
                onClick={() => setView({ mode: "sections", pageIndex: idx })}
              >
                <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{page.title?.fr || page.path}</p>
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
            ))}
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
            </SheetTitle>
            <Button size="sm" variant="ghost" className="ml-auto text-xs" onClick={() => navigate(page.path)}>
              Voir
            </Button>
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
                <div className="flex items-center gap-1 p-2 rounded-md border bg-card">
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
          <div className="flex gap-2">
            <Select value={addType} onValueChange={setAddType}>
              <SelectTrigger className="flex-1"><SelectValue placeholder="Type de section..." /></SelectTrigger>
              <SelectContent>
                {ADDABLE_SECTIONS.map((s) => (
                  <SelectItem key={s.type} value={s.type}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="icon" onClick={() => addSection(pageIdx)} disabled={!addType}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
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
        <ScrollArea className="flex-1 min-h-0 p-4">
          {propsSchema ? (
            <ZodAutoForm schema={propsSchema} value={section.props as Record<string, unknown>}
              onChange={(newProps) => updateSectionProps(pageIdx, sectionIdx, newProps)} />
          ) : (
            <p className="text-xs text-muted-foreground">Aucun schéma trouvé pour "{section.type}".</p>
          )}
        </ScrollArea>
      </div>
    );
  }


  function renderHeaderView() {
    if (!header) return null;

    return (
      <div className="flex flex-col h-full min-h-0">
        <SheetHeader className="p-4 border-b shrink-0">
          <div className="flex items-center gap-2">
            <Button size="icon" variant="ghost" onClick={() => setView({ mode: "pages" })}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <SheetTitle className="text-sm">
              Navigation <Badge variant="outline" className="ml-2">{nav.length}</Badge>
            </SheetTitle>
          </div>
        </SheetHeader>

        <ScrollArea className="flex-1 min-h-0">
          <div className="p-2">
            <SortableList
              items={nav}
              getId={(_: NavItem, i: number) => `nav-${i}`}
              onReorder={updateNav}
              renderItem={(item: NavItem, idx: number) => (
                <div className="flex items-center gap-1 p-2 rounded-md border bg-card">
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
                        <AlertDialogDescription>Le lien "{item.label?.fr}" sera supprimé du menu.</AlertDialogDescription>
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
          </div>
        </ScrollArea>

        <div className="p-4 border-t space-y-2 shrink-0">
          <Button className="w-full" variant="outline" onClick={addNavItem}>
            <Plus className="h-4 w-4 mr-2" /> Ajouter un lien
          </Button>
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
        <ScrollArea className="flex-1 min-h-0 p-4">
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Label (fr)</Label>
              <Input value={item.label?.fr ?? ""} onChange={(e) => update({ label: { ...item.label, fr: e.target.value } })} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Chemin (route interne)</Label>
              <Input value={item.path ?? ""} onChange={(e) => update({ path: e.target.value || undefined })} placeholder="/about" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">URL externe <span className="text-muted-foreground">(optionnel)</span></Label>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Icône <span className="text-muted-foreground">(optionnel)</span></Label>
              <Input value={item.icon ?? ""} onChange={(e) => update({ icon: e.target.value || undefined })} placeholder="Home" />
            </div>
          </div>
        </ScrollArea>
      </div>
    );
  }


  function renderFooterView() {
    if (!footer) return null;

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
          <div className="p-4 border-b space-y-1.5">
            <Label className="text-xs font-medium">Copyright (fr)</Label>
            <Input
              value={footer.copyright?.fr ?? ""}
              onChange={(e) => updateFooter({ ...footer, copyright: { ...footer.copyright, fr: e.target.value } })}
            />
          </div>

          <div className="p-2">
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

        <ScrollArea className="flex-1 min-h-0">
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
        </ScrollArea>

        <div className="p-4 border-t shrink-0">
          <Button className="w-full" onClick={saveConfig}>
            <Save className="h-4 w-4 mr-2" /> Sauvegarder
          </Button>
        </div>
      </div>
    );
  }


  return (
    <Sheet modal={false}>
      <SheetTrigger asChild>
        <Button size="icon" variant="outline"
          className="fixed bottom-4 right-4 z-[9999] h-12 w-12 rounded-full shadow-lg bg-background border-2">
          <Settings className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-[400px] sm:max-w-[400px] p-0 h-full flex flex-col overflow-hidden" noOverlay>
        {renderContent()}
      </SheetContent>
    </Sheet>
  );
}
