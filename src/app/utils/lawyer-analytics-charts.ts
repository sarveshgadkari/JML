import type { SettlementRateRow } from "../components/charts/TopSettlementRatesChart";

type OutcomeBreakdownRow = { name: string; cases: number; winRate: number; lossRate: number; settlementRate: number };

/** Columns populated by admin_refresh_lawyer_analytics_charts (migration 039). */
export type LawyerAnalyticsChartRow = {
  chart_rep_complainant_cases?: number | null;
  chart_rep_respondent_cases?: number | null;
  chart_hearings_1_5?: number | null;
  chart_hearings_6_10?: number | null;
  chart_hearings_11_15?: number | null;
  chart_hearings_16_plus?: number | null;
  chart_top_party_1_name?: string | null;
  chart_top_party_1_cases?: number | null;
  chart_top_party_1_won?: number | null;
  chart_top_party_1_lost?: number | null;
  chart_top_party_1_settled?: number | null;
  chart_top_party_1_win_rate?: number | string | null;
  chart_top_party_1_loss_rate?: number | string | null;
  chart_top_party_1_settlement_rate?: number | string | null;
  chart_top_party_2_name?: string | null;
  chart_top_party_2_cases?: number | null;
  chart_top_party_2_won?: number | null;
  chart_top_party_2_lost?: number | null;
  chart_top_party_2_settled?: number | null;
  chart_top_party_2_win_rate?: number | string | null;
  chart_top_party_2_loss_rate?: number | string | null;
  chart_top_party_2_settlement_rate?: number | string | null;
  chart_top_party_3_name?: string | null;
  chart_top_party_3_cases?: number | null;
  chart_top_party_3_won?: number | null;
  chart_top_party_3_lost?: number | null;
  chart_top_party_3_settled?: number | null;
  chart_top_party_3_win_rate?: number | string | null;
  chart_top_party_3_loss_rate?: number | string | null;
  chart_top_party_3_settlement_rate?: number | string | null;
  chart_top_party_4_name?: string | null;
  chart_top_party_4_cases?: number | null;
  chart_top_party_4_won?: number | null;
  chart_top_party_4_lost?: number | null;
  chart_top_party_4_settled?: number | null;
  chart_top_party_4_win_rate?: number | string | null;
  chart_top_party_4_loss_rate?: number | string | null;
  chart_top_party_4_settlement_rate?: number | string | null;
  chart_top_party_5_name?: string | null;
  chart_top_party_5_cases?: number | null;
  chart_top_party_5_won?: number | null;
  chart_top_party_5_lost?: number | null;
  chart_top_party_5_settled?: number | null;
  chart_top_party_5_win_rate?: number | string | null;
  chart_top_party_5_loss_rate?: number | string | null;
  chart_top_party_5_settlement_rate?: number | string | null;
  chart_top_opp_lawyer_1_name?: string | null;
  chart_top_opp_lawyer_1_cases?: number | null;
  chart_top_opp_lawyer_1_won?: number | null;
  chart_top_opp_lawyer_1_lost?: number | null;
  chart_top_opp_lawyer_1_settled?: number | null;
  chart_top_opp_lawyer_1_win_rate?: number | string | null;
  chart_top_opp_lawyer_1_loss_rate?: number | string | null;
  chart_top_opp_lawyer_1_settlement_rate?: number | string | null;
  chart_top_opp_lawyer_2_name?: string | null;
  chart_top_opp_lawyer_2_cases?: number | null;
  chart_top_opp_lawyer_2_won?: number | null;
  chart_top_opp_lawyer_2_lost?: number | null;
  chart_top_opp_lawyer_2_settled?: number | null;
  chart_top_opp_lawyer_2_win_rate?: number | string | null;
  chart_top_opp_lawyer_2_loss_rate?: number | string | null;
  chart_top_opp_lawyer_2_settlement_rate?: number | string | null;
  chart_top_opp_lawyer_3_name?: string | null;
  chart_top_opp_lawyer_3_cases?: number | null;
  chart_top_opp_lawyer_3_won?: number | null;
  chart_top_opp_lawyer_3_lost?: number | null;
  chart_top_opp_lawyer_3_settled?: number | null;
  chart_top_opp_lawyer_3_win_rate?: number | string | null;
  chart_top_opp_lawyer_3_loss_rate?: number | string | null;
  chart_top_opp_lawyer_3_settlement_rate?: number | string | null;
  chart_top_opp_lawyer_4_name?: string | null;
  chart_top_opp_lawyer_4_cases?: number | null;
  chart_top_opp_lawyer_4_won?: number | null;
  chart_top_opp_lawyer_4_lost?: number | null;
  chart_top_opp_lawyer_4_settled?: number | null;
  chart_top_opp_lawyer_4_win_rate?: number | string | null;
  chart_top_opp_lawyer_4_loss_rate?: number | string | null;
  chart_top_opp_lawyer_4_settlement_rate?: number | string | null;
  chart_top_opp_lawyer_5_name?: string | null;
  chart_top_opp_lawyer_5_cases?: number | null;
  chart_top_opp_lawyer_5_won?: number | null;
  chart_top_opp_lawyer_5_lost?: number | null;
  chart_top_opp_lawyer_5_settled?: number | null;
  chart_top_opp_lawyer_5_win_rate?: number | string | null;
  chart_top_opp_lawyer_5_loss_rate?: number | string | null;
  chart_top_opp_lawyer_5_settlement_rate?: number | string | null;
  chart_top_judge_1_name?: string | null;
  chart_top_judge_1_cases?: number | null;
  chart_top_judge_1_won?: number | null;
  chart_top_judge_1_lost?: number | null;
  chart_top_judge_1_settled?: number | null;
  chart_top_judge_1_win_rate?: number | string | null;
  chart_top_judge_1_loss_rate?: number | string | null;
  chart_top_judge_1_settlement_rate?: number | string | null;
  chart_top_judge_2_name?: string | null;
  chart_top_judge_2_cases?: number | null;
  chart_top_judge_2_won?: number | null;
  chart_top_judge_2_lost?: number | null;
  chart_top_judge_2_settled?: number | null;
  chart_top_judge_2_win_rate?: number | string | null;
  chart_top_judge_2_loss_rate?: number | string | null;
  chart_top_judge_2_settlement_rate?: number | string | null;
  chart_top_judge_3_name?: string | null;
  chart_top_judge_3_cases?: number | null;
  chart_top_judge_3_won?: number | null;
  chart_top_judge_3_lost?: number | null;
  chart_top_judge_3_settled?: number | null;
  chart_top_judge_3_win_rate?: number | string | null;
  chart_top_judge_3_loss_rate?: number | string | null;
  chart_top_judge_3_settlement_rate?: number | string | null;
  chart_top_judge_4_name?: string | null;
  chart_top_judge_4_cases?: number | null;
  chart_top_judge_4_won?: number | null;
  chart_top_judge_4_lost?: number | null;
  chart_top_judge_4_settled?: number | null;
  chart_top_judge_4_win_rate?: number | string | null;
  chart_top_judge_4_loss_rate?: number | string | null;
  chart_top_judge_4_settlement_rate?: number | string | null;
  chart_top_judge_5_name?: string | null;
  chart_top_judge_5_cases?: number | null;
  chart_top_judge_5_won?: number | null;
  chart_top_judge_5_lost?: number | null;
  chart_top_judge_5_settled?: number | null;
  chart_top_judge_5_win_rate?: number | string | null;
  chart_top_judge_5_loss_rate?: number | string | null;
  chart_top_judge_5_settlement_rate?: number | string | null;
  chart_settle_1_kind?: string | null;
  chart_settle_1_name?: string | null;
  chart_settle_1_pct?: number | string | null;
  chart_settle_1_n?: number | null;
  chart_settle_2_kind?: string | null;
  chart_settle_2_name?: string | null;
  chart_settle_2_pct?: number | string | null;
  chart_settle_2_n?: number | null;
  chart_settle_3_kind?: string | null;
  chart_settle_3_name?: string | null;
  chart_settle_3_pct?: number | string | null;
  chart_settle_3_n?: number | null;
  chart_settle_4_kind?: string | null;
  chart_settle_4_name?: string | null;
  chart_settle_4_pct?: number | string | null;
  chart_settle_4_n?: number | null;
  chart_settle_5_kind?: string | null;
  chart_settle_5_name?: string | null;
  chart_settle_5_pct?: number | string | null;
  chart_settle_5_n?: number | null;
};

