import { CalendarDays, MapPin, Users } from "lucide-react";
import {
  Avatar,
  AvatarFallback,
  Badge,
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "site-forge";

export const ApercuProfil = () => (
  <div style={{ padding: 32, minHeight: 300 }}>
    <p className="text-sm">
      Atelier proposé par{" "}
      <HoverCard open openDelay={0}>
        <HoverCardTrigger asChild>
          <a href="#" className="font-medium text-primary underline-offset-4 hover:underline">
            @marie.dupont
          </a>
        </HoverCardTrigger>
        <HoverCardContent className="w-80" align="start">
          <div className="flex gap-4">
            <Avatar>
              <AvatarFallback>MD</AvatarFallback>
            </Avatar>
            <div className="space-y-1">
              <h4 className="text-sm font-semibold">Marie Dupont</h4>
              <p className="text-sm">
                Animatrice du repair café et référente mobilité douce du
                quartier Nord.
              </p>
              <div className="text-muted-foreground flex items-center pt-1 text-xs">
                <CalendarDays className="mr-1.5 size-3.5" />
                Membre depuis mars 2022
              </div>
            </div>
          </div>
        </HoverCardContent>
      </HoverCard>{" "}
      dans le cadre de la semaine de la réparation.
    </p>
  </div>
);

export const ApercuStructure = () => (
  <div style={{ padding: 32, minHeight: 320 }}>
    <p className="text-sm">
      En partenariat avec{" "}
      <HoverCard open openDelay={0}>
        <HoverCardTrigger asChild>
          <a href="#" className="font-medium text-primary underline-offset-4 hover:underline">
            La Fabrique
          </a>
        </HoverCardTrigger>
        <HoverCardContent className="w-80" align="start">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-semibold">La Fabrique</h4>
              <Badge variant="secondary">Tiers-lieu</Badge>
            </div>
            <p className="text-sm">
              Fablab et espace de coworking associatif ouvert du mardi au
              samedi.
            </p>
            <div className="text-muted-foreground grid gap-1 pt-1 text-xs">
              <span className="flex items-center">
                <MapPin className="mr-1.5 size-3.5" />
                14 rue des Ateliers, Saint-Denis
              </span>
              <span className="flex items-center">
                <Users className="mr-1.5 size-3.5" />
                86 membres actifs
              </span>
            </div>
          </div>
        </HoverCardContent>
      </HoverCard>
      .
    </p>
  </div>
);
