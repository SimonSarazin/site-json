import { useRef, useEffect, useState, useMemo, useCallback } from "react";
import * as d3 from "d3";
import { getBaseUrl } from "@/lib/constant/common";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { RotateCcw, ListFilter } from "lucide-react";
import { useCountryDisplayNames, countryLabel } from "@/hooks/useCountryDisplayNames";

interface ServerData {
  _id: { $id: string } | string;
  name: string;
  slug?: string;
  tags?: string[];
  profilThumbImageUrl?: string;
  profilImageUrl?: string;
  profilMediumImageUrl?: string;
  address?: {
    level1Name?: string;
    addressCountry?: string;
    addressLocality?: string;
  };
}

interface SearchResult {
  serverData?: ServerData;
  _id?: { $id: string } | string;
  name?: string;
  slug?: string;
  tags?: string[];
  profilThumbImageUrl?: string;
  profilImageUrl?: string;
  profilMediumImageUrl?: string;
  address?: {
    level1Name?: string;
    addressCountry?: string;
    addressLocality?: string;
  };
}

interface SearchBubbleChartProps {
  results: SearchResult[];
  categories?: string[];
  onItemClick?: (item: SearchResult) => void;
  height?: number;
  // groupement initial (par pays ou par catégorie/tag)
  defaultGroupMode?: GroupMode;
  // activer/désactiver le regroupement par pays
  enableCountryGrouping?: boolean;
}

interface BubbleNode {
  id: string;
  name: string;
  slug?: string;
  category: string;
  imageUrl?: string;
  data: SearchResult;
  value: number;
}

interface GroupNode {
  name: string;
  children: BubbleNode[];
}

interface RootNode {
  name: string;
  children: GroupNode[];
}

type HierarchyDatum = RootNode | GroupNode | BubbleNode;

type CircularNode = d3.HierarchyCircularNode<HierarchyDatum>;

type GroupMode = "country" | "category";

const CATEGORY_COLORS: Record<string, string> = {
  "Entreprises(produits/solutions et services)": "#6366f1",
  "CERT/CSIRT": "#ec4899",
  "Organismes de formation": "#10b981",
  "Laboratoires/recherche": "#f59e0b",
  "Structure d'accompagnement et financement": "#8b5cf6",
  "Réseaux/cluster": "#06b6d4",
  "Services défense/intérieur": "#ef4444",
  "Association/ONG": "#22c55e",
};

const COUNTRY_COLORS: string[] = [
  "#6366f1", "#ec4899", "#10b981", "#f59e0b", "#8b5cf6",
  "#06b6d4", "#ef4444", "#22c55e", "#f97316", "#14b8a6",
  "#a855f7", "#eab308", "#3b82f6", "#e11d48",
];

const DEFAULT_COLOR = "#94a3b8";

function getGroupColor(name: string, mode: GroupMode, index?: number): string {
  if (mode === "category") {
    return CATEGORY_COLORS[name] || DEFAULT_COLOR;
  }
  return COUNTRY_COLORS[(index ?? 0) % COUNTRY_COLORS.length];
}

function getData(item: SearchResult): ServerData {
  return item.serverData || item as unknown as ServerData;
}

function getItemCategories(item: SearchResult, categories?: string[]): string[] {
  const data = getData(item);
  const itemTags = data.tags;

  if (!itemTags || itemTags.length === 0) {
    return [];
  }

  if (categories && categories.length > 0) {
    const matches: string[] = [];
    for (const cat of categories) {
      const normalizedCat = cat.trim().toLowerCase();
      const hasTag = itemTags.some((tag: string) => tag && tag.trim().toLowerCase() === normalizedCat);
      if (hasTag) {
        matches.push(cat);
      }
    }

    return matches;
  }

  const matches: string[] = [];
  for (const tag of itemTags) {
    const normalizedTag = tag.trim();
    if (CATEGORY_COLORS[normalizedTag]) {
      matches.push(normalizedTag);
    }
  }

  return matches;
}

