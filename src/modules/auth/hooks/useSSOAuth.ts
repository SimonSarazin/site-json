import { useCallback, useEffect, useRef } from "react";
import { type ApiClient } from "@communecter/cocolight-api-client";
import { useCocolight } from "@/hooks/useCocolight";
import { getBaseUrl, getSlug } from "@/lib/constant/common";

export interface SSOAuthResult {
  success: boolean;
  /** Message d'erreur si success === false (undefined si annulé silencieusement) */
  error?: string;
}

/**
 * Hook pour déclencher une connexion SSO via popup.
 *
 * Ouvre une popup Communecter pointant sur `/co2/sso/services?authclient=<service>`.
 * Après le flux OAuth, Communecter envoie un `postMessage` contenant les JWT tokens.
 * Le hook les injecte dans l'`ApiClient` et émet l'événement `userLoggedIn` afin que
 * `CocolightProvider` mette à jour l'état de l'utilisateur connecté.
 *
 * L'URL porte aussi le costum du SITE (`costumSlug` + `costumId`/`costumType` quand l'entité porteuse
 * est résolue) : un compte CRÉÉ par le SSO est alors estampillé `source.key` comme une inscription
 * classique depuis ce site (sans ça il n'appartenait à aucun costum). Même trio que `register`.
 *
 * Quand le retour du provider n'arrive PAS dans la popup (lien de vérification d'e-mail ouvert dans
 * un nouvel onglet), le backend renvoie ce nouvel onglet sur `/sso/callback` (SsoCallbackPage) ;
 * cet onglet-ci l'apprend par l'événement `storage` (CocolightProvider), la popup se ferme ensuite
 * d'elle-même et la promesse ci-dessous se résout en annulation silencieuse.
 */
export function useSSOAuth() {
  const { apiClient, contextId, contextType } = useCocolight();
  const cleanupRef = useRef<(() => void) | null>(null);

  // Nettoyage des listeners si le composant est démonté avant la fin du flux
  useEffect(() => {
    return () => {
      cleanupRef.current?.();
    };
  }, []);

  const openSSOPopup = useCallback(
    (service: string): Promise<SSOAuthResult> => {
      return new Promise((resolve) => {
        const origin      = window.location.origin;
        const backendUrl  = getBaseUrl();
        const params      = new URLSearchParams({ authclient: service, origin });
        const slug        = getSlug();
        if (slug) {
          params.set("costumSlug", slug);
          if (contextId && contextType) {
            params.set("costumId", contextId);
            params.set("costumType", contextType);
          }
        }
        const ssoUrl      = `${backendUrl}/co2/sso/services?${params.toString()}`;

        // Centrer le popup
        const w    = 600;
        const h    = 700;
        const left = Math.round(window.screen.width  / 2 - w / 2);
        const top  = Math.round(window.screen.height / 2 - h / 2);

        const popup = window.open(
          ssoUrl,
          "sso-login",
          `width=${w},height=${h},scrollbars=yes,resizable=yes,left=${left},top=${top}`,
        );

        if (!popup) {
          resolve({ success: false, error: "Popup bloqué par le navigateur" });
          return;
        }

        // La popup est sur la même origine que le backend.
        let backendOrigin: string;
        try {
          backendOrigin = new URL(backendUrl).origin;
        } catch {
          backendOrigin = backendUrl;
        }

        let resolved = false;

        const safeResolve = (result: SSOAuthResult) => {
          if (!resolved) {
            resolved = true;
            cleanup();
            resolve(result);
          }
        };

        const handleMessage = (event: MessageEvent) => {
          // Sécurité : on n'accepte que les messages venant du backend Communecter
          if (event.origin !== backendOrigin) return;
          if (event.data?.type === "SSO_AUTH_SUCCESS") {
            const { accessToken, refreshToken } = event.data as {
              accessToken: string;
              refreshToken?: string;
            };

            if (accessToken && apiClient) {
              const c = apiClient as ApiClient;
              c.setToken(accessToken);
              if (refreshToken) {
                c.setRefreshToken(refreshToken);
              }
              c.emit("userLoggedIn");
            }

            safeResolve({ success: true });
          } else if (event.data?.type === "SSO_AUTH_ERROR") {
            safeResolve({ success: false, error: event.data.error });
          }
        };

        // Détection de la fermeture du popup (annulation manuelle)
        const checkClosed = setInterval(() => {
          if (popup.closed) {
            safeResolve({ success: false });
          }
        }, 500);

        const cleanup = () => {
          clearInterval(checkClosed);
          window.removeEventListener("message", handleMessage);
          cleanupRef.current = null;
        };

        cleanupRef.current = cleanup;
        window.addEventListener("message", handleMessage);
      });
    },
    [apiClient, contextId, contextType],
  );

  return { openSSOPopup };
}
