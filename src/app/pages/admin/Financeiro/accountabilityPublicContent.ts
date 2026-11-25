import { questions } from '@/app/pages/public/Accountability/questions';
import type { PublicReport, PublicRow } from '@/app/pages/public/Accountability/model';
import { budgetLabels, calculateFajFinancials, type FajFinancialData } from './fajFinancialCalculations';

const text = (value: unknown) => typeof value === 'string' && value.trim() ? value : null;
const amount = (value: unknown) => typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;

export function accountabilityPublicContent(
  financial: FajFinancialData,
  narrative: Record<string, unknown>,
): PublicReport['content'] {
  const team = Array.isArray(financial.team) ? financial.team : [];
  const budget = Array.isArray(financial.budgetExcludingTeam) ? financial.budgetExcludingTeam : [];
  const funding = Array.isArray(financial.funding) ? financial.funding : [];
  const totals = calculateFajFinancials(team, budget, funding);
  const budgetRow = (label: string | null, total: number | null, faj: number | null) => ({
    label, total, faj,
    other: total !== null && faj !== null && faj <= total ? (Math.round(total * 100) - Math.round(faj * 100)) / 100 : null,
  });
  // Keep the team aggregate as a single budget line.
  const teamTotal = budgetRow('Pessoal/equipe', totals.teamTotal, totals.teamFaj);
  const hasTeam = team.length > 0 && (teamTotal.total !== null || teamTotal.faj !== null);
  const other = totals.share === null ? null : totals.other;
  const institution = (narrative.institution || {}) as Record<string, unknown>;
  const impact: PublicRow[] = [];

  for (const [channel, raw] of Object.entries(narrative.impact_engagement || {})) {
    if (!raw || typeof raw !== 'object') continue;
    const item = raw as Record<string, unknown>;
    const metrics = Object.entries(item.metrics || {});
    for (const [name, fields] of metrics) {
      if (!fields || typeof fields !== 'object') continue;
      const metric = fields as Record<string, unknown>;
      const row = {
        channel, label: text(metric.name) || name,
        prior: text(metric.value_2025) ?? amount(metric.value_2025),
        current: text(metric.value_2026) ?? amount(metric.value_2026),
        priorStart: text(metric.start_2025), priorEnd: text(metric.end_2025),
        currentStart: text(metric.start_2026), currentEnd: text(metric.end_2026),
        variation: text(metric.variation), notes: text(metric.notes),
      };
      if (row.prior !== null || row.current !== null || row.notes) impact.push(row);
    }
    const prior = text(item.year_2025) ?? amount(item.year_2025);
    const current = text(item.year_2026) ?? amount(item.year_2026);
    if (prior !== null || current !== null || text(item.notes)) {
      impact.push({ channel, label: text(item.indicators) || 'Dados gerais do canal', prior, current, variation: text(item.variation), notes: text(item.notes) });
    }
  }
  const answers = questions.flatMap(question => {
    const body = text(narrative[question.key]);
    return body ? [{ label: question.label, body, guidance: question.guidance }] : [];
  });
  const name = text(institution.organization_name);
  const renewal = text(institution.renewal_period);
  const vision: PublicRow[] = [
    ...(name ? [{ label: 'Organização', body: name }] : []),
    ...(renewal ? [{ label: 'Período de renovação', body: renewal }] : []),
  ];
  const plan = (Array.isArray(financial.workPlanRows) ? financial.workPlanRows : []).map(row => ({
    label: text(row.objective), activity: text(row.activity), outcome: text(row.outcome),
    evidence: text(row.evidence), period: text(row.period), budgetLine: text(row.budgetLine), notes: text(row.notes),
  })).filter(row => Object.values(row).some(value => value !== null));
  const legacyPlan = text(financial.workPlan);
  return {
    overview: totals.total === null && totals.faj === null ? [] : [{ total: totals.total, faj: totals.faj, other, share: totals.share,
      reference: text(financial.budgetReference) ?? amount(financial.budgetReference), period: text(financial.budgetPeriod),
      notes: text(financial.budgetChanges), fundingChanges: text(financial.sustainabilityVariations), fundingRisks: text(financial.sustainabilityRisks),
    }],
    budget: [...(hasTeam ? [{ ...teamTotal, notes: text(financial.personnelNotes) }] : []), ...budget.map((row, index) => ({
      ...budgetRow(text(row.label) || budgetLabels[index] || 'Rubrica adicional', amount(row.total), amount(row.faj)),
      description: text(row.description), notes: text(row.notes),
    }))],
    team_members: team.map(row => ({
      name: text(row.name), relationship: text(row.relationship), monthly: amount(row.monthly),
      months: amount(row.months), faj: amount(row.faj), charges: amount(row.charges), notes: text(row.notes),
    })).filter(row => row.name !== null || row.monthly !== null || row.faj !== null || row.charges !== null),
    team: hasTeam ? [{ ...teamTotal, count: totals.teamCount }] : [],
    funding: funding.map(row => ({
      label: text(row.source), type: text(row.sourceType), year: amount(row.year), status: text(row.status), total: amount(row.amount),
      purpose: text(row.purpose), project: text(row.project), expectedDate: text(row.expectedDate) ?? amount(row.expectedDate), notes: text(row.notes),
    })).filter(row => row.label || row.total !== null),
    plan: plan.length ? plan : legacyPlan ? [{ label: 'Plano de trabalho', activity: legacyPlan }] : [],
    institution: vision,
    narrative: answers,
    impact,
  };
}
