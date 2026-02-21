import { AlertTriangle, ThumbsUp, LayoutDashboard, DollarSign, BarChart2, UserX, XCircle, PanelLeftClose, PanelLeft, Settings, SlidersHorizontal } from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronRight } from "lucide-react";
import { useState } from "react";

const menuItems = [
  { title: "Visão Geral", url: "/", icon: LayoutDashboard },
  { title: "Financeiro", url: "/financeiro", icon: DollarSign },
  { title: "Chamados Frequentes", url: "/chamados", icon: AlertTriangle },
  { title: "Churn Analytics", url: "/churn-analytics", icon: BarChart2 },
  { title: "Clientes em Risco", url: "/clientes-em-risco", icon: UserX },
  { title: "Cancelamentos", url: "/cancelamentos", icon: XCircle },
  { title: "NPS", url: "/nps", icon: ThumbsUp },
];

const configSubItems = [
  { title: "Ajustar Churn Risk Score", url: "/configuracoes/churn-score", icon: SlidersHorizontal },
];

export function AppSidebar() {
  const { state, toggleSidebar } = useSidebar();
  const location = useLocation();
  const collapsed = state === "collapsed";

  const isConfigActive = configSubItems.some((i) => location.pathname === i.url);
  const [configOpen, setConfigOpen] = useState(isConfigActive);

  return (
    <Sidebar collapsible="icon" className="border-r" style={{ borderColor: 'hsl(213 81% 54% / 0.1)' }}>
      <SidebarContent className="pt-2">
        {/* Toggle button at top of sidebar */}
        <div className="px-2 mb-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleSidebar}
            className="w-full justify-center h-8"
          >
            {collapsed ? (
              <PanelLeft className="h-4 w-4" />
            ) : (
              <PanelLeftClose className="h-4 w-4" />
            )}
          </Button>
        </div>
        
        <SidebarGroup>
          <SidebarGroupLabel className={collapsed ? "sr-only" : ""}>
            Command Center
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => {
                const isActive = location.pathname === item.url;
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      tooltip={item.title}
                    >
                      <NavLink to={item.url}>
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Configurações */}
        <SidebarGroup className="mt-auto">
          <SidebarGroupLabel className={collapsed ? "sr-only" : ""}>
            Configurações
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {collapsed ? (
                // Em modo colapsado: mostra apenas ícone com tooltip
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    isActive={isConfigActive}
                    tooltip="Configurações"
                  >
                    <NavLink to="/configuracoes/churn-score">
                      <Settings className="h-4 w-4" />
                      <span>Configurações</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ) : (
                // Em modo expandido: mostra grupo colapsável com sub-itens
                <Collapsible open={configOpen} onOpenChange={setConfigOpen}>
                  <SidebarMenuItem>
                    <CollapsibleTrigger asChild>
                      <SidebarMenuButton
                        isActive={isConfigActive}
                        tooltip="Configurações"
                        className="w-full"
                      >
                        <Settings className="h-4 w-4" />
                        <span>Configurações</span>
                        <ChevronRight className={`ml-auto h-3 w-3 transition-transform ${configOpen ? "rotate-90" : ""}`} />
                      </SidebarMenuButton>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <SidebarMenuSub>
                        {configSubItems.map((sub) => (
                          <SidebarMenuSubItem key={sub.title}>
                            <SidebarMenuSubButton
                              asChild
                              isActive={location.pathname === sub.url}
                            >
                              <NavLink to={sub.url}>
                                <sub.icon className="h-3.5 w-3.5" />
                                <span>{sub.title}</span>
                              </NavLink>
                            </SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                        ))}
                      </SidebarMenuSub>
                    </CollapsibleContent>
                  </SidebarMenuItem>
                </Collapsible>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
