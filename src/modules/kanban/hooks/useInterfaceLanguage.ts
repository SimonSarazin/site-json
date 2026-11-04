/**
 * Langue de l'interface AU SENS DU SERVEUR (`fr` | `en`), celle qui part en
 * `lang` vers `board/get`, `board/create` et `column/move` (§11.3, E10).
 *
 * Un seul hook pour tous les appelants : la normalisation (`interfaceLanguage`)
 * etait recopiee dans chaque hook qui en avait besoin.
 */
import { useTranslation } from 'react-i18next';
import { interfaceLanguage, type InterfaceLanguage } from '@/modules/kanban/lib/language';

export function useInterfaceLanguage(): InterfaceLanguage {
  const { i18n } = useTranslation('modules/kanban');
  return interfaceLanguage(i18n.language);
}