export const LAWYER_ANALYTICS_CHART_SELECT = [
  "chart_rep_complainant_cases",
  "chart_rep_respondent_cases",
  "chart_hearings_1_5",
  "chart_hearings_6_10",
  "chart_hearings_11_15",
  "chart_hearings_16_plus",
  "chart_top_party_1_name",
  "chart_top_party_1_cases",
  "chart_top_party_1_won",
  "chart_top_party_1_lost",
  "chart_top_party_1_settled",
  "chart_top_party_1_win_rate",
  "chart_top_party_1_loss_rate",
  "chart_top_party_1_settlement_rate",
  "chart_top_party_2_name",
  "chart_top_party_2_cases",
  "chart_top_party_2_won",
  "chart_top_party_2_lost",
  "chart_top_party_2_settled",
  "chart_top_party_2_win_rate",
  "chart_top_party_2_loss_rate",
  "chart_top_party_2_settlement_rate",
  "chart_top_party_3_name",
  "chart_top_party_3_cases",
  "chart_top_party_3_won",
  "chart_top_party_3_lost",
  "chart_top_party_3_settled",
  "chart_top_party_3_win_rate",
  "chart_top_party_3_loss_rate",
  "chart_top_party_3_settlement_rate",
  "chart_top_party_4_name",
  "chart_top_party_4_cases",
  "chart_top_party_4_won",
  "chart_top_party_4_lost",
  "chart_top_party_4_settled",
  "chart_top_party_4_win_rate",
  "chart_top_party_4_loss_rate",
  "chart_top_party_4_settlement_rate",
  "chart_top_party_5_name",
  "chart_top_party_5_cases",
  "chart_top_party_5_won",
  "chart_top_party_5_lost",
  "chart_top_party_5_settled",
  "chart_top_party_5_win_rate",
  "chart_top_party_5_loss_rate",
  "chart_top_party_5_settlement_rate",
  "chart_top_opp_lawyer_1_name",
  "chart_top_opp_lawyer_1_cases",
  "chart_top_opp_lawyer_1_won",
  "chart_top_opp_lawyer_1_lost",
  "chart_top_opp_lawyer_1_settled",
  "chart_top_opp_lawyer_1_win_rate",
  "chart_top_opp_lawyer_1_loss_rate",
  "chart_top_opp_lawyer_1_settlement_rate",
  "chart_top_opp_lawyer_2_name",
  "chart_top_opp_lawyer_2_cases",
  "chart_top_opp_lawyer_2_won",
  "chart_top_opp_lawyer_2_lost",
  "chart_top_opp_lawyer_2_settled",
  "chart_top_opp_lawyer_2_win_rate",
  "chart_top_opp_lawyer_2_loss_rate",
  "chart_top_opp_lawyer_2_settlement_rate",
  "chart_top_opp_lawyer_3_name",
  "chart_top_opp_lawyer_3_cases",
  "chart_top_opp_lawyer_3_won",
  "chart_top_opp_lawyer_3_lost",
  "chart_top_opp_lawyer_3_settled",
  "chart_top_opp_lawyer_3_win_rate",
  "chart_top_opp_lawyer_3_loss_rate",
  "chart_top_opp_lawyer_3_settlement_rate",
  "chart_top_opp_lawyer_4_name",
  "chart_top_opp_lawyer_4_cases",
  "chart_top_opp_lawyer_4_won",
  "chart_top_opp_lawyer_4_lost",
  "chart_top_opp_lawyer_4_settled",
  "chart_top_opp_lawyer_4_win_rate",
  "chart_top_opp_lawyer_4_loss_rate",
  "chart_top_opp_lawyer_4_settlement_rate",
  "chart_top_opp_lawyer_5_name",
  "chart_top_opp_lawyer_5_cases",
  "chart_top_opp_lawyer_5_won",
  "chart_top_opp_lawyer_5_lost",
  "chart_top_opp_lawyer_5_settled",
  "chart_top_opp_lawyer_5_win_rate",
  "chart_top_opp_lawyer_5_loss_rate",
  "chart_top_opp_lawyer_5_settlement_rate",
  "chart_top_judge_1_name",
  "chart_top_judge_1_cases",
  "chart_top_judge_1_won",
  "chart_top_judge_1_lost",
  "chart_top_judge_1_settled",
  "chart_top_judge_1_win_rate",
  "chart_top_judge_1_loss_rate",
  "chart_top_judge_1_settlement_rate",
  "chart_top_judge_2_name",
  "chart_top_judge_2_cases",
  "chart_top_judge_2_won",
  "chart_top_judge_2_lost",
  "chart_top_judge_2_settled",
  "chart_top_judge_2_win_rate",
  "chart_top_judge_2_loss_rate",
  "chart_top_judge_2_settlement_rate",
  "chart_top_judge_3_name",
  "chart_top_judge_3_cases",
  "chart_top_judge_3_won",
  "chart_top_judge_3_lost",
  "chart_top_judge_3_settled",
  "chart_top_judge_3_win_rate",
  "chart_top_judge_3_loss_rate",
  "chart_top_judge_3_settlement_rate",
  "chart_top_judge_4_name",
  "chart_top_judge_4_cases",
  "chart_top_judge_4_won",
  "chart_top_judge_4_lost",
  "chart_top_judge_4_settled",
  "chart_top_judge_4_win_rate",
  "chart_top_judge_4_loss_rate",
  "chart_top_judge_4_settlement_rate",
  "chart_top_judge_5_name",
  "chart_top_judge_5_cases",
  "chart_top_judge_5_won",
  "chart_top_judge_5_lost",
  "chart_top_judge_5_settled",
  "chart_top_judge_5_win_rate",
  "chart_top_judge_5_loss_rate",
  "chart_top_judge_5_settlement_rate",
  "chart_settle_1_kind",
  "chart_settle_1_name",
  "chart_settle_1_pct",
  "chart_settle_1_n",
  "chart_settle_2_kind",
  "chart_settle_2_name",
  "chart_settle_2_pct",
  "chart_settle_2_n",
  "chart_settle_3_kind",
  "chart_settle_3_name",
  "chart_settle_3_pct",
  "chart_settle_3_n",
  "chart_settle_4_kind",
  "chart_settle_4_name",
  "chart_settle_4_pct",
  "chart_settle_4_n",
  "chart_settle_5_kind",
  "chart_settle_5_name",
  "chart_settle_5_pct",
  "chart_settle_5_n",
].join(",");

