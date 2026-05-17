/**
 * Génère un identifiant Mongo-like de 24 chars hexa pour un nouveau milestone.
 *
 * Format : 8 chars timestamp (secondes) + 16 chars random — proche du format ObjectId
 * sans avoir besoin du SDK Mongo côté client. Garantie d'unicité par retry contre
 * `existingIds` (jusqu'à 6 essais), puis fallback déterministe en dernier recours.
 *
 * Utilisé pour créer des milestones côté `projects.oceco.milestones` + `answers.aapStep1.depense`
 * où l'`milestoneId` est le lien entre les deux structures.
 */
export function generateMilestoneId(existingIds: readonly string[] = []): string {
  const existing = new Set(existingIds);
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const timestampPart = Math.floor(Date.now() / 1000)
      .toString(16)
      .padStart(8, "0")
      .slice(-8);
    const randomPart = Array.from({ length: 16 }, () => Math.floor(Math.random() * 16).toString(16)).join("");
    const candidate = `${timestampPart}${randomPart}`.slice(0, 24);
    if (!existing.has(candidate)) return candidate;
  }
  return `${Date.now().toString(16)}${Math.random().toString(16).slice(2)}`.slice(0, 24).padEnd(24, "0");
}
