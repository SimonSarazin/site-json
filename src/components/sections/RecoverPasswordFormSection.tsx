import RecoverPasswordForm from "../auth/RecoverPasswordForm";

interface RecoverPasswordFormSectionProps {
  id?: string;
}

export function RecoverPasswordFormSection({ id }: RecoverPasswordFormSectionProps) {

  return (
        <section id={id} className="py-16 bg-background">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="max-w-md mx-auto">
              <RecoverPasswordForm />
            </div>
          </div>
        </section>
  );
}