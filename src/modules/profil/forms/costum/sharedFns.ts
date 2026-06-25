/**
 * Fns de spec COMMUNES aux costums (registre `specRegistries`, pas des transforms) — l'import (side-effect)
 * enregistre les clés partagées. Pendant de `sharedCodecs` mais pour les fns de modale (existingUrl, …).
 */
import { registerExistingUrlFn } from "../specRegistries";

/** URL d'image existante GÉNÉRIQUE (clé `image:profilUrl`) : medium > image > thumb du serverData. Partagé par
 *  tous les costums (avant : enregistré à l'identique dans chaque `<entity>/fns`). */
registerExistingUrlFn("image:profilUrl", (entity) => {
  const sd = (entity as { serverData?: Record<string, unknown> }).serverData;
  return (sd?.profilMediumImageUrl || sd?.profilImageUrl || sd?.profilThumbImageUrl || undefined) as string | undefined;
});
