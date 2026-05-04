import { useEffect, useRef, useState, useMemo } from "react";
import * as d3 from "d3";
import type { FeatureCollection, Geometry } from "geojson";

interface RegionProperties {
  code: string;
  nom: string;
}

interface SearchResult {
  _id?: { $id: string } | string;
  name?: string;
  slug?: string;
  address?: {
    level1Name?: string;
    level1?: string;
    addressLocality?: string;
  };
  profilMediumImageUrl?: string;
  tags?: string[];
  [key: string]: unknown;
}

interface FranceRegionsMapProps {
  results: SearchResult[];
  onItemClick?: (item: SearchResult) => void;
  height?: number;
}

const DOMTOM_CODES = ["01", "02", "03", "04", "06"];

const REGION_COLORS: Record<string, string> = {
  "11": "#a8d8ea", "24": "#f9d56e", "27": "#5b8c85", "28": "#98d6a8",
  "32": "#ffb6c1", "44": "#7eb5d6", "52": "#a0d995", "53": "#6db093",
  "75": "#89b4d6", "76": "#e88ca5", "84": "#c4a8d8", "93": "#62c2db",
  "94": "#d9a8d4", "01": "#ffb6c1", "02": "#ffa07a", "03": "#98fb98",
  "04": "#ffd700", "06": "#dda0dd",
};

const REGION_ALIASES: Record<string, string[]> = {
  "Île-de-France": ["Île-de-France", "Ile-de-France", "IDF"],
  "Centre-Val de Loire": ["Centre-Val de Loire", "Centre"],
  "Bourgogne-Franche-Comté": ["Bourgogne-Franche-Comté", "BFC", "Bourgogne"],
  "Normandie": ["Normandie"],
  "Hauts-de-France": ["Hauts-de-France", "HDF"],
  "Grand Est": ["Grand Est"],
  "Pays de la Loire": ["Pays de la Loire", "PDL"],
  "Bretagne": ["Bretagne"],
  "Nouvelle-Aquitaine": ["Nouvelle-Aquitaine", "NA"],
  "Occitanie": ["Occitanie"],
  "Auvergne-Rhône-Alpes": ["Auvergne-Rhône-Alpes", "AURA", "Région AURA"],
  "Provence-Alpes-Côte d'Azur": ["Provence-Alpes-Côte d'Azur", "PACA"],
  "Corse": ["Corse"],
  "Guadeloupe": ["Guadeloupe"],
  "Martinique": ["Martinique"],
  "Guyane": ["Guyane"],
  "La Réunion": ["La Réunion", "Réunion"],
  "Mayotte": ["Mayotte"],
};

const NAME_REGION_HINTS: Record<string, string> = {
  "bfc": "Bourgogne-Franche-Comté", "bourgogne": "Bourgogne-Franche-Comté", "franche-comté": "Bourgogne-Franche-Comté",
  "aura": "Auvergne-Rhône-Alpes", "rhône-alpes": "Auvergne-Rhône-Alpes", "auvergne": "Auvergne-Rhône-Alpes",
  "paca": "Provence-Alpes-Côte d'Azur", "provence": "Provence-Alpes-Côte d'Azur", "côte d'azur": "Provence-Alpes-Côte d'Azur",
  "occitanie": "Occitanie", "nouvelle-aquitaine": "Nouvelle-Aquitaine", "aquitaine": "Nouvelle-Aquitaine",
  "bretagne": "Bretagne", "normandie": "Normandie", "grand est": "Grand Est",
  "hauts-de-france": "Hauts-de-France", "île-de-france": "Île-de-France", "ile-de-france": "Île-de-France",
  "pays de la loire": "Pays de la Loire", "centre": "Centre-Val de Loire",
  "corse": "Corse", "guadeloupe": "Guadeloupe", "martinique": "Martinique",
  "guyane": "Guyane", "réunion": "La Réunion", "mayotte": "Mayotte",
  "sud": "Provence-Alpes-Côte d'Azur",
};

