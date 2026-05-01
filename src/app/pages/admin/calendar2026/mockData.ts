import type { CalendarTask, Team, TeamMember, TeamNotification } from "./types";

export const teams: Team[] = [
  { id: "core", name: "Core Product" },
  { id: "growth", name: "Growth Ops" },
];

export const teamMembers: TeamMember[] = [
  { id: "m1", teamId: "core", name: "Ana Silva", role: "PM", avatar: "https://i.pravatar.cc/64?img=5" },
  { id: "m2", teamId: "core", name: "Bruno Costa", role: "Tech Lead", avatar: "https://i.pravatar.cc/64?img=12" },
  { id: "m3", teamId: "growth", name: "Carla Lima", role: "Marketing", avatar: "https://i.pravatar.cc/64?img=32" },
  { id: "m4", teamId: "growth", name: "Diego Rocha", role: "Analyst", avatar: "https://i.pravatar.cc/64?img=15" },
];

export const tasks: CalendarTask[] = [
  { id: "t1", title: "Sprint planning", description: "Planejar sprint Q2", date: "2026-05-05", startTime: "09:00", endTime: "10:00", priority: "alta", status: "andamento", assigneeId: "m1", meetingLink: "https://meet.google.com/abc-defg", attachments: ["brief.pdf"] },
  { id: "t2", title: "Revisar OKRs", description: "Alinhar metas", date: "2026-05-05", startTime: "14:00", endTime: "15:00", priority: "media", status: "pendente", assigneeId: "m2", attachments: [] },
  { id: "t3", title: "Upload de criativos", description: "Campanha Junho", date: "2026-05-09", startTime: "11:00", endTime: "12:00", priority: "baixa", status: "concluido", assigneeId: "m3", attachments: ["assets.zip"] },
  { id: "t4", title: "Aprovação de orçamento", description: "Financeiro e Growth", date: "2026-05-11", startTime: "16:00", endTime: "17:00", priority: "alta", status: "atrasado", assigneeId: "m4", attachments: [] },
];

export const notifications: TeamNotification[] = [
  { id: "n1", type: "meeting", message: "Reunião de sprint em 30 min", status: "novo", date: "2026-05-01T09:30:00Z" },
  { id: "n2", type: "task", message: "Nova tarefa atribuída a Bruno", status: "lido", date: "2026-05-01T08:10:00Z" },
  { id: "n3", type: "attachment", message: "Novo anexo em Upload de criativos", status: "novo", date: "2026-05-01T07:00:00Z" },
];
