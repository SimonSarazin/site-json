import { FileUploadProgress } from "site-forge";

// File d attente d envoi de pièces jointes (formulaire d actu) : barre de
// progression, états completed/error, annulation/retrait. Mocks = objets File.

const fichier = (nom: string, type: string) => new File(["contenu"], nom, { type });

export const EnCours = () => (
  <div style={{ maxWidth: 480, margin: "0 auto" }}>
    <FileUploadProgress
      uploads={[
        {
          id: "u1",
          file: fichier("photo-atelier-portage.jpg", "image/jpeg"),
          progress: 72,
          status: "uploading",
        },
        {
          id: "u2",
          file: fichier("compte-rendu-cafe-parents.pdf", "application/pdf"),
          progress: 31,
          status: "uploading",
        },
      ]}
      onCancel={() => {}}
    />
  </div>
);

export const TermineEtErreur = () => (
  <div style={{ maxWidth: 480, margin: "0 auto" }}>
    <FileUploadProgress
      uploads={[
        {
          id: "u1",
          file: fichier("affiche-fete-du-jeu.png", "image/png"),
          progress: 100,
          status: "completed",
        },
        {
          id: "u2",
          file: fichier("video-spectacle-fin-annee.mp4", "video/mp4"),
          progress: 48,
          status: "error",
          error: "Fichier trop volumineux (25 Mo max)",
        },
      ]}
      onCancel={() => {}}
      onRemove={() => {}}
    />
  </div>
);
