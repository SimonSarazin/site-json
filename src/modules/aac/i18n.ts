import i18n from "@/i18n";
import fr from "./i18n/fr.json";
import en from "./i18n/en.json";

// Enregistre le namespace i18n "modules/aac". Importé en side-effect par
// `index.ts` ET en tête de chaque section (`AacDirectorySection`,
// `AacHighlightSection`) et de chaque page (`AacPage`, `AacCommunDetailPage`)
// pour garantir que le bundle est chargé quel que soit le point d'entrée
// (route vs section lazy).
i18n.addResourceBundle("fr", "modules/aac", fr, true, true);
i18n.addResourceBundle("en", "modules/aac", en, true, true);
