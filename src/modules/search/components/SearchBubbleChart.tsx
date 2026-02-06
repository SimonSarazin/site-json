import React, { useRef, useEffect, useState, useMemo, useCallback } from "react";
import * as d3 from "d3";
import { getBaseUrl } from "@/lib/constant/common";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { RotateCcw } from "lucide-react";

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

interface CategoryNode {
  name: string;
  children: BubbleNode[];
}

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

const DEFAULT_COLOR = "#94a3b8";

function getCategoryColor(category: string): string {
  return CATEGORY_COLORS[category] || DEFAULT_COLOR;
}

function getData(item: SearchResult): ServerData {
  return item.serverData || item as unknown as ServerData;
}

function getItemCategory(item: SearchResult, categories?: string[]): string | null {
  const data = getData(item);
  const itemTags = data.tags;

  if (!itemTags || itemTags.length === 0) {
    return null;
  }

  if (categories && categories.length > 0) {
    for (const tag of itemTags) {
      const normalizedTag = tag.trim().toLowerCase();
      for (const cat of categories) {
        const normalizedCat = cat.trim().toLowerCase();
        if (normalizedTag === normalizedCat) {
          return cat;
        }
      }
    }
    return null;
  }

  for (const tag of itemTags) {
    const normalizedTag = tag.trim();
    if (CATEGORY_COLORS[normalizedTag]) {
      return normalizedTag;
    }
  }

  return null;
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

export default function SearchBubbleChart({
  results,
  categories,
  onItemClick,
  height = 600,
}: SearchBubbleChartProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height });
  const [tooltip, setTooltip] = useState<{ x: number; y: number; item: SearchResult } | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [isZoomed, setIsZoomed] = useState(false);
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
      const category = getItemCategory(item, categories);
      return category !== null;
    });
  }, [results, categories]);

  const hierarchyData = useMemo(() => {
    const categoryMap = new Map<string, BubbleNode[]>();

    filteredResults.forEach((item) => {
      const data = getData(item);
      const category = getItemCategory(item, categories);
      if (!category) return;

      const node: BubbleNode = {
        id: getItemId(item),
        name: data.name,
        slug: data.slug,
        category,
        imageUrl: getImageUrl(item, baseUrl),
        data: item,
        value: 1,
      };

      if (!categoryMap.has(category)) {
        categoryMap.set(category, []);
      }
      categoryMap.get(category)!.push(node);
    });

    const children: CategoryNode[] = Array.from(categoryMap.entries()).map(
      ([name, items]) => ({
        name,
        children: items,
      })
    );

    return { name: "root", children };
  }, [filteredResults, categories, baseUrl]);

  useEffect(() => {
    if (!svgRef.current || filteredResults.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const { width, height: h } = dimensions;
    const margin = 40;

    const root = d3
      .hierarchy(hierarchyData)
      .sum((d: any) => d.value || 0)
      .sort((a, b) => (b.value || 0) - (a.value || 0));

    const pack = d3
      .pack()
      .size([width - margin * 2, h - margin * 2])
      .padding(12);

    const nodes = pack(root as any).descendants();

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

    const categoryNodes = nodes.filter((d) => d.depth === 1);

    g.selectAll(".category-circle")
      .data(categoryNodes)
      .join("circle")
      .attr("class", "category-circle")
      .attr("cx", (d) => d.x)
      .attr("cy", (d) => d.y)
      .attr("r", (d) => d.r)
      .attr("fill", (d: any) => `${getCategoryColor(d.data.name)}15`)
      .attr("stroke", (d: any) => getCategoryColor(d.data.name))
      .attr("stroke-width", 2)
      .attr("stroke-dasharray", "5,5")
      .attr("opacity", 0.8);

    g.selectAll(".category-label")
      .data(categoryNodes)
      .join("text")
      .attr("class", "category-label")
      .attr("x", (d) => d.x)
      .attr("y", (d) => d.y - d.r + 18)
      .attr("text-anchor", "middle")
      .attr("fill", (d: any) => getCategoryColor(d.data.name))
      .attr("font-size", "11px")
      .attr("font-weight", "600")
      .attr("paint-order", "stroke")
      .attr("stroke", "white")
      .attr("stroke-width", 3)
      .text((d: any) => {
        const name = d.data.name;
        const maxLen = Math.max(12, Math.floor(d.r / 4));
        return name.length > maxLen ? name.substring(0, maxLen) + "..." : name;
      });

    const itemNodes = nodes.filter((d) => d.depth === 2);

    const defs = svg.append("defs");

    itemNodes.forEach((d: any, i) => {
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
      .on("click", (event, d: any) => {
        event.stopPropagation();
        if (onItemClick && d.data.data) {
          onItemClick(d.data.data);
        }
      })
      .on("mouseenter", (event, d: any) => {
        const rect = containerRef.current?.getBoundingClientRect();
        if (rect && d.data.data) {
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
      .attr("stroke", (d: any) => getCategoryColor(d.parent?.data.name || ""))
      .attr("stroke-width", 2);

    itemGroups
      .append("image")
      .attr("x", (d) => -(d.r - 2))
      .attr("y", (d) => -(d.r - 2))
      .attr("width", (d) => (d.r - 2) * 2)
      .attr("height", (d) => (d.r - 2) * 2)
      .attr("clip-path", (_, i) => `url(#bubble-clip-${i})`)
      .attr("href", (d: any) => d.data.imageUrl || "")
      .attr("preserveAspectRatio", "xMidYMid slice")
      .on("error", function (this: SVGImageElement, _, d: any) {
        const parent = d3.select(this.parentNode as SVGGElement);
        d3.select(this).remove();

        const name = d.data?.name || "";
        const initials = name
          .split(" ")
          .filter(Boolean)
          .map((n: string) => n[0])
          .join("")
          .toUpperCase()
          .slice(0, 2);

        parent
          .append("text")
          .attr("text-anchor", "middle")
          .attr("dominant-baseline", "central")
          .attr("fill", getCategoryColor(d.parent?.data.name || ""))
          .attr("font-size", `${Math.max(8, d.r / 2)}px`)
          .attr("font-weight", "600")
          .text(initials);
      });

    return () => {
      zoomRef.current = null;
    };
  }, [hierarchyData, dimensions, filteredResults, onItemClick, baseUrl]);

  const categoriesWithCount = useMemo(() => {
    const catMap = new Map<string, number>();
    filteredResults.forEach((item) => {
      const cat = getItemCategory(item, categories);
      if (cat) {
        catMap.set(cat, (catMap.get(cat) || 0) + 1);
      }
    });

    if (categories && categories.length > 0) {
      return categories
        .filter(cat => catMap.has(cat))
        .map(name => ({ name, count: catMap.get(name) || 0 }));
    }

    return Array.from(catMap.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }, [filteredResults, categories]);

  const zoomToCategory = useCallback((categoryName: string | null) => {
    if (!svgRef.current || !zoomRef.current) return;

    const svg = d3.select(svgRef.current);
    const { width, height: h } = dimensions;
    const margin = 40;

    if (categoryName === null) {
      svg.transition()
        .duration(750)
        .call(zoomRef.current.transform as any, d3.zoomIdentity);
      setSelectedCategory(null);
      return;
    }

    const root = d3
      .hierarchy(hierarchyData)
      .sum((d: any) => d.value || 0);

    const pack = d3
      .pack()
      .size([width - margin * 2, h - margin * 2])
      .padding(12);

    const nodes = pack(root as any).descendants();
    const categoryNode = nodes.find((d: any) => d.depth === 1 && d.data.name === categoryName);

    if (categoryNode) {
      const scale = Math.min(
        (width - margin * 2) / (categoryNode.r * 2.5),
        (h - margin * 2) / (categoryNode.r * 2.5),
        3
      );
      const translateX = width / 2 - categoryNode.x * scale - margin * scale;
      const translateY = h / 2 - categoryNode.y * scale - margin * scale;

      const newTransform = d3.zoomIdentity
        .translate(translateX, translateY)
        .scale(scale);

      svg.transition()
        .duration(750)
        .call(zoomRef.current.transform as any, newTransform);

      setSelectedCategory(categoryName);
    }
  }, [dimensions, hierarchyData]);

  if (filteredResults.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        Aucun résultat à afficher
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative w-full">
      {/* Layout horizontal: boutons à gauche, graphe à droite */}
      <div className="flex gap-4">
        {/* Boutons de catégories - colonne à gauche */}
        <div className="flex flex-col gap-2 shrink-0 w-55 z-10">
          {/* Bouton réinitialiser le zoom */}
          {(isZoomed || selectedCategory) && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => zoomToCategory(null)}
              className="text-xs gap-1 w-full justify-start"
            >
              <RotateCcw className="h-3 w-3" />
              Réinitialiser la vue
            </Button>
          )}

          {/* Séparateur */}
          {(isZoomed || selectedCategory) && <div className="border-b my-1" />}

          {categoriesWithCount.map(({ name, count }) => (
            <Button
              key={name}
              variant={selectedCategory === name ? "default" : "outline"}
              size="sm"
              onClick={() => zoomToCategory(name)}
              className={cn(
                "text-xs gap-1.5 transition-all w-full justify-start",
                selectedCategory === name && "ring-2 ring-offset-2"
              )}
              style={{
                borderColor: getCategoryColor(name),
                ...(selectedCategory === name
                  ? { backgroundColor: getCategoryColor(name), color: "white" }
                  : { color: getCategoryColor(name) }),
              }}
            >
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ backgroundColor: getCategoryColor(name) }}
              />
              <span className="truncate flex-1 text-left">{name}</span>
              <Badge
                variant="secondary"
                className="ml-auto px-1.5 py-0 text-[10px] font-semibold"
              >
                {count}
              </Badge>
            </Button>
          ))}
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
