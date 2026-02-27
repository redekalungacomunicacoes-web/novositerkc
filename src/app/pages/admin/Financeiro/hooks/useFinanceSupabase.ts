import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

/**
 * Ajuste os nomes das tabelas/colunas conforme seu Supabase.
 * Este hook fica responsável por:
 * - buscar dados brutos (fundos, projetos, movimentações)
 * - entregar funções utilitárias (incluindo exportação PDF sem libs)
 */

type UUID = string;

export type FinanceStatus =
  | "pago"
  | "pendente"
  | "cancelado"
  | "ativo"
  | "em_andamento"
  | "concluido";

export type MovimentoTipo = "entrada" | "saida";

export type FundoRow = {
  id: UUID;
  nome: string;
  ano?: number | null;
  saldo_inicial?: number | null;
  total_orcado?: number | null;
  status?: FinanceStatus | null;
};

export type ProjetoRow = {
  id: UUID;
  nome: string;
  fundo_id: UUID;
  total_orcado?: number | null;
  status?: FinanceStatus | null;
};

export type MovimentacaoRow = {
  id: UUID;
  data?: string | null; // ISO
  descricao?: string | null;
  valor: number;
  tipo: MovimentoTipo;
  status?: FinanceStatus | null;
  fundo_id?: UUID | null;
  projeto_id?: UUID | null;
  comprovante_url?: string | null;
  criado_em?: string | null;
};

export type FinanceRawData = {
  fundos: FundoRow[];
  projetos: ProjetoRow[];
  movimentacoes: MovimentacaoRow[];
};

type UseFinanceReturn = {
  loading: boolean;
  error: string | null;
  data: FinanceRawData;

  refetch: () => Promise<void>;

  // Exportação PDF SEM dependência (via print)
  exportRelatorioPdf: (opts: {
    titulo?: string;
    periodo?: { de?: string; ate?: string };
    filtro?: { fundoId?: string; projetoId?: string; tipo?: MovimentoTipo | "todos" };
    logoUrl?: string; // opcional: url da logo
  }) => Promise<void>;
};

function moneyBRL(v: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);
}

function safeText(v: any) {
  return String(v ?? "").replace(/[<>]/g, "");
}

function openPrintWindow(html: string, title = "Relatório Financeiro") {
  const w = window.open("", "_blank", "noopener,noreferrer,width=1024,height=768");
  if (!w) {
    alert("Pop-up bloqueado. Permita pop-ups para gerar o PDF.");
    return;
  }
  w.document.open();
  w.document.write(html);
  w.document.close();
  w.document.title = title;

  // aguarda render
  setTimeout(() => {
    w.focus();
    w.print();
    // opcional: fechar após imprimir
    setTimeout(() => w.close(), 500);
  }, 300);
}

function buildReportHtml(params: {
  titulo: string;
  logoUrl?: string;
  periodo?: { de?: string; ate?: string };
  resumo: { caixaGeral: number; entradas: number; saidas: number };
  itens: Array<{
    data: string;
    descricao: string;
    tipo: string;
    valor: number;
    fundo?: string;
    projeto?: string;
    status?: string;
  }>;
}) {
  const { titulo, logoUrl, periodo, resumo, itens } = params;

  const periodoTxt =
    periodo?.de || periodo?.ate
      ? `Período: ${safeText(periodo?.de || "—")} até ${safeText(periodo?.ate || "—")}`
      : "Período: —";

  const rows = itens
    .map(
      (m) => `
      <tr>
        <td>${safeText(m.data)}</td>
        <td>${safeText(m.descricao)}</td>
        <td>${safeText(m.tipo)}</td>
        <td style="text-align:right;">${moneyBRL(m.valor)}</td>
        <td>${safeText(m.fundo || "")}</td>
        <td>${safeText(m.projeto || "")}</td>
        <td>${safeText(m.status || "")}</td>
      </tr>
    `
    )
    .join("");

  return `
<!doctype html>
<html lang="pt-br">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>${safeText(titulo)}</title>
  <style>
    @page { margin: 16mm; }
    body { font-family: Arial, Helvetica, sans-serif; color: #111; }
    .top { display:flex; align-items:center; justify-content:space-between; gap:16px; margin-bottom:16px; }
    .brand { display:flex; align-items:center; gap:12px; }
    .logo { width: 56px; height:56px; object-fit:contain; border-radius:10px; }
    h1 { font-size:18px; margin:0; }
    .meta { font-size:12px; color:#444; margin-top:4px; }
    .cards { display:flex; gap:12px; margin: 12px 0 18px; }
    .card { flex:1; border:1px solid #ddd; border-radius:12px; padding:12px; }
    .card .label { font-size:11px; color:#666; }
    .card .value { font-size:16px; font-weight:700; margin-top:6px; }
    table { width:100%; border-collapse:collapse; font-size:12px; }
    th, td { border-bottom:1px solid #eee; padding:8px 6px; vertical-align:top; }
    th { text-align:left; font-size:11px; color:#555; }
    .footer { margin-top:14px; font-size:10px; color:#666; }
    .badge { display:inline-block; padding:2px 8px; border-radius:999px; background:#f2f2f2; font-size:11px; }
  </style>
</head>
<body>
  <div class="top">
    <div class="brand">
      ${
        logoUrl
          ? `<img class="logo" src="${safeText(logoUrl)}" alt="Logo"/>`
          : `<div class="logo" style="display:flex;align-items:center;justify-content:center;background:#f2f2f2;">RKC</div>`
      }
      <div>
        <h1>${safeText(titulo)}</h1>
        <div class="meta">${periodoTxt}</div>
      </div>
    </div>
    <div class="meta">
      <span class="badge">Gerado em ${new Date().toLocaleString("pt-BR")}</span>
    </div>
  </div>

  <div class="cards">
    <div class="card">
      <div class="label">Caixa geral</div>
      <div class="value">${moneyBRL(resumo.caixaGeral)}</div>
    </div>
    <div class="card">
      <div class="label">Entradas</div>
      <div class="value">${moneyBRL(resumo.entradas)}</div>
    </div>
    <div class="card">
      <div class="label">Saídas</div>
      <div class="value">${moneyBRL(resumo.saidas)}</div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th style="width:90px;">Data</th>
        <th>Descrição</th>
        <th style="width:70px;">Tipo</th>
        <th style="width:110px; text-align:right;">Valor</th>
        <th style="width:140px;">Fundo</th>
        <th style="width:140px;">Projeto</th>
        <th style="width:90px;">Status</th>
      </tr>
    </thead>
    <tbody>
      ${rows || `<tr><td colspan="7" style="padding:14px;color:#666;">Sem itens para este filtro/período.</td></tr>`}
    </tbody>
  </table>

  <div class="footer">
    Observação: este PDF é gerado via impressão do navegador (sem bibliotecas externas).
  </div>
</body>
</html>`;
}

