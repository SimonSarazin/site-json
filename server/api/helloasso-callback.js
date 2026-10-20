/** Redirige l'ancien retour HelloAsso vers la page de retour du backend, query comprise. Temporaire. */
export function helloassoCallbackRedirect(req, res) {
  const backend = (process.env.VITE_BASE_URL_BACKEND || "").replace(/\/+$/, "");
  if (!backend) {
    res.status(404).json({ error: "Unknown API route" });
    return;
  }
  const queryAt = req.originalUrl.indexOf("?");
  const query = queryAt >= 0 ? req.originalUrl.slice(queryAt) : "";
  res.redirect(302, `${backend}/co2/helloAsso/callback${query}`);
}
