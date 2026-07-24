import {
  Table,
  TableCaption,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  Badge,
} from "site-forge";

// Annuaire des tiers-lieux : en-tête, lignes, caption.
export const AnnuaireTiersLieux = () => (
  <Table>
    <TableCaption>Annuaire des tiers-lieux du Pas-de-Calais — extrait.</TableCaption>
    <TableHeader>
      <TableRow>
        <TableHead>Structure</TableHead>
        <TableHead>Commune</TableHead>
        <TableHead>Thématique</TableHead>
        <TableHead style={{ textAlign: "right" }}>Adhérents</TableHead>
      </TableRow>
    </TableHeader>
    <TableBody>
      <TableRow>
        <TableCell className="font-medium">La Fabrique du Marais</TableCell>
        <TableCell>Saint-Omer</TableCell>
        <TableCell>
          <Badge variant="outline">Fablab</Badge>
        </TableCell>
        <TableCell style={{ textAlign: "right" }}>134</TableCell>
      </TableRow>
      <TableRow>
        <TableCell className="font-medium">Le Quai des Possibles</TableCell>
        <TableCell>Boulogne-sur-Mer</TableCell>
        <TableCell>
          <Badge variant="outline">Coworking</Badge>
        </TableCell>
        <TableCell style={{ textAlign: "right" }}>89</TableCell>
      </TableRow>
      <TableRow>
        <TableCell className="font-medium">La Grange numérique</TableCell>
        <TableCell>Auxi-le-Château</TableCell>
        <TableCell>
          <Badge variant="outline">Inclusion</Badge>
        </TableCell>
        <TableCell style={{ textAlign: "right" }}>52</TableCell>
      </TableRow>
      <TableRow>
        <TableCell className="font-medium">Maison des parents</TableCell>
        <TableCell>Arras</TableCell>
        <TableCell>
          <Badge variant="outline">Parentalité</Badge>
        </TableCell>
        <TableCell style={{ textAlign: "right" }}>210</TableCell>
      </TableRow>
    </TableBody>
  </Table>
);

// Avec pied de tableau (total) et ligne sélectionnée (data-state).
export const AvecTotalEtSelection = () => (
  <Table>
    <TableHeader>
      <TableRow>
        <TableHead>Atelier</TableHead>
        <TableHead>Date</TableHead>
        <TableHead style={{ textAlign: "right" }}>Inscrits</TableHead>
      </TableRow>
    </TableHeader>
    <TableBody>
      <TableRow>
        <TableCell className="font-medium">Parents d'ados et écrans</TableCell>
        <TableCell>12 mars 2026</TableCell>
        <TableCell style={{ textAlign: "right" }}>18</TableCell>
      </TableRow>
      <TableRow data-state="selected">
        <TableCell className="font-medium">Cuisine et petits budgets</TableCell>
        <TableCell>21 mars 2026</TableCell>
        <TableCell style={{ textAlign: "right" }}>24</TableCell>
      </TableRow>
      <TableRow>
        <TableCell className="font-medium">Éveil musical 0-3 ans</TableCell>
        <TableCell>28 mars 2026</TableCell>
        <TableCell style={{ textAlign: "right" }}>12</TableCell>
      </TableRow>
    </TableBody>
    <TableFooter>
      <TableRow>
        <TableCell colSpan={2}>Total inscrits</TableCell>
        <TableCell style={{ textAlign: "right" }}>54</TableCell>
      </TableRow>
    </TableFooter>
  </Table>
);
