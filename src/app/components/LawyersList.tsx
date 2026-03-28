import { useEffect, useMemo, useState } from "react";
import { Briefcase, Calendar, CheckCircle, Clock, Info, TrendingUp, Trophy } from "lucide-react";
import getSupabase from "../../utils/supabase/client";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";

interface LawyersListProps {
  onViewDetails: (id: string) => void;
}

type LawyerRow = {
  id: string;
  name: string | null;
  email: string | null;
  is_verified: boolean | null;
  specialization?: string[] | null;
  courts?: string[] | null;
  total_cases: number;
  win_rate: number;
  loss_rate: number;
  settlement_rate: number;
  avg_days: number;
  avg_hearings: number;
  rank_score: number;
  rank: number;
  tri?: {
    winRateScore: number;
    experienceScore: number;
    velocityScore: number;
  };
};

type LawyerAnalyticsRow = {
  lawyer_id: string;
  total_cases: number;
  won_cases: number;
  lost_cases: number;
  settled_cases: number;
  win_rate: number;
  loss_rate: number;
  settlement_rate: number;
  avg_case_duration_days: number;
  win_rate_score?: number;
  experience_score?: number;
  velocity_score?: number;
};

export default function LawyersList({ onViewDetails }: LawyersListProps) {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<LawyerRow[]>([]);
  const [sortBy, setSortBy] = useState<"win" | "experience" | "speed">("win");
  const [minCases, setMinCases] = useState<number>(0);
  const [minWinRate, setMinWinRate] = useState<number>(0);
  // Replicate homepage filters
  const [rankSort, setRankSort] = useState<"win" | "speed" | "experience">("win");
  const [metricSort, setMetricSort] = useState<"none" | "win" | "settle" | "loss" | "duration" | "hearings">("none");
  const [selectedCaseType, setSelectedCaseType] = useState<string>("all");
  const [selectedCourt, setSelectedCourt] = useState<string>("all");
  const [selectedLocation, setSelectedLocation] = useState<string>("all");
  const [repFilter, setRepFilter] = useState<"all" | "Complainant" | "Respondent">("all");
  const [judgeFilter, setJudgeFilter] = useState<string>("all");
  const [judgesForFilter, setJudgesForFilter] = useState<string[]>([]);
  const [courtsForFilter, setCourtsForFilter] = useState<string[]>([]);
  const [lawyerToJudges, setLawyerToJudges] = useState<Map<string, Set<string>>>(new Map());

  const isAutoImportEmail = (email: string | null) => {
    const e = (email ?? "").toLowerCase().trim();
    return !e ? false : e.startsWith("import+") || e.endsWith("@judge-my-lawyer.local") || e.includes("@judge-my-lawyer.local");
  };

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const supabase = getSupabase();
        const [lawyersRes, analyticsRes, judgesRes, ljRes] = await Promise.all([
          supabase
            .from("lawyers")
            .select("id,name,email,is_verified,specialization,courts")
            .order("name", { ascending: true }),
          supabase
            .from("lawyer_analytics")
            .select("lawyer_id,total_cases,won_cases,lost_cases,settled_cases,win_rate,loss_rate,settlement_rate,avg_case_duration_days,win_rate_score,experience_score,velocity_score"),
          supabase.from("judges").select("id,name").order("name", { ascending: true }),
          supabase.from("lawyer_judge_analytics").select("lawyer_id,judge_name,total_cases").range(0, 9999),
        ]);
        if (!mounted) return;
        const analytics = (analyticsRes.data ?? []) as LawyerAnalyticsRow[];
        const analyticsByLawyerId = new Map<string, LawyerAnalyticsRow>(analytics.map((a) => [a.lawyer_id, a]));

        const baseLawyers = ((lawyersRes.data ?? []) as Array<{
          id: string;
          name: string | null;
          email: string | null;
          is_verified: boolean | null;
          specialization: string[] | null;
          courts: string[] | null;
        }>);

        // Build courts list
        const courtSet = new Set<string>();
        baseLawyers.forEach((l) => (l.courts ?? []).forEach((c) => c && courtSet.add(c)));
        setCourtsForFilter(Array.from(courtSet).sort());

        // Build judges list and mapping
        const jnames = Array.from(new Set(((judgesRes.data ?? []) as Array<{ name: string | null }>).map((j) => (j.name ?? "").trim()).filter(Boolean))).sort();
        setJudgesForFilter(jnames);
        const map = new Map<string, Set<string>>();
        ((ljRes.data ?? []) as Array<{ lawyer_id: string; judge_name: string | null; total_cases: number }>).forEach((r) => {
          const j = (r.judge_name ?? "").trim().toLowerCase();
          if (!j) return;
          if (!map.has(r.lawyer_id)) map.set(r.lawyer_id, new Set<string>());
          map.get(r.lawyer_id)!.add(j);
        });
        setLawyerToJudges(map);

        const mapped = baseLawyers.map((l, idx) => {
          const a = analyticsByLawyerId.get(l.id);
          const tri = {
            winRateScore: a?.win_rate_score ?? 0,
            experienceScore: a?.experience_score ?? 0,
            velocityScore: a?.velocity_score ?? 0,
          };
          // Outcome-base percentages (preferred): compute from won/lost/settled counts if present
          const wins = a?.won_cases ?? 0;
          const losses = a?.lost_cases ?? 0;
          const settled = a?.settled_cases ?? 0;
          const outcomeBase = wins + losses + settled;
          const computedWin = outcomeBase > 0 ? (wins / outcomeBase) * 100 : 0;
          const computedLoss = outcomeBase > 0 ? (losses / outcomeBase) * 100 : 0;
          const computedSettle = outcomeBase > 0 ? (settled / outcomeBase) * 100 : 0;
          // No fallbacks: always use strict outcome-base percentages
          const winRatePct = computedWin;
          const lossRatePct = computedLoss;
          const settleRatePct = computedSettle;
          return {
            ...l,
            total_cases: a?.total_cases ?? 0,
            win_rate: winRatePct,
            loss_rate: lossRatePct,
            settlement_rate: settleRatePct,
            avg_days: Math.round(a?.avg_case_duration_days ?? 0),
            avg_hearings: Math.max(1, Math.round((a?.total_cases ?? 0) / 3)),
            rank_score: 0,
            tri,
            rank: idx + 1,
          } satisfies Omit<LawyerRow, "rank"> & { rank: number };
        });

        setRows(mapped);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const locationsForFilter = useMemo(() => {
    const set = new Set<string>();
    courtsForFilter.forEach((court) => {
      const loc = court.split(" ")[0];
      if (loc) set.add(loc);
    });
    return Array.from(set).sort();
  }, [courtsForFilter]);

  const filtered = useMemo(() => {
    let list = rows.slice();
    // Case type
    if (selectedCaseType !== "all") {
      list = list.filter((l) => (l.specialization ?? []).includes(selectedCaseType));
    }
    // Court
    if (selectedCourt !== "all") {
      list = list.filter((l) => (l.courts ?? []).includes(selectedCourt));
    }
    // Location
    if (selectedLocation !== "all") {
      list = list.filter((l) => (l.courts ?? []).some((c) => c.startsWith(selectedLocation)));
    }
    // Judge
    if (judgeFilter !== "all") {
      const jf = judgeFilter.toLowerCase();
      list = list.filter((l) => lawyerToJudges.get(l.id)?.has(jf) ?? false);
    }
    // Representation (placeholder until side-specific analytics are split)
    if (repFilter !== "all") {
      list = list; // keep as-is for now (requires side-split analytics)
    }
    // Numeric trims
    list = list.filter((r) => (r.total_cases ?? 0) >= minCases);
    list = list.filter((r) => (r.win_rate ?? 0) >= minWinRate);
    // Sorting
    if (metricSort !== "none") {
      list = list.sort((a, b) => {
        if (metricSort === "win") return (b.win_rate ?? 0) - (a.win_rate ?? 0);
        if (metricSort === "settle") return (b.settlement_rate ?? 0) - (a.settlement_rate ?? 0);
        if (metricSort === "loss") return (a.loss_rate ?? 0) - (b.loss_rate ?? 0);
        if (metricSort === "duration") return (a.avg_days ?? 0) - (b.avg_days ?? 0);
        const ah = a.avg_hearings ?? 0;
        const bh = b.avg_hearings ?? 0;
        return ah - bh;
      });
    } else {
      list = list.sort((a, b) => {
        if (rankSort === "win") return (b.tri?.winRateScore ?? 0) - (a.tri?.winRateScore ?? 0);
        if (rankSort === "speed") return (b.tri?.velocityScore ?? 0) - (a.tri?.velocityScore ?? 0);
        return (b.tri?.experienceScore ?? 0) - (a.tri?.experienceScore ?? 0);
      });
    }
    return list.map((l, i) => ({ ...l, rank: i + 1 }));
  }, [rows, selectedCaseType, selectedCourt, selectedLocation, judgeFilter, repFilter, minCases, minWinRate, rankSort, metricSort, lawyerToJudges]);

  const performanceBar = (win: number, loss: number, settle: number) => {
    const w = Math.max(0, Math.min(100, win));
    const l = Math.max(0, Math.min(100, loss));
    const s = Math.max(0, Math.min(100, settle));
    const sum = w + l + s;
    const ww = sum > 0 ? (w / sum) * 100 : 0;
    const ll = sum > 0 ? (l / sum) * 100 : 0;
    const ss = sum > 0 ? (s / sum) * 100 : 0;
    return { ww, ll, ss };
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 bg-[#fafbfc]">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Top Ranked Lawyers</h1>
        <p className="text-gray-600">Browse lawyers ranked by performance metrics and case success rates</p>
      </div>

      {loading && <p className="text-gray-600">Loading lawyers...</p>}

      {!loading && rows.length === 0 && (
        <div className="rounded-lg border bg-white p-6 text-gray-600">No lawyers found in Supabase.</div>
      )}

      <div className="space-y-4">
        {/* Rank buttons */}
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm font-semibold text-[#5f6368]">Rank by:</span>
          <div className="inline-flex rounded-lg p-1 bg-[#f0f2f5] border border-[#e0e3e7]">
            <button
              onClick={() => setRankSort("win")}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold ${rankSort === "win" ? "bg-gradient-to-r from-[#1e40af] to-[#3b82f6] text-white shadow" : "text-[#1a2332] hover:bg-white"}`}
            >
              Wins
            </button>
            <button
              onClick={() => setRankSort("speed")}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold ${rankSort === "speed" ? "bg-gradient-to-r from-[#d97706] to-[#f59e0b] text-white shadow" : "text-[#1a2332] hover:bg-white"}`}
            >
              Speed
            </button>
            <button
              onClick={() => setRankSort("experience")}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold ${rankSort === "experience" ? "bg-gradient-to-r from-[#047857] to-[#10b981] text-white shadow" : "text-[#1a2332] hover:bg-white"}`}
            >
              Experience
            </button>
          </div>
          <div className="ml-auto flex items-end gap-4">
            <div>
              <label className="block text-sm font-semibold text-[#1a2332] mb-1">Min cases</label>
              <input
                type="number"
                min={0}
                value={minCases}
                onChange={(e) => setMinCases(Number(e.target.value || 0))}
                className="px-3 py-2 border border-[#e0e3e7] rounded-lg text-sm w-28"
                placeholder="0"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-[#1a2332] mb-1">Min win %</label>
              <input
                type="number"
                min={0}
                max={100}
                value={minWinRate}
                onChange={(e) => setMinWinRate(Number(e.target.value || 0))}
                className="px-3 py-2 border border-[#e0e3e7] rounded-lg text-sm w-28"
                placeholder="0"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-[#1a2332] mb-1">Sort by</label>
              <select
                value={metricSort}
                onChange={(e) => setMetricSort(e.target.value as any)}
                className="px-3 py-2 border border-[#e0e3e7] rounded-lg text-sm"
              >
                <option value="none">Tri‑Factor (above)</option>
                <option value="win">Win % (desc)</option>
                <option value="settle">Settlement % (desc)</option>
                <option value="loss">Loss % (asc)</option>
                <option value="duration">Avg duration (asc)</option>
                <option value="hearings">No. of hearings (asc)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div>
            <label className="block text-sm font-semibold text-[#1a2332] mb-1">Case Type</label>
            <select
              value={selectedCaseType}
              onChange={(e) => setSelectedCaseType(e.target.value)}
              className="px-3 py-2 border border-[#e0e3e7] rounded-lg text-sm w-full"
            >
              <option value="all">All Case Types</option>
              <option value="Property">Property</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold text-[#1a2332] mb-1">Court</label>
            <select
              value={selectedCourt}
              onChange={(e) => setSelectedCourt(e.target.value)}
              className="px-3 py-2 border border-[#e0e3e7] rounded-lg text-sm w-full"
            >
              <option value="all">All Courts</option>
              {courtsForFilter.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold text-[#1a2332] mb-1">Location</label>
            <select
              value={selectedLocation}
              onChange={(e) => setSelectedLocation(e.target.value)}
              className="px-3 py-2 border border-[#e0e3e7] rounded-lg text-sm w-full"
            >
              <option value="all">All Locations</option>
              {locationsForFilter.map((l) => (
                <option key={l} value={l}>{l}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold text-[#1a2332] mb-1">Representation</label>
            <select
              value={repFilter}
              onChange={(e) => setRepFilter(e.target.value as any)}
              className="px-3 py-2 border border-[#e0e3e7] rounded-lg text-sm w-full"
            >
              <option value="all">All</option>
              <option value="Complainant">For Complainant</option>
              <option value="Respondent">For Respondent</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold text-[#1a2332] mb-1">Judge</label>
            <select
              value={judgeFilter}
              onChange={(e) => setJudgeFilter(e.target.value)}
              className="px-3 py-2 border border-[#e0e3e7] rounded-lg text-sm w-full"
            >
              <option value="all">All Judges</option>
              {judgesForFilter.map((j) => (
                <option key={j} value={j}>{j}</option>
              ))}
            </select>
          </div>
        </div>

        {filtered.map((lawyer) => {
          const status = lawyer.is_verified ? "claimed" : "unclaimed";
          const { ww, ll, ss } = performanceBar(lawyer.win_rate, lawyer.loss_rate, lawyer.settlement_rate);
          return (
            <div
              key={lawyer.id}
              className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-lg transition cursor-pointer"
              onClick={() => onViewDetails(lawyer.id)}
            >
              <div className="flex items-start justify-between">
                <div className="flex gap-4 flex-1">
                  {/* Rank Badge */}
                  <div className="flex-shrink-0">
                    <div
                      className={`w-16 h-16 rounded-full flex items-center justify-center ${
                        lawyer.rank === 1 ? "bg-yellow-100" : lawyer.rank === 2 ? "bg-gray-100" : lawyer.rank === 3 ? "bg-orange-100" : "bg-blue-50"
                      }`}
                    >
                      {lawyer.rank <= 3 ? (
                        <Trophy
                          className={`w-8 h-8 ${
                            lawyer.rank === 1 ? "text-yellow-600" : lawyer.rank === 2 ? "text-gray-600" : "text-orange-600"
                          }`}
                        />
                      ) : (
                        <span className="text-2xl font-bold text-blue-600">#{lawyer.rank}</span>
                      )}
                    </div>
                  </div>

                  {/* Lawyer Info */}
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-1">
                      <h2 className="text-xl font-semibold text-gray-900">{lawyer.name ?? "Unnamed Lawyer"}</h2>
                      {status === "claimed" ? (
                        <span className="flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 text-xs font-semibold rounded-full border border-green-200">
                          <CheckCircle className="w-3 h-3" />
                          VERIFIED
                        </span>
                      ) : null}
                    </div>
                    <div className="mb-2 flex items-center gap-1.5 text-sm text-gray-700">
                      {(() => {
                        const win = Number(lawyer.tri?.winRateScore ?? 0);
                        const spd = Number(lawyer.tri?.velocityScore ?? 0);
                        const exp = Number(lawyer.tri?.experienceScore ?? 0);
                        const label = rankSort === "win" ? "Win Score" : rankSort === "speed" ? "Speed Score" : "Experience Score";
                        const value = rankSort === "win" ? win : rankSort === "speed" ? spd : exp;
                        return <span className="font-semibold">{label}: {value.toFixed(0)}</span>;
                      })()}
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex h-5 w-5 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100 hover:text-gray-700"
                            aria-label="Rank score formula"
                          >
                            <Info className="h-3.5 w-3.5" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent sideOffset={6} className="max-w-[320px]">
                          {rankSort === "win" && "Win Score: Bayesian-smoothed win rate (settlements = 0.5 wins), scaled 0–100."}
                          {rankSort === "experience" && "Experience Score: log10(total cases + 1) mapped to 0–100."}
                          {rankSort === "speed" && "Speed Score: duration efficiency vs 200-day avg, weighted by true win% + 0.2."}
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    <div className="flex flex-wrap gap-2 mb-3">
                      {(lawyer.specialization ?? ["MahaRERA"]).map((spec, idx) => (
                        <span key={idx} className="px-3 py-1 bg-blue-50 text-blue-700 text-sm rounded-full">
                          {spec}
                        </span>
                      ))}
                    </div>
                    <p className="text-sm text-gray-600 mb-3">
                      {lawyer.is_verified
                        ? "Verified profile"
                        : isAutoImportEmail(lawyer.email)
                          ? "Unclaimed profile"
                          : lawyer.email ?? "Unclaimed profile"}
                    </p>
                    <div className="flex flex-wrap gap-2 text-sm text-gray-600">
                      {(lawyer.courts ?? []).slice(0, 2).map((court, idx) => (
                        <span key={idx} className="flex items-center gap-1">
                          <Briefcase className="w-4 h-4" />
                          {court}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 gap-4 ml-6">
                  <div className="text-center">
                    <div className="flex items-center justify-center gap-1 mb-1">
                      <TrendingUp className="w-4 h-4 text-green-600" />
                      <span className="text-2xl font-bold text-green-600">{Number(lawyer.win_rate ?? 0).toFixed(1)}%</span>
                    </div>
                    <p className="text-xs text-gray-500">Win Rate</p>
                  </div>
                  <div className="text-center">
                    <div className="flex items-center justify-center gap-1 mb-1">
                      <Briefcase className="w-4 h-4 text-blue-600" />
                      <span className="text-2xl font-bold text-gray-900">{(lawyer.total_cases ?? 0).toLocaleString()}</span>
                    </div>
                    <p className="text-xs text-gray-500">Total Cases</p>
                  </div>
                  <div className="text-center">
                    <div className="flex items-center justify-center gap-1 mb-1">
                      <Clock className="w-4 h-4 text-orange-600" />
                      <span className="text-lg font-semibold text-gray-900">{lawyer.avg_days ?? 0}d</span>
                    </div>
                    <p className="text-xs text-gray-500">Avg Duration</p>
                  </div>
                  <div className="text-center">
                    <div className="flex items-center justify-center gap-1 mb-1">
                      <Calendar className="w-4 h-4 text-purple-600" />
                      <span className="text-lg font-semibold text-gray-900">{lawyer.avg_hearings ?? 0}</span>
                    </div>
                    <p className="text-xs text-gray-500">Avg Hearings</p>
                  </div>
                </div>
              </div>

              {/* Performance Bar */}
              <div className="mt-4 pt-4 border-t border-gray-100">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-sm font-medium text-gray-700">Performance:</span>
                  <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden flex">
                    <div className="bg-green-500" style={{ width: `${ww}%` }} />
                    <div className="bg-red-500" style={{ width: `${ll}%` }} />
                    <div className="bg-yellow-500" style={{ width: `${ss}%` }} />
                  </div>
                </div>
                <div className="flex gap-4 text-xs text-gray-600">
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 bg-green-500 rounded-full" />
                    Won: {Number(lawyer.win_rate ?? 0).toFixed(1)}%
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 bg-red-500 rounded-full" />
                    Lost: {Number(lawyer.loss_rate ?? 0).toFixed(1)}%
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 bg-yellow-500 rounded-full" />
                    Settled: {Number(lawyer.settlement_rate ?? 0).toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
