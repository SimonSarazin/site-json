import { NewsFileList } from "site-forge";

// Pièces jointes documentaires d une actu : une ligne cliquable par fichier
// (icône + nom tronqué à 50 caractères). Le composant embarque son padding.

export const Documents = () => (
  <div style={{ maxWidth: 560, margin: "0 auto" }}>
    <NewsFileList
      files={[
        { name: "Compte-rendu du café des parents - mai 2025.pdf", docPath: "#" },
        { name: "Affiche atelier sommeil - 14 juin.pdf", docPath: "#" },
        { name: "Planning des permanences.ods", docPath: "#" },
      ]}
    />
  </div>
);

export const NomsLongs = () => (
  <div style={{ maxWidth: 560, margin: "0 auto" }}>
    <NewsFileList
      files={[
        {
          name: "Dossier complet de subvention CAF 2025 - annexes budgétaires et pièces justificatives.pdf",
          docPath: "#",
        },
        { docPath: "#" }, // sans nom → libellé de repli « Fichier »
      ]}
    />
  </div>
);
