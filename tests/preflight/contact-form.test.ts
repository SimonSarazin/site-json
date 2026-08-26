import { readdirSync, readFileSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";

import { walkSections, type SectionLike } from "@/lib/sectionContainers";
import { missingContactRoles, type ContactFieldLike } from "@/lib/contactPayload";

/**
 * GARDE DU FORMULAIRE DE CONTACT.
 *
 * Le message part par la lib (`CONTACT_SEND` → `/co2/mailmanagement/createandsend`), qui résout le
 * destinataire côté serveur depuis `costum.admin.email`. Deux façons de casser ça en config, toutes
 * deux silencieuses à l'exécution :
 *  1. déclarer une `action`/`method` — héritage de l'ancien fil, qui postait du JSON sur `/api/contact`,
 *     une route qui n'a JAMAIS existé (le formulaire échouait sur les 3 sites du parc) ;
 *  2. nommer les champs hors convention sans poser de `role` : la charge utile ne peut plus être
 *     construite et le formulaire refuse d'envoyer sans que rien ne l'annonce à la relecture.
 */

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

type Props = {
  fields?: ContactFieldLike[];
  action?: unknown;
  method?: unknown;
};

function formulaires() {
  const out: Array<{ ref: string; props: Props }> = [];
  for (const f of readdirSync(ROOT).filter((n) => /^config\.prod\..+\.json$/.test(n)).sort()) {
    const site = f.replace(/^config\.prod\./, "").replace(/\.json$/, "");
    const cfg = JSON.parse(readFileSync(join(ROOT, f), "utf8")) as {
      pages?: Array<{ path?: string; sections?: SectionLike[] }>;
    };
    for (const page of cfg.pages ?? []) {
      for (const section of walkSections(page.sections ?? [])) {
        if (section.type !== "contactForm") continue;
        out.push({ ref: `${site} ${page.path ?? "?"}`, props: (section.props ?? {}) as Props });
      }
    }
  }
  return out;
}

describe("formulaire de contact (garde de config)", () => {
  it("le parc en déclare — sinon la garde ne garde rien", () => {
    expect(formulaires().length).toBeGreaterThan(0);
  });

  it("aucune `action`/`method` déclarée (clés dépréciées, ignorées à l'exécution)", () => {
    const restes = formulaires()
      .filter(({ props }) => props.action !== undefined || props.method !== undefined)
      .map(({ ref }) => ref);
    expect(restes, "un formulaire déclare encore une URL de soumission — elle n'est plus lue").toEqual([]);
  });

  it("chaque formulaire porte les rôles requis pour construire le message", () => {
    const incomplets = formulaires()
      .map(({ ref, props }) => ({ ref, manquants: missingContactRoles(props.fields ?? []) }))
      .filter(({ manquants }) => manquants.length > 0)
      .map(({ ref, manquants }) => `${ref} → manque ${manquants.join(", ")}`);
    expect(incomplets, "poser `role` sur les champs concernés (cf. lib/contactPayload.ts)").toEqual([]);
  });
});
