import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import Index from "./pages/Index";
import NPS from "./pages/NPS";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";
import VisaoGeral from "./pages/VisaoGeral";
import Financeiro from "./pages/Financeiro";
import ChurnRetencao from "./pages/ChurnRetencao";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/auth" element={<Auth />} />
          <Route
            path="/"
            element={
              <MainLayout>
                <Index />
              </MainLayout>
            }
          />
          <Route
            path="/visao-geral"
            element={
              <MainLayout>
                <VisaoGeral />
              </MainLayout>
            }
          />
          <Route
            path="/financeiro"
            element={
              <MainLayout>
                <Financeiro />
              </MainLayout>
            }
          />
          <Route
            path="/churn-retencao"
            element={
              <MainLayout>
                <ChurnRetencao />
              </MainLayout>
            }
          />
          <Route
            path="/nps"
            element={
              <MainLayout>
                <NPS />
              </MainLayout>
            }
          />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
