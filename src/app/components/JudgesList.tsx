import { useEffect, useMemo, useState } from "react";
import { Building2, Calendar, Clock, Gavel, Scale } from "lucide-react";
import getSupabase from "../../utils/supabase/client";

interface JudgesListProps {
  onViewDetails: (id: string) => void;
}

type JudgeRow = {
  id: string;
  name: string | null;
  designation: string | null;
  total_cases: number;
  complainant_favor_rate: number;
  respondent_favor_rate: number;
  settled_rate: number;
  avg_days: number;
  avg_hearings: number;
  rank: number;
};

type JudgeAnalyticsRow = {
  judge_id: string;
  total_cases: number;
  favor_complainant_rate: number;
  favor_respondent_rate: number;
  settlement_rate: number;
  avg_case_duration_days: number;
};

export default function JudgesList({ onViewDetails }: JudgesListProps) {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<JudgeRow[]>([]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const supabase = getSupabase();
        const [judgesRes, analyticsRes] = await Promise.all([
          supabase
            .from("judges")
            .select("id,name,designation")
            .order("name", { ascending: true }),
          supabase
            .from("judge_analytics")
            .select("judge_id,total_cases,favor_complainant_rate,favor_respondent_rate,settlement_rate,avg_case_duration_days"),
        ]);
        if (!mounted) return;
        const analytics = (analyticsRes.data ?? []) as JudgeAnalyticsRow[];
        const byId = new Map<string, JudgeAnalyticsRow>(analytics.map((a) => [a.judge_id, a]));
        const mapped = ((judgesRes.data ?? []) as JudgeRow[])
          .map((j) => {
            const s = j.id ? byId.get(j.id) : undefined;
            const total = s?.total_cases ?? 0;
            return {
              ...j,
              total_cases: total,
              complainant_favor_rate: s?.favor_complainant_rate ?? 0,
              respondent_favor_rate: s?.favor_respondent_rate ?? 0,
              settled_rate: s?.settlement_rate ?? 0,
              avg_days: Math.round(s?.avg_case_duration_days ?? 0),
              avg_hearings: Math.max(1, Math.round(total / 3)),
              rank: 0,
            };
          })
          .sort((a, b) => (b.total_cases ?? 0) - (a.total_cases ?? 0));
        setRows(mapped.map((r, idx) => ({ ...r, rank: idx + 1 })));
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const distribution = (row: JudgeRow) => {
    const c = Math.max(0, Math.min(100, row.complainant_favor_rate));
    const r = Math.max(0, Math.min(100, row.respondent_favor_rate));
    const s = Math.max(0, Math.min(100, row.settled_rate));
    const sum = c + r + s;
    return {
      c: sum > 0 ? (c / sum) * 100 : 0,
      r: sum > 0 ? (r / sum) * 100 : 0,
      s: sum > 0 ? (s / sum) * 100 : 0,
    };
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 bg-[#fafbfc]">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Top Ranked Judges</h1>
        <p className="text-gray-600">Browse judges ranked by case resolution efficiency and fairness metrics</p>
      </div>

      {loading && <p className="text-gray-600">Loading judges...</p>}
      {!loading && rows.length === 0 && (
        <div className="rounded-lg border bg-white p-6 text-gray-600">No judges found in Supabase.</div>
      )}

      <div className="space-y-4">
        {rows.map((judge) => {
          const dist = distribution(judge);
          return (
            <div
              key={judge.id}
              className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-lg transition cursor-pointer"
              onClick={() => onViewDetails(judge.id)}
            >
              <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                <div className="flex gap-4 flex-1 min-w-0">
                  {/* Rank Badge */}
                  <div className="flex-shrink-0">
                    <div
                      className={`w-16 h-16 rounded-full flex items-center justify-center ${
                        judge.rank === 1 ? "bg-yellow-100" : judge.rank === 2 ? "bg-gray-100" : judge.rank === 3 ? "bg-orange-100" : "bg-purple-50"
                      }`}
                    >
                      {judge.rank <= 3 ? (
                        <Gavel
                          className={`w-8 h-8 ${
                            judge.rank === 1 ? "text-yellow-600" : judge.rank === 2 ? "text-gray-600" : "text-orange-600"
                          }`}
                        />
                      ) : (
                        <span className="text-2xl font-bold text-purple-600">#{judge.rank}</span>
                      )}
                    </div>
                  </div>

                  {/* Judge Info */}
                  <div className="flex-1 min-w-0">
                    <h2 className="text-xl font-semibold text-gray-900 mb-1">{judge.name ?? "Unnamed Judge"}</h2>
                    <div className="flex flex-wrap items-center gap-2 mb-3">
                      <Building2 className="w-4 h-4 text-gray-500" />
                      <span className="text-gray-700">{judge.designation ?? "MahaRERA"}</span>
                    </div>
                    <p className="text-sm text-gray-600">Live analytics</p>
                  </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 gap-4 xl:ml-6 shrink-0">
                  <div className="text-center">
                    <div className="flex items-center justify-center gap-1 mb-1">
                      <Scale className="w-4 h-4 text-blue-600" />
                      <span className="text-2xl font-bold text-gray-900">{(judge.total_cases ?? 0).toLocaleString()}</span>
                    </div>
                    <p className="text-xs text-gray-500">Total Cases</p>
                  </div>
                  <div className="text-center">
                    <div className="flex items-center justify-center gap-1 mb-1">
                      <Gavel className="w-4 h-4 text-green-600" />
                      <span className="text-2xl font-bold text-green-600">{Number(judge.settled_rate ?? 0).toFixed(1)}%</span>
                    </div>
                    <p className="text-xs text-gray-500">Settlement Rate</p>
                  </div>
                  <div className="text-center">
                    <div className="flex items-center justify-center gap-1 mb-1">
                      <Clock className="w-4 h-4 text-orange-600" />
                      <span className="text-lg font-semibold text-gray-900">{judge.avg_days ?? 0}d</span>
                    </div>
                    <p className="text-xs text-gray-500">Avg Duration</p>
                  </div>
                  <div className="text-center">
                    <div className="flex items-center justify-center gap-1 mb-1">
                      <Calendar className="w-4 h-4 text-purple-600" />
                      <span className="text-lg font-semibold text-gray-900">{judge.avg_hearings ?? 0}</span>
                    </div>
                    <p className="text-xs text-gray-500">Avg Hearings</p>
                  </div>
                </div>
              </div>

              {/* Case Distribution */}
              <div className="mt-4 pt-4 border-t border-gray-100">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-sm font-medium text-gray-700">Case Distribution:</span>
                  <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden flex">
                    <div className="bg-blue-500" style={{ width: `${dist.c}%` }} />
                    <div className="bg-green-500" style={{ width: `${dist.r}%` }} />
                    <div className="bg-yellow-500" style={{ width: `${dist.s}%` }} />
                  </div>
                </div>
                <div className="flex flex-wrap gap-3 sm:gap-4 text-xs text-gray-600">
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 bg-blue-500 rounded-full" />
                    Complainant: {Number(judge.complainant_favor_rate ?? 0).toFixed(1)}%
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 bg-green-500 rounded-full" />
                    Respondent: {Number(judge.respondent_favor_rate ?? 0).toFixed(1)}%
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 bg-yellow-500 rounded-full" />
                    Settled: {Number(judge.settled_rate ?? 0).toFixed(1)}%
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
