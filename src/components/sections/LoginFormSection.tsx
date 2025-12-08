import { LoginFormSectionProps } from "@/types/site-schema";
import LoginForm from "../auth/LoginForm";

 
export function LoginFormSection({ id }: { id?: string; props: LoginFormSectionProps }) {

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
export default LoginFormSection;
