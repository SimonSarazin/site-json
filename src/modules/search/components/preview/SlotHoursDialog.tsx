import { useEffect, useId, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useDebounce } from "@/hooks/useDebounce";
import type { useT } from "@/hooks/useT";
import { hourMinutes } from "../../lib/slotFilter";

type Translate = ReturnType<typeof useT>;

/** Pas des champs heure : le quart d'heure du formulaire des créneaux (`minuteStep: 15`). Une AIDE de saisie
 *  seulement — une minute importée (7 h 35) reste possible, c'est l'horaire réel du planning. */
const PAS_SECONDES = 15 * 60;
/** Délai après la dernière frappe avant l'avertissement en direct. */
const DELAI_MS = 300;

/**
 * Fenêtre « Modifier l'horaire » d'un créneau (`reservations.booking.editHours`) : le jour et la période se
 * lisent, seules les heures se saisissent (NB de Peterson du 23/10). `onSubmit` contrôle et enregistre
 * (`useUpdateSlotHours`), et rend le motif d'un refus — affiché ici, la fenêtre restant ouverte — ou `null`.
 * `onCheck` juge le nouvel horaire PENDANT la saisie (demande de Peterson du 26/10) : dès que les deux heures sont
 * saisies et diffèrent de l'horaire actuel, son motif s'affiche sous les champs. Un avertissement seulement — le
 * bouton reste actif, et c'est `onSubmit` qui refuse l'enregistrement, sur des réservations relues.
 * Montée par l'appelant à chaque ouverture (`key`) : les champs repartent de l'horaire du créneau.
 */
export function SlotHoursDialog({
  open,
  onOpenChange,
  context,
  start,
  end,
  saving,
  onSubmit,
  onCheck,
  t,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** « Collège Joseph Bédier · Lundi · Du 19 août 2026 au 5 nov. 2026 », déjà formaté. */
  context: string;
  /** Horaire actuel, `HH:MM`. */
  start: string;
  end: string;
  saving: boolean;
  onSubmit: (startMinutes: number, endMinutes: number) => Promise<string | null>;
  /** Contrôle en direct (réservations en cache) : le motif qui refuserait cet horaire, ou `null`. */
  onCheck: (startMinutes: number, endMinutes: number) => Promise<string | null>;
  t: Translate;
}) {
  const id = useId();
  const [debut, setDebut] = useState(start);
  const [fin, setFin] = useState(end);
  const [refus, setRefus] = useState<string | null>(null);
  const [avertissement, setAvertissement] = useState<{ debut: string; fin: string; motif: string | null } | null>(null);
  const debutSaisi = useDebounce(debut, DELAI_MS);
  const finSaisie = useDebounce(fin, DELAI_MS);
  // Le contrôle relit les réservations avant l'écriture : bouton bloqué dès le clic, pas seulement
  // pendant l'enregistrement (`saving`), sinon un double clic lance deux contrôles et deux écritures.
  const [envoi, setEnvoi] = useState(false);
  const occupe = envoi || saving;

  // Avertissement en direct : seulement sur un horaire complet ET modifié — l'horaire actuel n'est pas une saisie.
  // Le motif est rangé avec la saisie qu'il juge : une réponse arrivée après une nouvelle frappe ne s'affiche pas.
  useEffect(() => {
    const s = hourMinutes(debutSaisi);
    const e = hourMinutes(finSaisie);
    if (s === null || e === null || (debutSaisi === start && finSaisie === end)) return;
    let actif = true;
    onCheck(s, e)
      .catch(() => null)
      .then((motif) => {
        if (actif) setAvertissement({ debut: debutSaisi, fin: finSaisie, motif });
      });
    return () => {
      actif = false;
    };
  }, [debutSaisi, end, finSaisie, onCheck, start]);
  const modifie = debut !== start || fin !== end;
  const juge = avertissement !== null && avertissement.debut === debut && avertissement.fin === fin;
  // Un refus d'enregistrement prime ; sinon l'avertissement de la saisie affichée, s'il la juge encore.
  const message = refus ?? (modifie && juge ? avertissement.motif : null);

  const enregistrer = async () => {
    const s = hourMinutes(debut);
    const e = hourMinutes(fin);
    if (s === null || e === null) {
      setRefus(t("PreviewReservations.issue.hours"));
      return;
    }
    setEnvoi(true);
    let motif: string | null;
    try {
      motif = await onSubmit(s, e);
    } finally {
      setEnvoi(false);
    }
    if (motif) setRefus(motif);
    else onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("PreviewReservations.editHours.title")}</DialogTitle>
          <DialogDescription>{context}</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor={`${id}-start`} className="text-xs text-muted-foreground">
              {t("PreviewReservations.editHours.start")}
            </Label>
            <Input
              id={`${id}-start`}
              type="time"
              step={PAS_SECONDES}
              value={debut}
              onChange={(e) => {
                setDebut(e.target.value);
                setRefus(null);
              }}
              className="border border-input"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`${id}-end`} className="text-xs text-muted-foreground">
              {t("PreviewReservations.editHours.end")}
            </Label>
            <Input
              id={`${id}-end`}
              type="time"
              step={PAS_SECONDES}
              value={fin}
              onChange={(e) => {
                setFin(e.target.value);
                setRefus(null);
              }}
              className="border border-input"
            />
          </div>
        </div>
        {message && (
          <p role="alert" className="text-sm font-medium text-destructive">
            {message}
          </p>
        )}
        <p className="text-xs text-muted-foreground">{t("PreviewReservations.editHours.hint")}</p>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={occupe}>
            {t("PreviewReservations.editHours.cancel")}
          </Button>
          <Button type="button" onClick={enregistrer} disabled={occupe}>
            {occupe ? t("PreviewReservations.editHours.saving") : t("PreviewReservations.editHours.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
