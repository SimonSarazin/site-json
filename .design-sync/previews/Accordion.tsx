import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "site-forge";

// FAQ de l'annuaire — mode single, premier item OUVERT (defaultValue).
export const QuestionsFrequentes = () => (
  <div style={{ maxWidth: 420 }}>
    <Accordion type="single" collapsible defaultValue="referencement">
      <AccordionItem value="referencement">
        <AccordionTrigger>Comment référencer mon tiers-lieu ?</AccordionTrigger>
        <AccordionContent>
          Créez un compte, puis remplissez la fiche « structure » depuis votre
          espace : adresse, horaires, thématiques. La fiche est publiée après
          validation par l'équipe d'animation du réseau.
        </AccordionContent>
      </AccordionItem>
      <AccordionItem value="cout">
        <AccordionTrigger>L'inscription est-elle payante ?</AccordionTrigger>
        <AccordionContent>
          Non, le référencement dans l'annuaire est gratuit pour toutes les
          structures du département.
        </AccordionContent>
      </AccordionItem>
      <AccordionItem value="maj">
        <AccordionTrigger>Qui met à jour les informations ?</AccordionTrigger>
        <AccordionContent>
          Chaque structure reste responsable de sa fiche et peut la modifier à
          tout moment depuis son espace adhérent.
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  </div>
);

// Mode multiple : deux entrées ouvertes simultanément.
export const OuvertureMultiple = () => (
  <div style={{ maxWidth: 420 }}>
    <Accordion type="multiple" defaultValue={["participation", "coeducation"]}>
      <AccordionItem value="participation">
        <AccordionTrigger>La participation</AccordionTrigger>
        <AccordionContent>
          La participation des parents aux actions qui les concernent, eux ou
          leurs enfants, est un objectif central du réseau.
        </AccordionContent>
      </AccordionItem>
      <AccordionItem value="soutien">
        <AccordionTrigger>Le soutien à l'initiative</AccordionTrigger>
        <AccordionContent>
          Institutions et professionnels ont pour responsabilité de soutenir les
          initiatives des parents et des acteurs locaux.
        </AccordionContent>
      </AccordionItem>
      <AccordionItem value="coeducation">
        <AccordionTrigger>La co-éducation</AccordionTrigger>
        <AccordionContent>
          Les parents sont les premiers éducateurs de leurs enfants. À leurs
          côtés, plusieurs acteurs forment une chaîne éducative cohérente.
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  </div>
);
