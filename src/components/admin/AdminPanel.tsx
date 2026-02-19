import { useState } from "react";
import { useLocation } from "react-router";
import { useSite } from "@/hooks/useSite";
import type { Section } from "@/types/site-schema";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Settings,
  ChevronUp,
  ChevronDown,
  Trash2,
  Pencil,
  Plus,
  ArrowLeft,
  Save,
} from "lucide-react";
import { toast } from "sonner";
import { FeaturesRezoLaMerEditor } from "./FeaturesRezoLaMerEditor";

const ADDABLE_SECTIONS: { type: Section["type"]; label: string }[] = [
  { type: "hero", label: "Hero" },
  { type: "features-rezo-la-mer", label: "Features Rézo la Mer" },
  { type: "cards", label: "Cartes" },
  { type: "markdown", label: "Markdown" },
  { type: "faq", label: "FAQ" },
  { type: "cta", label: "Call to Action" },
  { type: "stats", label: "Statistiques" },
  { type: "testimonials", label: "Témoignages" },
  { type: "team", label: "Équipe" },
  { type: "gallery", label: "Galerie" },
  { type: "banner", label: "Bannière" },
  { type: "title", label: "Titre" },
  { type: "content", label: "Contenu" },
];

// Props par défaut minimales pour les types courants
const SECTION_DEFAULTS: Partial<Record<Section["type"], unknown>> = {
  hero: { headline: { fr: "Nouveau Hero" }, align: "center" },
  "features-rezo-la-mer": {
    headline: { fr: "Fonctionnalités" },
    features: [
      {
        icon: "Star",
        title: { fr: "Feature 1" },
        description: { fr: "Description" },
      },
    ],
  },
  cards: { headline: { fr: "Cartes" }, items: [] },
  markdown: { content: { fr: "# Nouveau contenu" } },
  faq: { headline: { fr: "FAQ" }, items: [] },
  cta: {
    headline: { fr: "Call to Action" },
    buttonLabel: { fr: "Cliquez" },
    buttonHref: "#",
  },
  stats: { headline: { fr: "Statistiques" }, items: [] },
  testimonials: { headline: { fr: "Témoignages" }, items: [] },
  team: { headline: { fr: "Équipe" }, members: [] },
  gallery: { headline: { fr: "Galerie" }, images: [] },
  banner: { headline: { fr: "Bannière" } },
  title: { text: { fr: "Titre" } },
  content: { content: { fr: "Contenu" } },
};

