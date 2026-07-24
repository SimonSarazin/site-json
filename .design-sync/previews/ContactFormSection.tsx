import { ContactFormSection } from "site-forge";

// Usage réel : formulaire de la page /contact (config.prod.json) —
// texte, e-mail, select, textarea et case à cocher.
export const FormulaireContact = () => (
  <ContactFormSection
    props={{
      action: "/api/contact",
      method: "POST",
      submitLabel: { fr: "Envoyer le message" },
      successMessage: { fr: "Votre message a bien été envoyé" },
      fields: [
        { name: "name", label: { fr: "Nom complet" }, type: "text", required: true, placeholder: { fr: "Votre nom" } },
        { name: "email", label: { fr: "Adresse e-mail" }, type: "email", required: true, placeholder: { fr: "votre@email.fr" }, validation: "email" },
        {
          name: "subject",
          label: { fr: "Sujet" },
          type: "select",
          required: true,
          options: [
            { fr: "Question générale" },
            { fr: "Support technique" },
            { fr: "Demande de partenariat" },
          ],
        },
        { name: "message", label: { fr: "Message" }, type: "textarea", required: true, placeholder: { fr: "Décrivez votre demande..." } },
        { name: "newsletter", label: { fr: "Je souhaite recevoir la newsletter" }, type: "checkbox", required: false },
      ],
    }}
  />
);

// Inscription à un atelier : radio, téléphone et textarea.
export const InscriptionAtelier = () => (
  <ContactFormSection
    props={{
      action: "/api/inscription-atelier",
      method: "POST",
      submitLabel: { fr: "Valider mon inscription" },
      fields: [
        { name: "prenom", label: { fr: "Prénom et nom" }, type: "text", required: true, placeholder: { fr: "Camille Lefebvre" } },
        { name: "telephone", label: { fr: "Téléphone" }, type: "tel", required: false, placeholder: { fr: "06 12 34 56 78" }, validation: "tel" },
        {
          name: "profil",
          label: { fr: "Vous êtes" },
          type: "radio",
          required: true,
          options: [{ fr: "Parent" }, { fr: "Professionnel·le" }, { fr: "Bénévole" }],
        },
        { name: "attentes", label: { fr: "Vos attentes pour l'atelier" }, type: "textarea", required: false, placeholder: { fr: "Ce que vous aimeriez aborder..." } },
      ],
    }}
  />
);
