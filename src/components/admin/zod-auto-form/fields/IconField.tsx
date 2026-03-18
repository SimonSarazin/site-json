import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { DynamicIcon, type IconName } from "lucide-react/dynamic";
import { X, ChevronsUpDown, Search } from "lucide-react";

let _iconNamesCache: IconName[] | null = null;
async function loadIconNames(): Promise<IconName[]> {
  if (_iconNamesCache) return _iconNamesCache;
  const mod = await import("lucide-react/dynamicIconImports");
  _iconNamesCache = Object.keys(mod.default) as IconName[];
  return _iconNamesCache;
}
function getIconNames(): IconName[] {
  return _iconNamesCache ?? [];
}

const PAGE_SIZE = 120;

interface IconFieldProps {
  label: string;
  fieldKey: string;
  value: unknown;
  onChange: (v: unknown) => void;
  isOptional: boolean;
  compact?: boolean;
}

export function IconField({
  label,
  value,
  onChange,
  isOptional,
  compact,
}: IconFieldProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [iconsReady, setIconsReady] = useState(_iconNamesCache !== null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const currentValue = (value as string) ?? "";

  useEffect(() => {
    if (open && !iconsReady) {
      loadIconNames().then(() => setIconsReady(true));
    }
  }, [open, iconsReady]);

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
    scrollRef.current?.scrollTo(0, 0);
  }, [search]);

  const allIcons = getIconNames();

  const filteredIcons = useMemo(() => {
    if (!search.trim()) return allIcons;
    const q = search.toLowerCase().trim();
    return allIcons.filter((name) => name.includes(q));
  }, [search, allIcons]);

  const visibleIcons = useMemo(
    () => filteredIcons.slice(0, visibleCount),
    [filteredIcons, visibleCount],
  );

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 40) {
      setVisibleCount((prev) =>
        Math.min(prev + PAGE_SIZE, filteredIcons.length),
      );
    }
  }, [filteredIcons.length]);

  const handleSelect = useCallback(
    (iconName: string) => {
      onChange(iconName);
      setOpen(false);
      setSearch("");
    },
    [onChange],
  );

  const handleClear = useCallback(() => {
    onChange(isOptional ? undefined : "");
  }, [onChange, isOptional]);

  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium">
        {label}{" "}
        {isOptional && (
          <span className="text-muted-foreground">(optionnel)</span>
        )}
      </Label>

      <div className="flex items-center gap-1.5">
        <Popover open={open} onOpenChange={(v) => { setOpen(v); if (!v) setSearch(""); }}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={open}
              className={`w-full justify-between ${compact ? "h-8 text-xs" : "h-9 text-sm"}`}
            >
              <span className="flex items-center gap-2 truncate">
                {currentValue ? (
                  <>
                    <DynamicIcon
                      name={currentValue as IconName}
                      size={compact ? 14 : 16}
                    />
                    <span className="truncate">{currentValue}</span>
                  </>
                ) : (
                  <span className="text-muted-foreground">
                    Choisir une icône...
                  </span>
                )}
              </span>
              <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>

          <PopoverContent className="w-80 p-0" align="start">
            <div className="p-2 border-b">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Rechercher une icône..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="h-8 text-xs pl-7"
                  autoFocus
                />
              </div>
              <p className="text-[10px] text-muted-foreground mt-1.5">
                {filteredIcons.length} icône{filteredIcons.length > 1 ? "s" : ""}
                {search && ` pour "${search}"`}
              </p>
            </div>

            <div
              ref={scrollRef}
              className="overflow-y-auto max-h-72 p-2"
              onScroll={handleScroll}
            >
              {filteredIcons.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-6">
                  Aucune icône trouvée
                </p>
              ) : (
                <div className="grid grid-cols-6 gap-1">
                  {visibleIcons.map((name) => (
                    <button
                      key={name}
                      type="button"
                      title={name}
                      onClick={() => handleSelect(name)}
                      className={`flex items-center justify-center p-2 rounded-md cursor-pointer transition-colors hover:bg-accent ${
                        name === currentValue
                          ? "bg-primary/10 ring-1 ring-primary"
                          : ""
                      }`}
                    >
                      <DynamicIcon name={name} size={18} />
                    </button>
                  ))}
                </div>
              )}

              {visibleCount < filteredIcons.length && (
                <p className="text-[10px] text-muted-foreground text-center py-2">
                  Scroll pour plus...
                </p>
              )}
            </div>
          </PopoverContent>
        </Popover>

        {currentValue && (
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8 shrink-0"
            onClick={handleClear}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
    </div>
  );
}

const ICON_KEYS = new Set([
  "icon", "logoIcon", "favicon",
]);

const ICON_SUFFIXES = ["Icon"];

export function isIconKey(key: string): boolean {
  if (ICON_KEYS.has(key)) return true;
  return ICON_SUFFIXES.some((s) => key.endsWith(s));
}
