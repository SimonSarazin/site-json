/**
 * Émetteur de SOURCE TS d'un `FormDescriptor` — pour BOOTSTRAPPER un descripteur éditable (types +
 * autocomplétion) depuis une génération (costum/base) ou une config. Pendant de la voie « config JSON » :
 * on peut amorcer le travail dans L'UN OU L'AUTRE format (cf. doc/formulaire-config-driven.md).
 *
 * Sortie = un `.descriptor.ts` valide : `export const <name>: FormDescriptor = { … }`. Le littéral est
 * du JSON (clés quotées) — valide en TS et typé `FormDescriptor` (donc vérifié par tsc + autocomplété).
 *
 * LIMITE (sérialisabilité, comme la config) : les parties non sérialisables (`validate` fonction inline,
 * transforms inline) ne sont PAS émises — elles doivent être des CLÉS de registre. Un descripteur
 * issu de `configToDescriptor` n'a que des clés → émission complète.
 */
import type { FormDescriptor } from "../types";

/** Identifiant TS valide depuis un slug/id quelconque (ex. "equipements-sportifs" → "equipementsSportifsDescriptor"). */
function toExportName(raw: string): string {
  const camel = raw
    .replace(/[^a-zA-Z0-9]+(.)/g, (_, c: string) => c.toUpperCase())
    .replace(/[^a-zA-Z0-9]/g, "");
  const safe = /^[a-zA-Z_]/.test(camel) ? camel : `_${camel}`;
  return safe || "descriptor";
}

/**
 * Sérialise un `FormDescriptor` en source TS d'un fichier `.descriptor.ts`. `exportName` par défaut
 * dérivé de `descriptor.id`. `JSON.stringify` ignore `undefined`/fonctions (= bouts non sérialisables,
 * à porter en clés de registre avant émission).
 */
export function descriptorToTsSource(descriptor: FormDescriptor, exportName?: string): string {
  const name = exportName ?? `${toExportName(descriptor.id)}Descriptor`;
  // Garde-fou : un `validate` fonction (vs clé de registre string) est silencieusement abandonné par
  // JSON.stringify → le descripteur émis perdrait sa validation cross-champ sans le signaler.
  if (typeof descriptor.validate === "function") {
    console.warn(
      `[descriptorToTsSource] "${name}" : validate est une FONCTION inline — non émise (JSON.stringify l'ignore). ` +
      `Convertir validate en CLÉ de registre (string) avant émission pour conserver la validation.`,
    );
  }
  const body = JSON.stringify(descriptor, null, 2);
  return (
    `// Généré (descriptorToTsSource) — base éditable. Convertir en config via formDescriptorToConfig quand prêt.\n` +
    `import type { FormDescriptor } from "@/modules/formEngine";\n\n` +
    `export const ${name}: FormDescriptor = ${body};\n`
  );
}
