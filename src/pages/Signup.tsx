import { Helmet } from "react-helmet-async";
import { useNavigate } from "react-router-dom";
import { AuthPage } from "@/components/auth/AuthPage";

export default function Signup() {
  const navigate = useNavigate();
  return (
    <>
      <Helmet>
        <title>Criar conta · Plano do Milhão</title>
        <meta name="description" content="Crie sua conta gratuita no Plano do Milhão." />
        <meta name="robots" content="noindex, nofollow" />
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