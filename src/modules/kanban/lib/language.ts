/**
 * Langue de l'interface AU SENS DU SERVEUR — pure et testee.
 *
 * Le module PHP choisit les libelles personnalises des colonnes d'un board-lien
 * (`oceco.kanbanColumns.<lang>` de l'organisation porteuse, §11.3) d'apres le
 * parametre `lang` de `board/get`, `board/create` et `column/move` ; a defaut,
 * d'apres l'en-tete `Accept-Language` du NAVIGATEUR — qui n'est pas la langue
 * choisie sur le site. Le front envoie donc la sienne, ramenee aux deux
 * langues du projet (repli `fr`, langue principale de Communecter).
 */
export type InterfaceLanguage = 'fr' | 'en';

export function interfaceLanguage(language: string | null | undefined): InterfaceLanguage {
  return typeof language === 'string' && language.toLowerCase().startsWith('en') ? 'en' : 'fr';
}