function getData(result: SearchResult): Record<string, unknown> {
  const sd = (result as unknown as { serverData?: Record<string, unknown> }).serverData
    || (result as unknown as { _serverData?: Record<string, unknown> })._serverData
    || (result as unknown as { data?: Record<string, unknown> }).data
    || result;
  return sd as Record<string, unknown>;
}

function getCoordinates(result: SearchResult): [number, number] | null {
  const data = getData(result);
  const geoPos = data.geoPosition as { coordinates?: [number, number] } | undefined;
  if (geoPos?.coordinates && geoPos.coordinates.length >= 2) {
    return [geoPos.coordinates[0], geoPos.coordinates[1]];
  }
  const geo = data.geo as { latitude?: number | string; longitude?: number | string } | undefined;
  if (geo?.latitude && geo?.longitude) {
    return [Number(geo.longitude), Number(geo.latitude)];
  }
  return null;
}

let _geoFeatures: FeatureCollection<Geometry, RegionProperties> | null = null;

function matchRegionByGeo(result: SearchResult): string | null {
  if (!_geoFeatures) return null;
  const coords = getCoordinates(result);
  if (!coords) return null;

  for (const feature of _geoFeatures.features) {
    if (d3.geoContains(feature as unknown as d3.GeoPermissibleObjects, coords)) {
      return feature.properties.nom;
    }
  }
  return null;
}

function matchRegion(result: SearchResult): string | null {
  const data = getData(result);

  const geoMatch = matchRegionByGeo(result);
  if (geoMatch) return geoMatch;

  const address = data.address as { level1Name?: string; addressLocality?: string } | undefined;
  const level1Name = address?.level1Name;
  if (level1Name) {
    for (const [region, aliases] of Object.entries(REGION_ALIASES)) {
      if (aliases.some((a) => level1Name.toLowerCase().includes(a.toLowerCase()))) return region;
    }
  }

  const tags = data.tags as string[] | undefined;
  if (Array.isArray(tags)) {
    for (const tag of tags) {
      if (typeof tag !== "string") continue;
      for (const [region, aliases] of Object.entries(REGION_ALIASES)) {
        if (aliases.some((a) => tag.toLowerCase().includes(a.toLowerCase()))) return region;
      }
    }
  }

  const name = ((data.name as string) || "").toLowerCase();
  for (const [hint, region] of Object.entries(NAME_REGION_HINTS)) {
    if (name.includes(hint)) return region;
  }

  return null;
}

