import { Helmet } from "react-helmet-async";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AuthPage } from "@/components/auth/AuthPage";
import { sanitizeReturnTo } from "@/lib/utils/safeRedirect";

// Destinos internos permitidos como `?redirect=` após login. Restringir
// evita open-redirect e uso indevido como bounce para páginas técnicas.
const ALLOWED_REDIRECTS = ["/", "/connect"] as const;

export default function Login() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const target = sanitizeReturnTo(params.get("redirect"), "/", ALLOWED_REDIRECTS);
  return (
    <>
      <Helmet>
        <title>Entrar · Plano do Milhão</title>
        <meta
          name="description"
          content="Entre na sua conta do Plano do Milhão para continuar seu planejamento financeiro, acompanhar aportes e ver seu patrimônio."
        />
        <meta name="robots" content="noindex, nofollow" />
        <meta property="og:title" content="Entrar · Plano do Milhão" />
        <meta
          property="og:description"
          content="Acesse seu Plano do Milhão para continuar de onde parou: renda, gastos, aportes e patrimônio."
        />
        <meta property="og:url" content="https://couple-milestone-planner.lovable.app/login" />
        <link rel="canonical" href="https://couple-milestone-planner.lovable.app/login" />
      </Helmet>
      <AuthPage
        mode="login"
        showBackButton
        onClose={() => navigate("/")}
        onSuccess={() => navigate(target, { replace: true })}
      />
    </>
  );
}