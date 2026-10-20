import type { ComponentType } from "react";
import { Github, Twitter, Linkedin, Facebook, Instagram, Youtube, Mail } from "lucide-react";

/** Map plateforme → icône lucide, source unique des pieds de page : la rangée `socials`
 * (`SocialLinks`) ET les lignes de contact de `FooterContactPartners`. Un réseau ajouté ici
 * est disponible dans les deux. Fichier séparé : un export d'objet depuis un `.tsx` de
 * composant casserait le fast refresh (`react-refresh/only-export-components`). */
export const SOCIAL_ICONS: Record<string, ComponentType<{ className?: string }>> = {
  github: Github,
  twitter: Twitter,
  x: Twitter,
  linkedin: Linkedin,
  facebook: Facebook,
  instagram: Instagram,
  youtube: Youtube,
  mail: Mail,
};
