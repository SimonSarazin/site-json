import { Avatar, AvatarFallback, AvatarImage } from "site-forge";

// Portraits en data-URI SVG (pas d'URL réseau : OptimizedImage/img proxy absents
// hors app, et la capture tourne offline). Formes plates + hex, cf. learnings v1.
const portrait = (fond: string, buste: string) =>
  "data:image/svg+xml," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 64 64">` +
      `<rect width="64" height="64" fill="${fond}"/>` +
      `<circle cx="32" cy="24" r="11" fill="${buste}"/>` +
      `<path d="M10 58c2-13 11-19 22-19s20 6 22 19z" fill="${buste}"/>` +
    `</svg>`
  );

export const AvecPhoto = () => (
  <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
    <Avatar>
      <AvatarImage src={portrait("#dbeafe", "#3b82f6")} alt="Claire Fabre" />
      <AvatarFallback>CF</AvatarFallback>
    </Avatar>
    <Avatar className="size-12">
      <AvatarImage src={portrait("#fef3c7", "#d97706")} alt="Malik Benali" />
      <AvatarFallback>MB</AvatarFallback>
    </Avatar>
    <Avatar className="size-16">
      <AvatarImage src={portrait("#dcfce7", "#16a34a")} alt="Anne Roussel" />
      <AvatarFallback>AR</AvatarFallback>
    </Avatar>
  </div>
);

export const Initiales = () => (
  <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
    <Avatar>
      <AvatarFallback>CF</AvatarFallback>
    </Avatar>
    <Avatar className="size-12">
      <AvatarFallback className="bg-primary text-primary-foreground">MB</AvatarFallback>
    </Avatar>
    <Avatar className="size-12">
      <AvatarFallback className="bg-accent text-accent-foreground">AR</AvatarFallback>
    </Avatar>
  </div>
);

export const GroupeMembres = () => (
  <div style={{ display: "flex", alignItems: "center" }}>
    <div className="flex -space-x-2">
      <Avatar className="size-10 ring-2 ring-background">
        <AvatarImage src={portrait("#dbeafe", "#3b82f6")} alt="Claire Fabre" />
        <AvatarFallback>CF</AvatarFallback>
      </Avatar>
      <Avatar className="size-10 ring-2 ring-background">
        <AvatarImage src={portrait("#fef3c7", "#d97706")} alt="Malik Benali" />
        <AvatarFallback>MB</AvatarFallback>
      </Avatar>
      <Avatar className="size-10 ring-2 ring-background">
        <AvatarImage src={portrait("#fce7f3", "#db2777")} alt="Sonia Weber" />
        <AvatarFallback>SW</AvatarFallback>
      </Avatar>
      <Avatar className="size-10 ring-2 ring-background">
        <AvatarFallback className="bg-muted text-xs">+7</AvatarFallback>
      </Avatar>
    </div>
    <span className="ml-3 text-sm text-muted-foreground">11 membres du réseau</span>
  </div>
);
