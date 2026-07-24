/**
 * Déclenche le téléchargement navigateur d'un CSV (Blob → <a download>) — factorisé, la mécanique
 * était dupliquée 4× dans les sections admin (export, sélection, modèle d'import, rapports d'erreurs).
 */
export function downloadCsv(csv: string, filename: string): void {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
