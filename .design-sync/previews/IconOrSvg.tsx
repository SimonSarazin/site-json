import { IconOrSvg } from "site-forge";

// Les deux formats acceptés par la convention SiteForge (champs logoIcon/icon
// des configs JSON) : nom Lucide kebab-case → DynamicIcon, ou SVG inline.

const lucide = [
  { nom: "baby", legende: "baby" },
  { nom: "users", legende: "users" },
  { nom: "calendar-days", legende: "calendar-days" },
  { nom: "map-pin", legende: "map-pin" },
  { nom: "piggy-bank", legende: "piggy-bank" },
  { nom: "sprout", legende: "sprout" },
];

export const NomsLucide = () => (
  <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
    {lucide.map((i) => (
      <div key={i.nom} className="flex flex-col items-center gap-1.5">
        <IconOrSvg value={i.nom} className="size-8 text-primary" aria-label={i.legende} />
        <span className="font-mono text-xs text-muted-foreground">{i.legende}</span>
      </div>
    ))}
  </div>
);

const svgMaison =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
  '<path d="M3 11 L12 3 L21 11"/><path d="M5 10 V21 H19 V10"/>' +
  '<circle cx="12" cy="15" r="2.5"/><path d="M12 17.5 V21"/></svg>';

export const SvgInline = () => (
  <div style={{ display: "flex", gap: 24, alignItems: "center" }}>
    <div className="flex flex-col items-center gap-1.5">
      <IconOrSvg value={svgMaison} className="size-10 text-primary" aria-label="Maison des familles" />
      <span className="text-xs text-muted-foreground">SVG inline custom</span>
    </div>
    <div className="flex flex-col items-center gap-1.5">
      <IconOrSvg value={svgMaison} className="size-10 rounded-md bg-primary p-2 text-primary-foreground" />
      <span className="text-xs text-muted-foreground">sur pastille</span>
    </div>
    <div className="flex flex-col items-center gap-1.5">
      <IconOrSvg value="heart-handshake" className="size-10 text-accent-foreground" />
      <span className="text-xs text-muted-foreground">lucide, même rendu</span>
    </div>
  </div>
);
