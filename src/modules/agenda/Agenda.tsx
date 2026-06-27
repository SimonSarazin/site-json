import { useState } from "react";
import { Search } from "lucide-react";
import { EVENT_TYPES } from "@communecter/cocolight-api-client";
import { Input } from "@/components/ui/input";
import { useDebounce } from "@/hooks/useDebounce";
import { useLocalization } from "@/hooks/useLocalization";
import AgendaList from "./components/AgendaList";
import type { AgendaSectionProps } from "./schema";

/**
 * Conteneur agenda (event-centré) : barre de filtres (texte + type d'event) + liste à onglets temporels.
 * v1 = vue LISTE (En cours / À venir / Passés) sur `searchEventsCostum`. Grille calendrier = itération suivante.
 */
export function Agenda({ props }: { props: AgendaSectionProps }) {
  const { t } = useLocalization();
  const {
    title,
    description,
    tabs = ["upcoming", "ongoing", "past"],
    defaultTab = "upcoming",
    upcomingWindowMonths = 12,
    filters,
    detailsMode = "drawer",
    columns,
  } = props;

  const [text, setText] = useState("");
  const [type, setType] = useState("");
  const debouncedText = useDebounce(text, 500);

  const showText = filters?.text !== false;
  const showType = filters?.type !== false;

  return (
    <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {(title || description) && (
        <div className="mb-6">
          {title && <h2 className="text-2xl font-bold text-foreground">{t(title)}</h2>}
          {description && <p className="text-muted-foreground mt-1">{t(description)}</p>}
        </div>
      )}

      {(showText || showType) && (
        <div className="flex flex-col sm:flex-row gap-2 mb-6">
          {showText && (
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Rechercher un événement…"
                className="pl-9"
              />
            </div>
          )}
          {showType && (
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="h-10 rounded-md border border-input bg-background px-3 text-sm text-foreground"
              aria-label="Type d'événement"
            >
              <option value="">Tous les types</option>
              {EVENT_TYPES.map((evType) => (
                <option key={evType} value={evType}>
                  {evType}
                </option>
              ))}
            </select>
          )}
        </div>
      )}

      <AgendaList
        tabs={tabs}
        defaultTab={defaultTab}
        upcomingWindowMonths={upcomingWindowMonths}
        type={type || undefined}
        name={debouncedText || undefined}
        detailsMode={detailsMode}
        columns={columns}
      />
    </div>
  );
}

export default Agenda;
