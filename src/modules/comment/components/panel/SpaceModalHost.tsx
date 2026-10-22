import { Suspense, useEffect, useRef, type RefObject } from "react";
import type { EntityTypes } from "@communecter/cocolight-api-client";
import { useSpaceLauncher } from "../../hooks/useSpaceLauncher";
import { findOpener } from "../../lib/opener";
import { spaceKey } from "../../lib/space";
import { SpaceModalChunk } from "../../lib/spaceModalChunk";
import { useSpaceHost, type SpaceHostRank } from "../../lib/spaceHosts";
import type { SpaceRef, SpaceSubject } from "../../types";

/**
 * Tenu à l'écran par `Suspense` tant que le code de la modale n'est pas arrivé. Il ne montre rien :
 * il dit à l'hôte qu'on l'attend.
 */
function ModaleAttendue({ onChange }: { onChange: (attendue: boolean) => void }) {
  useEffect(() => {
    onChange(true);
    return () => onChange(false);
  }, [onChange]);
  return null;
}

const SANS_ATTENTE = (): void => undefined;

export interface SpaceModalHostProps {
  /** L'espace dont on monte la modale. */
  readonly space: SpaceRef;
  /** Son titre, tel que l'écran l'a résolu — repris en tête de la modale. */
  readonly title?: string | null;
  /** L'entité où chercher d'abord les personnes à mentionner. */
  readonly scopeEntity?: EntityTypes | null;
  /** Ce dont l'espace est l'espace, pour le nommer. Par défaut, un commun. */
  readonly subject?: SpaceSubject;
  /**
   * Le rang de cet hôte quand un autre monte le même espace (`lib/spaceHosts`) : la page — la fiche
   * d'un commun — passe devant un formulaire posé sur elle.
   */
  readonly rank: SpaceHostRank;
  /** Où rendre le focus à la fermeture, quand aucun bouton nommé n'est plus là pour le reprendre. */
  readonly fallbackFocus?: RefObject<HTMLElement | null>;
  /** Prévenu quand la modale se fait attendre — son code se télécharge — et quand elle arrive. */
  readonly onWaitingChange?: (waiting: boolean) => void;
}

/**
 * Monte la modale d'un espace quand l'adresse l'ouvre — une seule par espace et par page, quel que
 * soit le nombre d'hôtes déclarés (`useSpaceHost`).
 *
 * Fermée, elle ne rend rien et ne demande rien. À la fermeture — par la croix, Échap ou « retour » —,
 * le focus revient au bouton d'où l'on a ouvert, s'il s'est nommé (`OPENER_ATTRIBUTE`) et qu'il est
 * encore à l'écran, sinon à `fallbackFocus`. Radix le rendrait à son `DialogTrigger`, et la modale
 * n'en a pas : elle s'ouvre aussi par une adresse, sans clic. Sans ceci le focus tombait sur
 * `<body>` (mesuré au navigateur le 07/10), et qui navigue au clavier reprenait la page par son
 * début.
 */
export function SpaceModalHost({ space, title, scopeEntity, subject, rank, fallbackFocus, onWaitingChange }: SpaceModalHostProps) {
  const launcher = useSpaceLauncher(space);
  const hote = useSpaceHost(spaceKey(space), rank);
  const etaitOuverte = useRef(false);
  // Retenu tant que la modale est ouverte : à la fermeture, l'entrée qui le portait n'est plus là.
  // Chaque ouverture le réécrit — par son nom, ou par `null` quand elle n'en a pas.
  const ouvreur = useRef<string | null>(null);
  useEffect(() => {
    if (launcher.open) ouvreur.current = launcher.opener;
    // Sans défilement : le bouton est celui qu'on vient de quitter, la page n'a pas à bouger. Deux hôtes
    // du même espace le rendent au même bouton nommé — un second geste ne change rien.
    if (etaitOuverte.current && !launcher.open) {
      (findOpener(ouvreur.current) ?? fallbackFocus?.current)?.focus({ preventScroll: true });
    }
    etaitOuverte.current = launcher.open;
  }, [launcher.open, launcher.opener, fallbackFocus]);

  if (!hote || !launcher.open) return null;
  return (
    <Suspense fallback={<ModaleAttendue onChange={onWaitingChange ?? SANS_ATTENTE} />}>
      <SpaceModalChunk
        open
        onOpenChange={next => {
          if (!next) launcher.close();
        }}
        space={space}
        title={title}
        target={launcher.target}
        onSelect={launcher.select}
        scopeEntity={scopeEntity}
        subject={subject}
      />
    </Suspense>
  );
}
