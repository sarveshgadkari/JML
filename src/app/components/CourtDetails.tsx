import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Clock, Scale, TrendingUp } from "lucide-react";
import getSupabase from "../../utils/supabase/client";
import { Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

interface CourtDetailsProps {
  courtId: string;
  onBack: () => void;
}

type CourtRow = {
  id: string;
  name: string | null;
  type: string | null;
};

type CourtAnalyticsRow = {
  court_id: string;
  court_name: string;
  total_cases: number;
  settlement_rate: number;
  dismissed_cases: number;
  withdrawn_cases: number;
  partially_granted_cases: number;
  avg_case_duration_days?: number;
};

type CaseRow = {
  id: string;
  case_number: string;
  case_title: string;
  judgment_date: string | null;
  outcome: string | null;
};

export default function CourtDetails({ courtId, onBack }: CourtDetailsProps) {
  const [loading, setLoading] = useState(true);
  const [court, setCourt] = useState<CourtRow | null>(null);
  const [analytics, setAnalytics] = useState<CourtAnalyticsRow | null>(null);
  const [cases, setCases] = useState<CaseRow[]>([]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const supabase = getSupabase();
        // Single source of truth: court_analytics.
        const analyticsRes = await supabase
          .from("court_analytics")
          .select("court_id,court_name,total_cases,settlement_rate,dismissed_cases,withdrawn_cases,partially_granted_cases")
          .eq("court_id", courtId)
          .maybeSingle();
        if (analyticsRes.error) throw analyticsRes.error;

        const a = (analyticsRes.data as CourtAnalyticsRow | null) ?? null;
        const [courtRes, casesByIdRes] = await Promise.all([
          // Optional metadata only.
          supabase.from("courts").select("id,name,type").eq("id", courtId).maybeSingle(),
          supabase
            .from("court_analytics")
            .select("court_id,court_name,total_cases,settlement_rate,dismissed_cases,withdrawn_cases,partially_granted_cases")
            .eq("court_id", courtId)
            .maybeSingle(),
          supabase
            .from("cases")
            .select("id,case_number,case_title,judgment_date,outcome")
            .eq("court_id", courtId)
            .order("judgment_date", { ascending: false })
            .limit(50),
        ]);
        if (!mounted) return;
        const c = (courtRes.data as CourtRow | null) ?? null;
        setCourt(c ?? (a ? ({ id: a.court_id, name: a.court_name, type: null } as CourtRow) : null));
        setAnalytics(a);

        const casesById = (casesByIdRes.data ?? []) as CaseRow[];
        if (casesById.length > 0) {
          setCases(casesById);
        } else if (a?.court_name) {
          // Fallback when court_id isn't populated in cases: match by court_name.
          const { data: casesByName } = await supabase
            .from("cases")
            .select("id,case_number,case_title,judgment_date,outcome")
            .eq("court_name", a.court_name)
            .order("judgment_date", { ascending: false })
            .limit(50);
          if (!mounted) return;
          setCases((casesByName ?? []) as CaseRow[]);
        } else {
          setCases([]);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [courtId]);

  const pieData = useMemo(() => {
    const dismissed = analytics?.dismissed_cases ?? 0;
    const withdrawn = analytics?.withdrawn_cases ?? 0;
    const partial = analytics?.partially_granted_cases ?? 0;
    const settledRate = analytics?.settlement_rate ?? 0;
    // We don't have explicit settled count in court_analytics schema; use status counts + total for display tiles.
    return [
      { name: "Dismissed/Rejected", value: dismissed, color: "#f43f5e" },
      { name: "Withdrawn", value: withdrawn, color: "#a855f7" },
      { name: "Partial", value: partial, color: "#f59e0b" },
      { name: "Other", value: Math.max(0, (analytics?.total_cases ?? 0) - dismissed - withdrawn - partial), color: "#94a3b8" },
    ].filter((x) => x.value > 0 || settledRate > 0);
  }, [analytics]);

  const barData = useMemo(() => {
    return [
      { label: "Settlement %", value: Number(analytics?.settlement_rate ?? 0), color: "#10b981" },
    ];
  }, [analytics]);

  return (
    <div className="max-w-5xl mx-auto py-8">
      <button onClick={onBack} className="mb-4 flex items-center gap-2 text-sm text-emerald-700">
        <ArrowLeft className="h-4 w-4" /> Back
        </button>

      {loading && <p className="text-gray-600">Loading court...</p>}
      {!loading && !court && (
        <div className="rounded-lg border bg-white p-6 text-gray-600">Court not found.</div>
      )}

      {!!court && (
        <div className="space-y-6">
          <div className="rounded-xl border bg-white p-6">
            <h1 className="text-2xl font-bold text-gray-900">{court.name ?? "Unnamed Court"}</h1>
            <p className="mt-1 text-sm text-gray-600">
              {court.type ?? "Type N/A"}
            </p>
            <p className="mt-3 text-sm text-gray-700">Linked cases: {cases.length}</p>
            {!!analytics && (
              <div className="mt-4 grid grid-cols-2 gap-3 text-sm text-gray-700 md:grid-cols-4">
                <div className="rounded-lg border bg-slate-50 p-3">
                  <div className="text-xs text-gray-500">Total cases (outcome-based)</div>
                  <div className="text-lg font-semibold text-gray-900">{analytics.total_cases ?? 0}</div>
                </div>
                <div className="rounded-lg border bg-slate-50 p-3">
                  <div className="text-xs text-gray-500">Settlement rate</div>
                  <div className="text-lg font-semibold text-gray-900">{(analytics.settlement_rate ?? 0).toFixed(1)}%</div>
                </div>
                <div className="rounded-lg border bg-slate-50 p-3">
                  <div className="text-xs text-gray-500">Dismissed</div>
                  <div className="text-lg font-semibold text-gray-900">{analytics.dismissed_cases ?? 0}</div>
                </div>
                <div className="rounded-lg border bg-slate-50 p-3">
                  <div className="text-xs text-gray-500">Withdrawn</div>
                  <div className="text-lg font-semibold text-gray-900">{analytics.withdrawn_cases ?? 0}</div>
                </div>
              </div>
            )}
          </div>

          <div className="rounded-xl border bg-white p-6">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-lg font-bold text-gray-900">Trust & Analytics</h2>
              <div className="text-xs text-gray-500">Source: court_analytics</div>
            </div>
            {!analytics ? (
              <p className="text-sm text-gray-600">No analytics found yet. Run “Master Table Analysis” in Admin.</p>
            ) : (
              <div className="grid gap-4 lg:grid-cols-3">
                <div className="rounded-xl bg-slate-50 p-4">
                  <div className="text-xs font-semibold text-slate-600">Status mix</div>
                  <div className="mt-2 h-44">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={pieData} dataKey="value" innerRadius={45} outerRadius={65} paddingAngle={2}>
                          {pieData.map((entry, idx) => (
                            <Cell key={`cell-${idx}`} fill={(entry as any).color} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded-lg bg-white p-2">
                      <div className="flex items-center gap-1 text-rose-700"><Scale className="h-4 w-4" /> Dismissed</div>
                      <div className="font-bold text-slate-900">{analytics.dismissed_cases ?? 0}</div>
                    </div>
                    <div className="rounded-lg bg-white p-2">
                      <div className="flex items-center gap-1 text-purple-700"><TrendingUp className="h-4 w-4" /> Withdrawn</div>
                      <div className="font-bold text-slate-900">{analytics.withdrawn_cases ?? 0}</div>
                    </div>
                  </div>
                </div>

                <div className="rounded-xl bg-slate-50 p-4">
                  <div className="text-xs font-semibold text-slate-600">Settlement</div>
                  <div className="mt-2 h-44">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={barData} layout="vertical" margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                        <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11 }} />
                        <YAxis type="category" dataKey="label" tick={{ fontSize: 11 }} width={85} />
                        <Tooltip />
                        <Bar dataKey="value" radius={[6, 6, 6, 6]}>
                          {barData.map((d, idx) => (
                            <Cell key={idx} fill={(d as any).color} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="mt-2 flex items-center justify-between rounded-lg bg-white p-3 text-sm">
                    <div className="flex items-center gap-2 text-slate-700"><Clock className="h-4 w-4" /> Avg duration</div>
                    <div className="font-bold text-slate-900">{Math.round((analytics.avg_case_duration_days ?? 0) as number)} days</div>
                  </div>
                </div>

                <div className="rounded-xl bg-slate-50 p-4">
                  <div className="text-xs font-semibold text-slate-600">Totals</div>
                  <div className="mt-2 grid gap-2 text-sm">
                    <div className="rounded-lg bg-white p-3 flex items-center justify-between">
                      <span className="text-slate-700">Total (outcome-based)</span>
                      <span className="font-bold text-slate-900">{analytics.total_cases ?? 0}</span>
                    </div>
                    <div className="rounded-lg bg-white p-3 flex items-center justify-between">
                      <span className="text-slate-700">Partially granted</span>
                      <span className="font-bold text-slate-900">{analytics.partially_granted_cases ?? 0}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="rounded-xl border bg-white p-6">
            <h2 className="mb-3 text-lg font-bold text-gray-900">Recent Cases</h2>
            {cases.length === 0 && <p className="text-sm text-gray-600">No linked cases found.</p>}
            <div className="space-y-2">
              {cases.map((c) => (
                <div key={c.id} className="rounded-md border p-3">
                  <div className="font-semibold text-gray-900">{c.case_title}</div>
                  <div className="text-sm text-gray-600">{c.case_number}</div>
                  <div className="text-xs text-gray-500">
                    {c.judgment_date ?? "No judgment date"} • {c.outcome ?? "Outcome N/A"}
                  </div>
                </div>
              ))}
            </div>
          </div>
            </div>
          )}
    </div>
  );
}
