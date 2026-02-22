import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ChurnScoreConfigProvider } from "@/contexts/ChurnScoreConfigContext";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { MainLayout } from "@/components/layout/MainLayout";
import Index from "./pages/Index";
import NPS from "./pages/NPS";
import Auth from "./pages/Auth";
import EsqueciSenha from "./pages/EsqueciSenha";
import ResetSenha from "./pages/ResetSenha";
import NotFound from "./pages/NotFound";
import VisaoGeral from "./pages/VisaoGeral";
import Financeiro from "./pages/Financeiro";
import ChurnAnalytics from "./pages/ChurnAnalytics";
import ClientesEmRisco from "./pages/ClientesEmRisco";
import Cancelamentos from "./pages/Cancelamentos";
import SelecionarCliente from "./pages/SelecionarCliente";
import ConfiguracaoChurnScore from "./pages/ConfiguracaoChurnScore";
import PerfilISP from "./pages/PerfilISP";
import ContasAcesso from "./pages/ContasAcesso";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
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
            <Route
              path="/churn-analytics"
              element={
                <ProtectedRoute>
                  <MainLayout>
                    <ChurnAnalytics />
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
            <Route path="*" element={<NotFound />} />
          </Routes>
          </ChurnScoreConfigProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
