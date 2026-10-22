import { useContext } from "react";
import { useT } from "@/hooks/useT";
import { AuthModalContext } from "@/modules/auth/context/AuthModalContext";
import { LoginPrompt } from "@/modules/auth/components/LoginPrompt";

export interface LoginToParticipateProps {
  /** Le message. Par défaut, l'invitation à répondre (`thread.loginToComment`). */
  readonly message?: string;
  /**
   * `composer` (défaut) : à la place du composer, sous le fil. `block` : seule dans une colonne
   * vide — le panneau, devant un fil qu'il ne montre qu'à un connecté.
   */
  readonly placement?: "composer" | "block";
}

/**
 * Pour un visiteur ANONYME : l'invitation à se connecter, sur place. Le fil se lisait sans que
 * rien n'invite à y répondre (revue du 29/09).
 *
 * `LoginPrompt` ouvre la modale de connexion globale, qui n'existe que sous `AuthModalProvider`
 * (`RootLayout`). Ailleurs — un hôte qui monte le fil sans lui, un test —, seul le message
 * s'affiche, plutôt qu'une erreur.
 */
export function LoginToParticipate({ message, placement = "composer" }: LoginToParticipateProps) {
  const t = useT("modules/comment");
  const modale = useContext(AuthModalContext);
  const texte = message ?? String(t("thread.loginToComment"));
  const bloc = placement === "block";

  return (
    <div
      className={bloc ? "p-4" : "comment-composer-zone shrink-0 px-2 pb-2"}
      data-login-to-participate={placement}
    >
      {modale ? (
        <LoginPrompt message={texte} variant={bloc ? "card" : "inline"} />
      ) : (
        <p className="text-muted-foreground px-2 py-3 text-sm">{texte}</p>
      )}
    </div>
  );
}
