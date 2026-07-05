import { Link2 } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import type { AdminSection } from "../schema";

/**
 * Section `reference` (P5) — explique le référencement et pointe vers l'action par-ligne. Le rattachement
 * concret se fait via l'action « Référencer / Détacher » des tableaux de contenu (rowActions:["reference"]),
 * câblée sur `addReference`/`removeFromSource` (SET_SOURCE). Les compteurs référencé/rattaché = itération suivante.
 */
export default function AdminReferenceSection({ section: _section }: { section: AdminSection }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Link2 className="h-5 w-5" />
          Référencement
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm text-muted-foreground">
        <p>
          <strong className="text-foreground">Référencé</strong> : l&apos;élément est proposé au costum
          (<code>reference.costum</code>), en attente de validation.{" "}
          <strong className="text-foreground">Rattaché</strong> : l&apos;élément appartient au costum
          (<code>source.keys</code>).
        </p>
        <p>
          Rattachez ou détachez un élément via l&apos;action <em>Référencer / Détacher</em> par ligne dans les
          tableaux de contenu (déclarer <code>rowActions: [&quot;reference&quot;]</code> sur la resource).
        </p>
      </CardContent>
    </Card>
  );
}
