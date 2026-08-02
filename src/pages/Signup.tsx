import { Helmet } from "react-helmet-async";
import { useNavigate } from "react-router-dom";
import { AuthPage } from "@/components/auth/AuthPage";

export default function Signup() {
  const navigate = useNavigate();
  return (
    <>
      <Helmet>
        <title>Criar conta · Plano do Milhão</title>
        <meta
          name="description"
          content="Crie sua conta gratuita no Plano do Milhão e comece a organizar renda, gastos e patrimônio rumo ao primeiro milhão."
        />
        <meta name="robots" content="noindex, nofollow" />
        <meta property="og:title" content="Criar conta · Plano do Milhão" />
        <meta
          property="og:description"
          content="Crie sua conta gratuita e comece hoje seu planejamento financeiro do zero ao primeiro milhão."
        />
        <meta property="og:url" content="https://couple-milestone-planner.lovable.app/signup" />
      </Helmet>
      <AuthPage
        mode="signup"
        showBackButton
        onClose={() => navigate("/")}
        onSuccess={() => navigate("/", { replace: true })}
      />
    </>
  );
}