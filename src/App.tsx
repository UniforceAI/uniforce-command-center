import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
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
import SetupProvedor from "./pages/SetupProvedor";
import PerfilISP from "./pages/PerfilISP";
import ContasAcesso from "./pages/ContasAcesso";
import EventosDebug from "./pages/EventosDebug";
import Onboarding from "./pages/Onboarding";

// Clientes operam o dashboard por sessões longas de trabalho (8h).
// staleTime = 8h: dados permanecem frescos durante toda a jornada sem re-fetch.
// gcTime = 10h: cache mantido em memória e localStorage por 2h além do staleTime.
// F5 / reload: CacheRefreshGuard dispara refetchQueries explicitamente.
const EIGHT_HOURS = 1000 * 60 * 60 * 8;
const TEN_HOURS   = 1000 * 60 * 60 * 10;

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: EIGHT_HOURS,
      gcTime: TEN_HOURS,
      refetchOnWindowFocus: false,
      refetchOnMount: false,
      retry: 1,
    },
  },
});

const persister = createLocalStoragePersister();

const persistOptions = {
  persister,
  maxAge: TEN_HOURS,
  buster: "v7",
};

const Protected = ({ children }: { children: React.ReactNode }) => (
  <ProtectedRoute><MainLayout>{children}</MainLayout></ProtectedRoute>
);

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
                  {/* Public */}
                  <Route path="/auth"          element={<Auth />} />
                  <Route path="/esqueci-senha" element={<EsqueciSenha />} />
                  <Route path="/reset-senha"   element={<ResetSenha />} />

                  {/* Semi-protected (no ISP required) */}
                  <Route path="/selecionar-cliente" element={<ProtectedRoute requireSelectedIsp={false}><SelecionarCliente /></ProtectedRoute>} />
                  <Route path="/onboarding"         element={<Onboarding />} />

                  {/* Main dashboard */}
                  <Route path="/"                 element={<Protected><VisaoGeral /></Protected>} />
                  <Route path="/visao-geral"      element={<Protected><VisaoGeral /></Protected>} />
                  <Route path="/financeiro"       element={<Protected><Financeiro /></Protected>} />
                  <Route path="/chamados"         element={<Protected><Index /></Protected>} />
                  <Route path="/crm"              element={<Protected><ClientesEmRisco /></Protected>} />
                  <Route path="/clientes-em-risco"element={<Protected><ClientesEmRisco /></Protected>} />
                  <Route path="/cancelamentos"    element={<Protected><Cancelamentos /></Protected>} />
                  <Route path="/nps"              element={<Protected><NPS /></Protected>} />

                  {/* Configurações */}
                  <Route path="/configuracoes"        element={<Protected><SetupProvedor /></Protected>} />
                  <Route path="/configuracoes/perfil" element={<Protected><PerfilISP /></Protected>} />

                  {/* Legacy redirects */}
                  <Route path="/configuracoes/churn-score" element={<Navigate to="/configuracoes" replace />} />
                  <Route path="/configuracoes/chamados"    element={<Navigate to="/configuracoes" replace />} />
                  <Route path="/configuracoes/contas"      element={<Navigate to="/configuracoes/perfil?tab=contas" replace />} />

                  {/* Standalone fallback for ContasAcesso (admin deep link) */}
                  <Route path="/configuracoes/contas-standalone" element={<Protected><ContasAcesso /></Protected>} />

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
