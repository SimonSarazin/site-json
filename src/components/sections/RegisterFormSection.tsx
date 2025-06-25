import RegisterForm from "../auth/RegisterForm";

interface RegisterFormSectionProps {
  id?: string;
}

export function RegisterFormSection({ id }: RegisterFormSectionProps) {

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