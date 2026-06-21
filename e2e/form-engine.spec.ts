import { test, expect } from "@playwright/test";

/**
 * Test e2e du moteur de formulaire générique (`modules/formEngine/GenericForm`),
 * monté en isolation via la route DEV `/dev/form-engine` (cf. src/dev/FormEngineDevPage.tsx).
 * Vérifie EN NAVIGATEUR les briques du moteur que les tests unitaires (jsdom) ne couvrent pas :
 * rendu wizard, navigation + validation par step, conditionnel réactif, valeur calculée, submit.
 */
test.describe("GenericForm (moteur de formulaire générique)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/dev/form-engine", { waitUntil: "domcontentloaded" });
    // Le form est monté côté client après hydratation (+ 1re compilation Vite) → attente large.
    await expect(page.getByLabel("Nom")).toBeVisible({ timeout: 45_000 });
  });

  test("wizard : un champ requis vide bloque le passage au step suivant", async ({ page }) => {
    // Step 1 actif : les champs du step 2 (Longueur) ne sont pas dans le DOM.
    await expect(page.getByLabel("Longueur")).toHaveCount(0);

    // Next sans remplir "Nom" (requis) → on reste au step 1.
    await page.getByRole("button", { name: "Next" }).click();
    await expect(page.getByLabel("Longueur")).toHaveCount(0);
    await expect(page.getByLabel("Nom")).toBeVisible();
  });

  test("conditionnel : 'Detail' apparaît/disparaît selon le switch (visibleIf truthy)", async ({ page }) => {
    await expect(page.getByLabel("Detail")).toHaveCount(0);

    await page.getByRole("switch", { name: "Mode avance" }).click();
    await expect(page.getByLabel("Detail")).toBeVisible();

    await page.getByRole("switch", { name: "Mode avance" }).click();
    await expect(page.getByLabel("Detail")).toHaveCount(0);
  });

  test("groupes : sous-bloc à titre conditionnel (visibleIf de groupe)", async ({ page }) => {
    // Le groupe (titre « Bloc detail » + champ) est masqué tant que le switch est OFF.
    await expect(page.getByText("Bloc detail")).toHaveCount(0);
    await page.getByRole("switch", { name: "Mode avance" }).click();
    // Le titre du sous-bloc ET le champ apparaissent ensemble.
    await expect(page.getByText("Bloc detail")).toBeVisible();
    await expect(page.getByLabel("Detail")).toBeVisible();
  });

  test("conditionnel + requiredIf : Detail requis quand le switch est ON", async ({ page }) => {
    await page.getByLabel("Nom").fill("Stade A");
    await page.getByRole("switch", { name: "Mode avance" }).click();
    await expect(page.getByLabel("Detail")).toBeVisible();

    // Detail visible + requiredIf truthy + vide → Next bloqué (reste au step 1).
    await page.getByRole("button", { name: "Next" }).click();
    await expect(page.getByLabel("Longueur")).toHaveCount(0);

    // Une fois rempli → Next passe. On blur (Tab) pour laisser la re-validation
    // onChange se stabiliser avant le clic (sinon le re-render avale le clic synthétique).
    await page.getByLabel("Detail").fill("tartan");
    await page.getByLabel("Detail").press("Tab");
    await expect(page.getByLabel("Detail")).toHaveValue("tartan");
    await page.getByRole("button", { name: "Next" }).click();
    await expect(page.getByLabel("Longueur")).toBeVisible();
  });

  test("erreur sur un autre step : saut au 1er step fautif + badge + onInvalid", async ({ page }) => {
    // On NE remplit PAS "Nom" (requis, step 1). On saute directement au step 2 via l'indicateur.
    await page.getByTestId("step-metrics").click();
    await expect(page.getByLabel("Longueur")).toBeVisible();
    await expect(page.getByTestId("step-infos")).toHaveAttribute("data-error", "false");

    // Submit depuis le dernier step → la validation échoue sur "Nom" (step 1, inactif).
    await page.getByRole("button", { name: "Submit" }).click();

    // 1) le callback onInvalid s'est déclenché (toast côté modal réel) ;
    await expect(page.getByTestId("fe-invalid")).toBeVisible();
    // 2) saut automatique au 1er step fautif (retour au step 1) ;
    await expect(page.getByLabel("Nom")).toBeVisible();
    await expect(page.getByLabel("Longueur")).toHaveCount(0);
    // 3) badge d'erreur porté par le step 1, pas par le step 2.
    await expect(page.getByTestId("step-infos")).toHaveAttribute("data-error", "true");
    await expect(page.getByTestId("step-metrics")).toHaveAttribute("data-error", "false");
  });

  test("widgets avancés : openingHours + fieldArray + select value≠label", async ({ page }) => {
    await page.getByLabel("Nom").fill("x");
    await page.getByRole("button", { name: "Next" }).click();
    await expect(page.getByLabel("Longueur")).toBeVisible();

    // openingHours : les jours configurés (monday/tuesday) sont rendus.
    await expect(page.getByText("monday")).toBeVisible();
    await expect(page.getByText("tuesday")).toBeVisible();

    // fieldArray : "Ajouter un lien" fait apparaître les sous-champs (select plateforme + input URL).
    await expect(page.getByPlaceholder("URL")).toHaveCount(0);
    await page.getByRole("button", { name: "Ajouter un lien" }).click();
    await expect(page.getByPlaceholder("URL")).toHaveCount(1);
    await page.getByPlaceholder("URL").fill("https://x.test");
    await expect(page.getByPlaceholder("URL")).toHaveValue("https://x.test");

    // value≠label : le select plateforme affiche le LABEL (Facebook), pas la value (fb).
    await page.getByText("Plateforme").click();
    await expect(page.getByRole("option", { name: "Facebook" })).toBeVisible();
  });

  test("computed + navigation + submit : surface = longueur × largeur, valeurs capturées", async ({ page }) => {
    await page.getByLabel("Nom").fill("Stade A");
    await page.getByRole("button", { name: "Next" }).click();

    // Step 2.
    await expect(page.getByLabel("Longueur")).toBeVisible();
    await page.getByLabel("Longueur").fill("4");
    await page.getByLabel("Largeur").fill("5");

    // Valeur calculée (computeFrom "multiply") appliquée réactivement.
    await expect(page.getByLabel("Surface")).toHaveValue("20");

    // Retour arrière puis re-avance : l'état est conservé (le moteur ne réinitialise pas).
    await page.getByRole("button", { name: "Previous" }).click();
    await expect(page.getByLabel("Nom")).toHaveValue("Stade A");
    await page.getByRole("button", { name: "Next" }).click();

    // Submit → onSubmit capture les valeurs RHF (number bien typés, pas des strings).
    await page.getByRole("button", { name: "Submit" }).click();
    const dump = page.getByTestId("fe-submitted");
    await expect(dump).toBeVisible();

    const json = JSON.parse((await dump.textContent()) ?? "{}");
    expect(json.name).toBe("Stade A");
    expect(json.longueur).toBe(4);
    expect(json.largeur).toBe(5);
    expect(json.surface).toBe(20);
  });
});

