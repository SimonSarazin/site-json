import { RegisterFormSectionProps } from "@/types/site-schema";
import RegisterForm from "../auth/RegisterForm";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function RegisterFormSection({ id, props }: { id?: string; props: RegisterFormSectionProps }) {

  return (
        <section id={id} className="py-16 bg-background">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="max-w-md mx-auto">
              <RegisterForm />
            </div>
          </div>
        </section>
  );
}