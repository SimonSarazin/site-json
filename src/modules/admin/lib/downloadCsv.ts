import { downloadBlob } from "@/lib/downloadBlob";

/**
 * Déclenche le téléchargement navigateur d'un CSV — factorisé, la mécanique était dupliquée 4× dans
 * les sections admin (export, sélection, modèle d'import, rapports d'erreurs). Mécanique Blob →
 * `<a download>` partagée avec l'export PDF de l'agenda via `downloadBlob` (cf. ce fichier).
 */
export function downloadCsv(csv: string, filename: string): void {
  downloadBlob(new Blob([csv], { type: "text/csv;charset=utf-8;" }), filename);
}
