/**
 * GA4 — garde-fou PUR sur l'identifiant de mesure. `config.prod.json` livre un placeholder
 * (`G-XXXXXXX`) : sans ce test, gtag.js serait chargé et des `page_view` envoyés à une propriété
 * inexistante, un tiers appelé à chaque page pour rien.
 */
const MEASUREMENT_ID = /^G-[A-Z0-9]{4,}$/;
const PLACEHOLDER = /^G-X+$/i;

export function isValidGa4MeasurementId(id: string | undefined): boolean {
  if (typeof id !== "string") return false;
  const value = id.trim();
  return MEASUREMENT_ID.test(value) && !PLACEHOLDER.test(value);
}
