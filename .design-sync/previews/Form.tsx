import { useEffect } from "react";
import { useForm } from "react-hook-form";
import {
  Button,
  Checkbox,
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Input,
  Textarea,
} from "site-forge";

// Composition react-hook-form (Form = FormProvider) telle qu'utilisée dans
// le repo (profil/EditEventDatesTab, coform) : FormField → FormItem →
// FormLabel/FormControl/FormDescription/FormMessage. Les erreurs de la
// story dédiée sont posées via form.setError (déterministe à la capture).

export const InscriptionAtelier = () => {
  const form = useForm({
    defaultValues: {
      nom: "Camille Robert",
      email: "",
      message: "",
    },
  });

  return (
    <Form {...form}>
      <form className="max-w-sm space-y-5">
        <FormField
          control={form.control}
          name="nom"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nom et prénom</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Adresse e-mail</FormLabel>
              <FormControl>
                <Input type="email" placeholder="prenom.nom@exemple.fr" {...field} />
              </FormControl>
              <FormDescription>Pour recevoir la confirmation d'inscription.</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="message"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Remarques (allergies, besoins particuliers…)</FormLabel>
              <FormControl>
                <Textarea placeholder="Facultatif" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit">S'inscrire à l'atelier</Button>
      </form>
    </Form>
  );
};

export const ErreursDeValidation = () => {
  const form = useForm({
    defaultValues: {
      email: "camille.robert@",
      creneau: "",
    },
  });

  useEffect(() => {
    form.setError("email", { type: "manual", message: "Cette adresse e-mail est invalide." });
    form.setError("creneau", { type: "manual", message: "Choisissez un créneau pour continuer." });
  }, [form]);

  return (
    <Form {...form}>
      <form className="max-w-sm space-y-5">
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Adresse e-mail</FormLabel>
              <FormControl>
                <Input type="email" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="creneau"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Créneau souhaité</FormLabel>
              <FormControl>
                <Input placeholder="Ex. : mercredi 14h" {...field} />
              </FormControl>
              <FormDescription>Les créneaux sont détaillés sur la page de l'atelier.</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit">Valider</Button>
      </form>
    </Form>
  );
};

export const CaseDeConsentement = () => {
  const form = useForm({
    defaultValues: { consentement: true },
  });

  return (
    <Form {...form}>
      <form className="max-w-sm">
        <FormField
          control={form.control}
          name="consentement"
          render={({ field }) => (
            <FormItem className="flex flex-row items-start gap-3 space-y-0 rounded-lg border p-4">
              <FormControl>
                <Checkbox checked={field.value} onCheckedChange={field.onChange} className="mt-0.5" />
              </FormControl>
              <div className="space-y-1">
                <FormLabel>Recevoir la lettre d'information</FormLabel>
                <FormDescription>
                  Une fois par mois, les actualités et événements du réseau. Désinscription en un clic.
                </FormDescription>
              </div>
            </FormItem>
          )}
        />
      </form>
    </Form>
  );
};
