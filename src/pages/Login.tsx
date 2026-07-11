import { Helmet } from "react-helmet-async";
import { useNavigate } from "react-router-dom";
import { AuthPage } from "@/components/auth/AuthPage";

export default function Login() {
  const navigate = useNavigate();
  return (
    <>
      <Helmet>
        <title>Entrar · Plano do Milhão</title>
        <meta name="description" content="Acesse sua conta no Plano do Milhão." />
        <meta name="robots" content="noindex, nofollow" />
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