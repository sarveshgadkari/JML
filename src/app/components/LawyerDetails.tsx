import React, { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import getSupabase from "../../utils/supabase/client";
import TrustRiskMatrix from "./TrustRiskMatrix";
import AnalyticsDashboard from "./AnalyticsDashboard";

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
};

type CaseRow = {
  case_number: string;
  case_type: string | null;
  court_name: string | null;
  filing_date: string | null;
  judgment_date: string | null;
  outcome: string | null;
};

export default function LawyerDetails({ lawyerId, onBack }: Props) {
  const [loading, setLoading] = useState(true);
  const [lawyer, setLawyer] = useState<LawyerRow | null>(null);
  const [judgePerformance, setJudgePerformance] = useState<LawyerJudgeAnalyticsRow[]>([]);
  const [analytics, setAnalytics] = useState<LawyerAnalyticsRow | null>(null);
  const [opponentLawyers, setOpponentLawyers] = useState<Array<{ name: string; cases: number; won: number; lost: number; settled: number }>>([]);
  const [topJudges, setTopJudges] = useState<Array<{ name: string; cases: number; won: number; lost: number; settled: number }>>([]);
  const [clientRepresentationData, setClientRepresentationData] = useState<Array<{ name: string; value: number; fill: string }>>([
    { name: "Homebuyers", value: 0, fill: "#166534" },
    { name: "Builders", value: 0, fill: "#475569" },
  ]);
  const [caseTable, setCaseTable] = useState<CaseRow[]>([]);
  const [aiPromoterText, setAiPromoterText] = useState<string>(
    "Portfolio split unavailable due to limited side-tagged records."
  );
  const [benchTrackRecordText, setBenchTrackRecordText] = useState<string>(
    "Bench track record unavailable due to insufficient judge-level history."
  );
  const [verifiedDataText, setVerifiedDataText] = useState<string>(
    "Data source: Master cases table and computed analytics."
  );
  const [hearingRiskText, setHearingRiskText] = useState<string>(
    "Hearing intensity unavailable due to missing hearing-count data."
  );
  const [hearingVelocityData, setHearingVelocityData] = useState<Array<{ bucket: string; cases: number }>>([]);
  const [topOpponentsData, setTopOpponentsData] = useState<Array<{ name: string; cases: number; winRate: number }>>([]);
  const [reraResolutionData, setReraResolutionData] = useState<
    Array<{ year: string; refund: number; possession: number; conciliation: number; dismissed: number }>
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

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const supabase = getSupabase();
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
          supabase
            .from("lawyer_analytics")
            .select("lawyer_id,lawyer_name,total_cases,won_cases,lost_cases,settled_cases,dismissed_cases,withdrawn_cases,partially_granted_cases,win_rate,loss_rate,settlement_rate,avg_case_duration_days")
            .eq("lawyer_id", lawyerId)
            .maybeSingle(),
        ]);
        if (mounted) setLawyer((lawyerRes.data as LawyerRow | null) ?? null);
        if (mounted) setJudgePerformance((judgePerfRes.data ?? []) as LawyerJudgeAnalyticsRow[]);

        let a = (analyticsRes.data as LawyerAnalyticsRow | null) ?? null;
        // Fallback: if analytics row is missing (common after merges/resets), try matching by lawyer_name.
        if (!a) {
          const lawyerName = ((lawyerRes.data as LawyerRow | null)?.name ?? "").trim();
          if (lawyerName) {
            const { data: byName } = await supabase
              .from("lawyer_analytics")
              .select("lawyer_id,lawyer_name,total_cases,won_cases,lost_cases,settled_cases,dismissed_cases,withdrawn_cases,partially_granted_cases,win_rate,loss_rate,settlement_rate,avg_case_duration_days")
              .ilike("lawyer_name", lawyerName)
              .maybeSingle();
            a = (byName as LawyerAnalyticsRow | null) ?? null;
          }
        }
        if (mounted) setAnalytics(a);

        // Build opponent datasets from master `cases` (client-side, pilot-safe volume).
        const lawyerName = (((lawyerRes.data as LawyerRow | null)?.name ?? "") as string).trim();
        if (lawyerName) {
          const normalizeOutcome = (outcome: string | null, status: string | null) => {
            const s = `${outcome ?? ""} ${status ?? ""}`.toLowerCase();
            if (!s.trim()) return null;
            if (s.includes("settled") || s.includes("conciliation")) return "settled" as const;
            if (s.includes("in favor of complainant") || s.includes("in favour of complainant") || s.includes("in favor of petitioner")) return "petitioner" as const;
            if (s.includes("in favor of respondent") || s.includes("in favour of respondent")) return "respondent" as const;
            return null;
          };

          const selectCols =
            "case_number,case_type,court_name,filing_date,judgment_date,outcome,status," +
            "petitioner_name,respondent_name,total_hearings," +
            "petitioner_lawyer_1,petitioner_lawyer_2,petitioner_lawyer_3,petitioner_lawyer_4,petitioner_lawyer_5," +
            "respondent_lawyer_1,respondent_lawyer_2,respondent_lawyer_3,respondent_lawyer_4,respondent_lawyer_5," +
            "judge_1,judge_2,judge_3,judge_4,judge_5,judge_6,judge_7,judge_8,judge_9";
          const canonicalLawyerName = normalizePersonName(lawyerName);
          const { data: allCaseRows } = await supabase
            .from("cases")
            .select(selectCols)
            .limit(40000);

          const caseRows = (allCaseRows ?? []).filter((r: any) => {
            const pLawyers = [
              r.petitioner_lawyer_1,
              r.petitioner_lawyer_2,
              r.petitioner_lawyer_3,
              r.petitioner_lawyer_4,
              r.petitioner_lawyer_5,
            ];
            const rLawyers = [
              r.respondent_lawyer_1,
              r.respondent_lawyer_2,
              r.respondent_lawyer_3,
              r.respondent_lawyer_4,
              r.respondent_lawyer_5,
            ];
            const petitionerVirtualName = buildSelfRepresentedLawyerName(r.court_name, "Complainant");
            const respondentVirtualName = buildSelfRepresentedLawyerName(r.court_name, "Respondent");
            const hasPetitionerLawyer = pLawyers.some(Boolean);
            const hasRespondentLawyer = rLawyers.some(Boolean);
            return [...pLawyers, ...rLawyers].some(
              (name) => normalizePersonName(name) === canonicalLawyerName
            )
              || (!hasPetitionerLawyer && normalizePersonName(petitionerVirtualName) === canonicalLawyerName)
              || (!hasRespondentLawyer && normalizePersonName(respondentVirtualName) === canonicalLawyerName);
          });

          const oppMap = new Map<string, { name: string; cases: number; won: number; lost: number; settled: number }>();
          const judgeMap = new Map<string, { name: string; cases: number; won: number; lost: number; settled: number }>();
          const oppPartyMap = new Map<string, { name: string; cases: number; wins: number; losses: number }>();
          let petitionerAppearances = 0;
          let respondentAppearances = 0;
          let hearingsSum = 0;
          let hearingsCount = 0;

          const hearingBuckets = new Map<string, number>([
            ["1-5", 0],
            ["6-10", 0],
            ["11-15", 0],
            ["16+", 0],
          ]);

          const resolutionYears = ["2024", "2025", "2026"];
          const resolutionMap = new Map<
            string,
            { year: string; refund: number; possession: number; conciliation: number; dismissed: number }
          >();
          resolutionYears.forEach((y) => {
            resolutionMap.set(y, { year: y, refund: 0, possession: 0, conciliation: 0, dismissed: 0 });
          });

          for (const r of (caseRows ?? []) as any[]) {
            const pLawyers = [r.petitioner_lawyer_1, r.petitioner_lawyer_2, r.petitioner_lawyer_3, r.petitioner_lawyer_4, r.petitioner_lawyer_5].filter(Boolean);
            const rLawyers = [r.respondent_lawyer_1, r.respondent_lawyer_2, r.respondent_lawyer_3, r.respondent_lawyer_4, r.respondent_lawyer_5].filter(Boolean);
            const judges = [r.judge_1, r.judge_2, r.judge_3, r.judge_4, r.judge_5, r.judge_6, r.judge_7, r.judge_8, r.judge_9].filter(Boolean);

            const petitionerVirtualName = buildSelfRepresentedLawyerName(r.court_name, "Complainant");
            const respondentVirtualName = buildSelfRepresentedLawyerName(r.court_name, "Respondent");
            const side: "petitioner" | "respondent" | null =
              pLawyers.some((name) => normalizePersonName(name) === canonicalLawyerName)
                || (!pLawyers.length && normalizePersonName(petitionerVirtualName) === canonicalLawyerName)
                ? "petitioner"
                : rLawyers.some((name) => normalizePersonName(name) === canonicalLawyerName)
                    || (!rLawyers.length && normalizePersonName(respondentVirtualName) === canonicalLawyerName)
                  ? "respondent"
                  : null;
            if (side === "petitioner") petitionerAppearances += 1;
            if (side === "respondent") respondentAppearances += 1;

            const norm = normalizeOutcome(r.outcome ?? null, r.status ?? null);
            const isWin = norm === (side === "petitioner" ? "petitioner" : side === "respondent" ? "respondent" : "none");
            const isLoss = norm && side && !isWin && norm !== "settled";
            const isSettled = norm === "settled";

            // Hearing velocity buckets (Tareekh anxiety)
            const hearings = Number(r.total_hearings ?? 0);
            if (side && hearings > 0) {
              const bucket =
                hearings <= 5 ? "1-5" : hearings <= 10 ? "6-10" : hearings <= 15 ? "11-15" : "16+";
              hearingBuckets.set(bucket, (hearingBuckets.get(bucket) ?? 0) + 1);
              hearingsSum += hearings;
              hearingsCount += 1;
            }

            // Resolution matrix (Refund vs Possession vs Settled vs Dismissed) by judgment year
            const statusLower = `${r.status ?? ""}`.toLowerCase();
            const jdYear = r.judgment_date ? new Date(r.judgment_date).getFullYear() : null;
            const yearKey = jdYear ? String(jdYear) : null;
            if (yearKey && resolutionMap.has(yearKey)) {
              if (norm === "petitioner") {
                resolutionMap.get(yearKey)!.refund += 1;
              } else if (norm === "respondent") {
                resolutionMap.get(yearKey)!.possession += 1;
              } else if (norm === "settled") {
                resolutionMap.get(yearKey)!.conciliation += 1;
              } else {
                const looksDismissed = statusLower.includes("dismiss") || statusLower.includes("rejected") || statusLower.includes("complaint rejected");
                if (looksDismissed) resolutionMap.get(yearKey)!.dismissed += 1;
              }
            }

            // Top opponents (builder/respondent) + win rate for this lawyer vs that opponent
            const oppPartyName =
              side === "petitioner" ? String(r.respondent_name ?? "").trim() : side === "respondent" ? String(r.petitioner_name ?? "").trim() : "";
            if (side && oppPartyName) {
              const cur = oppPartyMap.get(oppPartyName) ?? { name: oppPartyName, cases: 0, wins: 0, losses: 0 };
              cur.cases += 1;
              if (isWin) cur.wins += 1;
              else if (isLoss) cur.losses += 1;
              oppPartyMap.set(oppPartyName, cur);
            }

            // Opponent lawyers
            const opponents = side === "petitioner"
              ? (rLawyers.length ? rLawyers : [buildSelfRepresentedLawyerName(r.court_name, "Respondent")])
              : side === "respondent"
                ? (pLawyers.length ? pLawyers : [buildSelfRepresentedLawyerName(r.court_name, "Complainant")])
                : [];
            for (const o of opponents) {
              const name = String(o).trim();
              if (!name) continue;
              const cur = oppMap.get(name) ?? { name, cases: 0, won: 0, lost: 0, settled: 0 };
              cur.cases += 1;
              if (isSettled) cur.settled += 1;
              else if (isWin) cur.won += 1;
              else if (isLoss) cur.lost += 1;
              oppMap.set(name, cur);
            }

            // Judges
            for (const j of judges) {
              const name = String(j).trim();
              if (!name) continue;
              const cur = judgeMap.get(name) ?? { name, cases: 0, won: 0, lost: 0, settled: 0 };
              cur.cases += 1;
              if (isSettled) cur.settled += 1;
              else if (isWin) cur.won += 1;
              else if (isLoss) cur.lost += 1;
              judgeMap.set(name, cur);
            }
          }

          const topOpp = Array.from(oppMap.values()).sort((a, b) => b.cases - a.cases).slice(0, 5);
          const topJ = Array.from(judgeMap.values()).sort((a, b) => b.cases - a.cases).slice(0, 5);
          const hearingRows = ["1-5", "6-10", "11-15", "16+"].map((b) => ({ bucket: b, cases: hearingBuckets.get(b) ?? 0 }));
          const matrixRows = resolutionYears.map((y) => resolutionMap.get(y) ?? { year: y, refund: 0, possession: 0, conciliation: 0, dismissed: 0 });
          const partyRows = Array.from(oppPartyMap.values())
            .map((x) => {
              const denom = x.wins + x.losses;
              const winRate = denom > 0 ? (x.wins * 100) / denom : 0;
              return { name: x.name, cases: x.cases, winRate: Math.round(winRate * 10) / 10 };
            })
            .sort((a, b) => b.cases - a.cases)
            .slice(0, 5);
          const tableRows = (caseRows ?? []).map((r: any) => ({
            case_number: r.case_number,
            case_type: r.case_type ?? null,
            court_name: r.court_name ?? null,
            filing_date: r.filing_date ?? null,
            judgment_date: r.judgment_date ?? null,
            outcome: r.outcome ?? null,
          }));
          const totalTagged = petitionerAppearances + respondentAppearances;
          const homebuyerPct = totalTagged > 0 ? Math.round((petitionerAppearances * 100) / totalTagged) : 0;
          const builderPct = totalTagged > 0 ? Math.round((respondentAppearances * 100) / totalTagged) : 0;

          if (mounted) setOpponentLawyers(topOpp);
          if (mounted) setTopJudges(topJ);
          if (mounted) setHearingVelocityData(hearingRows);
          if (mounted) setReraResolutionData(matrixRows);
          if (mounted) setTopOpponentsData(partyRows);
          if (mounted) setCaseTable(tableRows.slice(0, 300));
          if (mounted) {
            const topJudge = topJ[0];
            if (topJudge && (topJudge.cases ?? 0) > 0) {
              const judgeWinRate = Math.round((topJudge.won * 1000) / Math.max(1, topJudge.cases)) / 10;
              setBenchTrackRecordText(
                `Bench Track Record: ${judgeWinRate}% wins (${topJudge.won}/${topJudge.cases} cases) before ${topJudge.name}.`
              );
            } else {
              setBenchTrackRecordText("Bench track record unavailable due to insufficient judge-level history.");
            }

            setVerifiedDataText(
              `Data source: ${analytics?.total_cases ?? 0} analyzed cases from master records and analytics tables.`
            );

            if (hearingsCount > 0) {
              const avgHearings = Math.round((hearingsSum / hearingsCount) * 10) / 10;
              setHearingRiskText(
                `Hearing Intensity: Average ${avgHearings} hearings per case across ${hearingsCount} tracked matters.`
              );
            } else {
              setHearingRiskText("Hearing intensity unavailable due to missing hearing-count data.");
            }

            setClientRepresentationData([
              { name: "Homebuyers", value: homebuyerPct, fill: "#166534" },
              { name: "Builders", value: builderPct, fill: "#475569" },
            ]);
            setAiPromoterText(
              `Portfolio split: ${builderPct}% appearances defending builders/promoters versus ${homebuyerPct}% representing homebuyers.`
            );
          }
        } else {
          if (mounted) setOpponentLawyers([]);
          if (mounted) setTopJudges([]);
        if (mounted) setHearingVelocityData([]);
        if (mounted) setReraResolutionData([]);
        if (mounted) setTopOpponentsData([]);
          if (mounted) {
          setBenchTrackRecordText("Bench track record unavailable due to insufficient judge-level history.");
          setVerifiedDataText("Data source: Master cases table and computed analytics.");
          setHearingRiskText("Hearing intensity unavailable due to missing hearing-count data.");
            setClientRepresentationData([
              { name: "Homebuyers", value: 0, fill: "#166534" },
              { name: "Builders", value: 0, fill: "#475569" },
            ]);
            setAiPromoterText("Portfolio split unavailable due to limited side-tagged records.");
          }
        }
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
                      })()}%
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
                      })()}%
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
                      })()}%
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
            <h2 className="font-serif text-2xl text-slate-900 border-b border-slate-200 pb-2 mb-6">
              Historical Case Analytics
            </h2>
            <AnalyticsDashboard
              caseBase={analytics?.total_cases ?? 0}
              topOpponentLawyers={opponentLawyers}
              topJudges={topJudges}
              clientRepresentationData={clientRepresentationData}
                hearingVelocityData={hearingVelocityData}
                topOpponentsData={topOpponentsData}
                reraResolutionData={reraResolutionData}
            />
          </div>

        {/* Detailed Case Records */}
        <div className="mt-10">
          <div className="bg-[#1a2332] text-white rounded-t-xl px-4 py-3 font-semibold">DETAILED CASE RECORDS</div>
          <div className="bg-white border border-[#e0e3e7] rounded-b-xl p-0 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-[#f8fafc] text-[#1a2332]">
                <tr>
                  <th className="px-4 py-2 text-left">Case Number</th>
                  <th className="px-4 py-2 text-left">Type</th>
                  <th className="px-4 py-2 text-left">Court</th>
                  <th className="px-4 py-2 text-left">Filing Date</th>
                  <th className="px-4 py-2 text-left">Judgment Date</th>
                  <th className="px-4 py-2 text-left">Outcome</th>
                </tr>
              </thead>
              <tbody>
                {caseTable.map((c) => {
                  const o = (c.outcome ?? '').toLowerCase();
                  const pill =
                    o.includes('settled')
                      ? 'bg-amber-50 text-amber-700 border border-amber-200'
                      : o.includes('in favor of complainant') || o.includes('complainant')
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : o.includes('in favor of respondent') || o.includes('respondent')
                      ? 'bg-rose-50 text-rose-700 border border-rose-200'
                      : 'bg-slate-50 text-slate-700 border border-slate-200';
                  return (
                    <tr key={c.case_number} className="border-t border-[#eef2f7]">
                      <td className="px-4 py-2">{c.case_number}</td>
                      <td className="px-4 py-2">{c.case_type ?? '—'}</td>
                      <td className="px-4 py-2">{c.court_name ?? '—'}</td>
                      <td className="px-4 py-2">{c.filing_date ?? '—'}</td>
                      <td className="px-4 py-2">{c.judgment_date ?? '—'}</td>
                      <td className="px-4 py-2">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${pill}`}>
                          {c.outcome ?? 'Pending'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
                {caseTable.length === 0 && (
                  <tr>
                    <td className="px-4 py-4 text-[#5f6368]" colSpan={6}>No case records found for this lawyer.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
        </div>
      )}
    </div>
  );
}
