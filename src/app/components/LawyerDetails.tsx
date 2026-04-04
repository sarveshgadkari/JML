import React, { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import getSupabase from "../../utils/supabase/client";
import TrustRiskMatrix from "./TrustRiskMatrix";
import AnalyticsDashboard from "./AnalyticsDashboard";
import { buildLawyerDashboardCharts, LAWYER_ANALYTICS_CHART_SELECT } from "../utils/lawyer-analytics-charts";

interface Props {
  lawyerId: string;
  onBack: () => void;
}

type LawyerRow = {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  bio: string | null;
  courts: string[] | null;
  specialization: string[] | null;
  is_verified: boolean | null;
};

type LawyerJudgeAnalyticsRow = {
  judge_id: string;
  judge_name: string;
  total_cases: number;
  won_cases: number;
  lost_cases: number;
  settled_cases: number;
  win_rate: number;
};

type LawyerAnalyticsRow = {
  lawyer_id: string;
  lawyer_name: string;
  total_cases: number;
  won_cases: number;
  lost_cases: number;
  settled_cases: number;
  dismissed_cases: number;
  withdrawn_cases: number;
  partially_granted_cases: number;
  win_rate: number;
  loss_rate: number;
  settlement_rate: number;
  avg_case_duration_days: number;
} & Record<string, unknown>;

type CaseRow = {
  case_number: string;
  case_title: string | null;
  judge_name: string | null;
  opponent_lawyer: string | null;
  outcome: string | null;
};

const CORE_LAWYER_ANALYTICS_SELECT = [
  "lawyer_id",
  "lawyer_name",
  "total_cases",
  "won_cases",
  "lost_cases",
  "settled_cases",
  "dismissed_cases",
  "withdrawn_cases",
  "partially_granted_cases",
  "win_rate",
  "loss_rate",
  "settlement_rate",
  "avg_case_duration_days",
].join(",");

export default function LawyerDetails({ lawyerId, onBack }: Props) {
  const [loading, setLoading] = useState(true);
  const [lawyer, setLawyer] = useState<LawyerRow | null>(null);
  const [judgePerformance, setJudgePerformance] = useState<LawyerJudgeAnalyticsRow[]>([]);
  const [analytics, setAnalytics] = useState<LawyerAnalyticsRow | null>(null);
  const [clientRepresentationData, setClientRepresentationData] = useState<Array<{ name: string; value: number; fill: string }>>([
    { name: "Complainant side (cases)", value: 0, fill: "#166534" },
    { name: "Respondent side (cases)", value: 0, fill: "#475569" },
  ]);
  const [caseTable, setCaseTable] = useState<CaseRow[]>([]);
  const [visibleCaseCount, setVisibleCaseCount] = useState(20);
  const [aiPromoterText, setAiPromoterText] = useState<string>(
    "Portfolio split unavailable until chart columns are refreshed (run master or table analysis)."
  );
  const [benchTrackRecordText, setBenchTrackRecordText] = useState<string>(
    "Bench track record unavailable due to insufficient judge-level history."
  );
  const [verifiedDataText, setVerifiedDataText] = useState<string>(
    "Data source: lawyer_analytics and lawyer_judge_analytics."
  );
  const [hearingRiskText, setHearingRiskText] = useState<string>(
    "Hearing intensity derived from precomputed hearing buckets in lawyer_analytics."
  );
  const [hearingVelocityData, setHearingVelocityData] = useState<Array<{ bucket: string; cases: number }>>([]);
  const [topOpponentsData, setTopOpponentsData] = useState<Array<{ name: string; cases: number; winRate: number; lossRate: number; settlementRate: number }>>([]);
  const [topOpponentLawyersCases, setTopOpponentLawyersCases] = useState<Array<{ name: string; cases: number; winRate: number; lossRate: number; settlementRate: number }>>([]);
  const [topJudgesCases, setTopJudgesCases] = useState<Array<{ name: string; cases: number; winRate: number; lossRate: number; settlementRate: number }>>([]);
  const [settlementRatesData, setSettlementRatesData] = useState<
    Array<{ label: string; pct: number; n: number; kind?: string | null }>
  >([]);

  const isAutoImportEmail = (email: string | null) => {
    const e = (email ?? "").toLowerCase().trim();
    return !e ? false : e.startsWith("import+") || e.endsWith("@judge-my-lawyer.local") || e.includes("@judge-my-lawyer.local");
  };

  const normalizePersonName = (value: string | null | undefined) =>
    String(value ?? "")
      .toLowerCase()
      .replace(/[\u2018\u2019\u201C\u201D]/g, "'")
      .replace(/\([^)]*\)/g, " ")
      .replace(/\b(for\s+complainant|for\s+respondent|present\s+for\s+complainant|present\s+for\s+respondent)\b/g, " ")
      .replace(/\b(adv\.?|advocate|ld\.?|mr\.?|mrs\.?|ms\.?|shri|smt|dr\.?|prof\.?|c\.?a\.?)\b/g, " ")
      .replace(/[.,/\\|:;~`"!@#$%^&*_+=\-]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();

  const buildSelfRepresentedLawyerName = (
    courtName: string | null | undefined,
    side: "Complainant" | "Respondent"
  ) => `${String(courtName ?? "").trim() || "Unknown Court"} ${side} without a lawyer`;

  const firstNonEmpty = (values: Array<string | null | undefined>) => {
    for (const value of values) {
      const v = String(value ?? "").trim();
      if (v) return v;
    }
    return null;
  };

  const uniqueNonEmpty = (values: Array<string | null | undefined>) => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const value of values) {
      const v = String(value ?? "").trim();
      if (!v) continue;
      const key = normalizePersonName(v);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      out.push(v);
    }
    return out;
  };

  useEffect(() => {
    let mounted = true;
    setVisibleCaseCount(20);
    (async () => {
      try {
        const supabase = getSupabase();
        const analyticsSelect = `${CORE_LAWYER_ANALYTICS_SELECT},${LAWYER_ANALYTICS_CHART_SELECT}`;
        const [lawyerRes, judgePerfRes, analyticsRes] = await Promise.all([
          supabase
            .from("lawyers")
            .select("id,name,email,phone,bio,courts,specialization,is_verified")
            .eq("id", lawyerId)
            .maybeSingle(),
          supabase
            .from("lawyer_judge_analytics")
            .select("judge_id,judge_name,total_cases,won_cases,lost_cases,settled_cases,win_rate")
            .eq("lawyer_id", lawyerId)
            .order("total_cases", { ascending: false })
            .limit(10),
          supabase.from("lawyer_analytics").select(analyticsSelect).eq("lawyer_id", lawyerId).maybeSingle(),
        ]);
        if (mounted) setLawyer((lawyerRes.data as LawyerRow | null) ?? null);
        const judgePerfRows = (judgePerfRes.data ?? []) as LawyerJudgeAnalyticsRow[];
        if (mounted) setJudgePerformance(judgePerfRows);

        let a = (analyticsRes.data as LawyerAnalyticsRow | null) ?? null;
        if (!a) {
          const lawyerName = ((lawyerRes.data as LawyerRow | null)?.name ?? "").trim();
          if (lawyerName) {
            const { data: byName } = await supabase.from("lawyer_analytics").select(analyticsSelect).ilike("lawyer_name", lawyerName).maybeSingle();
            a = (byName as LawyerAnalyticsRow | null) ?? null;
          }
        }
        if (mounted) setAnalytics(a);

        const charts = buildLawyerDashboardCharts(a ?? undefined);
        if (mounted) {
          setClientRepresentationData(charts.clientRepresentationData);
          setHearingVelocityData(charts.hearingVelocityData);
          setTopOpponentsData(charts.topOpponentsData);
          setTopOpponentLawyersCases(charts.topOpponentLawyersCases);
          setTopJudgesCases(charts.topJudgesCases);
          setSettlementRatesData(charts.settlementRatesData);

          const rc = charts.clientRepresentationData[0]?.value ?? 0;
          const rr = charts.clientRepresentationData[1]?.value ?? 0;
          const totalTagged = rc + rr;
          const complainantPct = totalTagged > 0 ? Math.round((rc * 100) / totalTagged) : 0;
          setAiPromoterText(
            totalTagged > 0
              ? `Portfolio split: ${complainantPct}% of side-tagged appearances on the complainant (petitioner) side (${rc} cases) versus ${100 - complainantPct}% on the respondent side (${rr} cases).`
              : "Portfolio split unavailable until chart columns are populated (admin refresh)."
          );

          const topJudge = judgePerfRows[0];
          if (topJudge && (topJudge.total_cases ?? 0) > 0) {
            const judgeWinRate = Math.round(((topJudge.won_cases ?? 0) * 1000) / Math.max(1, topJudge.total_cases)) / 10;
            setBenchTrackRecordText(
              `Bench Track Record: ${judgeWinRate}% wins (${topJudge.won_cases}/${topJudge.total_cases} cases) before ${topJudge.judge_name}.`
            );
          } else {
            setBenchTrackRecordText("Bench track record unavailable due to insufficient judge-level history.");
          }

          setVerifiedDataText(
            `Data source: ${a?.total_cases ?? 0} cases aggregated in lawyer_analytics; charts use precomputed chart_* columns.`
          );

          const bh =
            charts.hearingVelocityData.reduce((s, r) => s + (r.cases ?? 0), 0);
          if (bh > 0) {
            setHearingRiskText(
              `Hearing buckets: ${charts.hearingVelocityData.map((r) => `${r.bucket}: ${r.cases}`).join(", ")} matters with hearing counts.`
            );
          } else {
            setHearingRiskText("No hearing-bucket data in analytics (missing total_hearings on matched cases).");
          }
        }

        const lawyerName = (((lawyerRes.data as LawyerRow | null)?.name ?? "") as string).trim();
        if (lawyerName) {
          const selectCols = [
            "case_number",
            "case_title",
            "court_name",
            "outcome",
            "judge_1","judge_2","judge_3","judge_4","judge_5","judge_6","judge_7","judge_8","judge_9",
            "petitioner_lawyer_1","petitioner_lawyer_2","petitioner_lawyer_3","petitioner_lawyer_4","petitioner_lawyer_5",
            "respondent_lawyer_1","respondent_lawyer_2","respondent_lawyer_3","respondent_lawyer_4","respondent_lawyer_5",
            "updated_at",
          ].join(",");
          const canonicalLawyerName = normalizePersonName(lawyerName);

          const allCaseRows: Record<string, unknown>[] = [];
          const pageSize = 1000;
          let from = 0;
          while (true) {
            const { data, error } = await supabase
              .from("cases_analytics")
              .select(selectCols)
              .order("updated_at", { ascending: false })
              .range(from, from + pageSize - 1);
            if (error) throw error;
            const chunk = (data ?? []) as Record<string, unknown>[];
            allCaseRows.push(...chunk);
            if (chunk.length < pageSize) break;
            from += pageSize;
          }

          const tableRows = allCaseRows.flatMap((r) => {
            const pLawyers = [
              r.petitioner_lawyer_1,
              r.petitioner_lawyer_2,
              r.petitioner_lawyer_3,
              r.petitioner_lawyer_4,
              r.petitioner_lawyer_5,
            ].filter(Boolean) as string[];
            const resLawyers = [
              r.respondent_lawyer_1,
              r.respondent_lawyer_2,
              r.respondent_lawyer_3,
              r.respondent_lawyer_4,
              r.respondent_lawyer_5,
            ].filter(Boolean) as string[];

            const petitionerList = pLawyers.length > 0
              ? pLawyers
              : [buildSelfRepresentedLawyerName(r.court_name as string | null, "Complainant")];
            const respondentList = resLawyers.length > 0
              ? resLawyers
              : [buildSelfRepresentedLawyerName(r.court_name as string | null, "Respondent")];

            const appearsPetitioner = petitionerList.some((name) => normalizePersonName(name) === canonicalLawyerName);
            const appearsRespondent = respondentList.some((name) => normalizePersonName(name) === canonicalLawyerName);
            if (!appearsPetitioner && !appearsRespondent) return [];

            const opponents = uniqueNonEmpty([
              ...(appearsPetitioner ? respondentList : []),
              ...(appearsRespondent ? petitionerList : []),
            ]);

            return [{
              case_number: String(r.case_number ?? ""),
              case_title: (r.case_title ?? null) as string | null,
              judge_name: firstNonEmpty([
                r.judge_1 as string | null,
                r.judge_2 as string | null,
                r.judge_3 as string | null,
                r.judge_4 as string | null,
                r.judge_5 as string | null,
                r.judge_6 as string | null,
                r.judge_7 as string | null,
                r.judge_8 as string | null,
                r.judge_9 as string | null,
              ]),
              opponent_lawyer: opponents.length > 0 ? opponents.join(", ") : null,
              outcome: (r.outcome ?? null) as string | null,
            } satisfies CaseRow];
          });

          if (mounted) setCaseTable(tableRows);
        } else if (mounted) setCaseTable([]);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [lawyerId]);

  return (
    <div className="max-w-7xl mx-auto px-4 lg:px-8 bg-slate-50">
      {loading && <p className="text-gray-600">Loading lawyer...</p>}

      {!loading && !lawyer && (
        <div className="rounded-lg border bg-white p-6 text-gray-600">Lawyer not found.</div>
      )}

      {!!lawyer && (
        <div className="pt-2 pb-8">
          {/* Top segment only: split half-half */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start border-b border-slate-300 pb-6 mb-8">
            <div className="col-span-12 lg:col-span-6">
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <button onClick={onBack} className="mb-1 flex items-center gap-2 text-sm font-medium text-slate-700">
                    <ArrowLeft className="h-4 w-4" /> Back
                  </button>
                  <h1 className="font-serif text-3xl text-slate-900">{lawyer.name ?? "Unnamed Lawyer"}</h1>
                  <div className="text-sm text-slate-700">
                    {(() => {
                      const safeEmail = lawyer.email && !isAutoImportEmail(lawyer.email) ? lawyer.email : null;
                      const safePhone = lawyer.phone?.trim() ? lawyer.phone.trim() : null;
                      if (!safeEmail && !safePhone) return "Contact Details: Unavailable";
                      const parts = [safePhone, safeEmail].filter(Boolean);
                      return `Contact Details: ${parts.join(" • ")}`;
                    })()}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-sm border border-[#10b981]/20 bg-gradient-to-br from-[#ecfdf5] to-[#d1fae5] p-3 text-slate-800">
                    <div className="text-xs font-bold tracking-wide text-[#065f46] uppercase">Win</div>
                    <div className="mt-1 text-xl font-semibold text-[#047857]">
                      {(() => {
                        const w = analytics?.won_cases ?? 0;
                        const l = analytics?.lost_cases ?? 0;
                        const s = analytics?.settled_cases ?? 0;
                        const base = w + l + s;
                        const pct = base > 0 ? (w * 100) / base : 0;
                        return pct.toFixed(1);
                      })()}
                      %
                    </div>
                  </div>
                  <div className="rounded-sm border border-[#dc2626]/20 bg-gradient-to-br from-[#fef2f2] to-[#fee2e2] p-3 text-slate-800">
                    <div className="text-xs font-bold tracking-wide text-[#991b1b] uppercase">Loss</div>
                    <div className="mt-1 text-xl font-semibold text-[#b91c1c]">
                      {(() => {
                        const w = analytics?.won_cases ?? 0;
                        const l = analytics?.lost_cases ?? 0;
                        const s = analytics?.settled_cases ?? 0;
                        const base = w + l + s;
                        const pct = base > 0 ? (l * 100) / base : 0;
                        return pct.toFixed(1);
                      })()}
                      %
                    </div>
                  </div>
                  <div className="rounded-sm border border-[#d97706]/20 bg-gradient-to-br from-[#fef3c7] to-[#fde68a] p-3 text-slate-800">
                    <div className="text-xs font-bold tracking-wide text-[#78350f] uppercase">Settlement</div>
                    <div className="mt-1 text-xl font-semibold text-[#92400e]">
                      {(() => {
                        const w = analytics?.won_cases ?? 0;
                        const l = analytics?.lost_cases ?? 0;
                        const s = analytics?.settled_cases ?? 0;
                        const base = w + l + s;
                        const pct = base > 0 ? (s * 100) / base : 0;
                        return pct.toFixed(1);
                      })()}
                      %
                    </div>
                  </div>
                  <div className="rounded-sm border border-[#e0e3e7] bg-[#f0f2f5] p-3 text-slate-800">
                    <div className="text-xs font-bold tracking-wide text-[#5f6368] uppercase">Avg Duration</div>
                    <div className="mt-1 text-xl font-semibold text-[#1a2332]">{Math.round(analytics?.avg_case_duration_days ?? 0)}d</div>
                  </div>
                </div>
              </div>
            </div>
            <div className="col-span-12 lg:col-span-6">
              <TrustRiskMatrix
                benchTrackRecordText={benchTrackRecordText}
                verifiedDataText={verifiedDataText}
                highAdjournmentText={hearingRiskText}
                promoterHeavyText={aiPromoterText}
              />
            </div>
          </div>

          {/* Below top segment: full-width content */}
          <div>
            <h2 className="font-serif text-2xl text-slate-900 border-b border-slate-200 pb-2 mb-6">Historical Case Analytics</h2>
            <AnalyticsDashboard
              caseBase={analytics?.total_cases ?? 0}
              clientRepresentationData={clientRepresentationData}
                hearingVelocityData={hearingVelocityData}
                topOpponentsData={topOpponentsData}
              topOpponentLawyersCases={topOpponentLawyersCases}
              topJudgesCases={topJudgesCases}
              settlementRatesData={settlementRatesData}
            />
          </div>

        {/* Detailed Case Records */}
        <div className="mt-10">
          <div className="bg-[#1a2332] text-white rounded-t-xl px-4 py-3 font-semibold">DETAILED CASE RECORDS</div>
          <div className="bg-white border border-[#e0e3e7] rounded-b-xl p-0 overflow-x-auto">
            <div className="px-4 py-3 text-xs text-slate-600 border-b border-[#eef2f7]">
              Source proof: complete list from cases_analytics matched by canonical lawyer-name mapping.
            </div>
            <table className="min-w-full text-sm">
              <thead className="bg-[#f8fafc] text-[#1a2332]">
                <tr>
                  <th className="px-4 py-2 text-left">Case name</th>
                  <th className="px-4 py-2 text-left">Judge</th>
                  <th className="px-4 py-2 text-left">Opponent lawyer</th>
                  <th className="px-4 py-2 text-left">Outcome</th>
                </tr>
              </thead>
              <tbody>
                {caseTable.slice(0, visibleCaseCount).map((c) => {
                    const o = (c.outcome ?? "").toLowerCase();
                    const pill = o.includes("settled")
                      ? "bg-amber-50 text-amber-700 border border-amber-200"
                      : o.includes("in favor of complainant") || o.includes("complainant")
                        ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                        : o.includes("in favor of respondent") || o.includes("respondent")
                          ? "bg-rose-50 text-rose-700 border border-rose-200"
                          : "bg-slate-50 text-slate-700 border border-slate-200";
                  return (
                    <tr key={c.case_number} className="border-t border-[#eef2f7]">
                      <td className="px-4 py-2">{c.case_title?.trim() || c.case_number}</td>
                      <td className="px-4 py-2">{c.judge_name ?? "—"}</td>
                      <td className="px-4 py-2">{c.opponent_lawyer ?? "—"}</td>
                      <td className="px-4 py-2">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${pill}`}>
                            {c.outcome ?? "Pending"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
                {caseTable.length === 0 && (
                  <tr>
                      <td className="px-4 py-4 text-[#5f6368]" colSpan={4}>
                        No case records found for this lawyer.
                      </td>
                  </tr>
                )}
              </tbody>
            </table>
            {caseTable.length > visibleCaseCount && (
              <div className="p-4 border-t border-[#eef2f7]">
                <button
                  onClick={() => setVisibleCaseCount((v) => v + 20)}
                  className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50"
                >
                  Show more
                </button>
              </div>
            )}
          </div>
        </div>
        </div>
      )}
    </div>
  );
}
