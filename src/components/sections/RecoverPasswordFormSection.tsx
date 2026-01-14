import { RecoverPasswordFormSectionProps } from "@/types/site-schema";
import RecoverPasswordForm from "../auth/RecoverPasswordForm";

 
export function RecoverPasswordFormSection({ id }: { id?: string; props: RecoverPasswordFormSectionProps }) {

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
export default RecoverPasswordFormSection;
