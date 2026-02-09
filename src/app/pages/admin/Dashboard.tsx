import { Card, CardContent, CardHeader, CardTitle } from "@/app/components/ui/card";
import { FileText, FolderOpen, Users, TrendingUp } from "lucide-react";
// I'm assuming Card component exists in @/app/components/ui/card, if not I will use standard div.
// To be safe, I'll use standard divs with Tailwind classes if I'm not sure about the UI library presence.
// I'll check first.

export function Dashboard() {
  const stats = [
    { title: "Total de Matérias", value: "124", icon: FileText, change: "+12% esse mês" },
    { title: "Projetos Ativos", value: "8", icon: FolderOpen, change: "2 novos" },
    { title: "Usuários Cadastrados", value: "1,203", icon: Users, change: "+5% essa semana" },
    { title: "Visitas (30 dias)", value: "45.2k", icon: TrendingUp, change: "+18%" },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground mt-2">Bem-vindo ao painel administrativo da Rede Kalunga Comunicações.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.title} className="rounded-xl border bg-card text-card-foreground shadow-sm p-6">
            <div className="flex flex-row items-center justify-between space-y-0 pb-2">
              <h3 className="tracking-tight text-sm font-medium text-muted-foreground">{stat.title}</h3>
              <stat.icon className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="pt-2">
              <div className="text-2xl font-bold">{stat.value}</div>
              <p className="text-xs text-muted-foreground mt-1">{stat.change}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <div className="col-span-4 rounded-xl border bg-card text-card-foreground shadow-sm">
          <div className="p-6">
            <h3 className="font-semibold text-lg">Matérias Recentes</h3>
            <p className="text-sm text-muted-foreground mb-4">Últimas publicações no portal.</p>
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-4 pb-4 border-b last:border-0 last:pb-0">
                  <div className="h-12 w-12 rounded bg-muted flex items-center justify-center">
                    <FileText className="h-6 w-6 text-muted-foreground/50" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-medium leading-none">Título da Matéria Exemplo {i}</p>
                    <p className="text-xs text-muted-foreground">Publicado em 03/02/2025</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
        
        <div className="col-span-3 rounded-xl border bg-card text-card-foreground shadow-sm">
           <div className="p-6">
            <h3 className="font-semibold text-lg">Status do Sistema</h3>
            <div className="mt-4 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>Banco de Dados</span>
                <span className="text-green-600 font-medium">Conectado</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span>API</span>
                <span className="text-green-600 font-medium">Online</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span>Versão</span>
                <span className="text-muted-foreground">v1.0.0</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
