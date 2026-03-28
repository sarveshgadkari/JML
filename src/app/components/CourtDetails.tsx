import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import getSupabase from "../../utils/supabase/client";

interface CourtDetailsProps {
  courtId: string;
  onBack: () => void;
}

type CourtRow = {
  id: string;
  name: string | null;
  type: string | null;
  location: string | null;
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
  const [cases, setCases] = useState<CaseRow[]>([]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const supabase = getSupabase();
        const [courtRes, casesRes] = await Promise.all([
          supabase.from("courts").select("id,name,type,location").eq("id", courtId).maybeSingle(),
          supabase
            .from("cases")
            .select("id,case_number,case_title,judgment_date,outcome")
            .eq("court_id", courtId)
            .order("judgment_date", { ascending: false })
            .limit(50),
        ]);
        if (!mounted) return;
        setCourt((courtRes.data as CourtRow | null) ?? null);
        setCases((casesRes.data ?? []) as CaseRow[]);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [courtId]);

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
              {court.type ?? "Type N/A"} {court.location ? `• ${court.location}` : ""}
            </p>
            <p className="mt-3 text-sm text-gray-700">Linked cases: {cases.length}</p>
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
