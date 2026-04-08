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

const CARDS_PER_PAGE = 10;

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
  court_type: string;
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
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [totalLawyersCount, setTotalLawyersCount] = useState(0);
  const [totalJudgesCount, setTotalJudgesCount] = useState(0);
  const [totalCourtsCount, setTotalCourtsCount] = useState(0);

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
  const [judgeFilter, setJudgeFilter] = useState<string>("all");
  const [metricSort, setMetricSort] = useState<"none" | "win" | "settle" | "loss" | "duration" | "hearings">("none");

  // Judge filters
  const [selectedJudgeSpec, setSelectedJudgeSpec] = useState<string>("all");
  const [selectedJudgeCourt, setSelectedJudgeCourt] = useState<string>("all");

  // Court filters
  const [selectedCourtType, setSelectedCourtType] = useState<string>("all");
  const [selectedCourtLocation, setSelectedCourtLocation] = useState<string>("all");

  // Dropdown options (fetched from Supabase, not hardcoded)
  const [specializations, setSpecializations] = useState<string[]>([]);
  const [courtsForFilter, setCourtsForFilter] = useState<string[]>([]);
  const [judgesForFilter, setJudgesForFilter] = useState<string[]>([]);
  const [locations, setLocations] = useState<string[]>([]);
  const [judgeCourtsForFilter, setJudgeCourtsForFilter] = useState<string[]>([]);
  const [courtTypesForFilter, setCourtTypesForFilter] = useState<string[]>([]);
  const [courtLocationsForFilter, setCourtLocationsForFilter] = useState<string[]>([]);
  const [caseTypesForFilter, setCaseTypesForFilter] = useState<string[]>([]);
  const [courtNamesForFilter, setCourtNamesForFilter] = useState<string[]>([]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const supabase = getSupabase();

        const [lawyerOptionsRes, judgeOptionsRes, courtOptionsRes, caseAnalyticsRes] = await Promise.all([
          supabase.from("lawyers").select("specialization,courts").range(0, 4999),
          supabase.from("judges").select("name,designation").range(0, 4999),
          supabase.from("court_analytics").select("court_name").range(0, 4999),
          supabase.from("cases_analytics").select("case_type").range(0, 4999),
        ]);

        if (!mounted) return;

        const lawyerRows = (lawyerOptionsRes.data ?? []) as Array<{ specialization: string[] | null; courts: string[] | null }>;
        const specSet = new Set<string>();
        const lawyerCourtSet = new Set<string>();
        lawyerRows.forEach((row) => {
          (row.specialization ?? []).forEach((s) => {
            const value = (s ?? "").trim();
            if (value) specSet.add(value);
          });
          (row.courts ?? []).forEach((c) => {
            const value = (c ?? "").trim();
            if (value) lawyerCourtSet.add(value);
          });
        });

        const judgeRows = (judgeOptionsRes.data ?? []) as Array<{ name: string | null; designation: string | null }>;
        const judgeNameSet = new Set<string>();
        const judgeCourtSet = new Set<string>();
        judgeRows.forEach((row) => {
          const name = (row.name ?? "").trim();
          if (name) judgeNameSet.add(name);
          const designation = (row.designation ?? "").trim();
          if (designation) judgeCourtSet.add(designation);
        });

        const courtRows = (courtOptionsRes.data ?? []) as Array<{ court_name: string | null }>;
        const courtLocationSet = new Set<string>();
        const courtTypeSet = new Set<string>();
        const courtNamesSet = new Set<string>();
        courtRows.forEach((row) => {
          const name = (row.court_name ?? "").trim();
          if (!name) return;
          courtNamesSet.add(name);
          const firstToken = name.split(" ")[0]?.trim();
          if (firstToken) courtLocationSet.add(firstToken);

          if (name.toLowerCase().includes("rera")) {
            courtTypeSet.add("MahaRERA");
          } else {
            courtTypeSet.add("Court");
          }
        });

        const caseAnalyticsRows = (caseAnalyticsRes.data ?? []) as Array<{ case_type: string | null }>;
        const caseTypesSet = new Set<string>();
        caseAnalyticsRows.forEach((row) => {
          const caseType = (row.case_type ?? "").trim();
          if (caseType) caseTypesSet.add(caseType);
        });

        const lawyerCourts = Array.from(lawyerCourtSet).sort();
        setSpecializations(Array.from(specSet).sort());
        setCourtsForFilter(lawyerCourts);
        setJudgesForFilter(Array.from(judgeNameSet).sort());
        setLocations(
          Array.from(
            new Set(
              lawyerCourts
                .map((court) => court.split(" ")[0]?.trim())
                .filter(Boolean) as string[],
            ),
          ).sort(),
        );
        setJudgeCourtsForFilter(Array.from(judgeCourtSet).sort());
        setCourtTypesForFilter(Array.from(courtTypeSet).sort());
        setCourtLocationsForFilter(Array.from(courtLocationSet).sort());
        setCaseTypesForFilter(Array.from(caseTypesSet).sort());
        setCourtNamesForFilter(Array.from(courtNamesSet).sort());
      } catch {
        // Keep UI usable if options query fails.
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        const supabase = getSupabase();
        const from = (currentPage - 1) * CARDS_PER_PAGE;
        const to = from + CARDS_PER_PAGE - 1;

        const intersectIds = (left: string[] | null, right: string[]) => {
          if (left === null) return right;
          const rightSet = new Set(right);
          return left.filter((id) => rightSet.has(id));
        };

        const lawyerSortColumn =
          metricSort === "win"
            ? "win_rate"
            : metricSort === "settle"
              ? "settlement_rate"
              : metricSort === "loss"
                ? "loss_rate"
                : metricSort === "duration"
                  ? "avg_case_duration_days"
                  : metricSort === "hearings"
                    ? "total_cases"
                    : rankSort === "speed"
                      ? "velocity_score"
                      : rankSort === "experience"
                        ? "experience_score"
                        : "win_rate_score";

        const lawyerSortAscending = metricSort === "loss" || metricSort === "duration" || metricSort === "hearings";
        const EMPTY_UUID = "00000000-0000-0000-0000-000000000000";

        let lawyerIdsFilter: string[] | null = null;

        if (selectedSpecialization !== "all" || selectedCourt !== "all" || selectedLocation !== "all") {
          let lawyerMetaQuery = supabase.from("lawyers").select("id");

          if (selectedSpecialization !== "all") {
            lawyerMetaQuery = lawyerMetaQuery.contains("specialization", [selectedSpecialization]);
          }

          if (selectedCourt !== "all") {
            lawyerMetaQuery = lawyerMetaQuery.contains("courts", [selectedCourt]);
          }

          if (selectedLocation !== "all") {
            const locationCourts = courtsForFilter.filter((court) => court.toLowerCase().startsWith(selectedLocation.toLowerCase()));
            if (locationCourts.length === 0) {
              lawyerIdsFilter = [];
            } else {
              lawyerMetaQuery = lawyerMetaQuery.overlaps("courts", locationCourts);
            }
          }

          if (lawyerIdsFilter === null) {
            const { data: lawyerMetaRows } = await lawyerMetaQuery;
            lawyerIdsFilter = (lawyerMetaRows ?? []).map((row: any) => row.id as string);
          }
        }

        if (judgeFilter !== "all") {
          const { data: judgeLawyerRows } = await supabase
            .from("lawyer_judge_analytics")
            .select("lawyer_id")
            .ilike("judge_name", `%${judgeFilter}%`)
            .range(0, 9999);

          const judgeMatchedIds = Array.from(new Set((judgeLawyerRows ?? []).map((row: any) => row.lawyer_id as string)));
          lawyerIdsFilter = intersectIds(lawyerIdsFilter, judgeMatchedIds);
        }

        let lawyerAnalyticsQuery = supabase
          .from("lawyer_analytics")
          .select("lawyer_id,lawyer_name,total_cases,won_cases,lost_cases,settled_cases,win_rate,loss_rate,settlement_rate,avg_case_duration_days,win_rate_score,experience_score,velocity_score", { count: "exact" })
          .order(lawyerSortColumn, { ascending: lawyerSortAscending })
          .range(from, to);

        if (lawyerIdsFilter !== null) {
          if (lawyerIdsFilter.length === 0) {
            lawyerAnalyticsQuery = supabase
              .from("lawyer_analytics")
              .select("lawyer_id,lawyer_name,total_cases,won_cases,lost_cases,settled_cases,win_rate,loss_rate,settlement_rate,avg_case_duration_days,win_rate_score,experience_score,velocity_score", { count: "exact" })
              .in("lawyer_id", [EMPTY_UUID])
              .range(0, 0);
          } else {
            lawyerAnalyticsQuery = lawyerAnalyticsQuery.in("lawyer_id", lawyerIdsFilter);
          }
        }

        let judgeIdsFilter: string[] | null = null;
        if (selectedJudgeCourt !== "all" || selectedJudgeSpec !== "all") {
          let judgeMetaQuery = supabase.from("judges").select("id");

          if (selectedJudgeCourt !== "all") {
            judgeMetaQuery = judgeMetaQuery.ilike("designation", `%${selectedJudgeCourt}%`);
          }

          if (selectedJudgeSpec !== "all") {
            judgeMetaQuery = judgeMetaQuery.ilike("designation", `%${selectedJudgeSpec}%`);
          }

          const { data: judgeMetaRows } = await judgeMetaQuery;
          judgeIdsFilter = (judgeMetaRows ?? []).map((row: any) => row.id as string);
        }

        let judgeAnalyticsQuery = supabase
          .from("judge_analytics")
          .select("judge_id,judge_name,total_cases,favor_complainant_rate,favor_respondent_rate,settlement_rate", { count: "exact" })
          .order("total_cases", { ascending: false })
          .range(from, to);

        if (judgeIdsFilter !== null) {
          if (judgeIdsFilter.length === 0) {
            judgeAnalyticsQuery = supabase
              .from("judge_analytics")
              .select("judge_id,judge_name,total_cases,favor_complainant_rate,favor_respondent_rate,settlement_rate", { count: "exact" })
              .in("judge_id", [EMPTY_UUID])
              .range(0, 0);
          } else {
            judgeAnalyticsQuery = judgeAnalyticsQuery.in("judge_id", judgeIdsFilter);
          }
        }

        let courtAnalyticsQuery = supabase
          .from("court_analytics")
          .select("court_id,court_name,total_cases,settlement_rate,dismissed_cases,withdrawn_cases,partially_granted_cases,avg_case_duration_days", { count: "exact" })
          .order("total_cases", { ascending: false })
          .range(from, to);

        if (selectedCourtLocation !== "all") {
          courtAnalyticsQuery = courtAnalyticsQuery.ilike("court_name", `${selectedCourtLocation}%`);
        }

        if (selectedCourtType !== "all") {
          courtAnalyticsQuery = courtAnalyticsQuery.ilike("court_name", `%${selectedCourtType}%`);
        }

        const [lawyerAnalyticsRes, judgeAnalyticsRes, courtAnalyticsRes] = await Promise.all([
          lawyerAnalyticsQuery,
          judgeAnalyticsQuery,
          courtAnalyticsQuery,
        ]);

        if (!mounted) return;

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
        const lawyerIds = lawyerAnalytics.map((l) => l.lawyer_id);
        const lawyersRes = lawyerIds.length
          ? await supabase.from("lawyers").select("id,name,specialization,courts").in("id", lawyerIds)
          : { data: [] as any[] };
        const lawyerCaseFallbackRes = lawyerIds.length
          ? await supabase
              .from("cases")
              .select("lawyer_id,case_type,court_name")
              .in("lawyer_id", lawyerIds)
              .range(0, 4999)
          : { data: [] as any[] };

        const lawyersBase = (lawyersRes.data ?? []) as Array<{ id: string; name: string | null; specialization: string[] | null; courts: string[] | null }>;
        const lawyersById = new Map(lawyersBase.map((l) => [l.id, l]));
        const caseFallbackRows = (lawyerCaseFallbackRes.data ?? []) as Array<{
          lawyer_id: string | null;
          case_type: string | null;
          court_name: string | null;
        }>;
        const fallbackByLawyerName = new Map<
          string,
          { specializations: Set<string>; courts: Set<string> }
        >();

        caseFallbackRows.forEach((row) => {
          const key = (row.lawyer_id ?? "").trim();
          if (!key) return;

          const existing =
            fallbackByLawyerName.get(key) ??
            { specializations: new Set<string>(), courts: new Set<string>() };

          const caseType = (row.case_type ?? "").trim();
          if (caseType) existing.specializations.add(caseType);

          const courtName = (row.court_name ?? "").trim();
          if (courtName) existing.courts.add(courtName);

          fallbackByLawyerName.set(key, existing);
        });

        const mergedLawyers: LawyerRow[] = lawyerAnalytics.map((a, idx) => {
          const base = lawyersById.get(a.lawyer_id);
          const fallback = fallbackByLawyerName.get(a.lawyer_id);
          const baseSpecialization = (base?.specialization ?? [])
            .map((s) => (s ?? "").trim())
            .filter(Boolean);
          const baseCourts = (base?.courts ?? [])
            .map((c) => (c ?? "").trim())
            .filter(Boolean);
          const tri = {
            winRateScore: a.win_rate_score ?? 0,
            experienceScore: a.experience_score ?? 0,
            velocityScore: a.velocity_score ?? 0,
          };
          return {
            id: a.lawyer_id,
            name: base?.name ?? a.lawyer_name ?? null,
            specialization:
              baseSpecialization.length > 0
                ? baseSpecialization
                : Array.from(fallback?.specializations ?? []),
            courts: baseCourts.length > 0 ? baseCourts : Array.from(fallback?.courts ?? []),
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
            filteredRank: from + idx + 1,
          };
        });

        const judgeAnalytics = (judgeAnalyticsRes.data ?? []) as Array<{
          judge_id: string;
          judge_name: string;
          total_cases: number;
          favor_complainant_rate: number;
          favor_respondent_rate: number;
          settlement_rate: number;
        }>;
        const judgeIds = judgeAnalytics.map((j) => j.judge_id);
        const judgesRes = judgeIds.length
          ? await supabase.from("judges").select("id,name,designation").in("id", judgeIds)
          : { data: [] as any[] };
        const judgesBase = (judgesRes.data ?? []) as Array<{ id: string; name: string | null; designation: string | null }>;
        const judgesById = new Map(judgesBase.map((j) => [j.id, j]));

        const mergedJudges: JudgeRow[] = judgeAnalytics.map((a, idx) => {
          const base = judgesById.get(a.judge_id);
          return {
            id: a.judge_id,
            name: base?.name ?? a.judge_name ?? null,
            designation: base?.designation ?? null,
            total_cases: a.total_cases ?? 0,
            favor_complainant_rate: a.favor_complainant_rate ?? 0,
            favor_respondent_rate: a.favor_respondent_rate ?? 0,
            settlement_rate: a.settlement_rate ?? 0,
            filteredRank: from + idx + 1,
          };
        });

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
        const mergedCourts: CourtRow[] = courtAnalytics.map((a, idx) => {
          const courtType = (a.court_name ?? "").toLowerCase().includes("rera") ? "MahaRERA" : "Court";
          return {
            id: a.court_id,
            court_type: courtType,
            name: a.court_name ?? null,
            total_cases: a.total_cases ?? 0,
            settlement_rate: a.settlement_rate ?? 0,
            dismissed_cases: a.dismissed_cases ?? 0,
          withdrawn_cases: a.withdrawn_cases ?? 0,
          partially_granted_cases: a.partially_granted_cases ?? 0,
          avg_case_duration_days: a.avg_case_duration_days ?? 0,
          filteredRank: from + idx + 1,
          };
        });

        setLawyers(mergedLawyers);
        setJudges(mergedJudges);
        setCourts(mergedCourts);
        setTotalLawyersCount(lawyerAnalyticsRes.count ?? 0);
        setTotalJudgesCount(judgeAnalyticsRes.count ?? 0);
        setTotalCourtsCount(courtAnalyticsRes.count ?? 0);
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [
    currentPage,
    selectedSpecialization,
    selectedCourt,
    selectedLocation,
    judgeFilter,
    metricSort,
    rankSort,
    selectedJudgeSpec,
    selectedJudgeCourt,
    selectedCourtType,
    selectedCourtLocation,
    courtsForFilter,
  ]);

  // Data is already filtered and sorted server-side.
  const filteredLawyers = useMemo(() => lawyers, [lawyers]);
  const filteredJudges = useMemo(() => judges, [judges]);
  const filteredCourts = useMemo(() => courts, [courts]);

  const totalPages = useMemo(() => {
    if (activeTab === "lawyers") return Math.max(1, Math.ceil(totalLawyersCount / CARDS_PER_PAGE));
    if (activeTab === "judges") return Math.max(1, Math.ceil(totalJudgesCount / CARDS_PER_PAGE));
    return Math.max(1, Math.ceil(totalCourtsCount / CARDS_PER_PAGE));
  }, [activeTab, totalCourtsCount, totalJudgesCount, totalLawyersCount]);

  const paginatedLawyers = useMemo(() => {
    return filteredLawyers;
  }, [filteredLawyers]);

  const paginatedJudges = useMemo(() => {
    return filteredJudges;
  }, [filteredJudges]);

  const paginatedCourts = useMemo(() => {
    return filteredCourts;
  }, [filteredCourts]);

  useEffect(() => {
    setCurrentPage(1);
  }, [
    activeTab,
    selectedSpecialization,
    selectedCourt,
    selectedLocation,
    judgeFilter,
    metricSort,
    rankSort,
    selectedJudgeSpec,
    selectedJudgeCourt,
    selectedCourtType,
    selectedCourtLocation,
  ]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const clearLawyerFilters = () => {
    setSelectedSpecialization("all");
    setSelectedCourt("all");
    setSelectedLocation("all");
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
    if (tab === "lawyers") return selectedSpecialization !== "all" || selectedCourt !== "all" || selectedLocation !== "all" || judgeFilter !== "all" || metricSort !== "none";
    if (tab === "judges") return selectedJudgeSpec !== "all" || selectedJudgeCourt !== "all";
    return selectedCourtType !== "all" || selectedCourtLocation !== "all";
  };

  const showPagination =
    (activeTab === "lawyers" && totalLawyersCount > CARDS_PER_PAGE) ||
    (activeTab === "judges" && totalJudgesCount > CARDS_PER_PAGE) ||
    (activeTab === "courts" && totalCourtsCount > CARDS_PER_PAGE);

  return (
    <div className="bg-[#fafbfc]">
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-sm border-b border-[#e0e3e7]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          <button onClick={() => onNavigate("landing")} className="flex items-center gap-2 group">
            <div className="bg-gradient-to-br from-[#1a2332] to-[#2d3d54] p-2 rounded-xl">
              <Scale className="w-5 h-5 text-[#d4a574]" />
            </div>
            <span className="font-bold text-[#1a2332] group-hover:text-[#1e40af] transition-colors">Judge My Lawyer</span>
          </button>

          <div className="hidden md:flex items-center gap-6">
            <button onClick={() => onNavigate("lawyers")} className="text-[#5f6368] hover:text-[#1e40af] font-semibold transition-colors">Lawyers</button>
            <button onClick={() => onNavigate("judges")} className="text-[#5f6368] hover:text-[#7c3aed] font-semibold transition-colors">Judges</button>
            <button onClick={() => onNavigate("courts")} className="text-[#5f6368] hover:text-[#047857] font-semibold transition-colors">Courts</button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => onLogin("client")}
              className="px-3 py-2 text-sm font-semibold text-[#1e40af] border border-[#bfdbfe] rounded-lg hover:bg-[#eff6ff] transition-colors"
            >
              Client Login
            </button>
            <button
              onClick={() => onLogin("lawyer")}
              className="px-3 py-2 text-sm font-semibold text-white bg-[#1e40af] rounded-lg hover:bg-[#1e3a8a] transition-colors"
            >
              Lawyer Login
            </button>
          </div>
        </div>
      </header>

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
                    {caseTypesForFilter.map((caseType) => (
                      <option key={caseType} value={caseType}>
                        {caseType}
                      </option>
                    ))}
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
                    {courtNamesForFilter.map((courtName) => (
                      <option key={courtName} value={courtName}>
                        {courtName}
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
                    Showing <span className="font-bold text-[#1a2332]">{totalLawyersCount}</span> lawyers, re-ranked by performance in selected category
                  </p>
                </div>
              )}
            </div>

            {/* Grid Layout */}
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
              {paginatedLawyers.map((lawyer, index) => (
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
                        {(lawyer.specialization ?? []).slice(0, 2).map((spec, idx) => (
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
                          {(() => {
                            const courtList = (lawyer.courts ?? []).filter((court) => (court ?? "").trim().length > 0);
                            if (courtList.length === 0) {
                              return <span className="font-semibold truncate">No courts listed</span>;
                            }
                            const shownCourts = courtList.slice(0, 2).join(", ");
                            const remaining = courtList.length - 2;
                            return (
                              <span className="font-semibold truncate">
                                {shownCourts}
                                {remaining > 0 ? ` +${remaining} more` : ""}
                              </span>
                            );
                          })()}
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
                  {(index + 1) % 6 === 0 && index !== paginatedLawyers.length - 1 && (
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

            {showPagination && (
              <div className="flex items-center justify-center gap-3 mt-8">
                <button
                  type="button"
                  onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className="px-4 py-2 rounded-lg border border-[#e0e3e7] text-sm font-semibold text-[#1a2332] disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#f8fafc]"
                >
                  Previous
                </button>
                <span className="text-sm font-semibold text-[#5f6368]">
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  type="button"
                  onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  className="px-4 py-2 rounded-lg border border-[#e0e3e7] text-sm font-semibold text-[#1a2332] disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#f8fafc]"
                >
                  Next
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
                    {judgeCourtsForFilter.map((spec) => (
                      <option key={spec} value={spec}>
                        {spec}
                      </option>
                    ))}
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
                    {judgeCourtsForFilter.map((court) => (
                      <option key={court} value={court}>
                        {court}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
              {paginatedJudges.map((judge) => (
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
                        <span className="font-semibold">{judge.designation ?? ""}</span>
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

            {showPagination && (
              <div className="flex items-center justify-center gap-3 mt-8">
                <button
                  type="button"
                  onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className="px-4 py-2 rounded-lg border border-[#e0e3e7] text-sm font-semibold text-[#1a2332] disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#f8fafc]"
                >
                  Previous
                </button>
                <span className="text-sm font-semibold text-[#5f6368]">
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  type="button"
                  onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  className="px-4 py-2 rounded-lg border border-[#e0e3e7] text-sm font-semibold text-[#1a2332] disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#f8fafc]"
                >
                  Next
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
                    {courtTypesForFilter.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
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
                    {courtLocationsForFilter.map((loc) => (
                      <option key={loc} value={loc}>
                        {loc}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
              {paginatedCourts.map((court) => (
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
                        <span className="font-semibold">{court.court_type}</span>
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

            {showPagination && (
              <div className="flex items-center justify-center gap-3 mt-8">
                <button
                  type="button"
                  onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className="px-4 py-2 rounded-lg border border-[#e0e3e7] text-sm font-semibold text-[#1a2332] disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#f8fafc]"
                >
                  Previous
                </button>
                <span className="text-sm font-semibold text-[#5f6368]">
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  type="button"
                  onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  className="px-4 py-2 rounded-lg border border-[#e0e3e7] text-sm font-semibold text-[#1a2332] disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#f8fafc]"
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
