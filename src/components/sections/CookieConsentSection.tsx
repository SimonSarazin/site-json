import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Cookie, Settings, X } from "lucide-react";
import { useLocalization } from "@/hooks/useLocalization";
import { useLoadNamespace } from "@/hooks/useLoadNamespace";
import { useT } from "@/hooks/useT";
import { useHydrated } from "@/hooks/useHydrated";
import NavLink from "@/components/layout/NavLink";
import { useConsentRecord, writeConsent, type ConsentRecord } from "@/lib/consent";
import { cn } from "@/lib/utils";
import type { CookieConsentSectionProps } from "@/types/site-schema";
import "./i18n/i18n";

type Category = NonNullable<CookieConsentSectionProps["categories"]>[number];

/**
 * Choix affiché pour chaque catégorie : requise → toujours vraie ; sinon la préférence
 * enregistrée, et à défaut `defaultOn` (catégorie en opposition) ou décochée.
 */
function preferencesFrom(categories: Category[], record: ConsentRecord | null): Record<string, boolean> {
  const prefs: Record<string, boolean> = {};
  for (const c of categories) {
    if (c.required) prefs[c.id] = true;
    else if (record && c.id in record.preferences) prefs[c.id] = record.preferences[c.id];
    else prefs[c.id] = record && !record.accepted ? false : (c.defaultOn ?? false);
  }
  return prefs;
}

/**
 * Consentement cookies — deux usages, mêmes props :
 * - bandeau flottant (`inline` absent) : affiché après hydratation tant qu'aucun choix n'est
 *   enregistré, monté globalement par `SiteShell` (`config.consent`) ou placé en section ;
 * - panneau de préférences (`inline: true`) : dans le flux de la page (politique de cookies),
 *   toujours visible, pour consulter et modifier son choix — le droit d'opposition.
 * Le choix est écrit par `src/lib/consent.ts`, que lit `IntegrationsLoader`.
 */
export function CookieConsentSection({ id, props }: { id?: string; props: CookieConsentSectionProps }) {
  const { t, currentLocale } = useLocalization();
  useLoadNamespace("components/sections");
  const tt = useT("components/sections");
  const { message, acceptLabel, declineLabel, settingsLabel, policyUrl, position = "bottom", inline = false, categories = [] } = props;

  const record = useConsentRecord();
  const hydrated = useHydrated();
  const [dismissed, setDismissed] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [draft, setDraft] = useState<Record<string, boolean> | null>(null);

  const stored = useMemo(() => preferencesFrom(categories, record), [categories, record]);
  const preferences = draft ?? stored;

  const save = (prefs: Record<string, boolean>, accepted: boolean) => {
    writeConsent(prefs, accepted);
    setDraft(null);
    setShowSettings(false);
    setDismissed(true);
  };
  const acceptAll = () => save(Object.fromEntries(categories.map((c) => [c.id, true])), true);
  const declineAll = () => save(Object.fromEntries(categories.map((c) => [c.id, c.required === true])), false);
  const savePreferences = () => save(preferences, true);
  const setPreference = (categoryId: string, checked: boolean) => setDraft({ ...preferences, [categoryId]: checked });

  const categoryRows = (
    <div className="space-y-4">
      {categories.map((category) => (
        <div key={category.id} className="space-y-2">
          <div className="flex items-center space-x-2">
            <Checkbox
              id={`${id ?? "cookie-consent"}-${category.id}`}
              checked={preferences[category.id] ?? false}
              onCheckedChange={(checked) => !category.required && setPreference(category.id, Boolean(checked))}
              disabled={category.required}
            />
            <Label htmlFor={`${id ?? "cookie-consent"}-${category.id}`} className="font-medium">
              {t(category.label)}
              {category.required && <span className="text-xs text-muted-foreground ml-2">({tt("Requis")})</span>}
            </Label>
          </div>
          <p className="text-xs text-muted-foreground ml-6">{t(category.description)}</p>
        </div>
      ))}
    </div>
  );

  const policyLink = policyUrl ? (
    <>
      {" "}
      <NavLink to={policyUrl} className="text-primary hover:underline">
        {tt("En savoir plus")}
      </NavLink>
    </>
  ) : null;

  if (inline) {
    const savedOn = record?.timestamp ? new Date(record.timestamp) : null;
    return (
      <section id={id} className="container mx-auto max-w-2xl px-4 py-8">
        <Card>
          <CardContent className="p-6 space-y-6">
            <div className="flex items-start gap-4">
              <Cookie className="w-6 h-6 text-primary mt-1 shrink-0" aria-hidden="true" />
              <p className="text-sm leading-relaxed">
                {t(message)}
                {policyLink}
              </p>
            </div>
            {categories.length > 0 && categoryRows}
            <div className="flex flex-wrap items-center gap-3">
              <Button onClick={savePreferences} size="sm" disabled={!hydrated}>
                {tt("Enregistrer mes choix")}
              </Button>
              <span className="text-xs text-muted-foreground" data-testid="consent-status">
                {savedOn && !Number.isNaN(savedOn.getTime())
                  ? tt("Choix enregistré le {{date}}", undefined, { date: savedOn.toLocaleDateString(currentLocale) })
                  : tt("Aucun choix enregistré")}
              </span>
            </div>
          </CardContent>
        </Card>
      </section>
    );
  }

  // Bandeau : rien au SSR ni avant hydratation (le choix vit dans le navigateur), rien une fois choisi.
  if (!hydrated || record || dismissed) return null;

  const positionClasses = {
    top: "top-4 left-4 right-4",
    "bottom-left": "bottom-4 left-4 max-w-md",
    "bottom-right": "bottom-4 right-4 max-w-md",
    bottom: "bottom-4 left-4 right-4",
  }[position];

  return (
    <div id={id} className={cn("fixed z-50", positionClasses)} role="dialog" aria-live="polite" aria-label={tt("Paramètres des cookies")}>
      <Card className="shadow-lg border-2">
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            <Cookie className="w-6 h-6 text-primary mt-1 shrink-0" aria-hidden="true" />
            <div className="flex-1">
              <p className="text-sm leading-relaxed mb-4">
                {t(message)}
                {policyLink}
              </p>

              <div className="flex flex-wrap gap-2">
                <Button onClick={acceptAll} size="sm">
                  {t(acceptLabel)}
                </Button>

                {declineLabel && (
                  <Button variant="outline" onClick={declineAll} size="sm">
                    {t(declineLabel)}
                  </Button>
                )}

                {settingsLabel && categories.length > 0 && (
                  <Dialog open={showSettings} onOpenChange={setShowSettings}>
                    <DialogTrigger asChild>
                      <Button variant="ghost" size="sm">
                        <Settings className="w-4 h-4 mr-2" aria-hidden="true" />
                        {t(settingsLabel)}
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-md">
                      <DialogHeader>
                        <DialogTitle>{tt("Paramètres des cookies")}</DialogTitle>
                      </DialogHeader>
                      {categoryRows}
                      <div className="flex gap-2 pt-4">
                        <Button onClick={savePreferences} className="flex-1">
                          {tt("Sauvegarder")}
                        </Button>
                        <Button variant="outline" onClick={() => setShowSettings(false)}>
                          {tt("Annuler")}
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                )}
              </div>
            </div>

            <Button variant="ghost" size="sm" aria-label={tt("Fermer")} onClick={() => setDismissed(true)} className="shrink-0 p-1">
              <X className="w-4 h-4" aria-hidden="true" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
export default CookieConsentSection;