export default function AdminPanel() {
  const { config, setConfig } = useSite();
  const { pathname } = useLocation();
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [addType, setAddType] = useState<string>("");

  const pageIndex = config.pages.findIndex((p) => p.path === pathname);
  const currentPage =
    pageIndex >= 0 ? config.pages[pageIndex] : config.pages[0];
  const effectivePageIndex = pageIndex >= 0 ? pageIndex : 0;

  if (!currentPage) return null;

  function updateSections(fn: (sections: Section[]) => Section[]) {
    setConfig({
      ...config,
      pages: config.pages.map((page, i) =>
        i === effectivePageIndex
          ? { ...page, sections: fn(page.sections) }
          : page
      ),
    });
  }

  function moveSection(idx: number, dir: -1 | 1) {
    const target = idx + dir;
    if (target < 0 || target >= currentPage.sections.length) return;
    updateSections((sections) => {
      const copy = [...sections];
      [copy[idx], copy[target]] = [copy[target], copy[idx]];
      return copy;
    });
    if (editingIndex === idx) setEditingIndex(target);
    else if (editingIndex === target) setEditingIndex(idx);
  }

  function removeSection(idx: number) {
    updateSections((sections) => sections.filter((_, i) => i !== idx));
    if (editingIndex === idx) setEditingIndex(null);
    else if (editingIndex !== null && editingIndex > idx)
      setEditingIndex(editingIndex - 1);
  }

  function addSection() {
    if (!addType) return;
    const defaultProps = SECTION_DEFAULTS[addType as Section["type"]] ?? {};
    updateSections((sections) => [
      ...sections,
      { type: addType, props: defaultProps } as Section,
    ]);
    setAddType("");
  }

  function updateSectionProps(idx: number, newProps: unknown) {
    updateSections((sections) =>
      sections.map((sec, i) =>
        i === idx ? ({ ...sec, props: newProps } as Section) : sec
      )
    );
  }

  function saveConfig() {
    if (import.meta.hot) {
      import.meta.hot.send("config-save", config);
      toast.success("Config sauvegardée");
    } else {
      toast.error("HMR non disponible");
    }
  }

  const editingSection =
    editingIndex !== null ? currentPage.sections[editingIndex] : null;

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button
          size="icon"
          variant="outline"
          className="fixed bottom-4 right-4 z-[9999] h-12 w-12 rounded-full shadow-lg bg-background border-2"
        >
          <Settings className="h-5 w-5" />
        </Button>
      </SheetTrigger>

      <SheetContent side="right" className="w-[400px] sm:max-w-[400px] p-0 h-full flex flex-col overflow-hidden">
        {editingSection ? (
          <div className="flex flex-col h-full min-h-0">
            <SheetHeader className="p-4 border-b shrink-0">
              <div className="flex items-center gap-2">
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => setEditingIndex(null)}
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <SheetTitle className="text-sm">
                  Édition :{" "}
                  <Badge variant="secondary">{editingSection.type}</Badge>
                </SheetTitle>
              </div>
            </SheetHeader>

            <ScrollArea className="flex-1 min-h-0 p-4">
              {editingSection.type === "features-rezo-la-mer" ? (
                <FeaturesRezoLaMerEditor
                  props={editingSection.props as import("@/types/site-schema").FeaturesRezoLaMerProps}
                  onChange={(newProps) =>
                    updateSectionProps(editingIndex!, newProps)
                  }
                />
              ) : (
                <JsonFallbackEditor
                  props={editingSection.props}
                  onChange={(newProps) =>
                    updateSectionProps(editingIndex!, newProps)
                  }
                />
              )}
            </ScrollArea>
          </div>
        ) : (
          <div className="flex flex-col h-full min-h-0">
            <SheetHeader className="p-4 border-b shrink-0">
              <SheetTitle className="text-sm">
                Sections — {currentPage.path || "/"}
                <Badge variant="outline" className="ml-2">
                  {currentPage.sections.length}
                </Badge>
              </SheetTitle>
            </SheetHeader>

            <ScrollArea className="flex-1 min-h-0">
              <div className="p-2 space-y-1">
                {currentPage.sections.map((section, idx) => (
                  <div
                    key={section.id ?? `section-${idx}`}
                    className="flex items-center gap-1 p-2 rounded-md border bg-card hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <Badge variant="secondary" className="text-xs">
                        {section.type}
                      </Badge>
                      {section.id && (
                        <span className="text-xs text-muted-foreground ml-1">
                          #{section.id}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-0.5">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        disabled={idx === 0}
                        onClick={() => moveSection(idx, -1)}
                      >
                        <ChevronUp className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        disabled={idx === currentPage.sections.length - 1}
                        onClick={() => moveSection(idx, 1)}
                      >
                        <ChevronDown className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        onClick={() => setEditingIndex(idx)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>

                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>
                              Supprimer cette section ?
                            </AlertDialogTitle>
                            <AlertDialogDescription>
                              La section{" "}
                              <strong>{section.type}</strong> sera
                              supprimée de la page.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Annuler</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => removeSection(idx)}
                            >
                              Supprimer
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>

            <div className="p-4 border-t space-y-2 shrink-0">
              <div className="flex gap-2">
                <Select value={addType} onValueChange={setAddType}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Type de section..." />
                  </SelectTrigger>
                  <SelectContent>
                    {ADDABLE_SECTIONS.map((s) => (
                      <SelectItem key={s.type} value={s.type}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  size="icon"
                  onClick={addSection}
                  disabled={!addType}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <Button
                className="w-full"
                onClick={saveConfig}
              >
                <Save className="h-4 w-4 mr-2" />
                Sauvegarder
              </Button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function JsonFallbackEditor({
  props,
  onChange,
}: {
  props: unknown;
  onChange: (newProps: unknown) => void;
}) {
  const [json, setJson] = useState(() => JSON.stringify(props, null, 2));
  const [error, setError] = useState<string | null>(null);

  function apply() {
    try {
      const parsed = JSON.parse(json);
      setError(null);
      onChange(parsed);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Éditeur JSON — pas de formulaire dédié pour ce type.
      </p>
      <textarea
        className="w-full h-64 font-mono text-xs p-2 border rounded-md bg-muted/30 resize-y"
        value={json}
        onChange={(e) => setJson(e.target.value)}
      />
      {error && (
        <p className="text-xs text-destructive">{error}</p>
      )}
      <Button size="sm" onClick={apply} className="w-full">
        Appliquer
      </Button>
    </div>
  );
}
