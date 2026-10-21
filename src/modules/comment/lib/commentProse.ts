/**
 * La mise en forme d'un message — UNE liste de classes, pour le fil qui l'affiche et pour l'éditeur
 * où on l'écrit : ce qu'on voit en tapant est ce que le fil montrera, marges et couleurs comprises.
 *
 * Les titres n'y sont pas : leur échelle vit dans `styles.css`, parce que des thèmes les règlent
 * hors couche, là où aucune classe ne peut les reprendre.
 */
export const COMMENT_PROSE = [
  "prose prose-sm dark:prose-invert max-w-none text-sm leading-relaxed text-foreground",
  "prose-p:my-0.5 prose-ul:my-1 prose-ol:my-1 prose-blockquote:my-1",
  "prose-a:text-primary prose-a:no-underline hover:prose-a:underline",
  "prose-code:before:content-none prose-code:after:content-none",
  // L'image DANS le texte : dans la ligne, bornée — une capture d'écran ne doit pas noyer le fil.
  "prose-img:my-1 prose-img:inline-block prose-img:max-h-80 prose-img:rounded-md prose-img:align-bottom",
].join(" ");
