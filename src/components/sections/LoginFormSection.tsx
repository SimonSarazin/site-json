import { LoginFormSectionProps } from "@/types/site-schema";
import LoginForm from "../auth/LoginForm";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function LoginFormSection({ id, props }: { id?: string; props: LoginFormSectionProps }) {

  return (
        <section id={id} className="py-16 bg-background">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="max-w-md mx-auto">
              <LoginForm />
            </div>
          </div>
        </section>
  );
}