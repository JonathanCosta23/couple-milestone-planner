import { useLocation } from "react-router-dom";
import { useEffect } from "react";
import { Helmet } from "react-helmet-async";
import { logger } from "@/lib/logger";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    logger.warn("route.not_found", { route: location.pathname });
  }, [location.pathname]);

  return (
    <>
      <Helmet>
        <title>Página não encontrada · Plano do Milhão</title>
        <meta
          name="description"
          content="Esta página não existe no Plano do Milhão. Volte para o início e continue seu planejamento financeiro."
        />
        <meta name="robots" content="noindex, follow" />
        <link rel="canonical" href="https://couple-milestone-planner.lovable.app/404" />
        <meta property="og:title" content="Página não encontrada · Plano do Milhão" />
        <meta
          property="og:description"
          content="A página que você procurou não existe no Plano do Milhão. Volte ao início e continue seu planejamento financeiro."
        />
        <meta property="og:url" content="https://couple-milestone-planner.lovable.app/404" />
      </Helmet>
      <main className="flex min-h-screen items-center justify-center bg-muted">
        <div className="text-center">
          <h1 className="mb-4 text-4xl font-bold">404 · Página não encontrada</h1>
          <p className="mb-4 text-xl text-muted-foreground">Esta página não existe.</p>
          <a href="/" className="text-primary underline hover:text-primary/90">
            Voltar para o início
          </a>
        </div>
      </main>
    </>
  );
};

export default NotFound;
