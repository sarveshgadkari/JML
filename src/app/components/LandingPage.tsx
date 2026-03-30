import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  Award,
  Briefcase,
  Building2,
  Calendar,
  Clock,
  Filter,
  Gavel,
  Handshake,
  Scale,
  Search,
  TrendingDown,
  TrendingUp,
  Users,
  Info,
  X,
} from "lucide-react";
import getSupabase from "../../utils/supabase/client";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";

interface LandingPageProps {
  onNavigate: (view: string) => void;
  onLogin: (role: "client" | "lawyer") => void;
  onViewLawyerDetails: (id: string) => void;
  onViewJudgeDetails: (id: string) => void;
  onViewCourtDetails: (id: string) => void;
}

type LawyerRow = {
  id: string;
  name: string | null;
  specialization: string[] | null;
  courts: string[] | null;
  total_cases: number;
  won_cases: number;
  lost_cases: number;
  settled_cases: number;
  win_rate: number;
  loss_rate: number;
  settlement_rate: number;
  avg_case_duration_days: number;
  rankScore: number;
  filteredRank: number;
  tri?: {
    winRateScore: number;
    experienceScore: number;
    velocityScore: number;
  };
};

type JudgeRow = {
  id: string;
  name: string | null;
  designation: string | null;
  total_cases: number;
  favor_complainant_rate: number;
  favor_respondent_rate: number;
  settlement_rate: number;
  filteredRank: number;
};

type CourtRow = {
  id: string;
  name: string | null;
  total_cases: number;
  settlement_rate: number;
  dismissed_cases: number;
  withdrawn_cases: number;
  partially_granted_cases: number;
  avg_case_duration_days: number;
  filteredRank: number;
};

// Google Ad Placeholder Component (from Figma export)
function AdPlaceholder({ type = "horizontal", className = "" }: { type?: "horizontal" | "vertical" | "square"; className?: string }) {
  const dimensions = {
    horizontal: "h-24",
    vertical: "w-40 h-96",
    square: "h-64",
  } as const;

  return (
    <div
      className={`bg-gradient-to-br from-[#f0f2f5] to-[#e0e3e7] border-2 border-dashed border-[#c4c9d0] rounded-xl flex items-center justify-center ${dimensions[type]} ${className}`}
    >
      <span className="text-sm font-semibold text-[#5f6368]">Advertisement</span>
    </div>
  );
}