/**
 * Clé de regroupement « par pays » : le code ISO-3166 alpha-2, JAMAIS le libellé.
 *
 * `address.level1Name` est un libellé libre : sur un même pays il coexiste en
 * plusieurs orthographes et plusieurs langues (« Tanzania »/« Tanzanie »,
 * « Madagascar »/« Madagasikara », « Afrique du Sud »/« Nanzfeih »), ce qui
 * éclatait un pays en plusieurs bulles et faussait les compteurs. On groupe
 * donc sur `addressCountry`, seul champ normalisé ; le nom lisible est résolu
 * à l'affichage par `useCountryDisplayNames`.
 *
 * Repli sur `level1Name` uniquement quand l'ISO manque : un acteur mal saisi
 * vaut mieux dans un seau imparfait que perdu.
 */
function getItemCountry(item: SearchResult): string | null {
  const data = getData(item);
  const iso = data.address?.addressCountry?.trim().toUpperCase();
  if (iso) return iso;
  return data.address?.level1Name || null;
}

function getItemId(item: SearchResult): string {
  const data = getData(item);
  const id = data._id;
  if (typeof id === "object" && "$id" in id) {
    return id.$id;
  }
  return String(id);
}

function getImageUrl(item: SearchResult, baseUrl: string): string {
  const data = getData(item);
  const imageUrl = data.profilImageUrl || data.profilMediumImageUrl || data.profilThumbImageUrl;

  if (!imageUrl) return "";
  if (imageUrl.startsWith("http")) return imageUrl;
  return `${baseUrl}${imageUrl}`;
}

function isGroupCircularNode(d: CircularNode): d is d3.HierarchyCircularNode<HierarchyDatum> & { data: GroupNode } {
  return d.depth === 1 && "children" in d.data && Array.isArray((d.data as GroupNode).children);
}

function isBubbleCircularNode(d: CircularNode): d is d3.HierarchyCircularNode<HierarchyDatum> & { data: BubbleNode } {
  return d.depth === 2 && "id" in d.data;
}

