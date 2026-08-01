import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { FullscreenSkeleton } from "@/components/plan/PanelSkeleton";
import { OfflineQueueProvider } from "@/hooks/useOfflineQueue";
import Index from "./pages/Index";
import { useAuth } from "@/hooks/useAuth";

const NotFound = lazy(() => import("./pages/NotFound"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const OAuthConsent = lazy(() => import("./pages/OAuthConsent"));
const GuiaPlanejamentoFinanceiro = lazy(() => import("./pages/GuiaPlanejamentoFinanceiro"));
const Connect = lazy(() => import("./pages/Connect"));
const Landing = lazy(() => import("./pages/Landing"));
const Login = lazy(() => import("./pages/Login"));
const Signup = lazy(() => import("./pages/Signup"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));
const Elo = lazy(() => import("./pages/Elo"));

const queryClient = new QueryClient();

function RootRoute() {
  const { user, loading } = useAuth();
  if (loading) return <FullscreenSkeleton />;
  if (!user) return <Landing />;
  return <Index />;
}

function RequireAnon({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <FullscreenSkeleton />;
  if (user) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <FullscreenSkeleton />;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

const App = () => (
  <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <OfflineQueueProvider>
          <BrowserRouter>
            <Suspense fallback={<FullscreenSkeleton />}>
              <Routes>
                <Route path="/" element={<RootRoute />} />
                <Route path="/elo" element={<RequireAuth><Elo /></RequireAuth>} />
                <Route path="/login" element={<RequireAnon><Login /></RequireAnon>} />
                <Route path="/signup" element={<RequireAnon><Signup /></RequireAnon>} />
                <Route path="/criar-conta" element={<Navigate to="/signup" replace />} />
                <Route path="/forgot-password" element={<RequireAnon><ForgotPassword /></RequireAnon>} />
                <Route path="/recuperar-senha" element={<Navigate to="/forgot-password" replace />} />
                <Route path="/reset-password" element={<ResetPassword />} />
                <Route path="/.lovable/oauth/consent" element={<OAuthConsent />} />
                <Route path="/guia-planejamento-financeiro" element={<GuiaPlanejamentoFinanceiro />} />
                <Route path="/connect" element={<Connect />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </BrowserRouter>
        </OfflineQueueProvider>
      </TooltipProvider>
    </QueryClientProvider>
  </ThemeProvider>
);

export default App;
