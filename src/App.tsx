import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ChurnScoreConfigProvider } from "@/contexts/ChurnScoreConfigContext";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { MainLayout } from "@/components/layout/MainLayout";
import { ErrorBoundary } from "@/components/shared/ErrorBoundary";
import { createLocalStoragePersister } from "@/lib/queryPersister";
import { CacheRefreshGuard } from "@/components/CacheRefreshGuard";
import Index from "./pages/Index";
import NPS from "./pages/NPS";
import Auth from "./pages/Auth";
import EsqueciSenha from "./pages/EsqueciSenha";
import ResetSenha from "./pages/ResetSenha";
import NotFound from "./pages/NotFound";
import VisaoGeral from "./pages/VisaoGeral";
import Financeiro from "./pages/Financeiro";

import ClientesEmRisco from "./pages/ClientesEmRisco";
import Cancelamentos from "./pages/Cancelamentos";
import SelecionarCliente from "./pages/SelecionarCliente";
import ConfiguracaoChurnScore from "./pages/ConfiguracaoChurnScore";
import PerfilISP from "./pages/PerfilISP";
import ContasAcesso from "./pages/ContasAcesso";
import SetupChamados from "./pages/SetupChamados";
import EventosDebug from "./pages/EventosDebug";
// Onboarding removido — página não existe mais no projeto

// Clientes operam o dashboard por sessões longas de trabalho (8h).
// staleTime = 8h: dados permanecem frescos durante toda a jornada sem re-fetch.
// gcTime = 10h: cache é mantido em memória e localStorage por 2h além do staleTime,
//   garantindo que um background refetch pós-stale complete antes da limpeza.
// F5 / reload: CacheRefreshGuard dispara refetchQueries explicitamente,
//   ignorando staleTime e forçando dados frescos do banco.
const EIGHT_HOURS = 1000 * 60 * 60 * 8;
const TEN_HOURS   = 1000 * 60 * 60 * 10;

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: EIGHT_HOURS,
      gcTime: TEN_HOURS,
      refetchOnWindowFocus: false,
      refetchOnMount: false,   // CacheRefreshGuard controla reload; navegação SPA usa cache
      retry: 1,
    },
  },
});

const persister = createLocalStoragePersister();

const persistOptions = {
  persister,
  maxAge: TEN_HOURS,
  buster: "v5", // fase-1-perf: staleTime 8h + refetchOnMount removido dos hooks
};

const App = () => (
  <PersistQueryClientProvider client={queryClient} persistOptions={persistOptions}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <CacheRefreshGuard>
          <ErrorBoundary>
          <ChurnScoreConfigProvider>
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route path="/esqueci-senha" element={<EsqueciSenha />} />
            <Route path="/reset-senha" element={<ResetSenha />} />
            <Route
              path="/selecionar-cliente"
              element={
                <ProtectedRoute requireSelectedIsp={false}>
                  <SelecionarCliente />
                </ProtectedRoute>
              }
            />
              {/* Onboarding route removed — page no longer exists */}
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <MainLayout>
                    <VisaoGeral />
                  </MainLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/chamados"
              element={
                <ProtectedRoute>
                  <MainLayout>
                    <Index />
                  </MainLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/visao-geral"
              element={
                <ProtectedRoute>
                  <MainLayout>
                    <VisaoGeral />
                  </MainLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/financeiro"
              element={
                <ProtectedRoute>
                  <MainLayout>
                    <Financeiro />
                  </MainLayout>
                </ProtectedRoute>
              }
            />
            {/* churn-analytics removed — metrics moved to Cancelamentos */}
            <Route
              path="/crm"
              element={
                <ProtectedRoute>
                  <MainLayout>
                    <ClientesEmRisco />
                  </MainLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/clientes-em-risco"
              element={
                <ProtectedRoute>
                  <MainLayout>
                    <ClientesEmRisco />
                  </MainLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/cancelamentos"
              element={
                <ProtectedRoute>
                  <MainLayout>
                    <Cancelamentos />
                  </MainLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/nps"
              element={
                <ProtectedRoute>
                  <MainLayout>
                    <NPS />
                  </MainLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/configuracoes/churn-score"
              element={
                <ProtectedRoute>
                  <MainLayout>
                    <ConfiguracaoChurnScore />
                  </MainLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/configuracoes/perfil"
              element={
                <ProtectedRoute>
                  <MainLayout>
                    <PerfilISP />
                  </MainLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/configuracoes/contas"
              element={
                <ProtectedRoute>
                  <MainLayout>
                    <ContasAcesso />
                  </MainLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/configuracoes/chamados"
              element={
                <ProtectedRoute>
                  <MainLayout>
                    <SetupChamados />
                  </MainLayout>
                </ProtectedRoute>
              }
            />
            <Route path="/eventos-debug" element={<EventosDebug />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
          </ChurnScoreConfigProvider>
          </ErrorBoundary>
          </CacheRefreshGuard>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </PersistQueryClientProvider>
);

export default App;