export default function LandingPage({ onNavigate, onLogin, onViewLawyerDetails, onViewJudgeDetails, onViewCourtDetails }: LandingPageProps) {
  const [activeTab, setActiveTab] = useState<"lawyers" | "judges" | "courts">("lawyers");
  const [loading, setLoading] = useState(true);

  // Data
  const [lawyers, setLawyers] = useState<LawyerRow[]>([]);
  const [judges, setJudges] = useState<JudgeRow[]>([]);
  const [courts, setCourts] = useState<CourtRow[]>([]);

  // Lawyer filters (Figma structure)
  const [selectedSpecialization, setSelectedSpecialization] = useState<string>("all");
  const [selectedCourt, setSelectedCourt] = useState<string>("all");
  const [selectedLocation, setSelectedLocation] = useState<string>("all");
  // Rank sort buttons (Wins / Speed / Experience)
  const [rankSort, setRankSort] = useState<"win" | "speed" | "experience">("win");
  // Additional filters and sorts
  const [repFilter, setRepFilter] = useState<"all" | "Complainant" | "Respondent">("all");
  const [judgeFilter, setJudgeFilter] = useState<string>("all");
  const [metricSort, setMetricSort] = useState<"none" | "win" | "settle" | "loss" | "duration" | "hearings">("none");
  // Mapping for judge-based filtering
  const [lawyerToJudges, setLawyerToJudges] = useState<Map<string, Set<string>>>(new Map());

  // Judge filters
  const [selectedJudgeSpec, setSelectedJudgeSpec] = useState<string>("all");
  const [selectedJudgeCourt, setSelectedJudgeCourt] = useState<string>("all");

  // Court filters
  const [selectedCourtType, setSelectedCourtType] = useState<string>("all");
  const [selectedCourtLocation, setSelectedCourtLocation] = useState<string>("all");

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const supabase = getSupabase();

        // Pull base entities + analytics; this keeps rendering fast and consistent.
        const [lawyersRes, lawyerAnalyticsRes, judgesRes, judgeAnalyticsRes, courtAnalyticsRes, ljRes] = await Promise.all([
          supabase.from("lawyers").select("id,name,specialization,courts").order("name", { ascending: true }).range(0, 4999),
          supabase
            .from("lawyer_analytics")
            .select("lawyer_id,lawyer_name,total_cases,won_cases,lost_cases,settled_cases,win_rate,loss_rate,settlement_rate,avg_case_duration_days,win_rate_score,experience_score,velocity_score")
            .range(0, 4999),
          supabase.from("judges").select("id,name,designation").order("name", { ascending: true }).range(0, 4999),
          supabase
            .from("judge_analytics")
            .select("judge_id,judge_name,total_cases,favor_complainant_rate,favor_respondent_rate,settlement_rate")
            .range(0, 4999),
          supabase
            .from("court_analytics")
            .select("court_id,court_name,total_cases,settlement_rate,dismissed_cases,withdrawn_cases,partially_granted_cases,avg_case_duration_days")
            .range(0, 4999),
          supabase
            .from("lawyer_judge_analytics")
            .select("lawyer_id,judge_name,total_cases")
            .range(0, 9999),
        ]);

        if (!mounted) return;

        const lawyersBase = (lawyersRes.data ?? []) as Array<{ id: string; name: string | null; specialization: string[] | null; courts: string[] | null }>;
        const lawyersById = new Map(lawyersBase.map((l) => [l.id, l]));
        const lawyerAnalytics = (lawyerAnalyticsRes.data ?? []) as Array<{
          lawyer_id: string;
          lawyer_name: string;
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
        }>;

        const mergedLawyers: LawyerRow[] = lawyerAnalytics
          .map((a, idx) => {
            const base = lawyersById.get(a.lawyer_id);
            const tri = {
              winRateScore: a.win_rate_score ?? 0,
              experienceScore: a.experience_score ?? 0,
              velocityScore: a.velocity_score ?? 0,
            };
            return {
              id: a.lawyer_id,
              name: base?.name ?? a.lawyer_name ?? null,
              specialization: base?.specialization ?? ["MahaRERA"],
              courts: base?.courts ?? [],
              total_cases: a.total_cases ?? 0,
              won_cases: a.won_cases ?? 0,
              lost_cases: a.lost_cases ?? 0,
              settled_cases: a.settled_cases ?? 0,
              win_rate: a.win_rate ?? 0,
              loss_rate: a.loss_rate ?? 0,
              settlement_rate: a.settlement_rate ?? 0,
              avg_case_duration_days: a.avg_case_duration_days ?? 0,
              rankScore: 0,
              tri,
              filteredRank: idx + 1,
            };
          })
          .sort((x, y) => (y.tri?.winRateScore ?? 0) - (x.tri?.winRateScore ?? 0))
          .map((l, i) => ({ ...l, filteredRank: i + 1 }));

        const judgesBase = (judgesRes.data ?? []) as Array<{ id: string; name: string | null; designation: string | null }>;
        const judgesById = new Map(judgesBase.map((j) => [j.id, j]));
        const judgeAnalytics = (judgeAnalyticsRes.data ?? []) as Array<{
          judge_id: string;
          judge_name: string;
          total_cases: number;
          favor_complainant_rate: number;
          favor_respondent_rate: number;
          settlement_rate: number;
        }>;
        const mergedJudges: JudgeRow[] = judgeAnalytics
          .map((a, idx) => {
            const base = judgesById.get(a.judge_id);
            return {
              id: a.judge_id,
              name: base?.name ?? a.judge_name ?? null,
              designation: base?.designation ?? null,
              total_cases: a.total_cases ?? 0,
              favor_complainant_rate: a.favor_complainant_rate ?? 0,
              favor_respondent_rate: a.favor_respondent_rate ?? 0,
              settlement_rate: a.settlement_rate ?? 0,
              filteredRank: idx + 1,
            };
          })
          .sort((x, y) => (y.total_cases ?? 0) - (x.total_cases ?? 0))
          .map((j, i) => ({ ...j, filteredRank: i + 1 }));

        const courtAnalytics = (courtAnalyticsRes.data ?? []) as Array<{
          court_id: string;
          court_name: string;
          total_cases: number;
          settlement_rate: number;
          dismissed_cases: number;
          withdrawn_cases: number;
          partially_granted_cases: number;
          avg_case_duration_days: number;
        }>;
        const mergedCourts: CourtRow[] = courtAnalytics
          .map((a, idx) => ({
            id: a.court_id,
            name: a.court_name ?? null,
            total_cases: a.total_cases ?? 0,
            settlement_rate: a.settlement_rate ?? 0,
            dismissed_cases: a.dismissed_cases ?? 0,
            withdrawn_cases: a.withdrawn_cases ?? 0,
            partially_granted_cases: a.partially_granted_cases ?? 0,
            avg_case_duration_days: a.avg_case_duration_days ?? 0,
            filteredRank: idx + 1,
          }))
          .sort((x, y) => (y.total_cases ?? 0) - (x.total_cases ?? 0))
          .map((c, i) => ({ ...c, filteredRank: i + 1 }));

        // Build mapping for judge filter
        const ljRows = (ljRes.data ?? []) as Array<{ lawyer_id: string; judge_name: string | null; total_cases: number }>;
        const jmap = new Map<string, Set<string>>();
        ljRows.forEach((r) => {
          const j = (r.judge_name ?? "").trim();
          if (!j) return;
          if (!jmap.has(r.lawyer_id)) jmap.set(r.lawyer_id, new Set<string>());
          jmap.get(r.lawyer_id)!.add(j.toLowerCase());
        });
        setLawyerToJudges(jmap);

        setLawyers(mergedLawyers);
        setJudges(mergedJudges);
        setCourts(mergedCourts);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  // Extract unique values for filters (Figma behavior, but from live data)
  const specializations = useMemo(() => {
    const specs = new Set<string>();
    lawyers.forEach((l) => (l.specialization ?? []).forEach((s) => specs.add(s)));
    return Array.from(specs).sort();
  }, [lawyers]);

  const courtsForFilter = useMemo(() => {
    const set = new Set<string>();
    lawyers.forEach((l) => (l.courts ?? []).forEach((c) => set.add(c)));
    return Array.from(set).sort();
  }, [lawyers]);

  const judgesForFilter = useMemo(() => {
    return Array.from(new Set((judges ?? []).map((j) => (j.name ?? "").trim()).filter(Boolean))).sort();
  }, [judges]);

  const locations = useMemo(() => {
    const set = new Set<string>();
    courtsForFilter.forEach((court) => {
      const location = court.split(" ")[0];
      if (location) set.add(location);
    });
    return Array.from(set).sort();
  }, [courtsForFilter]);

  // Filter and re-rank lawyers (Figma behavior)
  const filteredLawyers = useMemo(() => {
    let filtered = lawyers.filter((lawyer) => {
      const specMatch = selectedSpecialization === "all" || (lawyer.specialization ?? []).includes(selectedSpecialization);
      const courtMatch = selectedCourt === "all" || (lawyer.courts ?? []).includes(selectedCourt);
      const locationMatch = selectedLocation === "all" || (lawyer.courts ?? []).some((c) => c.startsWith(selectedLocation));
      const judgeMatch =
        judgeFilter === "all"
          ? true
          : (lawyerToJudges.get(lawyer.id)?.has(judgeFilter.toLowerCase()) ?? false);
      // Note: repFilter requires side-specific analytics; placeholder pass-through for now
      return specMatch && courtMatch && locationMatch && judgeMatch;
    });
    // Sorting: if metricSort is set, use it; otherwise use tri-factor rank buttons
    if (metricSort !== "none") {
      filtered = filtered.sort((a, b) => {
        if (metricSort === "win") return (b.win_rate ?? 0) - (a.win_rate ?? 0);
        if (metricSort === "settle" || metricSort === "settle") return (b.settlement_rate ?? 0) - (a.settlement_rate ?? 0);
        if (metricSort === "loss") return (a.loss_rate ?? 0) - (b.loss_rate ?? 0); // lower loss better
        if (metricSort === "duration") return (a.avg_case_duration_days ?? 0) - (b.avg_case_duration_days ?? 0); // faster first
        // hearings: approximate from total_cases (fallback)
        const ah = Math.max(1, Math.round((a.total_cases ?? 0) / 3));
        const bh = Math.max(1, Math.round((b.total_cases ?? 0) / 3));
        return ah - bh; // fewer hearings first
      });
    } else {
      filtered = filtered.sort((a, b) => {
        if (rankSort === "win") {
          return (b.tri?.winRateScore ?? 0) - (a.tri?.winRateScore ?? 0);
        }
        if (rankSort === "speed") {
          return (b.tri?.velocityScore ?? 0) - (a.tri?.velocityScore ?? 0);
        }
        return (b.tri?.experienceScore ?? 0) - (a.tri?.experienceScore ?? 0);
      });
    }
    return filtered.map((lawyer, index) => ({ ...lawyer, filteredRank: index + 1 }));
  }, [lawyers, selectedCourt, selectedLocation, selectedSpecialization, rankSort, metricSort, judgeFilter, lawyerToJudges]);

  const filteredJudges = useMemo(() => {
    let filtered = judges.filter((j) => {
      const specMatch = selectedJudgeSpec === "all" || selectedJudgeSpec === "MahaRERA";
      const courtMatch = selectedJudgeCourt === "all" || (j.designation ?? "").includes(selectedJudgeCourt);
      return specMatch && courtMatch;
    });
    filtered = filtered.sort((a, b) => (b.settlement_rate ?? 0) - (a.settlement_rate ?? 0));
    return filtered.map((judge, index) => ({ ...judge, filteredRank: index + 1 }));
  }, [judges, selectedJudgeCourt, selectedJudgeSpec]);

  const filteredCourts = useMemo(() => {
    let filtered = courts.filter((c) => {
      const typeMatch = selectedCourtType === "all" || selectedCourtType === "MahaRERA";
      const locationMatch = selectedCourtLocation === "all" || (c.name ?? "").includes(selectedCourtLocation);
      return typeMatch && locationMatch;
    });
    filtered = filtered.sort((a, b) => (b.settlement_rate ?? 0) - (a.settlement_rate ?? 0));
    return filtered.map((court, index) => ({ ...court, filteredRank: index + 1 }));
  }, [courts, selectedCourtLocation, selectedCourtType]);

  const clearLawyerFilters = () => {
    setSelectedSpecialization("all");
    setSelectedCourt("all");
    setSelectedLocation("all");
    setRepFilter("all");
    setJudgeFilter("all");
    setMetricSort("none");
  };
  const clearJudgeFilters = () => {
    setSelectedJudgeSpec("all");
    setSelectedJudgeCourt("all");
  };
  const clearCourtFilters = () => {
    setSelectedCourtType("all");
    setSelectedCourtLocation("all");
  };

  const hasActiveFilters = (tab: string) => {
    if (tab === "lawyers") return selectedSpecialization !== "all" || selectedCourt !== "all" || selectedLocation !== "all" || repFilter !== "all" || judgeFilter !== "all" || metricSort !== "none";
    if (tab === "judges") return selectedJudgeSpec !== "all" || selectedJudgeCourt !== "all";
    return selectedCourtType !== "all" || selectedCourtLocation !== "all";
  };

  return (
    <div className="bg-[#fafbfc]">
      {/* Compact Hero Section (Figma structure + colors) */}
      <div className="relative bg-gradient-to-br from-[#1a2332] via-[#2d3d54] to-[#1a2332] text-white overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-10 left-10 w-64 h-64 bg-[#d4a574] rounded-full blur-3xl" />
          <div className="absolute bottom-10 right-10 w-72 h-72 bg-[#3b82f6] rounded-full blur-3xl" />
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-12">
          <div className="text-center">
            <h1 className="text-3xl sm:text-5xl font-bold mb-3 tracking-tight">
              Judge My <span className="text-[#d4a574]">Lawyer</span>
            </h1>
            <p className="text-base sm:text-lg mb-6 text-white/80 max-w-2xl mx-auto">
              India's Premier Legal Analytics Platform - Make informed decisions with verified performance data
            </p>
            <div className="flex flex-col sm:flex-row justify-center gap-3">
              <button
                onClick={() => onNavigate("search")}
                className="group bg-white text-[#1a2332] px-6 py-3 rounded-xl font-semibold hover:bg-[#d4a574] hover:text-white transition-all duration-300 shadow-xl flex items-center gap-2"
              >
                Find Legal Counsel
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </button>
              <button
                onClick={() => onLogin("lawyer")}
                className="bg-white/10 backdrop-blur-sm border border-white/20 text-white px-6 py-3 rounded-xl font-semibold hover:bg-white/20 transition-all duration-300"
              >
                Lawyer Login
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* AD SPOT 1: Top Leaderboard */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <AdPlaceholder type="horizontal" />
      </div>

      {/* Rankings Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-12">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-6">
          <div>
            <h2 className="text-2xl sm:text-3xl font-bold text-[#1a2332]">Top Ranked Professionals</h2>
            <p className="text-[#5f6368] mt-1">
              {hasActiveFilters(activeTab) ? "Filtered and re-ranked based on your criteria" : "Discover India's highest-performing legal professionals"}
            </p>
          </div>

          {/* Tabs (Figma gradients per tab) */}
          <div className="inline-flex w-full md:w-auto bg-white rounded-xl p-1 shadow-lg border border-[#e0e3e7] overflow-x-auto">
            <button
              onClick={() => setActiveTab("lawyers")}
              className={`px-4 sm:px-6 py-2.5 rounded-lg font-semibold transition-all duration-300 text-sm whitespace-nowrap ${
                activeTab === "lawyers"
                  ? "bg-gradient-to-r from-[#1e40af] to-[#3b82f6] text-white shadow-md"
                  : "text-[#5f6368] hover:text-[#1a2332]"
              }`}
            >
              Lawyers
            </button>
            <button
              onClick={() => setActiveTab("judges")}
              className={`px-4 sm:px-6 py-2.5 rounded-lg font-semibold transition-all duration-300 text-sm whitespace-nowrap ${
                activeTab === "judges"
                  ? "bg-gradient-to-r from-[#7c3aed] to-[#a78bfa] text-white shadow-md"
                  : "text-[#5f6368] hover:text-[#1a2332]"
              }`}
            >
              Judges
            </button>
            <button
              onClick={() => setActiveTab("courts")}
              className={`px-4 sm:px-6 py-2.5 rounded-lg font-semibold transition-all duration-300 text-sm whitespace-nowrap ${
                activeTab === "courts"
                  ? "bg-gradient-to-r from-[#047857] to-[#10b981] text-white shadow-md"
                  : "text-[#5f6368] hover:text-[#1a2332]"
              }`}
            >
              Courts
            </button>
          </div>
        </div>

        {loading && <p className="text-sm text-[#5f6368]">Loading rankings...</p>}

        {/* Lawyers Tab */}
        {activeTab === "lawyers" && (
          <>
            {/* Filters */}
            <div className="bg-white rounded-xl border border-[#e0e3e7] p-5 mb-6 shadow-sm">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Filter className="w-5 h-5 text-[#1e40af]" />
                  <h3 className="font-bold text-[#1a2332]">Filter Lawyers</h3>
                  {hasActiveFilters("lawyers") && (
                    <span className="bg-[#1e40af] text-white text-xs px-2 py-1 rounded-full font-semibold">Active</span>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold text-[#5f6368]">Rank by:</span>
                  <div className="inline-flex rounded-lg p-1 bg-[#f0f2f5] border border-[#e0e3e7]">
                    <button
                      type="button"
                      onClick={() => setRankSort("win")}
                      className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                        rankSort === "win"
                          ? "bg-gradient-to-r from-[#1e40af] to-[#3b82f6] text-white shadow"
                          : "text-[#1a2332] hover:bg-white"
                      }`}
                    >
                      Wins
                    </button>
                    <button
                      type="button"
                      onClick={() => setRankSort("speed")}
                      className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                        rankSort === "speed"
                          ? "bg-gradient-to-r from-[#d97706] to-[#f59e0b] text-white shadow"
                          : "text-[#1a2332] hover:bg-white"
                      }`}
                    >
                      Speed
                    </button>
                    <button
                      type="button"
                      onClick={() => setRankSort("experience")}
                      className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                        rankSort === "experience"
                          ? "bg-gradient-to-r from-[#047857] to-[#10b981] text-white shadow"
                          : "text-[#1a2332] hover:bg-white"
                      }`}
                    >
                      Experience
                    </button>
                  </div>
                </div>
                {hasActiveFilters("lawyers") && (
                  <button onClick={clearLawyerFilters} className="flex items-center gap-1 text-sm text-[#b91c1c] hover:text-[#991b1b] font-semibold self-start lg:self-auto">
                    <X className="w-4 h-4" />
                    Clear All
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-[#1a2332] mb-2">Case Type</label>
                  <select
                    value={selectedSpecialization}
                    onChange={(e) => setSelectedSpecialization(e.target.value)}
                    className="w-full px-4 py-2.5 border border-[#e0e3e7] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1e40af] focus:border-transparent bg-white text-[#1a2332] font-medium"
                  >
                    <option value="all">All Case Types</option>
                    <option value="Property">Property</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-[#1a2332] mb-2">Court</label>
                  <select
                    value={selectedCourt}
                    onChange={(e) => setSelectedCourt(e.target.value)}
                    className="w-full px-4 py-2.5 border border-[#e0e3e7] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1e40af] focus:border-transparent bg-white text-[#1a2332] font-medium"
                  >
                    <option value="all">All Courts</option>
                    {courtsForFilter.map((court) => (
                      <option key={court} value={court}>
                        {court}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-[#1a2332] mb-2">Location</label>
                  <select
                    value={selectedLocation}
                    onChange={(e) => setSelectedLocation(e.target.value)}
                    className="w-full px-4 py-2.5 border border-[#e0e3e7] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1e40af] focus:border-transparent bg-white text-[#1a2332] font-medium"
                  >
                    <option value="all">All Locations</option>
                    {locations.map((loc) => (
                      <option key={loc} value={loc}>
                        {loc}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-[#1a2332] mb-2">Representation</label>
                  <select
                    value={repFilter}
                    onChange={(e) => setRepFilter(e.target.value as any)}
                    className="w-full px-4 py-2.5 border border-[#e0e3e7] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1e40af] focus:border-transparent bg-white text-[#1a2332] font-medium"
                  >
                    <option value="all">All</option>
                    <option value="Complainant">For Complainant</option>
                    <option value="Respondent">For Respondent</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-[#1a2332] mb-2">Judge</label>
                  <select
                    value={judgeFilter}
                    onChange={(e) => setJudgeFilter(e.target.value)}
                    className="w-full px-4 py-2.5 border border-[#e0e3e7] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1e40af] focus:border-transparent bg-white text-[#1a2332] font-medium"
                  >
                    <option value="all">All Judges</option>
                    {judgesForFilter.map((j) => (
                      <option key={j} value={j}>
                        {j}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-[#1a2332] mb-2">Sort by</label>
                  <select
                    value={metricSort}
                    onChange={(e) => setMetricSort(e.target.value as any)}
                    className="w-full px-4 py-2.5 border border-[#e0e3e7] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1e40af] focus:border-transparent bg-white text-[#1a2332] font-medium"
                  >
                    <option value="none">Tri‑Factor (above buttons)</option>
                    <option value="win">Win % (desc)</option>
                    <option value="settle">Settlement % (desc)</option>
                    <option value="loss">Loss % (asc)</option>
                    <option value="duration">Avg duration (asc)</option>
                    <option value="hearings">No. of hearings (asc)</option>
                  </select>
                </div>
              </div>

              {hasActiveFilters("lawyers") && (
                <div className="mt-4 pt-4 border-t border-[#e0e3e7]">
                  <p className="text-sm text-[#5f6368]">
                    Showing <span className="font-bold text-[#1a2332]">{filteredLawyers.length}</span> lawyers, re-ranked by performance in selected category
                  </p>
                </div>
              )}
            </div>

            {/* Grid Layout */}
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredLawyers.map((lawyer, index) => (
                <div key={lawyer.id}>
                  <div
                    className="group bg-white rounded-xl border border-[#e0e3e7] p-5 hover:shadow-2xl hover:border-[#3b82f6]/40 transition-all duration-300 cursor-pointer h-full flex flex-col relative"
                    onClick={() => onViewLawyerDetails(lawyer.id)}
                  >
                    {/* Prominent Rank Badge */}
                    <div className="absolute -top-3 -right-3 z-10">
                      <div
                        className={`w-16 h-16 rounded-xl flex flex-col items-center justify-center shadow-xl ${
                          lawyer.filteredRank === 1
                            ? "bg-gradient-to-br from-[#d4a574] to-[#b8915f]"
                            : lawyer.filteredRank === 2
                              ? "bg-gradient-to-br from-[#94a3b8] to-[#64748b]"
                              : lawyer.filteredRank === 3
                                ? "bg-gradient-to-br from-[#d97706] to-[#ea580c]"
                                : "bg-gradient-to-br from-[#1e40af] to-[#3b82f6]"
                        }`}
                      >
                        <span className="text-xs font-bold text-white/80 uppercase">Rank</span>
                        <span className="text-2xl font-bold text-white">{lawyer.filteredRank}</span>
                      </div>
                    </div>

                    {/* Top 3 Badge */}
                    {lawyer.filteredRank <= 3 && (
                      <div className="flex items-center gap-1 mb-3">
                        <Award className="w-5 h-5 text-[#d4a574]" />
                        <span className="text-xs font-bold text-[#d4a574] uppercase">Top Performer</span>
                      </div>
                    )}

                    {/* Lawyer Info */}
                    <div className="mb-4">
                      <h3 className="text-lg font-bold text-[#1a2332] group-hover:text-[#1e40af] transition-colors mb-2 pr-12">
                        {lawyer.name ?? "Unnamed Lawyer"}
                      </h3>
                      <div className="flex flex-wrap gap-1.5 mb-3">
                        {(lawyer.specialization ?? ["MahaRERA"]).slice(0, 2).map((spec, idx) => (
                          <span key={idx} className="px-2.5 py-1 bg-[#e8f0fe] text-[#1e40af] text-xs font-semibold rounded-md">
                            {spec}
                          </span>
                        ))}
                        {(lawyer.specialization ?? []).length > 2 && (
                          <span className="px-2 py-1 bg-[#f0f2f5] text-[#5f6368] text-xs font-semibold rounded-md">
                            +{(lawyer.specialization ?? []).length - 2}
                          </span>
                        )}
                      </div>
                      <div className="space-y-1.5 text-xs text-[#5f6368]">
                        <div className="flex items-center gap-1.5">
                          {(() => {
                            const win = Number(lawyer.tri?.winRateScore ?? 0);
                            const spd = Number(lawyer.tri?.velocityScore ?? 0);
                            const exp = Number(lawyer.tri?.experienceScore ?? 0);
                            const label = rankSort === "win" ? "Win Score" : rankSort === "speed" ? "Speed Score" : "Experience Score";
                            const value = rankSort === "win" ? win : rankSort === "speed" ? spd : exp;
                            return (
                              <span className="font-semibold text-[#1a2332]">
                                {label}: {value.toFixed(0)}
                              </span>
                            );
                          })()}
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                type="button"
                                onClick={(e) => e.stopPropagation()}
                                className="inline-flex h-5 w-5 items-center justify-center rounded-full text-[#5f6368] hover:bg-[#f0f2f5] hover:text-[#1a2332]"
                                aria-label="Rank score formula"
                              >
                                <Info className="w-3.5 h-3.5" />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent sideOffset={6} className="max-w-[320px]">
                              {rankSort === "win" && (
                                <span>
                                  Win Score: Bayesian-smoothed win rate (Settlements count as 0.5 wins), using (wins + 0.5·settlements + 1) / (total + 2), scaled to 0–100.
                                </span>
                              )}
                              {rankSort === "experience" && (
                                <span>
                                  Experience Score: Logarithmic mapping of total cases to 0–100 using log10(totalCases + 1).
                                </span>
                              )}
                              {rankSort === "speed" && (
                                <span>
                                  Speed Score: Duration efficiency vs 200-day tribunal avg (baseline 50 for hearings), then weighted by true win% + 0.2 buffer.
                                </span>
                              )}
                            </TooltipContent>
                          </Tooltip>
                        </div>
                        <div className="flex items-center gap-2">
                          <Briefcase className="w-3.5 h-3.5 flex-shrink-0" />
                          <span className="font-semibold">Live profile</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Building2 className="w-3.5 h-3.5 flex-shrink-0" />
                          <span className="font-semibold truncate">{(lawyer.courts ?? [])[0] ?? "MahaRERA"}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Scale className="w-3.5 h-3.5 flex-shrink-0" />
                          <span className="font-semibold">{lawyer.total_cases} total cases</span>
                        </div>
                      </div>
                    </div>

                    {/* Stats Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-auto">
                      <div className="text-center bg-gradient-to-br from-[#ecfdf5] to-[#d1fae5] p-3 rounded-lg border border-[#10b981]/20">
                        <div className="flex items-center justify-center gap-1 mb-1">
                          <TrendingUp className="w-3.5 h-3.5 text-[#047857]" />
                          <span className="text-xl font-bold text-[#047857]">{Number(lawyer.win_rate ?? 0).toFixed(1)}%</span>
                        </div>
                        <p className="text-[10px] font-bold text-[#065f46] uppercase">Win</p>
                      </div>
                      <div className="text-center bg-gradient-to-br from-[#fef2f2] to-[#fee2e2] p-3 rounded-lg border border-[#dc2626]/20">
                        <div className="flex items-center justify-center gap-1 mb-1">
                          <TrendingDown className="w-3.5 h-3.5 text-[#b91c1c]" />
                          <span className="text-xl font-bold text-[#b91c1c]">{Number(lawyer.loss_rate ?? 0).toFixed(1)}%</span>
                        </div>
                        <p className="text-[10px] font-bold text-[#991b1b] uppercase">Loss</p>
                      </div>
                      <div className="text-center bg-gradient-to-br from-[#fef3c7] to-[#fde68a] p-3 rounded-lg border border-[#d97706]/20">
                        <div className="flex items-center justify-center gap-1 mb-1">
                          <Handshake className="w-3.5 h-3.5 text-[#92400e]" />
                          <span className="text-xl font-bold text-[#92400e]">{Number(lawyer.settlement_rate ?? 0).toFixed(1)}%</span>
                        </div>
                        <p className="text-[10px] font-bold text-[#78350f] uppercase">Settle</p>
                      </div>
                      <div className="text-center bg-[#f0f2f5] p-2 rounded-lg sm:col-span-3">
                        <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3">
                          <div className="flex items-center gap-1 whitespace-nowrap">
                            <Clock className="w-3.5 h-3.5 text-[#d97706]" />
                            <span className="text-sm font-bold text-[#1a2332]">{Math.round(lawyer.avg_case_duration_days ?? 0)}d</span>
                            <span className="text-xs text-[#5f6368]">avg duration</span>
                          </div>
                          <div className="hidden sm:block w-px h-4 bg-[#e0e3e7]" />
                          <div className="flex items-center gap-1 whitespace-nowrap">
                            <Calendar className="w-3.5 h-3.5 text-[#7c3aed]" />
                            <span className="text-sm font-bold text-[#1a2332]">{Math.max(1, Math.round((lawyer.total_cases ?? 0) / 3))}</span>
                            <span className="text-xs text-[#5f6368]">hearings</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* AD SPOT 2: In-feed ads after every 6 cards */}
                  {(index + 1) % 6 === 0 && index !== filteredLawyers.length - 1 && (
                    <div className="col-span-full py-4">
                      <AdPlaceholder type="horizontal" />
                    </div>
                  )}
                </div>
              ))}
            </div>

            {filteredLawyers.length === 0 && (
              <div className="text-center py-12">
                <Search className="w-16 h-16 text-[#c4c9d0] mx-auto mb-4" />
                <h3 className="text-xl font-bold text-[#1a2332] mb-2">No lawyers found</h3>
                <p className="text-[#5f6368] mb-4">Try adjusting your filters to see more results</p>
                <button onClick={clearLawyerFilters} className="text-[#1e40af] hover:text-[#1a2332] font-semibold">
                  Clear all filters
                </button>
              </div>
            )}

            {filteredLawyers.length > 0 && (
              <div className="text-center pt-8">
                <button
                  onClick={() => onNavigate("lawyers")}
                  className="group inline-flex items-center gap-2 text-[#1e40af] hover:text-[#1a2332] font-bold text-lg"
                >
                  View All Lawyers
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-2 transition-transform" />
                </button>
              </div>
            )}
          </>
        )}

        {/* Judges Tab */}
        {activeTab === "judges" && (
          <>
            <div className="bg-white rounded-xl border border-[#e0e3e7] p-5 mb-6 shadow-sm">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Filter className="w-5 h-5 text-[#7c3aed]" />
                  <h3 className="font-bold text-[#1a2332]">Filter Judges</h3>
                  {hasActiveFilters("judges") && (
                    <span className="bg-[#7c3aed] text-white text-xs px-2 py-1 rounded-full font-semibold">Active</span>
                  )}
                </div>
                {hasActiveFilters("judges") && (
                  <button onClick={clearJudgeFilters} className="flex items-center gap-1 text-sm text-[#b91c1c] hover:text-[#991b1b] font-semibold">
                    <X className="w-4 h-4" />
                    Clear All
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-[#1a2332] mb-2">Specialization</label>
                  <select
                    value={selectedJudgeSpec}
                    onChange={(e) => setSelectedJudgeSpec(e.target.value)}
                    className="w-full px-4 py-2.5 border border-[#e0e3e7] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#7c3aed] focus:border-transparent bg-white text-[#1a2332] font-medium"
                  >
                    <option value="all">All Specializations</option>
                    <option value="MahaRERA">MahaRERA</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-[#1a2332] mb-2">Court</label>
                  <select
                    value={selectedJudgeCourt}
                    onChange={(e) => setSelectedJudgeCourt(e.target.value)}
                    className="w-full px-4 py-2.5 border border-[#e0e3e7] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#7c3aed] focus:border-transparent bg-white text-[#1a2332] font-medium"
                  >
                    <option value="all">All Courts</option>
                    <option value="MahaRERA">MahaRERA</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredJudges.map((judge) => (
                <div
                  key={judge.id}
                  className="group bg-white rounded-xl border border-[#e0e3e7] p-5 hover:shadow-2xl hover:border-[#a78bfa]/60 transition-all duration-300 cursor-pointer h-full flex flex-col relative"
                  onClick={() => onViewJudgeDetails(judge.id)}
                >
                  <div className="absolute -top-3 -right-3 z-10">
                    <div
                      className={`w-16 h-16 rounded-xl flex flex-col items-center justify-center shadow-xl ${
                        judge.filteredRank === 1
                          ? "bg-gradient-to-br from-[#d4a574] to-[#b8915f]"
                          : judge.filteredRank === 2
                            ? "bg-gradient-to-br from-[#94a3b8] to-[#64748b]"
                            : judge.filteredRank === 3
                              ? "bg-gradient-to-br from-[#d97706] to-[#ea580c]"
                              : "bg-gradient-to-br from-[#7c3aed] to-[#a78bfa]"
                      }`}
                    >
                      <span className="text-xs font-bold text-white/80 uppercase">Rank</span>
                      <span className="text-2xl font-bold text-white">{judge.filteredRank}</span>
                    </div>
                  </div>

                  {judge.filteredRank <= 3 && (
                    <div className="flex items-center gap-1 mb-3">
                      <Award className="w-5 h-5 text-[#d4a574]" />
                      <span className="text-xs font-bold text-[#d4a574] uppercase">Top Performer</span>
                    </div>
                  )}

                  <div className="mb-4">
                    <h3 className="text-lg font-bold text-[#1a2332] group-hover:text-[#7c3aed] transition-colors mb-2 pr-12">
                      {judge.name ?? "Unnamed Judge"}
                    </h3>
                    <div className="space-y-1.5 text-xs text-[#5f6368]">
                      <div className="flex items-center gap-2">
                        <Gavel className="w-3.5 h-3.5 flex-shrink-0" />
                        <span className="font-semibold">{judge.designation ?? "MahaRERA"}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Scale className="w-3.5 h-3.5 flex-shrink-0" />
                        <span className="font-semibold">{judge.total_cases} cases</span>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-auto">
                    <div className="text-center bg-gradient-to-br from-[#eff6ff] to-[#dbeafe] p-3 rounded-lg border border-[#3b82f6]/20">
                      <div className="flex items-center justify-center gap-1 mb-1">
                        <Scale className="w-3.5 h-3.5 text-[#1e40af]" />
                        <span className="text-xl font-bold text-[#1e40af]">{Number(judge.favor_complainant_rate ?? 0).toFixed(1)}%</span>
                      </div>
                      <p className="text-[10px] font-bold text-[#1e3a8a] uppercase">Complainant</p>
                    </div>
                    <div className="text-center bg-gradient-to-br from-[#ecfdf5] to-[#d1fae5] p-3 rounded-lg border border-[#10b981]/20">
                      <div className="flex items-center justify-center gap-1 mb-1">
                        <Gavel className="w-3.5 h-3.5 text-[#047857]" />
                        <span className="text-xl font-bold text-[#047857]">{Number(judge.favor_respondent_rate ?? 0).toFixed(1)}%</span>
                      </div>
                      <p className="text-[10px] font-bold text-[#065f46] uppercase">Respondent</p>
                    </div>
                    <div className="text-center bg-gradient-to-br from-[#fef3c7] to-[#fde68a] p-3 rounded-lg border border-[#d97706]/20">
                      <div className="flex items-center justify-center gap-1 mb-1">
                        <Handshake className="w-3.5 h-3.5 text-[#92400e]" />
                        <span className="text-xl font-bold text-[#92400e]">{Number(judge.settlement_rate ?? 0).toFixed(1)}%</span>
                      </div>
                      <p className="text-[10px] font-bold text-[#78350f] uppercase">Settled</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {filteredJudges.length === 0 && (
              <div className="text-center py-12">
                <Search className="w-16 h-16 text-[#c4c9d0] mx-auto mb-4" />
                <h3 className="text-xl font-bold text-[#1a2332] mb-2">No judges found</h3>
                <p className="text-[#5f6368] mb-4">Try adjusting your filters to see more results</p>
                <button onClick={clearJudgeFilters} className="text-[#7c3aed] hover:text-[#1a2332] font-semibold">
                  Clear all filters
                </button>
              </div>
            )}

            {filteredJudges.length > 0 && (
              <div className="text-center pt-8">
                <button
                  onClick={() => onNavigate("judges")}
                  className="group inline-flex items-center gap-2 text-[#7c3aed] hover:text-[#1a2332] font-bold text-lg"
                >
                  View All Judges
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-2 transition-transform" />
                </button>
              </div>
            )}
          </>
        )}

        {/* Courts Tab */}
        {activeTab === "courts" && (
          <>
            <div className="bg-white rounded-xl border border-[#e0e3e7] p-5 mb-6 shadow-sm">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Filter className="w-5 h-5 text-[#047857]" />
                  <h3 className="font-bold text-[#1a2332]">Filter Courts</h3>
                  {hasActiveFilters("courts") && (
                    <span className="bg-[#047857] text-white text-xs px-2 py-1 rounded-full font-semibold">Active</span>
                  )}
                </div>
                {hasActiveFilters("courts") && (
                  <button onClick={clearCourtFilters} className="flex items-center gap-1 text-sm text-[#b91c1c] hover:text-[#991b1b] font-semibold">
                    <X className="w-4 h-4" />
                    Clear All
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-[#1a2332] mb-2">Type</label>
                  <select
                    value={selectedCourtType}
                    onChange={(e) => setSelectedCourtType(e.target.value)}
                    className="w-full px-4 py-2.5 border border-[#e0e3e7] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#047857] focus:border-transparent bg-white text-[#1a2332] font-medium"
                  >
                    <option value="all">All Types</option>
                    <option value="MahaRERA">MahaRERA</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-[#1a2332] mb-2">Location</label>
                  <select
                    value={selectedCourtLocation}
                    onChange={(e) => setSelectedCourtLocation(e.target.value)}
                    className="w-full px-4 py-2.5 border border-[#e0e3e7] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#047857] focus:border-transparent bg-white text-[#1a2332] font-medium"
                  >
                    <option value="all">All Locations</option>
                    {Array.from(new Set(filteredCourts.map((c) => (c.name ?? "").split(" ")[0]).filter(Boolean))).map((loc) => (
                      <option key={loc} value={loc}>
                        {loc}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredCourts.map((court) => (
                <div
                  key={court.id}
                  className="group bg-white rounded-xl border border-[#e0e3e7] p-5 hover:shadow-2xl hover:border-[#10b981]/40 transition-all duration-300 cursor-pointer h-full flex flex-col relative"
                  onClick={() => onViewCourtDetails(court.id)}
                >
                  <div className="absolute -top-3 -right-3 z-10">
                    <div
                      className={`w-16 h-16 rounded-xl flex flex-col items-center justify-center shadow-xl ${
                        court.filteredRank === 1
                          ? "bg-gradient-to-br from-[#d4a574] to-[#b8915f]"
                          : court.filteredRank === 2
                            ? "bg-gradient-to-br from-[#94a3b8] to-[#64748b]"
                            : court.filteredRank === 3
                              ? "bg-gradient-to-br from-[#d97706] to-[#ea580c]"
                              : "bg-gradient-to-br from-[#047857] to-[#10b981]"
                      }`}
                    >
                      <span className="text-xs font-bold text-white/80 uppercase">Rank</span>
                      <span className="text-2xl font-bold text-white">{court.filteredRank}</span>
                    </div>
                  </div>

                  {court.filteredRank <= 3 && (
                    <div className="flex items-center gap-1 mb-3">
                      <Award className="w-5 h-5 text-[#d4a574]" />
                      <span className="text-xs font-bold text-[#d4a574] uppercase">Top Performer</span>
                    </div>
                  )}

                  <div className="mb-4">
                    <h3 className="text-lg font-bold text-[#1a2332] group-hover:text-[#047857] transition-colors mb-2 pr-12">
                      {court.name ?? "Unnamed Court"}
                    </h3>
                    <div className="space-y-1.5 text-xs text-[#5f6368]">
                      <div className="flex items-center gap-2">
                        <Building2 className="w-3.5 h-3.5 flex-shrink-0" />
                        <span className="font-semibold">MahaRERA</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Scale className="w-3.5 h-3.5 flex-shrink-0" />
                        <span className="font-semibold">{court.total_cases} cases</span>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-auto">
                    <div className="text-center bg-gradient-to-br from-[#ecfdf5] to-[#d1fae5] p-3 rounded-lg border border-[#10b981]/20">
                      <div className="flex items-center justify-center gap-1 mb-1">
                        <Handshake className="w-3.5 h-3.5 text-[#047857]" />
                        <span className="text-xl font-bold text-[#047857]">{Number(court.settlement_rate ?? 0).toFixed(1)}%</span>
                      </div>
                      <p className="text-[10px] font-bold text-[#065f46] uppercase">Settled</p>
                    </div>
                    <div className="text-center bg-gradient-to-br from-[#fef2f2] to-[#fee2e2] p-3 rounded-lg border border-[#dc2626]/20">
                      <div className="flex items-center justify-center gap-1 mb-1">
                        <X className="w-3.5 h-3.5 text-[#b91c1c]" />
                        <span className="text-xl font-bold text-[#b91c1c]">{court.dismissed_cases ?? 0}</span>
                      </div>
                      <p className="text-[10px] font-bold text-[#991b1b] uppercase">Dismissed</p>
                    </div>
                    <div className="text-center bg-gradient-to-br from-[#fef3c7] to-[#fde68a] p-3 rounded-lg border border-[#d97706]/20">
                      <div className="flex items-center justify-center gap-1 mb-1">
                        <Clock className="w-3.5 h-3.5 text-[#92400e]" />
                        <span className="text-xl font-bold text-[#92400e]">{Math.round(court.avg_case_duration_days ?? 0)}d</span>
                      </div>
                      <p className="text-[10px] font-bold text-[#78350f] uppercase">Duration</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {filteredCourts.length === 0 && (
              <div className="text-center py-12">
                <Search className="w-16 h-16 text-[#c4c9d0] mx-auto mb-4" />
                <h3 className="text-xl font-bold text-[#1a2332] mb-2">No courts found</h3>
                <p className="text-[#5f6368] mb-4">Try adjusting your filters to see more results</p>
                <button onClick={clearCourtFilters} className="text-[#047857] hover:text-[#1a2332] font-semibold">
                  Clear all filters
                </button>
              </div>
            )}

            {filteredCourts.length > 0 && (
              <div className="text-center pt-8">
                <button
                  onClick={() => onNavigate("courts")}
                  className="group inline-flex items-center gap-2 text-[#047857] hover:text-[#1a2332] font-bold text-lg"
                >
                  View All Courts
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-2 transition-transform" />
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
