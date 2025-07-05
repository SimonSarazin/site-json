import { RecoverPasswordFormSectionProps } from "@/types/site-schema";
import RecoverPasswordForm from "../auth/RecoverPasswordForm";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function RecoverPasswordFormSection({ id, props }: { id?: string; props: RecoverPasswordFormSectionProps }) {

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