/**
 * Fns de spec COMMUNES aux costums (registre `specRegistries`, pas des transforms) — l'import (side-effect)
 * enregistre les clés partagées. Pendant de `sharedCodecs` mais pour les fns de modale (existingUrl, …).
 */
import { registerExistingUrlFn, registerCleanValuesFn } from "../specRegistries";

/** URL d'image existante GÉNÉRIQUE (clé `image:profilUrl`) : medium > image > thumb du serverData. Partagé par
 *  tous les costums (avant : enregistré à l'identique dans chaque `<entity>/fns`). */
registerExistingUrlFn("image:profilUrl", (entity) => {
  const sd = (entity as { serverData?: Record<string, unknown> }).serverData;
  return (sd?.profilMediumImageUrl || sd?.profilImageUrl || sd?.profilThumbImageUrl || undefined) as string | undefined;
});

/** cleanValues GÉNÉRIQUE PARAMÉTRÉ (clé `cleanValues:dropEmptyArrayItems`) : pour chaque champ array listé dans
 *  `params.fields`, retire les items vides (string vide/espaces). Ex-`poi:dropEmptyUrls` (params {fields:["urls"]}). */
registerCleanValuesFn("cleanValues:dropEmptyArrayItems", (values, params) => {
  const fields = (params?.fields as string[] | undefined) ?? [];
  const out = { ...values };
  for (const f of fields) {
    if (Array.isArray(out[f])) out[f] = (out[f] as unknown[]).filter((u) => String(u ?? "").trim().length > 0);
  }
  return out;
});
