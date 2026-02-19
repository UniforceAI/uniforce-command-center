import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { MainLayout } from "@/components/layout/MainLayout";
import Index from "./pages/Index";
import NPS from "./pages/NPS";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";
import VisaoGeral from "./pages/VisaoGeral";
import Financeiro from "./pages/Financeiro";
import ChurnRetencao from "./pages/ChurnRetencao";
import SelecionarCliente from "./pages/SelecionarCliente";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/auth" element={<Auth />} />
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
              path="/churn-retencao"
              element={
                <ProtectedRoute>
                  <MainLayout>
                    <ChurnRetencao />
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
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