export function useFinanceSupabase(): UseFinanceReturn {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [fundos, setFundos] = useState<FundoRow[]>([]);
  const [projetos, setProjetos] = useState<ProjetoRow[]>([]);
  const [movimentacoes, setMovimentacoes] = useState<MovimentacaoRow[]>([]);

  const data = useMemo<FinanceRawData>(
    () => ({ fundos, projetos, movimentacoes }),
    [fundos, projetos, movimentacoes]
  );

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // ⚠️ Ajuste os nomes das tabelas conforme o seu Supabase
      const [fundosRes, projetosRes, movRes] = await Promise.all([
        supabase.from("financeiro_fundos").select("*").order("nome", { ascending: true }),
        supabase.from("financeiro_projetos").select("*").order("nome", { ascending: true }),
        supabase.from("financeiro_movimentacoes").select("*").order("data", { ascending: false }),
      ]);

      if (fundosRes.error) throw fundosRes.error;
      if (projetosRes.error) throw projetosRes.error;
      if (movRes.error) throw movRes.error;

      setFundos((fundosRes.data || []) as FundoRow[]);
      setProjetos((projetosRes.data || []) as ProjetoRow[]);
      setMovimentacoes((movRes.data || []) as MovimentacaoRow[]);
    } catch (e: any) {
      setError(e?.message || "Erro ao buscar dados financeiros.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  const exportRelatorioPdf = useCallback(
    async (opts: {
      titulo?: string;
      periodo?: { de?: string; ate?: string };
      filtro?: { fundoId?: string; projetoId?: string; tipo?: MovimentoTipo | "todos" };
      logoUrl?: string;
    }) => {
      const titulo = opts.titulo || "Relatório Financeiro";
      const de = opts.periodo?.de ? new Date(opts.periodo.de) : null;
      const ate = opts.periodo?.ate ? new Date(opts.periodo.ate) : null;
      const filtro = opts.filtro || {};

      const fundoById = new Map(fundos.map((f) => [f.id, f]));
      const projetoById = new Map(projetos.map((p) => [p.id, p]));

      // Filtra apenas "pago" (se preferir incluir pendente, remova isso)
      let filtered = movimentacoes.filter((m) => (m.status ?? "pago") === "pago");

      if (de) filtered = filtered.filter((m) => (m.data ? new Date(m.data) >= de : true));
      if (ate) filtered = filtered.filter((m) => (m.data ? new Date(m.data) <= ate : true));

      if (filtro.tipo && filtro.tipo !== "todos") {
        filtered = filtered.filter((m) => m.tipo === filtro.tipo);
      }

      if (filtro.projetoId) {
        filtered = filtered.filter((m) => m.projeto_id === filtro.projetoId);
      }

      if (filtro.fundoId) {
        // se movimento não tem fundo_id mas tem projeto_id, resolve via projeto
        filtered = filtered.filter((m) => {
          const fundoIdDireto = m.fundo_id ?? null;
          if (fundoIdDireto) return fundoIdDireto === filtro.fundoId;
          const proj = m.projeto_id ? projetoById.get(m.projeto_id) : null;
          return proj?.fundo_id === filtro.fundoId;
        });
      }

      const entradas = filtered
        .filter((m) => m.tipo === "entrada")
        .reduce((acc, m) => acc + (Number(m.valor) || 0), 0);

      const saidas = filtered
        .filter((m) => m.tipo === "saida")
        .reduce((acc, m) => acc + (Number(m.valor) || 0), 0);

      // Caixa geral (do recorte do relatório)
      const caixaGeral = entradas - saidas;

      const itens = filtered.map((m) => {
        const proj = m.projeto_id ? projetoById.get(m.projeto_id) : null;
        const fundoId = m.fundo_id ?? proj?.fundo_id ?? null;
        const fundo = fundoId ? fundoById.get(fundoId) : null;

        return {
          data: m.data ? new Date(m.data).toLocaleDateString("pt-BR") : "",
          descricao: m.descricao || "",
          tipo: m.tipo,
          valor: Number(m.valor) || 0,
          fundo: fundo?.nome || "",
          projeto: proj?.nome || "",
          status: m.status || "",
        };
      });

      const html = buildReportHtml({
        titulo,
        logoUrl: opts.logoUrl,
        periodo: opts.periodo,
        resumo: { caixaGeral, entradas, saidas },
        itens,
      });

      openPrintWindow(html, titulo);
    },
    [fundos, projetos, movimentacoes]
  );

  return {
    loading,
    error,
    data,
    refetch,
    exportRelatorioPdf,
  };
}
