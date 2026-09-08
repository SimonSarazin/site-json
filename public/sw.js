/* eslint-disable no-undef */
/**
 * SERVICE WORKER — notifications push (cocolight docs/29 §12).
 *
 * C'est le seul code du projet qui s'exécute SANS page ouverte. Il reste donc minimal, et
 * délibérément ignorant : il ne connaît ni l'utilisateur, ni le contenu de la notification.
 *
 * ── POURQUOI IL N'AFFICHE RIEN DE PRÉCIS ────────────────────────────────────────────────────
 * La charge push est chiffrée de bout en bout, mais elle traverse un service tiers (Google,
 * Mozilla, Apple) et arrive ici EN CLAIR. On y applique la même règle qu'au flux SSE : on
 * transporte l'invalidation, jamais la donnée. Le clic ouvre l'application, qui va chercher le
 * contenu avec les droits de la personne.
 *
 * ── LE `tag` ────────────────────────────────────────────────────────────────────────────────
 * Il fusionne les avertissements successifs D'UNE MÊME ORIGINE : dix notifications d'affilée
 * n'empilent pas dix bannières. Il ne fusionne RIEN entre origines — deux déploiements de
 * site-json sont deux origines, donc deux piles. C'est la limite du multi-site, et elle est
 * structurelle.
 */

const TAG = "cocolight-notification";

self.addEventListener("install", () => {
  // Prendre la main tout de suite : sans cela le premier abonnement d'une visite ne reçoit rien
  // jusqu'au prochain chargement complet.
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(self.clients.claim());
});

self.addEventListener("push", (e) => {
  let charge = {};
  try { charge = e.data ? e.data.json() : {}; } catch { charge = {}; }

  const titre = charge.titre || "Nouvelle notification";
  const options = {
    body: charge.corps || "",
    tag: TAG,
    // `renotify` avec un `tag` : la bannière se remplace au lieu de s'empiler, mais réalerte —
    // sans quoi une notification arrivée après une autre passerait totalement inaperçue.
    renotify: true,
    data: { url: charge.url || "/notifications", topic: charge.topic || "" },
  };
  // `waitUntil` est OBLIGATOIRE : sans lui le navigateur peut arrêter le worker avant l'affichage,
  // et certains navigateurs affichent alors une notification générique « ce site a été mis à jour ».
  e.waitUntil(self.registration.showNotification(titre, options));
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const cible = (e.notification.data && e.notification.data.url) || "/notifications";

  e.waitUntil((async () => {
    const fenetres = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    // Réutiliser un onglet DÉJÀ ouvert sur ce site plutôt que d'en ouvrir un de plus : sans cela,
    // chaque clic laisse un onglet derrière lui.
    for (const f of fenetres) {
      if (new URL(f.url).origin === self.location.origin) {
        await f.focus();
        if ("navigate" in f) { try { await f.navigate(cible); } catch { /* navigation refusée */ } }
        return;
      }
    }
    await self.clients.openWindow(cible);
  })());
});
