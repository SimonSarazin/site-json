import i18n from "@/i18n";
import fr from "./i18n/fr.json";
import en from "./i18n/en.json";

// Enregistre le namespace i18n "modules/kanban". Importé en side-effect par `index.ts` ET en
// tête de chaque page : une arrivée DIRECTE sur une route (lien partagé, F5) rendrait sinon la
// page avant l'enregistrement, et `t()` retournerait les clés brutes.
i18n.addResourceBundle("fr", "modules/kanban", fr, true, true);
i18n.addResourceBundle("en", "modules/kanban", en, true, true);