export default function FranceRegionsMap({ results, onItemClick, height = 600 }: FranceRegionsMapProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [geoData, setGeoData] = useState<FeatureCollection<Geometry, RegionProperties> | null>(null);

  useEffect(() => {
    fetch("/france-regions.geojson")
      .then((res) => res.json())
      .then((data) => {
        const geo = data as FeatureCollection<Geometry, RegionProperties>;
        _geoFeatures = geo;
        setGeoData(geo);
      })
      .catch((err) => console.error("Erreur chargement GeoJSON:", err));
  }, []);

  const resultsByRegion = useMemo(() => {
    const map = new Map<string, SearchResult[]>();
    if (results.length > 0) {
      console.log("[FranceRegionsMap] Sample results:", results.slice(0, 3).map(r => {
        const d = getData(r);
        return { name: d.name, address: d.address, geo: d.geo, geoPosition: d.geoPosition, tags: d.tags, slug: d.slug };
      }));
    }
    for (const result of results) {
      const region = matchRegion(result);
      if (region) {
        if (!map.has(region)) map.set(region, []);
        map.get(region)!.push(result);
      }
    }
    return map;
  }, [results]);

  useEffect(() => {
    if (!geoData || !svgRef.current) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const width = svgRef.current.clientWidth || 800;
    const mapHeight = height;
    svg.attr("viewBox", `0 0 ${width} ${mapHeight}`);

    const metropole = geoData.features.filter((f) => !DOMTOM_CODES.includes(f.properties.code));
    const domtom = geoData.features.filter((f) => DOMTOM_CODES.includes(f.properties.code));

    const metroProjection = d3.geoMercator().fitSize([width * 0.85, mapHeight * 0.75], {
      type: "FeatureCollection", features: metropole,
    });
    const metroPath = d3.geoPath().projection(metroProjection);

    const tooltip = tooltipRef.current;

    function showTooltip(event: MouseEvent, regionName: string) {
      if (!tooltip) return;
      const regionResults = resultsByRegion.get(regionName) || [];
      if (regionResults.length === 0) {
        tooltip.style.display = "none";
        return;
      }

      const items = regionResults.map((r) => {
        const d = getData(r);
        const name = (d.name as string) || "Sans nom";
        const img = (d.profilMediumImageUrl as string) || (d.profilThumbImageUrl as string) || "";
        const locality = (d.address as Record<string, unknown>)?.addressLocality as string || "";
        const slug = (d.slug as string) || "";
        return `<div class="flex items-center gap-2 py-1.5 px-1 cursor-pointer hover:bg-gray-50 rounded" data-slug="${slug}">
          ${img ? `<img src="${img}" class="w-8 h-8 rounded object-cover shrink-0" />` : `<div class="w-8 h-8 rounded bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-400 shrink-0">${name.slice(0, 2).toUpperCase()}</div>`}
          <div class="min-w-0"><div class="text-sm font-semibold text-gray-800 truncate">${name}</div>${locality ? `<div class="text-xs text-gray-500">${locality}</div>` : ""}</div>
        </div>`;
      }).join("");

      tooltip.innerHTML = `
        <div class="font-bold text-sm text-gray-700 mb-1.5 pb-1.5 border-b border-gray-100">${regionName}</div>
        <div class="max-h-[200px] overflow-y-auto">${items}</div>
      `;
      tooltip.style.display = "block";

      const svgRect = svgRef.current!.getBoundingClientRect();
      const x = event.clientX - svgRect.left + 15;
      const y = event.clientY - svgRect.top - 10;
      tooltip.style.left = `${Math.min(x, svgRect.width - 220)}px`;
      tooltip.style.top = `${Math.max(0, y)}px`;

      tooltip.querySelectorAll("[data-slug]").forEach((el) => {
        el.addEventListener("click", () => {
          const slug = el.getAttribute("data-slug");
          if (slug) window.open(`/s/${slug}`, "_blank");
        });
      });
    }

    function hideTooltip() {
      if (tooltip) tooltip.style.display = "none";
    }

    function regionHover(regionName: string) {
      return {
        mouseover(event: MouseEvent) {
          d3.select(event.currentTarget as SVGPathElement).attr("stroke", "#444").attr("stroke-width", 2);
          showTooltip(event, regionName);
        },
        mousemove(event: MouseEvent) {
          showTooltip(event, regionName);
        },
        mouseout(event: MouseEvent) {
          d3.select(event.currentTarget as SVGPathElement).attr("stroke", "#fff").attr("stroke-width", 0.5);
          hideTooltip();
        },
        click() {
          const regionResults = resultsByRegion.get(regionName) || [];
          if (regionResults.length >= 1) {
            const d = getData(regionResults[0]);
            const slug = d.slug as string;
            if (slug) window.open(`/s/${slug}`, "_blank");
          }
        },
      };
    }

    const metroGroup = svg.append("g").attr("class", "metropole");
    metroGroup.selectAll("path").data(metropole).enter().append("path")
      .attr("d", metroPath as unknown as string)
      .attr("fill", (d) => {
        const count = resultsByRegion.get(d.properties.nom)?.length || 0;
        const color = REGION_COLORS[d.properties.code] || "#ccc";
        return count > 0 ? color : color + "60";
      })
      .attr("stroke", "#fff")
      .attr("stroke-width", 0.5)
      .attr("cursor", "pointer")
      .each(function (d) {
        const handlers = regionHover(d.properties.nom);
        d3.select(this)
          .on("mouseover", handlers.mouseover)
          .on("mousemove", handlers.mousemove)
          .on("mouseout", handlers.mouseout)
          .on("click", handlers.click);
      });

    for (const [regionName, regionResults] of resultsByRegion) {
      const feature = metropole.find((f) => f.properties.nom === regionName);
      if (!feature) continue;
      const centroid = metroPath.centroid(feature);
      if (!centroid || isNaN(centroid[0])) continue;

      const badgeGroup = metroGroup.append("g")
        .attr("transform", `translate(${centroid[0]}, ${centroid[1]})`)
        .attr("pointer-events", "none");

      badgeGroup.append("circle")
        .attr("r", 12)
        .attr("fill", "white")
        .attr("stroke", "#444")
        .attr("stroke-width", 1.5)
        .attr("filter", "drop-shadow(0 1px 2px rgba(0,0,0,0.15))");

      badgeGroup.append("text")
        .attr("text-anchor", "middle")
        .attr("dy", "0.35em")
        .attr("font-size", "10px")
        .attr("font-weight", "700")
        .attr("fill", "#333")
        .text(regionResults.length);
    }

    const domtomStartX = width * 0.05;
    const domtomY = mapHeight * 0.78;
    const domtomSize = Math.min(width * 0.12, 80);
    const domtomSpacing = width * 0.18;

    domtom.forEach((feature, i) => {
      const domProjection = d3.geoMercator().fitSize([domtomSize, domtomSize], {
        type: "FeatureCollection", features: [feature],
      });
      const domPath = d3.geoPath().projection(domProjection);
      const offsetX = domtomStartX + i * domtomSpacing;
      const offsetY = domtomY;

      const domGroup = svg.append("g").attr("transform", `translate(${offsetX}, ${offsetY})`);
      const handlers = regionHover(feature.properties.nom);

      const count = resultsByRegion.get(feature.properties.nom)?.length || 0;
      const color = REGION_COLORS[feature.properties.code] || "#ccc";

      domGroup.append("path").datum(feature)
        .attr("d", domPath as unknown as string)
        .attr("fill", count > 0 ? color : color + "60")
        .attr("stroke", "#fff").attr("stroke-width", 0.5)
        .attr("cursor", "pointer")
        .on("mouseover", handlers.mouseover)
        .on("mousemove", handlers.mousemove)
        .on("mouseout", handlers.mouseout)
        .on("click", handlers.click);

      domGroup.append("text")
        .attr("x", domtomSize / 2).attr("y", domtomSize + 14)
        .attr("text-anchor", "middle").attr("font-size", "9px")
        .attr("fill", "currentColor").attr("class", "text-muted-foreground")
        .text(feature.properties.nom);

      if (count > 0) {
        const badgeG = domGroup.append("g")
          .attr("transform", `translate(${domtomSize / 2}, ${domtomSize / 2})`)
          .attr("pointer-events", "none");

        badgeG.append("circle").attr("r", 10).attr("fill", "white").attr("stroke", "#444").attr("stroke-width", 1);
        badgeG.append("text").attr("text-anchor", "middle").attr("dy", "0.35em")
          .attr("font-size", "9px").attr("font-weight", "700").attr("fill", "#333")
          .text(count);
      }
    });
  }, [geoData, results, resultsByRegion, height, onItemClick]);

  if (!geoData) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="relative w-full">
      <svg ref={svgRef} className="w-full" style={{ height }} />
      <div
        ref={tooltipRef}
        className="absolute z-50 hidden w-[200px] px-3 py-2 rounded-xl bg-white border border-gray-200 shadow-xl text-sm"
        style={{ pointerEvents: "auto" }}
        onMouseEnter={() => { if (tooltipRef.current) tooltipRef.current.style.display = "block"; }}
        onMouseLeave={() => { if (tooltipRef.current) tooltipRef.current.style.display = "none"; }}
      />
    </div>
  );
}
