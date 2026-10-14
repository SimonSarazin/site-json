/**
 * Gestionnaire `onSubmit` du CONTENU d'un dialogue : le `submit` d'un formulaire qui s'y trouve n'en
 * sort pas.
 *
 * En React, un `submit` remonte l'arbre des COMPOSANTS, portails compris — pas celui du DOM, où le
 * contenu du portail vit sous `<body>`. Un dialogue ouvert depuis un formulaire (la création d'un
 * élément depuis un finder coform, rendue sous sa question) soumettait donc AUSSI ce formulaire : sa
 * validation partait, ses erreurs s'affichaient derrière. Arrêté ici, le `submit` ne remonte plus à
 * un formulaire placé au-dessus dans l'arbre React (ni, au passage, à un écouteur natif de `document`).
 *
 * Posé sur les contenus bâtis sur le dialogue Radix — `DialogContent`, `SheetContent`, `ModalContent`.
 * Les autres portails (`AlertDialogContent`, `DrawerContent`, `PopoverContent`) ne l'ont pas : un
 * formulaire qu'on y monterait sous un autre formulaire demande de le poser là aussi.
 *
 * @param own Le `onSubmit` que l'appelant pose lui-même sur le contenu. Il passe APRÈS l'arrêt : une
 *            exception chez lui ne rouvre pas la remontée.
 */
export function stopSubmitAtPortal<E extends { stopPropagation: () => void }>(
  own?: (event: E) => void,
): (event: E) => void {
  return (event) => {
    event.stopPropagation();
    own?.(event);
  };
}
