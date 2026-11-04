/**
 * Identifiant de l'onglet qui réserve des promesses (`pledgeSelection`, `mine`), gardé en `sessionStorage`. Un onglet
 * dupliqué l'annonce sur un `BroadcastChannel` et en prend un autre s'il est déjà porté par un onglet ouvert.
 */
const STORAGE_KEY = "cagnotte.pledgeHolder";
const CHANNEL_NAME = "cagnotte.pledgeHolder";
const HOLDER_FORMAT = /^[A-Za-z0-9-]{8,64}$/;

let current = "";
let channel: BroadcastChannel | null = null;

function newHolder(): string {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

function store(holder: string) {
  current = holder;
  try {
    window.sessionStorage.setItem(STORAGE_KEY, holder);
  } catch {
    // Stockage indisponible : l'identifiant vit le temps de la page.
  }
}

function watchDuplicates() {
  if (channel || typeof BroadcastChannel === "undefined") return;
  try {
    channel = new BroadcastChannel(CHANNEL_NAME);
  } catch {
    return;
  }
  channel.onmessage = (event: MessageEvent) => {
    const message = event.data as { type?: unknown; holder?: unknown } | null;
    if (!message || message.holder !== current) return;
    if (message.type === "hello") channel?.postMessage({ type: "taken", holder: current });
    else if (message.type === "taken") store(newHolder());
  };
  channel.postMessage({ type: "hello", holder: current });
}

/** L'identifiant de cet onglet, `""` hors navigateur. */
export function getPledgeHolder(): string {
  if (typeof window === "undefined") return "";
  if (current === "") {
    let stored: string | null = null;
    try {
      stored = window.sessionStorage.getItem(STORAGE_KEY);
    } catch {
      stored = null;
    }
    store(stored && HOLDER_FORMAT.test(stored) ? stored : newHolder());
    watchDuplicates();
  }
  return current;
}
