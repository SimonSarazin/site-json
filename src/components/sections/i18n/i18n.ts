import i18n from "@/i18n";
import fr from "./fr.json";
import en from "./en.json";

/** Namespace des sections de page (`components/sections`) — à ne pas emprunter à `components/layout`. */
i18n.addResourceBundle("fr", "components/sections", fr, true, true);
i18n.addResourceBundle("en", "components/sections", en, true, true);
