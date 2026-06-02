import { useSite } from "@/hooks/useSite";
import { AuthPageLayout } from "../components/AuthPageLayout";
import { resolveAuthVariant } from "../components/variants/registry";

export default function LoginPage() {
  const { config } = useSite();
  const { LoginForm } = resolveAuthVariant(config.auth?.variant);

  return (
    <AuthPageLayout
      title={config.auth?.login?.title}
      description={config.auth?.login?.subtitle}
    >
      <LoginForm />
    </AuthPageLayout>
  );
}
