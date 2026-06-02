import { useSite } from "@/hooks/useSite";
import { AuthPageLayout } from "../components/AuthPageLayout";
import { resolveAuthVariant } from "../components/variants/registry";

export default function RegisterPage() {
  const { config } = useSite();
  const { RegisterForm } = resolveAuthVariant(config.auth?.variant);

  return (
    <AuthPageLayout
      title={config.auth?.register?.title}
      description={config.auth?.register?.subtitle}
    >
      <RegisterForm />
    </AuthPageLayout>
  );
}
