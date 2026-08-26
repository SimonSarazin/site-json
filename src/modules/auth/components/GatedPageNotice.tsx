import { useEffect, useRef } from "react";
import { Lock } from "lucide-react";

import { useT } from "@/hooks/useT";
import { useLoadNamespace } from "@/hooks/useLoadNamespace";
import type { GateReason, PageGateMode } from "@/lib/pageAccess";

import { LoginPrompt } from "./LoginPrompt";
import { useAuthModal } from "../hooks/useAuthModal";

interface GatedPageNoticeProps {
  mode: PageGateMode;
  reason: GateReason;
  /** L'accès est-il déjà tranché ? Avant hydratation on ne sait rien : on n'affiche aucun refus. */
  resolved: boolean;
}

/**
 * Ce qu'une page GARDÉE affiche à la place de ses sections tant que l'accès n'est pas accordé.
 *
 * Trois situations, une seule règle : ne jamais laisser l'utilisateur devant une page vide sans
 * explication, et ne jamais lui faire perdre ce qu'il était en train de faire.
 *
 *  - `prompt` + anonyme → la modale de connexion s'ouvre PAR-DESSUS la page, et une invitation
 *    reste affichée derrière (si l'utilisateur ferme la modale, il garde une porte). On ne navigue
 *    pas : ni la destination ni l'historique ne sont perdus. C'est la convention déjà en vigueur
 *    pour les ACTIONS du produit, étendue aux pages.
 *  - `redirect` → la garde est en train de naviguer : un message neutre, pas un refus (l'écran
 *    ne vit qu'une fraction de seconde).
 *  - `hide`, ou refus de RÔLE quel que soit le mode → un refus. Inviter à « se connecter »
 *    quelqu'un DÉJÀ connecté à qui il manque un rôle n'aurait aucun sens.
 *
 * Avant hydratation (`resolved` faux), on ne sait pas encore : message d'attente neutre. Ce
 * composant n'est de toute façon jamais rendu au SSR avec un verdict, puisque `me` y vaut
 * toujours `null`.
 */
export function GatedPageNotice({ mode, reason, resolved }: GatedPageNoticeProps) {
  useLoadNamespace("modules/auth");
  const t = useT("modules/auth");
  const { openLogin } = useAuthModal();
  const dejaOuvert = useRef(false);

  const inviteALaConnexion = resolved && reason === "anonymous" && mode === "prompt";

  useEffect(() => {
    if (!inviteALaConnexion || dejaOuvert.current) return;
    dejaOuvert.current = true;
    openLogin();
  }, [inviteALaConnexion, openLogin]);

  if (!resolved || mode === "redirect") {
    return (
      <div className="flex min-h-[50vh] items-center justify-center px-4">
        <p className="text-center text-muted-foreground">
          {t("Vérification de votre accès…")}
        </p>
      </div>
    );
  }

  if (inviteALaConnexion) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center px-4">
        <LoginPrompt variant="card" className="max-w-md" message={t("Cette page est réservée. Connectez-vous pour y accéder.")} />
      </div>
    );
  }

  // `hide`, ou rôle manquant : refus, sans proposer une connexion qui ne changerait rien.
  return (
    <div className="flex min-h-[50vh] items-center justify-center px-4">
      <div className="flex max-w-md flex-col items-center gap-3 rounded-xl border border-border bg-muted/30 p-6 text-center">
        <Lock className="h-6 w-6 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          {reason === "role" ? t("Votre compte n'a pas les droits nécessaires pour voir cette page.") : t("Cette page est réservée.")}
        </p>
      </div>
    </div>
  );
}
