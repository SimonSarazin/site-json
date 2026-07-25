/**
 * Préfixes des routes servies par les MODULES (`src/modules/<x>/routes.tsx`),
 * DÉRIVÉS du code plutôt que recopiés dans une constante.
 *
 * Précédent mesuré : la liste figée d'`audit-config.ts` ignorait `/admin` et
 * `/blog` (ajoutés depuis), ce qui produisait des faux positifs `lien-mort` sur
 * des liens parfaitement valides — et poussait l'assistant à « réparer » ce qui
 * marchait. Même discipline que la parité SECTION_META ⇄ union `Section`.
 *
 * Seules les routes de PREMIER niveau donnent un préfixe : le `path` d'un
 * enfant est RELATIF à son parent (ampli : `community` = /ampli/:slug/community),
 * il ne fonde donc aucune route racine.
 */
import fs from "node:fs";
import path from "node:path";

/** Plages `[début, fin]` des tableaux `children: [ … ]` (routes imbriquées). */
function childrenRanges(src: string): [number, number][] {
  const ranges: [number, number][] = [];
  for (const m of src.matchAll(/children\s*:\s*\[/g)) {
    const open = m.index + m[0].length - 1;
    let depth = 0;
    for (let i = open; i < src.length; i++) {
      if (src[i] === "[") depth++;
      else if (src[i] === "]" && --depth === 0) {
        ranges.push([open, i]);
        break;
      }
    }
  }
  return ranges;
}

/** `["/admin", "/ampli", "/blog", "/coform", "/login", …]` — triés, dédupliqués. */
export function moduleRoutePrefixes(root: string): string[] {
  const dir = path.join(root, "src/modules");
  const out = new Set<string>();
  for (const mod of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!mod.isDirectory()) continue;
    const file = path.join(dir, mod.name, "routes.tsx");
    if (!fs.existsSync(file)) continue;
    const src = fs.readFileSync(file, "utf-8");
    const nested = childrenRanges(src);
    for (const m of src.matchAll(/path:\s*"([^"]+)"/g)) {
      const at = m.index;
      if (nested.some(([a, b]) => at > a && at < b)) continue;
      const seg = m[1].replace(/^\//, "").split("/")[0];
      if (seg && !seg.startsWith(":")) out.add(`/${seg}`);
    }
  }
  return [...out].sort();
}
