/**
 * Conventional Commits (les commits du repo suivent déjà ce format, en français :
 * `feat(scope): …`, `fix(scope): …`, `chore(…)`, `docs(…)`…).
 *
 * On assouplit volontairement les limites de longueur : les corps de commit du repo
 * sont des explications détaillées en français (souvent > 100 colonnes), et on ne veut
 * pas bloquer un bon message pour une ligne longue. Seul le FORMAT de l'en-tête compte.
 */
export default {
  extends: ["@commitlint/config-conventional"],
  rules: {
    "header-max-length": [2, "always", 120],
    "body-max-line-length": [0, "always", 100], // désactivé
    "footer-max-line-length": [0, "always", 100], // désactivé
  },
};
