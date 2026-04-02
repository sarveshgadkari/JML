import React from "react";
import getSupabase from "../../utils/supabase/client";
import { Landmark, CheckCircle, AlertOctagon, Flag } from "lucide-react";
import AnalyticsDashboard from "./AnalyticsDashboard";

export default function JudgeDetails({ judgeId }: { judgeId: string }) {
  const [judge, setJudge] = React.useState<{ name: string; city?: string; years?: number } | null>(null);
  const [metrics, setMetrics] = React.useState<{ favorComplainant: number; favorRespondent: number; settlementRate: number; avgDays: number }>({
    favorComplainant: 0,
    favorRespondent: 0,
    settlementRate: 0,
    avgDays: 0,
  });
  type CaseRow = {
    case_number: string;
    case_title: string | null;
    judge_1?: string | null;
    judge_2?: string | null;
    judge_3?: string | null;
    judge_4?: string | null;
    judge_5?: string | null;
    judge_6?: string | null;
    judge_7?: string | null;
    judge_8?: string | null;
    judge_9?: string | null;
    filing_date?: string | null;
    judgment_date?: string | null;
    status?: string | null;
    outcome?: string | null;
    petitioner_lawyer_1?: string | null;
    petitioner_lawyer_2?: string | null;
    petitioner_lawyer_3?: string | null;
    petitioner_lawyer_4?: string | null;
    petitioner_lawyer_5?: string | null;
    respondent_lawyer_1?: string | null;
    respondent_lawyer_2?: string | null;
    respondent_lawyer_3?: string | null;
    respondent_lawyer_4?: string | null;
    respondent_lawyer_5?: string | null;
    total_hearings?: number | null;
  };
  type JudgeAnalyticsRow = {
    judge_id: string;
    judge_name: string;
    total_cases: number;
    favor_complainant_cases: number | null;
    favor_respondent_cases: number | null;
    settled_cases: number | null;
    dismissed_cases: number | null;
    withdrawn_cases: number | null;
    partially_granted_cases: number | null;
    favor_complainant_rate: number | string | null;
    favor_respondent_rate: number | string | null;
    settlement_rate: number | string | null;
    avg_case_duration_days: number | string | null;
  } | null;
  type LjaRow = {
    lawyer_name: string | null;
    total_cases: number | null;
    won_cases: number | null;
    lost_cases: number | null;
    settled_cases: number | null;
    win_rate: number | string | null;
    avg_case_duration_days?: number | string | null;
  };

  const [caseBase, setCaseBase] = React.useState<CaseRow[]>([]);
  const [clientRepresentationData, setClientRepresentationData] = React.useState<Array<{ name: string; value: number; fill: string }>>([]);
  const [hearingVelocityData, setHearingVelocityData] = React.useState<Array<{ bucket: string; cases: number }>>([]);
  const [topOpponentsData, setTopOpponentsData] = React.useState<Array<{ name: string; cases: number; winRate: number }>>([]);
  const [reraResolutionData, setReraResolutionData] = React.useState<Array<{ year: string; refund: number; possession: number; conciliation: number; dismissed: number }>>([]);
  const [topOpponentLawyers, setTopOpponentLawyers] = React.useState<Array<{ name: string; cases: number; won: number; lost: number; settled: number }>>([]);
  const [respondentBars, setRespondentBars] = React.useState<Array<{ label: string; value: number }>>([]);
  const [avgDurationTopLawyers, setAvgDurationTopLawyers] = React.useState<Array<{ name: string; avgDays: number }>>([]);
  const [respondentOutcomeRows, setRespondentOutcomeRows] = React.useState<Array<{ name: string; cases: number; won: number; lost: number; settled: number }>>([]);
  const [bases, setBases] = React.useState<{ client?: number; hearings?: number; respondents?: number; duration?: number; opponents?: number }>({});
  const [courtAvg, setCourtAvg] = React.useState<{ favorComplainant: number; favorRespondent: number; settlementRate: number; avgDays: number; avgHearings: number }>({
    favorComplainant: 0,
    favorRespondent: 0,
    settlementRate: 0,
    avgDays: 0,
    avgHearings: 6,
  });

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

  React.useEffect(() => {
    (async () => {
      const supabase = getSupabase();
      // Load judge basic info
      const { data: jRaw } = await supabase.from("judges").select("name").eq("id", judgeId).maybeSingle();
      const j = (jRaw as { name: string } | null) ?? null;
      const judgeName = j?.name ?? "Unknown";
      setJudge({ name: judgeName, city: undefined, years: undefined });

      // Load judge analytics (authoritative hero metrics)
      const { data: jaRaw } = await supabase.from("judge_analytics").select("*").eq("judge_id", judgeId).maybeSingle();
      const ja = (jaRaw as JudgeAnalyticsRow) ?? null;

      // Load cases for analytics from master table using canonical name matching across judge_1..9.
      const canonicalJudgeName = normalizePersonName(judgeName);
      const { data: allCases } = await supabase
        .from("cases")
        .select([
          "case_number",
          "case_title",
          "case_type",
          "court_name",
          "judge_1","judge_2","judge_3","judge_4","judge_5","judge_6","judge_7","judge_8","judge_9",
          "filing_date","judgment_date","status","outcome",
          "petitioner_lawyer_1","petitioner_lawyer_2","petitioner_lawyer_3","petitioner_lawyer_4","petitioner_lawyer_5",
          "respondent_lawyer_1","respondent_lawyer_2","respondent_lawyer_3","respondent_lawyer_4","respondent_lawyer_5",
          "total_hearings"
        ].join(","))
        .limit(40000);
      const rows: CaseRow[] = ((allCases as CaseRow[] | null) ?? []).filter((row) => {
        const judges = [
          row.judge_1, row.judge_2, row.judge_3, row.judge_4, row.judge_5,
          row.judge_6, row.judge_7, row.judge_8, row.judge_9,
        ];
        return judges.some((name) => normalizePersonName(name) === canonicalJudgeName);
      });
      setCaseBase(rows);

      // Hero metrics from judge_analytics where available; otherwise fallback compute from cases (outcome-only base)
      if (ja) {
        setMetrics({
          favorComplainant: Math.round(Number(ja.favor_complainant_rate ?? 0)),
          favorRespondent: Math.round(Number(ja.favor_respondent_rate ?? 0)),
          settlementRate: Math.round(Number(ja.settlement_rate ?? 0)),
          avgDays: Math.round(Number(ja.avg_case_duration_days ?? 0)),
        });
      } else {
        const parseOutcome = (o: string | null | undefined) => {
          const s = (o ?? "").toLowerCase();
          if (/complainant/.test(s)) return "buyer";
          if (/respondent/.test(s)) return "builder";
          if (/settle|consent/.test(s)) return "settled";
          return "other";
        };
        const outcomeBase = rows.filter(r => parseOutcome(r.outcome) !== "other").length || 1;
        const favorComplainant = (rows.filter(r => parseOutcome(r.outcome) === "buyer").length / outcomeBase) * 100;
        const favorRespondent = (rows.filter(r => parseOutcome(r.outcome) === "builder").length / outcomeBase) * 100;
        const settlementRate = (rows.filter(r => /settle|consent/.test((r.outcome ?? "").toLowerCase())).length / Math.max(rows.length, 1)) * 100;
        const avgDays = (() => {
          let sum = 0, c = 0;
          rows.forEach(r => {
            if (r.filing_date && r.judgment_date) {
              const d = (new Date(r.judgment_date).getTime() - new Date(r.filing_date).getTime()) / 86400000;
              if (d >= 0 && Number.isFinite(d)) { sum += d; c += 1; }
            }
          });
          return c > 0 ? Math.round(sum / c) : 0;
        })();
        setMetrics({ favorComplainant: Math.round(favorComplainant), favorRespondent: Math.round(favorRespondent), settlementRate: Math.round(settlementRate), avgDays });
      }

      // Court-wide averages (weighted by cases for rates/duration; hearings from cases)
      const { data: jaAll } = await supabase
        .from("judge_analytics")
        .select("favor_complainant_rate,favor_respondent_rate,settlement_rate,avg_case_duration_days,total_cases");
      if (Array.isArray(jaAll) && jaAll.length > 0) {
        let wSum = 0, wc = 0, wr = 0, ws = 0, wd = 0;
        jaAll.forEach((r: any) => {
          const tc = Number(r.total_cases ?? 0);
          const fc = Number(r.favor_complainant_rate ?? 0);
          const fr = Number(r.favor_respondent_rate ?? 0);
          const sr = Number(r.settlement_rate ?? 0);
          const ad = Number(r.avg_case_duration_days ?? 0);
          wSum += tc;
          wc += fc * tc;
          wr += fr * tc;
          ws += sr * tc;
          wd += ad * tc;
        });
        const favorComplainant = wSum > 0 ? Math.round(wc / wSum) : 0;
        const favorRespondent = wSum > 0 ? Math.round(wr / wSum) : 0;
        const settlementRate = wSum > 0 ? Math.round(ws / wSum) : 0;
        const avgDays = wSum > 0 ? Math.round(wd / wSum) : 0;
        // avg hearings from cases (server-side aggregate)
        const { data: hv } = await supabase
          .from("cases")
          .select("avg:avg(total_hearings)")
          .gt("total_hearings", 0)
          .single();
        const avgHearings = Math.round(Number((hv as any)?.avg ?? 6));
        setCourtAvg({ favorComplainant, favorRespondent, settlementRate, avgDays, avgHearings });
      }

      // Build charts datasets
      // 1) Client Representation: complainant vs respondent relief split (use judge_analytics counts if present)
      if (ja) {
        const buyers = Number(ja.favor_complainant_cases ?? 0);
        const builders = Number(ja.favor_respondent_cases ?? 0);
        setClientRepresentationData([
          { name: "Homebuyers", value: buyers, fill: "#166534" },
          { name: "Builders", value: builders, fill: "#475569" },
        ]);
      } else {
        const buyers = rows.filter(r => (r.outcome ?? "").toLowerCase().includes("complainant")).length;
        const builders = rows.filter(r => (r.outcome ?? "").toLowerCase().includes("respondent")).length;
        const clientData = [
          { name: "Homebuyers", value: buyers, fill: "#166534" },
          { name: "Builders", value: builders, fill: "#475569" },
        ];
        setClientRepresentationData(clientData);
        setBases(prev => ({ ...prev, client: buyers + builders }));
      }

      // 2) Hearings per Case: bucket total_hearings into 1, 2-3, 4-5, 5+
      const buckets = { "1": 0, "2-3": 0, "4-5": 0, "5+": 0 } as Record<string, number>;
      let hearingsBase = 0;
      rows.forEach(r => {
        const h = Number(r.total_hearings ?? 0);
        if (!Number.isFinite(h) || h <= 0) return;
        hearingsBase += 1;
        if (h === 1) buckets["1"] += 1;
        else if (h <= 3) buckets["2-3"] += 1;
        else if (h <= 5) buckets["4-5"] += 1;
        else buckets["5+"] += 1;
      });
      setHearingVelocityData([
        { bucket: "1", cases: buckets["1"] },
        { bucket: "2-3", cases: buckets["2-3"] },
        { bucket: "4-5", cases: buckets["4-5"] },
        { bucket: "5+", cases: buckets["5+"] },
      ]);
      setBases(prev => ({ ...prev, hearings: hearingsBase }));

      // 3) Top Opponents (for judge page: top lawyers appearing before this judge)
      // Use lawyer_judge_analytics where judge_id = current
      const { data: ljaRaw } = await supabase
        .from("lawyer_judge_analytics")
        .select("lawyer_name,total_cases,won_cases,lost_cases,settled_cases,win_rate,avg_case_duration_days")
        .eq("judge_id", judgeId)
        .order("total_cases", { ascending: false })
        .limit(10);
      const ljaRows: LjaRow[] = (ljaRaw as LjaRow[] | null) ?? [];
      const ljaRowsFiltered = ljaRows.filter(r => (r.lawyer_name ?? "").trim() !== "");
      setTopOpponentsData(
        ljaRowsFiltered.slice(0, 8).map(r => ({
          name: String(r.lawyer_name ?? ""),
          cases: Number(r.total_cases ?? 0),
          winRate: Number(r.win_rate ?? 0),
        }))
      );
      setTopOpponentLawyers(
        ljaRowsFiltered.slice(0, 5).map(r => ({
          name: String(r.lawyer_name ?? ""),
          cases: Number(r.total_cases ?? 0),
          won: Number(r.won_cases ?? 0),
          lost: Number(r.lost_cases ?? 0),
          settled: Number(r.settled_cases ?? 0),
        }))
      );

      // Respondent chart (two bars: complainant vs respondent share)
      const compRate = ja ? Number(ja.favor_complainant_rate ?? 0) : Number.isFinite(metrics.favorComplainant) ? metrics.favorComplainant : 0;
      const respRate = ja ? Number(ja.favor_respondent_rate ?? 0) : Number.isFinite(metrics.favorRespondent) ? metrics.favorRespondent : 0;
      setRespondentBars([
        { label: "Complainant", value: Math.round(compRate) },
        { label: "Respondent", value: Math.round(respRate) },
      ]);

      // Average case duration with Top Lawyers (by appearance count, show avg days)
      const avgDur = ljaRowsFiltered
        .map(r => ({ name: String(r.lawyer_name ?? ""), avgDays: Math.round(Number(r.avg_case_duration_days ?? 0)) }))
        .sort((a, b) => b.avgDays - a.avgDays)
        .slice(0, 8);
      setAvgDurationTopLawyers(avgDur);
      // Use duration_count sum across selected lawyers if present for base
      const { data: ljaForDuration } = await supabase
        .from("lawyer_judge_analytics")
        .select("lawyer_name,duration_count")
        .eq("judge_id", judgeId);
      const mapCount = new Map<string, number>();
      (ljaForDuration ?? []).forEach((r: any) => mapCount.set(String(r.lawyer_name ?? ""), Number(r.duration_count ?? 0)));
      const durationBase = avgDur.reduce((acc, r) => acc + (mapCount.get(r.name) ?? 0), 0);
      setBases(prev => ({ ...prev, duration: durationBase }));

      // Top Respondents Outcome (derive respondents from case_title RHS of 'vs' and outcome from cases)
      const respMap = new Map<string, { name: string; cases: number; won: number; lost: number; settled: number }>();
      const norm = (s: string) => s.replace(/\s+/g, " ").replace(/[^\w&.,/() -]/g, "").trim();
      const splitRespondents = (s: string) => {
        // split on common separators
        return s
          .split(/\s*&\s*|\s*,\s*|\s+and\s+/i)
          .map(part => norm(part))
          .filter(Boolean);
      };
      const outcomeOf = (o?: string | null) => {
        const s = (o ?? "").toLowerCase();
        if (s.includes("in favor of complainant")) return "complainant";
        if (s.includes("in favour of complainant")) return "complainant";
        if (s.includes("in favor of respondent")) return "respondent";
        if (s.includes("in favour of respondent")) return "respondent";
        if (s.includes("settle") || s.includes("conciliation") || s.includes("consent")) return "settled";
        return "other";
      };
      const inc = (key: string, kind: "complainant" | "respondent" | "settled" | "other") => {
        if (!key) return;
        const k = key.trim();
        if (!k) return;
        const cur = respMap.get(k) ?? { name: k, cases: 0, won: 0, lost: 0, settled: 0 };
        cur.cases += 1;
        if (kind === "respondent") cur.won += 1; // respondent (builder) won
        else if (kind === "complainant") cur.lost += 1; // respondent lost
        else if (kind === "settled") cur.settled += 1;
        respMap.set(k, cur);
      };
      rows.forEach(r => {
        const res = outcomeOf(r.outcome);
        const title = r.case_title ?? "";
        const m = title.split(/vs\.?|v\/s\.?|versus/i);
        if (m.length >= 2) {
          const rhs = norm(m[1]);
          const entities = splitRespondents(rhs);
          entities.forEach(ent => inc(ent, res as any));
        }
      });
      const respArr = Array.from(respMap.values())
        .filter(r => r.name.toLowerCase() !== "none" && r.name.trim() !== "")
        .sort((a, b) => b.cases - a.cases)
        .slice(0, 8);
      // Convert counts to percentages so stacks sum to 100 for each respondent
      const respPct = respArr.map(r => {
        const base = Math.max(r.won + r.lost + r.settled, 1);
        return {
          name: r.name,
          cases: r.cases,
          won: Math.round((r.won / base) * 100),
          lost: Math.round((r.lost / base) * 100),
          settled: Math.round((r.settled / base) * 100),
        };
      });
      setRespondentOutcomeRows(respPct);
      setBases(prev => ({ ...prev, respondents: respArr.reduce((acc, r) => acc + (r.won + r.lost + r.settled), 0) }));

      // 4) RERA Resolution Matrix: stacked per year from cases.outcome/status
      const byYear: Record<string, { refund: number; possession: number; conciliation: number; dismissed: number }> = {};
      const yearOf = (d: string | null | undefined) => (d ? new Date(d).getFullYear().toString() : "Unknown");
      rows.forEach(r => {
        const y = yearOf(r.judgment_date);
        if (!byYear[y]) byYear[y] = { refund: 0, possession: 0, conciliation: 0, dismissed: 0 };
        const o = (r.outcome ?? "").toLowerCase();
        const s = (r.status ?? "").toLowerCase();
        if (/(refund)/.test(o)) byYear[y].refund += 1;
        else if (/(possession|hand ?over)/.test(o)) byYear[y].possession += 1;
        else if (/(settle|conciliation|consent)/.test(o)) byYear[y].conciliation += 1;
        else if (/(dismiss|reject)/.test(s)) byYear[y].dismissed += 1;
      });
      const orderedYears = Object.keys(byYear).filter(y => y !== "Unknown").sort();
      setReraResolutionData(
        orderedYears.map(y => ({
          year: y,
          refund: byYear[y].refund,
          possession: byYear[y].possession,
          conciliation: byYear[y].conciliation,
          dismissed: byYear[y].dismissed,
        }))
      );
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [judgeId]);

  return (
    <div className="max-w-7xl mx-auto px-4 lg:px-8 bg-slate-50">
      {/* Hero 50/50 */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch pt-6">
        {/* Left Pane: 2x2 metric grid */}
        <div className="col-span-12 lg:col-span-6 flex flex-col">
          {/* Name + contact moved inside left pane */}
          <div className="border-b border-slate-300 mb-4 pb-3">
            <h1 className="font-serif tracking-tight text-3xl font-bold text-slate-900">
              Hon. Shri {judge?.name ?? "—"}
            </h1>
            <div className="text-slate-600 mt-1">
              MahaRERA {judge?.city ?? "Bench"} • {judge?.years ?? "—"} Years of Service
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 h-full">
            <div className="rounded-md border border-emerald-200 bg-emerald-50 p-5 flex flex-col justify-center min-h-[96px]">
              <div className="text-xs text-emerald-700">In favor of Complainant</div>
              <div className="text-2xl font-semibold text-emerald-700">{metrics.favorComplainant}%</div>
              <div className="text-[11px] text-emerald-700/80 mt-1">Court Avg {courtAvg.favorComplainant}%</div>
            </div>
            <div className="rounded-md border border-indigo-200 bg-indigo-50 p-5 flex flex-col justify-center min-h-[96px]">
              <div className="text-xs text-indigo-700">In favor of Respondent</div>
              <div className="text-2xl font-semibold text-indigo-700">{metrics.favorRespondent}%</div>
              <div className="text-[11px] text-indigo-700/80 mt-1">Court Avg {courtAvg.favorRespondent}%</div>
            </div>
            <div className="rounded-md border border-amber-200 bg-amber-50 p-5 flex flex-col justify-center min-h-[96px]">
              <div className="text-xs text-amber-700">Settlement Rate</div>
              <div className="text-2xl font-semibold text-amber-700">{metrics.settlementRate}%</div>
              <div className="text-[11px] text-amber-700/80 mt-1">Court Avg {courtAvg.settlementRate}%</div>
            </div>
            <div className="rounded-md border border-slate-200 bg-slate-50 p-5 flex flex-col justify-center min-h-[96px]">
              <div className="text-xs text-slate-700">Avg Disposal</div>
              <div className="text-2xl font-semibold text-slate-700">{metrics.avgDays} days</div>
              <div className="text-[11px] text-slate-600 mt-1">Court Avg {courtAvg.avgDays} days</div>
            </div>
          </div>
        </div>
        {/* Right Pane: AI Summary fills height */}
        <div className="col-span-12 lg:col-span-6">
          <div className="h-full bg-white border-2 border-slate-300 rounded-md p-6 shadow-sm flex flex-col">
            <div className="text-sm font-semibold text-slate-900 mb-2">AI Summary</div>
            <div className="space-y-4 flex-1">
              <div>
                <div className="text-xs font-bold tracking-wider text-slate-500 uppercase mb-2">Verified Strengths</div>
                <div className="bg-green-50 border border-green-100 rounded p-3 text-green-800 flex items-start gap-2">
                  <Landmark className="w-4 h-4 mt-0.5" />
                  <div>Bench Consistency: Predictable rulings in delay‑interest disputes.</div>
                </div>
                <div className="bg-green-50 border border-green-100 rounded p-3 text-green-800 flex items-start gap-2 mt-2">
                  <CheckCircle className="w-4 h-4 mt-0.5" />
                  <div>Procedural Efficiency: Clear orders and timely uploads.</div>
                </div>
              </div>
              <div className="border-t border-slate-200 pt-3">
                <div className="text-xs font-bold tracking-wider text-red-700 uppercase mb-2">Identified Risk Factors</div>
                <div className="bg-red-50/30 border border-red-100 rounded p-3 text-red-800 flex items-start gap-2">
                  <AlertOctagon className="w-4 h-4 mt-0.5" />
                  <div>Adjournment Frequency: Hearings per case above tribunal average.</div>
                </div>
                <div className="bg-red-50/30 border border-red-100 rounded p-3 text-red-800 flex items-start gap-2 mt-2">
                  <Flag className="w-4 h-4 mt-0.5" />
                  <div>Respondent Favorability: Higher relief to promoters in contested refunds.</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Historical Case Analytics */}
      <div className="border-b border-slate-300 pb-3 mb-6">
        <h2 className="font-serif text-2xl text-slate-900">Historical Case Analytics</h2>
      </div>
      <AnalyticsDashboard
        caseBase={caseBase.length}
        context="judge"
        clientRepresentationData={clientRepresentationData}
        hearingVelocityData={hearingVelocityData}
        topOpponentsData={topOpponentsData}
        reraResolutionData={reraResolutionData}
        topOpponentLawyers={topOpponentLawyers}
        avgDurationTopLawyers={avgDurationTopLawyers}
        respondentOutcomeRows={respondentOutcomeRows}
        bases={bases}
        courtAvg={courtAvg}
      />
    </div>
  );
}