test.describe("GenericForm — layout tabs (navigation libre, submit global)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/dev/form-engine?layout=tabs", { waitUntil: "domcontentloaded" });
    await expect(page.getByLabel("Nom")).toBeVisible({ timeout: 45_000 });
  });

  test("onglets : pas de Next/Previous, Submit toujours dispo, navigation libre", async ({ page }) => {
    // Mode tabs : aucun bouton de navigation séquentielle ; Submit présent d'emblée.
    await expect(page.getByRole("button", { name: "Next" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Previous" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Submit" })).toBeVisible();

    // Navigation LIBRE : cliquer l'onglet "Mesures" sans rien remplir → une seule section affichée.
    await page.getByTestId("step-metrics").click();
    await expect(page.getByLabel("Longueur")).toBeVisible();
    await expect(page.getByLabel("Nom")).toHaveCount(0);

    // Revenir à l'onglet "Infos" librement.
    await page.getByTestId("step-infos").click();
    await expect(page.getByLabel("Nom")).toBeVisible();
    await expect(page.getByLabel("Longueur")).toHaveCount(0);
  });

  test("onglets : submit global invalide → badge sur l'onglet fautif + saut + onInvalid", async ({ page }) => {
    // Aller sur l'onglet "Mesures" sans remplir "Nom" (requis, onglet "Infos").
    await page.getByTestId("step-metrics").click();
    await expect(page.getByLabel("Longueur")).toBeVisible();

    // Submit (toujours dispo en mode tabs) → validation GLOBALE échoue sur "Nom".
    await page.getByRole("button", { name: "Submit" }).click();

    await expect(page.getByTestId("fe-invalid")).toBeVisible();           // onInvalid déclenché
    await expect(page.getByLabel("Nom")).toBeVisible();                   // saut au 1er onglet fautif
    await expect(page.getByTestId("step-infos")).toHaveAttribute("data-error", "true");
    await expect(page.getByTestId("step-metrics")).toHaveAttribute("data-error", "false");
  });

  test("onglets : remplissage multi-onglets puis submit valide capture tout", async ({ page }) => {
    await page.getByLabel("Nom").fill("Halle B");
    await page.getByTestId("step-metrics").click();
    await page.getByLabel("Longueur").fill("3");
    await page.getByLabel("Largeur").fill("7");
    await expect(page.getByLabel("Surface")).toHaveValue("21");

    await page.getByRole("button", { name: "Submit" }).click();
    const dump = page.getByTestId("fe-submitted");
    await expect(dump).toBeVisible();
    const json = JSON.parse((await dump.textContent()) ?? "{}");
    expect(json.name).toBe("Halle B");
    expect(json.surface).toBe(21);
  });
});
