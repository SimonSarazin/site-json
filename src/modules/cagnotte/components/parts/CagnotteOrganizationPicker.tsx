import { useId, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useT } from "@/hooks/useT";
import { cn } from "@/lib/utils";
import type { AdminOrganization } from "@/modules/cagnotte/hooks/useUserAdminOrganizations";

/** Au-delà, la liste ne se lit plus d'un coup d'œil : le champ de recherche apparaît. */
export const ORG_SEARCH_THRESHOLD = 6;

/** Comparaison tolérante casse/accents — « federation » trouve « Fédération ». */
const fold = (s: string) =>
    s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim();

interface CagnotteOrganizationPickerProps {
    organizations: AdminOrganization[];
    isLoading: boolean;
    selectedId: string;
    onSelect: (org: AdminOrganization) => void;
}

/**
 * Choix de l'organisation qui contribue : les orgas administrées sont affichées
 * directement en cartes, sans menu à ouvrir. La recherche n'apparaît qu'au-delà
 * de `ORG_SEARCH_THRESHOLD` et filtre côté client — la liste complète est déjà là,
 * et l'orga choisie ne peut donc pas disparaître sous un résultat de recherche.
 */
export function CagnotteOrganizationPicker({
    organizations,
    isLoading,
    selectedId,
    onSelect,
}: CagnotteOrganizationPickerProps) {
    const t = useT("modules/cagnotte");
    const baseId = useId();
    const [query, setQuery] = useState("");

    const showSearch = organizations.length > ORG_SEARCH_THRESHOLD;
    const term = showSearch ? fold(query) : "";

    const matches = useMemo(
        () => (term ? organizations.filter((org) => fold(org.name).includes(term)) : organizations),
        [organizations, term]
    );

    // L'orga choisie reste visible même quand le terme l'exclut.
    const visible = useMemo(() => {
        const selected = organizations.find((org) => org.id === selectedId);
        return selected && !matches.includes(selected) ? [selected, ...matches] : matches;
    }, [organizations, matches, selectedId]);

    if (isLoading) {
        return (
            <div className="space-y-2" aria-busy="true">
                {[0, 1, 2].map((i) => (
                    <Skeleton key={i} className="h-14 w-full rounded-lg" />
                ))}
            </div>
        );
    }

    if (organizations.length === 0) {
        return (
            <div className="py-4 text-center text-sm text-muted-foreground">
                <p>{t("PaymentConfigPage.orgPicker.notAdminTitle")}</p>
                <p className="text-xs mt-2">{t("PaymentConfigPage.orgPicker.notAdminHelp")}</p>
            </div>
        );
    }

    const searchPlaceholder = String(t("PaymentConfigPage.orgPicker.searchPlaceholder"));

    return (
        <div className="space-y-3">
            {showSearch && (
                <div className="relative">
                    <Search className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" aria-hidden="true" />
                    <Input
                        type="search"
                        placeholder={searchPlaceholder}
                        aria-label={searchPlaceholder}
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        className="h-10 pl-10"
                    />
                </div>
            )}

            {term && matches.length === 0 && (
                <p className="py-2 text-center text-sm text-muted-foreground">
                    {t("PaymentConfigPage.orgPicker.noMatch", undefined, { query: query.trim() })}
                </p>
            )}

            <RadioGroup
                value={selectedId}
                onValueChange={(id) => {
                    const org = organizations.find((o) => o.id === id);
                    if (org) onSelect(org);
                }}
                aria-label={String(t("PaymentConfigPage.orgPicker.listLabel"))}
                className="max-h-64 overflow-y-auto gap-2 pr-1"
            >
                {visible.map((org) => {
                    const itemId = `${baseId}-${org.id}`;
                    const isSelected = org.id === selectedId;
                    return (
                        <label
                            key={org.id}
                            htmlFor={itemId}
                            className={cn(
                                "flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all hover:border-primary/50",
                                isSelected ? "border-primary bg-primary/20" : "border-border bg-background"
                            )}
                        >
                            <RadioGroupItem id={itemId} value={org.id} />
                            <Avatar className="size-8" aria-hidden="true">
                                {org.profilThumbImageUrl && (
                                    <AvatarImage src={org.profilThumbImageUrl} alt="" className="object-cover" />
                                )}
                                <AvatarFallback className="text-xs font-semibold">
                                    {org.name.charAt(0).toUpperCase()}
                                </AvatarFallback>
                            </Avatar>
                            <span className="text-sm font-medium truncate">{org.name}</span>
                        </label>
                    );
                })}
            </RadioGroup>
        </div>
    );
}