export default function SearchBubbleChart({
  results,
  categories,
  onItemClick,
  height = 600,
  defaultGroupMode,
  enableCountryGrouping = true,
}: SearchBubbleChartProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height });
  const [tooltip, setTooltip] = useState<{ x: number; y: number; item: SearchResult } | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const [groupMode, setGroupMode] = useState<GroupMode>(defaultGroupMode ?? "country");
  const [isZoomed, setIsZoomed] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const baseUrl = getBaseUrl();

  const sidebarWidth = 240;

  useEffect(() => {
    if (!containerRef.current) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width } = entry.contentRect;
        setDimensions({ width: Math.max(width - sidebarWidth, 300), height });
      }
    });

    resizeObserver.observe(containerRef.current);
    return () => resizeObserver.disconnect();
  }, [height]);

  const filteredResults = useMemo(() => {
    return results.filter((item) => {
      const itemCategories = getItemCategories(item, categories);
      return itemCategories.length > 0;
    });
  }, [results, categories]);

  const groupsWithCount = useMemo(() => {
    const groupMap = new Map<string, number>();

    filteredResults.forEach((item) => {
      let groupKeys: string[] = [];
      if (groupMode === "country") {
        const country = getItemCountry(item);
        if (country) {
          groupKeys = [country];
        }
      } else {
        groupKeys = getItemCategories(item, categories);
      }

      groupKeys.forEach((groupKey) => {
        groupMap.set(groupKey, (groupMap.get(groupKey) || 0) + 1);
      });
    });

    if (groupMode === "category" && categories && categories.length > 0) {
  
      return categories.map(name => ({ name, count: groupMap.get(name) || 0 }));
    }

    return Array.from(groupMap.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }, [filteredResults, categories, groupMode]);

  const groupColorMap = useMemo(() => {
    const map = new Map<string, string>();
    groupsWithCount.forEach(({ name }, index) => {
      map.set(name, getGroupColor(name, groupMode, index));
    });
    return map;
  }, [groupsWithCount, groupMode]);

  const countryDisplayNames = useCountryDisplayNames();
  /**
   * Nom AFFICHÉ d'un groupe. En mode « pays » la clé est un code ISO
   * (cf. `getItemCountry`) : c'est le seul endroit qui le traduit. En mode
   * « type d'acteur » la clé est déjà le libellé, on la rend telle quelle.
   */
  const groupLabel = useCallback(
    (key: string) => (groupMode === "country" ? countryLabel(key, countryDisplayNames) : key),
    [groupMode, countryDisplayNames],
  );

  const hierarchyData = useMemo((): RootNode => {
    const groupMap = new Map<string, BubbleNode[]>();

    filteredResults.forEach((item) => {
      const data = getData(item);

      let groupKeys: string[] = [];
      if (groupMode === "country") {
        const country = getItemCountry(item);
        if (country) {
          groupKeys = [country];
        }
      } else {
        groupKeys = getItemCategories(item, categories);
      }

      if (groupKeys.length === 0) return;

      groupKeys.forEach((groupKey) => {
        const node: BubbleNode = {
          id: `${getItemId(item)}::${groupKey}`,
          name: data.name,
          slug: data.slug,
          category: groupKey,
          imageUrl: getImageUrl(item, baseUrl),
          data: item,
          value: 1,
        };

        if (!groupMap.has(groupKey)) {
          groupMap.set(groupKey, []);
        }
        groupMap.get(groupKey)!.push(node);
      });
    });

    const children: GroupNode[] = Array.from(groupMap.entries()).map(
      ([name, items]) => ({
        name,
        children: items,
      })
    );

    return { name: "root", children };
  }, [filteredResults, categories, baseUrl, groupMode]);

  useEffect(() => {
    if (!svgRef.current || filteredResults.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const { width, height: h } = dimensions;
    const margin = 40;

    const root = d3
      .hierarchy<HierarchyDatum>(hierarchyData)
      .sum((d: HierarchyDatum) => ("value" in d ? (d as BubbleNode).value : 0))
      .sort((a, b) => (b.value || 0) - (a.value || 0));

    const pack = d3
      .pack<HierarchyDatum>()
      .size([width - margin * 2, h - margin * 2])
      .padding(12);

    const nodes = pack(root).descendants();

    const g = svg
      .append("g")
      .attr("class", "zoom-group")
      .attr("transform", `translate(${margin}, ${margin})`);

    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.5, 5])
      .on("zoom", (event) => {
        g.attr("transform", `translate(${margin + event.transform.x}, ${margin + event.transform.y}) scale(${event.transform.k})`);
        const isIdentity = event.transform.k === 1 && event.transform.x === 0 && event.transform.y === 0;
        setIsZoomed(!isIdentity);
      });

    svg.call(zoom);
    zoomRef.current = zoom;

    const groupNodes = nodes.filter((d) => d.depth === 1);

    g.selectAll(".group-circle")
      .data(groupNodes)
      .join("circle")
      .attr("class", "group-circle")
      .attr("cx", (d) => d.x)
      .attr("cy", (d) => d.y)
      .attr("r", (d) => d.r)
      .attr("fill", (d: CircularNode) => {
        const groupData = d.data as GroupNode;
        return `${groupColorMap.get(groupData.name) || DEFAULT_COLOR}15`;
      })
      .attr("stroke", (d: CircularNode) => {
        const groupData = d.data as GroupNode;
        return groupColorMap.get(groupData.name) || DEFAULT_COLOR;
      })
      .attr("stroke-width", 2)
      .attr("stroke-dasharray", "5,5")
      .attr("opacity", 0.8);

    groupNodes.forEach((d: CircularNode) => {
      if (!isGroupCircularNode(d)) return;
      const name: string = d.data.name;
      const color = groupColorMap.get(name) || DEFAULT_COLOR;
      const fontSize = Math.max(10, Math.min(14, d.r / 5));

      g.append("text")
        .attr("class", "group-label")
        .attr("x", d.x)
        .attr("y", d.y - d.r - 5)
        .attr("text-anchor", "middle")
        .attr("fill", color)
        .attr("font-size", `${fontSize}px`)
        .attr("font-weight", "700")
        .attr("paint-order", "stroke")
        .attr("stroke", "white")
        .attr("stroke-width", 4)
        .text(groupLabel(name));
    });

    // Item nodes (depth 2)
    const itemNodes = nodes.filter((d) => d.depth === 2);

    const defs = svg.append("defs");

    itemNodes.forEach((d: CircularNode, i) => {
      defs
        .append("clipPath")
        .attr("id", `bubble-clip-${i}`)
        .append("circle")
        .attr("r", d.r - 2);
    });

    const itemGroups = g
      .selectAll(".item-group")
      .data(itemNodes)
      .join("g")
      .attr("class", "item-group")
      .attr("transform", (d) => `translate(${d.x}, ${d.y})`)
      .style("cursor", "pointer")
      .on("click", (event: MouseEvent, d: CircularNode) => {
        event.stopPropagation();
        if (onItemClick && isBubbleCircularNode(d)) {
          onItemClick(d.data.data);
        }
      })
      .on("mouseenter", (event: MouseEvent, d: CircularNode) => {
        const rect = containerRef.current?.getBoundingClientRect();
        if (rect && isBubbleCircularNode(d)) {
          setTooltip({
            x: event.clientX - rect.left,
            y: event.clientY - rect.top,
            item: d.data.data,
          });
        }
      })
      .on("mouseleave", () => {
        setTooltip(null);
      });

    itemGroups
      .append("circle")
      .attr("r", (d) => d.r)
      .attr("fill", "white")
      .attr("stroke", (d: CircularNode) => {
        const parentData = d.parent?.data as GroupNode | undefined;
        return groupColorMap.get(parentData?.name || "") || DEFAULT_COLOR;
      })
      .attr("stroke-width", 2);

    itemGroups
      .append("image")
      .attr("x", (d) => -(d.r - 2))
      .attr("y", (d) => -(d.r - 2))
      .attr("width", (d) => (d.r - 2) * 2)
      .attr("height", (d) => (d.r - 2) * 2)
      .attr("clip-path", (_, i) => `url(#bubble-clip-${i})`)
      .attr("href", (d: CircularNode) => {
        const bubbleData = d.data as BubbleNode;
        return bubbleData.imageUrl || "";
      })
      .attr("preserveAspectRatio", "xMidYMid slice")
      .on("error", (event: Event, d: CircularNode) => {
        const target = event.currentTarget as SVGImageElement;
        const parent = d3.select(target.parentNode as SVGGElement);
        d3.select(target).remove();

        const bubbleData = d.data as BubbleNode;
        const name = bubbleData?.name || "";
        const initials = name
          .split(" ")
          .filter(Boolean)
          .map((n: string) => n[0])
          .join("")
          .toUpperCase()
          .slice(0, 2);

        const parentData = d.parent?.data as GroupNode | undefined;
        parent
          .append("text")
          .attr("text-anchor", "middle")
          .attr("dominant-baseline", "central")
          .attr("fill", groupColorMap.get(parentData?.name || "") || DEFAULT_COLOR)
          .attr("font-size", `${Math.max(8, d.r / 2)}px`)
          .attr("font-weight", "600")
          .text(initials);
      });

    return () => {
      zoomRef.current = null;
    };
  }, [hierarchyData, dimensions, filteredResults, onItemClick, baseUrl, groupColorMap, groupLabel]);

  const zoomToGroup = useCallback((groupName: string | null) => {
    if (!svgRef.current || !zoomRef.current) return;

    const svg = d3.select(svgRef.current);
    const { width, height: h } = dimensions;
    const margin = 40;

    if (groupName === null) {
      svg.transition()
        .duration(750)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .call(zoomRef.current.transform as any, d3.zoomIdentity);
      setSelectedGroup(null);
      return;
    }

    const root = d3
      .hierarchy<HierarchyDatum>(hierarchyData)
      .sum((d: HierarchyDatum) => ("value" in d ? (d as BubbleNode).value : 0));

    const pack = d3
      .pack<HierarchyDatum>()
      .size([width - margin * 2, h - margin * 2])
      .padding(12);

    const nodes = pack(root).descendants();
    const groupNode = nodes.find((d: CircularNode) => d.depth === 1 && (d.data as GroupNode).name === groupName);

    if (groupNode) {
      const scale = Math.min(
        (width - margin * 2) / (groupNode.r * 2.5),
        (h - margin * 2) / (groupNode.r * 2.5),
        3
      );
      const translateX = width / 2 - groupNode.x * scale - margin * scale;
      const translateY = h / 2 - groupNode.y * scale - margin * scale;

      const newTransform = d3.zoomIdentity
        .translate(translateX, translateY)
        .scale(scale);

      svg.transition()
        .duration(750)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .call(zoomRef.current.transform as any, newTransform);

      setSelectedGroup(groupName);
    }
  }, [dimensions, hierarchyData]);

  const handleGroupModeChange = useCallback((mode: GroupMode) => {
    setGroupMode(mode);
    setSelectedGroup(null);
    setIsZoomed(false);
    if (svgRef.current && zoomRef.current) {
      const svg = d3.select(svgRef.current);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      svg.call(zoomRef.current.transform as any, d3.zoomIdentity);
    }
  }, []);

  if (filteredResults.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        Aucun résultat à afficher
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="flex items-center gap-2 mb-4">
        {enableCountryGrouping && (
          <Button
            variant={groupMode === "country" ? "default" : "outline"}
            size="sm"
            onClick={() => handleGroupModeChange("country")}
            className="text-xs font-semibold"
          >
            Par pays
          </Button>
        )}
        <Button
          variant={groupMode === "category" ? "default" : "outline"}
          size="sm"
          onClick={() => handleGroupModeChange("category")}
          className="text-xs font-semibold"
        >
          Par type d&apos;acteur
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowSidebar(!showSidebar)}
          className={cn("text-xs gap-1 sm:hidden", showSidebar && "bg-accent")}
        >
          <ListFilter className="h-3.5 w-3.5" />
          Filtres
        </Button>
      </div>

      <div className="flex gap-4">
        <div className={cn(
          "flex flex-col gap-2 shrink-0 w-55 z-10 overflow-y-auto overflow-x-hidden p-2",
          showSidebar ? "flex" : "hidden sm:flex"
        )} style={{ maxHeight: height }}>
          {(isZoomed || selectedGroup) && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => zoomToGroup(null)}
              className="text-xs gap-1 w-full justify-start"
            >
              <RotateCcw className="h-3 w-3" />
              Réinitialiser la vue
            </Button>
          )}

          {/* Séparateur */}
          {(isZoomed || selectedGroup) && <div className="border-b my-1" />}

          {groupsWithCount.map(({ name, count }) => {
            const color = groupColorMap.get(name) || DEFAULT_COLOR;
            return (
              <Button
                key={name}
                variant={selectedGroup === name ? "default" : "outline"}
                size="sm"
                onClick={() => zoomToGroup(selectedGroup === name ? null : name)}
                className={cn(
                  "text-xs gap-1.5 transition-all w-full justify-start",
                  selectedGroup === name && "ring-2 ring-offset-2"
                )}
                style={{
                  borderColor: color,
                  ...(selectedGroup === name
                    ? { backgroundColor: color, color: "white" }
                    : { color }),
                }}
              >
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: color }}
                />
                <span className="truncate flex-1 text-left">{groupLabel(name)}</span>
                <Badge
                  variant="secondary"
                  className="ml-auto px-1.5 py-0 text-[10px] font-semibold"
                >
                  {count}
                </Badge>
              </Button>
            );
          })}
        </div>

        {/* SVG - graphe à droite */}
        <div className="flex-1 min-w-0 overflow-hidden relative">
          <svg
            ref={svgRef}
            width={dimensions.width}
            height={dimensions.height}
            className="cursor-grab active:cursor-grabbing"
          />
        </div>
      </div>

      {/* Tooltip */}
      {tooltip && (() => {
        const tooltipData = getData(tooltip.item);
        const tooltipImage = getImageUrl(tooltip.item, baseUrl);
        return (
          <div
            className="absolute z-50 bg-popover border rounded-lg shadow-lg p-3 pointer-events-none max-w-xs"
            style={{
              left: tooltip.x + 10,
              top: tooltip.y + 10,
            }}
          >
            <div className="flex items-center gap-2">
              {tooltipImage && (
                <img
                  src={tooltipImage}
                  alt={tooltipData.name}
                  className="w-10 h-10 rounded-full object-cover"
                />
              )}
              <div>
                <div className="font-medium text-sm">{tooltipData.name}</div>
                {(tooltipData.address?.addressLocality || tooltipData.address?.level1Name) && (
                  <div className="text-xs text-muted-foreground">
                    {tooltipData.address.addressLocality || tooltipData.address.level1Name}
                    {tooltipData.address?.addressCountry && ` · ${tooltipData.address.addressCountry}`}
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