function num(v: unknown): number {
  const n = typeof v === "string" ? Number(v) : Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function pct(part: number, total: number): number {
  return total > 0 ? Math.round((part * 10000) / total) / 100 : 0;
}

export function buildLawyerDashboardCharts(a: LawyerAnalyticsChartRow | null | undefined): {
  clientRepresentationData: Array<{ name: string; value: number; fill: string }>;
  hearingVelocityData: Array<{ bucket: string; cases: number }>;
  topOpponentsData: OutcomeBreakdownRow[];
  topOpponentLawyersCases: OutcomeBreakdownRow[];
  topJudgesCases: OutcomeBreakdownRow[];
  settlementRatesData: SettlementRateRow[];
} {
  const z = a ?? {};
  const rc = num(z.chart_rep_complainant_cases);
  const rr = num(z.chart_rep_respondent_cases);
  const clientRepresentationData = [
    { name: "Complainant side (cases)", value: rc, fill: "#166534" },
    { name: "Respondent side (cases)", value: rr, fill: "#475569" },
  ];
  const hearingVelocityData = [
    { bucket: "1-5", cases: num(z.chart_hearings_1_5) },
    { bucket: "6-10", cases: num(z.chart_hearings_6_10) },
    { bucket: "11-15", cases: num(z.chart_hearings_11_15) },
    { bucket: "16+", cases: num(z.chart_hearings_16_plus) },
  ];
  const toOutcomeRows = (
    names: Array<string | null | undefined>,
    cases: Array<number | null | undefined>,
    won: Array<number | null | undefined>,
    lost: Array<number | null | undefined>,
    settled: Array<number | null | undefined>,
    winRates: Array<number | string | null | undefined>,
    lossRates: Array<number | string | null | undefined>,
    settlementRates: Array<number | string | null | undefined>
  ): OutcomeBreakdownRow[] => {
    const out: OutcomeBreakdownRow[] = [];
    for (let i = 0; i < 5; i += 1) {
      const name = (names[i] ?? "").trim();
      const w = num(won[i]);
      const l = num(lost[i]);
      const s = num(settled[i]);
      const totalFromSplit = w + l + s;
      const c = num(cases[i]);
      const resolvedCases = c > 0 ? c : totalFromSplit;
      if (!name && resolvedCases <= 0) continue;
      const winRate = num(winRates[i]) || pct(w, resolvedCases || totalFromSplit);
      const lossRate = num(lossRates[i]) || pct(l, resolvedCases || totalFromSplit);
      const settlementRate = num(settlementRates[i]) || pct(s, resolvedCases || totalFromSplit);
      out.push({
        name: name || "—",
        cases: resolvedCases,
        winRate,
        lossRate,
        settlementRate,
      });
    }
    return out;
  };

  const topOpponentsData = toOutcomeRows(
    [z.chart_top_party_1_name, z.chart_top_party_2_name, z.chart_top_party_3_name, z.chart_top_party_4_name, z.chart_top_party_5_name],
    [z.chart_top_party_1_cases, z.chart_top_party_2_cases, z.chart_top_party_3_cases, z.chart_top_party_4_cases, z.chart_top_party_5_cases],
    [z.chart_top_party_1_won, z.chart_top_party_2_won, z.chart_top_party_3_won, z.chart_top_party_4_won, z.chart_top_party_5_won],
    [z.chart_top_party_1_lost, z.chart_top_party_2_lost, z.chart_top_party_3_lost, z.chart_top_party_4_lost, z.chart_top_party_5_lost],
    [z.chart_top_party_1_settled, z.chart_top_party_2_settled, z.chart_top_party_3_settled, z.chart_top_party_4_settled, z.chart_top_party_5_settled],
    [z.chart_top_party_1_win_rate, z.chart_top_party_2_win_rate, z.chart_top_party_3_win_rate, z.chart_top_party_4_win_rate, z.chart_top_party_5_win_rate],
    [z.chart_top_party_1_loss_rate, z.chart_top_party_2_loss_rate, z.chart_top_party_3_loss_rate, z.chart_top_party_4_loss_rate, z.chart_top_party_5_loss_rate],
    [z.chart_top_party_1_settlement_rate, z.chart_top_party_2_settlement_rate, z.chart_top_party_3_settlement_rate, z.chart_top_party_4_settlement_rate, z.chart_top_party_5_settlement_rate]
  );

  const topOpponentLawyersCases = toOutcomeRows(
    [z.chart_top_opp_lawyer_1_name, z.chart_top_opp_lawyer_2_name, z.chart_top_opp_lawyer_3_name, z.chart_top_opp_lawyer_4_name, z.chart_top_opp_lawyer_5_name],
    [z.chart_top_opp_lawyer_1_cases, z.chart_top_opp_lawyer_2_cases, z.chart_top_opp_lawyer_3_cases, z.chart_top_opp_lawyer_4_cases, z.chart_top_opp_lawyer_5_cases],
    [z.chart_top_opp_lawyer_1_won, z.chart_top_opp_lawyer_2_won, z.chart_top_opp_lawyer_3_won, z.chart_top_opp_lawyer_4_won, z.chart_top_opp_lawyer_5_won],
    [z.chart_top_opp_lawyer_1_lost, z.chart_top_opp_lawyer_2_lost, z.chart_top_opp_lawyer_3_lost, z.chart_top_opp_lawyer_4_lost, z.chart_top_opp_lawyer_5_lost],
    [z.chart_top_opp_lawyer_1_settled, z.chart_top_opp_lawyer_2_settled, z.chart_top_opp_lawyer_3_settled, z.chart_top_opp_lawyer_4_settled, z.chart_top_opp_lawyer_5_settled],
    [z.chart_top_opp_lawyer_1_win_rate, z.chart_top_opp_lawyer_2_win_rate, z.chart_top_opp_lawyer_3_win_rate, z.chart_top_opp_lawyer_4_win_rate, z.chart_top_opp_lawyer_5_win_rate],
    [z.chart_top_opp_lawyer_1_loss_rate, z.chart_top_opp_lawyer_2_loss_rate, z.chart_top_opp_lawyer_3_loss_rate, z.chart_top_opp_lawyer_4_loss_rate, z.chart_top_opp_lawyer_5_loss_rate],
    [z.chart_top_opp_lawyer_1_settlement_rate, z.chart_top_opp_lawyer_2_settlement_rate, z.chart_top_opp_lawyer_3_settlement_rate, z.chart_top_opp_lawyer_4_settlement_rate, z.chart_top_opp_lawyer_5_settlement_rate]
  );

  const topJudgesCases = toOutcomeRows(
    [z.chart_top_judge_1_name, z.chart_top_judge_2_name, z.chart_top_judge_3_name, z.chart_top_judge_4_name, z.chart_top_judge_5_name],
    [z.chart_top_judge_1_cases, z.chart_top_judge_2_cases, z.chart_top_judge_3_cases, z.chart_top_judge_4_cases, z.chart_top_judge_5_cases],
    [z.chart_top_judge_1_won, z.chart_top_judge_2_won, z.chart_top_judge_3_won, z.chart_top_judge_4_won, z.chart_top_judge_5_won],
    [z.chart_top_judge_1_lost, z.chart_top_judge_2_lost, z.chart_top_judge_3_lost, z.chart_top_judge_4_lost, z.chart_top_judge_5_lost],
    [z.chart_top_judge_1_settled, z.chart_top_judge_2_settled, z.chart_top_judge_3_settled, z.chart_top_judge_4_settled, z.chart_top_judge_5_settled],
    [z.chart_top_judge_1_win_rate, z.chart_top_judge_2_win_rate, z.chart_top_judge_3_win_rate, z.chart_top_judge_4_win_rate, z.chart_top_judge_5_win_rate],
    [z.chart_top_judge_1_loss_rate, z.chart_top_judge_2_loss_rate, z.chart_top_judge_3_loss_rate, z.chart_top_judge_4_loss_rate, z.chart_top_judge_5_loss_rate],
    [z.chart_top_judge_1_settlement_rate, z.chart_top_judge_2_settlement_rate, z.chart_top_judge_3_settlement_rate, z.chart_top_judge_4_settlement_rate, z.chart_top_judge_5_settlement_rate]
  );

  const settlementRatesData: SettlementRateRow[] = [];
  for (let i = 1; i <= 5; i += 1) {
    const kind = z[`chart_settle_${i}_kind` as keyof LawyerAnalyticsChartRow] as string | null | undefined;
    const name = z[`chart_settle_${i}_name` as keyof LawyerAnalyticsChartRow] as string | null | undefined;
    const pctRaw = z[`chart_settle_${i}_pct` as keyof LawyerAnalyticsChartRow];
    const n = num(z[`chart_settle_${i}_n` as keyof LawyerAnalyticsChartRow]);
    const nm = (name ?? "").trim();
    if (!nm || n < 1) continue;
    const prefix = kind === "judge" ? "Before " : kind === "opponent_lawyer" ? "Vs " : "";
    const label = `${prefix}${nm}`.trim();
    settlementRatesData.push({
      label,
      pct: num(pctRaw),
      n,
      kind: kind ?? undefined,
    });
  }

  return {
    clientRepresentationData,
    hearingVelocityData,
    topOpponentsData,
    topOpponentLawyersCases,
    topJudgesCases,
    settlementRatesData,
  };
}
