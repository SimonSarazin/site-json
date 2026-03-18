import i18n from "@/i18n";
import fr from "./fr.json";
import en from "./en.json";

i18n.addResourceBundle("fr", "modules/coform", fr, true, true);
i18n.addResourceBundle("en", "modules/coform", en, true, true);

export const coformTranslations = {
  fr,
  en,
};

export default coformTranslations;
