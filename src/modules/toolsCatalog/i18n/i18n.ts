import i18n from "@/i18n";
import fr from "./fr.json";
import en from "./en.json";

i18n.addResourceBundle("fr", "modules/toolsCatalog", fr, true, true);
i18n.addResourceBundle("en", "modules/toolsCatalog", en, true, true);

export const toolsCatalogTranslations = { fr, en };
export default toolsCatalogTranslations;
