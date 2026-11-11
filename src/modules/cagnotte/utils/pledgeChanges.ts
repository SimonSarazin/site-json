/**
 * Prévient les autres onglets du navigateur qu'une réservation ou une promesse a changé (`BroadcastChannel`) : ils
 * relisent les paiements en cours sans attendre leur prochaine relecture. Sans `BroadcastChannel`, rien n'est envoyé.
 */
const CHANNEL_NAME = "cagnotte.pledgeChanges";

let channel: BroadcastChannel | null = null;
const listeners = new Set<() => void>();

function openChannel(): BroadcastChannel | null {
  if (channel || typeof BroadcastChannel === "undefined") return channel;
  try {
    channel = new BroadcastChannel(CHANNEL_NAME);
    channel.onmessage = () => listeners.forEach((listener) => listener());
  } catch {
    channel = null;
  }
  return channel;
}

/** Signale aux autres onglets qu'une réservation ou une promesse a changé. */
export function notifyPledgeChange(): void {
  openChannel()?.postMessage({ type: "changed" });
}

/** Rappelle `listener` quand un autre onglet signale un changement ; rend la désinscription. */
export function onPledgeChange(listener: () => void): () => void {
  openChannel();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
