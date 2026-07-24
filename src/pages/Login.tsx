import { Helmet } from "react-helmet-async";
import { useNavigate } from "react-router-dom";
import { AuthPage } from "@/components/auth/AuthPage";

export default function Login() {
  const navigate = useNavigate();
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
      </Helmet>
      <AuthPage
        mode="login"
        showBackButton
        onClose={() => navigate("/")}
        onSuccess={() => navigate("/", { replace: true })}
      />
    </>
  );
}