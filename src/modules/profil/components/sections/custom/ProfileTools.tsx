import { useMemo, useState } from "react";
import { Pencil, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useReactiveProperty } from "@/hooks/useReactiveProperty";
import { useProfileSetup } from "../../../hooks/useProfileSetup";
import { useProfilPermissions } from "@/modules/profil/hooks/useProfilPermissions";
import type { ProfileToolsSection } from "../../../schema";
import { TOOLS_MAP } from "./toolsMap";
import { OurToolsEditDialog } from "./OurToolsEditDialog";
import SectionTitle from "./SectionTitleTL";

interface ProfileToolsProps {
    section: ProfileToolsSection;
}

/**
 * Section générique "Nos outils" — équivalent du bloc "Nos outils" de
 * ProfileTiersLieuxInfo, mais autonome et sans vocabulaire tiers-lieux, pour
 * être utilisable dans n'importe quel profil (organizations, projects, …).
 * Lit/écrit `serverData.ourTools` via `TOOLS_MAP`/`OurToolsEditDialog`,
 * partagés avec ProfileTiersLieuxInfo. Textes dans le namespace i18n
 * `ProfileTools` (fr.json/en.json), distinct de `ProfileTiersLieuxInfo`.
 */
export default function ProfileTools({ section }: ProfileToolsProps) {
    const { entity, t } = useProfileSetup();
    const { canEditProfile } = useProfilPermissions(entity);
    const [editOpen, setEditOpen] = useState(false);
    const toolsRaw = useReactiveProperty(entity.serverData, "ourTools");

    type ToolItem = { name: string; url?: string };
    type ParsedTools = Array<{ key: string; items: ToolItem[] }>;

    const parsedTools = useMemo((): ParsedTools => {
        if (!toolsRaw || typeof toolsRaw !== "object" || Array.isArray(toolsRaw)) return [];
        return Object.entries(toolsRaw as Record<string, unknown>)
            .filter(([key]) => key in TOOLS_MAP)
            .map(([key, val]) => ({
                key,
                items: Array.isArray(val) ? (val as ToolItem[]) : [],
            }));
    }, [toolsRaw]);

    if (parsedTools.length === 0 && !canEditProfile) return null;

    const cardClasses = section.sticky
        ? "bg-card rounded-lg border border-border shadow-sm p-4 overflow-hidden lg:sticky lg:top-4"
        : "bg-card rounded-lg border border-border shadow-sm p-4 overflow-hidden";

    return (
        <div className={cardClasses}>
            <div className="flex items-center justify-between gap-2">
                <SectionTitle
                    label={section.title ? t(section.title) : t("ProfileTools.tools")}
                    count={parsedTools.length}
                />
                {canEditProfile && (
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="gap-1.5 text-muted-foreground hover:text-foreground"
                        onClick={() => setEditOpen(true)}
                    >
                        <Pencil className="w-3.5 h-3.5" />
                        {t("ProfileTools.editTools")}
                    </Button>
                )}
            </div>
            {parsedTools.length === 0 ? (
                <p className="text-sm text-muted-foreground italic">
                    {t("ProfileTools.toolsEmpty")}
                </p>
            ) : (
                <div className="space-y-2">
                    {parsedTools.map(({ key, items }) => {
                        const tool = TOOLS_MAP[key];
                        return (
                            <div key={key} className="rounded-lg border border-primary/20 bg-primary/5 overflow-hidden">
                                <div className="flex items-center gap-2 px-3 py-2">
                                    <tool.Icon className="w-4 h-4 text-primary shrink-0" />
                                    <span className="text-sm font-semibold text-foreground">{tool.label}</span>
                                </div>
                                {items.length > 0 && (
                                    <div className="border-t border-primary/10 divide-y divide-primary/10">
                                        {items.map((item, idx) => (
                                            item.url ? (
                                                <a
                                                    key={idx}
                                                    href={item.url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="flex items-center justify-between px-3 py-1.5 hover:bg-primary/10 transition-colors gap-2"
                                                >
                                                    <span className="text-xs text-foreground truncate">{item.name}</span>
                                                    <ExternalLink className="w-3 h-3 text-muted-foreground shrink-0" />
                                                </a>
                                            ) : (
                                                <div key={idx} className="px-3 py-1.5">
                                                    <span className="text-xs text-foreground">{item.name}</span>
                                                </div>
                                            )
                                        ))}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
            {editOpen && (
                <OurToolsEditDialog
                    entity={entity}
                    isOpen={editOpen}
                    onClose={() => setEditOpen(false)}
                    translationNamespace="ProfileTools"
                />
            )}
        </div>
    );
}
