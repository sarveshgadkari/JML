"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Briefcase, Building2, CheckCircle2, Clock, Handshake, Loader2, Search, TrendingDown, TrendingUp } from "lucide-react";
import getSupabase from "../../utils/supabase/client";
import { calculateTriFactorRank } from "../../utils/rankingEngine";
import TrustRiskMatrix from "./TrustRiskMatrix";

type Step =
  | "caseType"
  | "court"
  | "filingSide"
  | "partyType"
  | "opponent"
  | "details"
  | "judge"
  | "loading"
  | "results";

type LawyerRow = {
  id: string;
  name: string | null;
  specialization: string[] | null;
  courts: string[] | null;
};

type LawyerAnalytics = {
  lawyer_id: string;
  lawyer_name?: string;
  total_cases: number;
  won_cases: number;
  lost_cases: number;
  settled_cases: number;
  win_rate?: number;
  loss_rate?: number;
  settlement_rate?: number;
  avg_case_duration_days: number;
};

type JudgePerf = {
  judge_id: string;
  judge_name: string;
  lawyer_id: string;
  total_cases: number;
  won_cases: number;
  lost_cases: number;
  settled_cases: number;
};

type JudgeRow = {
  id: string;
  name: string | null;
  courts: string[] | null;
  designation: string | null;
};

type SummaryTemplate = {
  id: string;
  text: string;
  tags: string[];
};

type TemplateContext = {
  lawyerName: string;
  court: string;
  judge: string;
  opponent: string;
  partyType: string;
  filingSide: string;
  totalCases: number;
  winRate: number;
  lossRate: number;
  settlementRate: number;
  avgDays: number;
  rankScore: number;
  favorablePct: number;
  judgeCases: number;
  judgeCompatPct: number;
  detailsGiven: boolean;
};

const POSITIVE_TEMPLATES: SummaryTemplate[] = [
  { id: "p1", text: "{lawyerName} has prior bench exposure before {judge}, improving procedural predictability.", tags: ["judge"] },
  { id: "p2", text: "Historical outcomes before {judge} show a {judgeCompatPct}% favorable-or-settled profile.", tags: ["judge"] },
  { id: "p3", text: "Strong court familiarity in {court} supports faster tactical decision-making.", tags: ["court"] },
  { id: "p4", text: "In {court}, this lawyer maintains disciplined hearing strategy with outcome focus.", tags: ["court", "speed"] },
  { id: "p5", text: "Against similar opponents like {opponent}, the case posture appears strategically compatible.", tags: ["opponent"] },
  { id: "p6", text: "The profile shows repeat exposure to builder-side disputes and practical pattern recognition.", tags: ["opponent", "builder"] },
  { id: "p7", text: "For homebuyer-side matters, this lawyer’s win/settle blend supports recovery-oriented strategy.", tags: ["homebuyer"] },
  { id: "p8", text: "For promoter-side defense, this lawyer’s settlement handling can reduce volatility.", tags: ["builder", "settlement"] },
  { id: "p9", text: "Across {totalCases} cases, sustained courtroom volume indicates durable execution capacity.", tags: ["volume"] },
  { id: "p10", text: "A rank score of {rankScore} reflects balanced performance quality with proven case exposure.", tags: ["volume", "balance"] },
  { id: "p11", text: "Favorable-or-settled outcomes near {favorablePct}% suggest practical closure capability.", tags: ["balance", "settlement"] },
  { id: "p12", text: "The outcome mix suggests this lawyer converts pressure situations into workable resolutions.", tags: ["settlement"] },
  { id: "p13", text: "Average duration around {avgDays} days indicates a comparatively controlled litigation cycle.", tags: ["speed"] },
  { id: "p14", text: "Case handling speed appears operationally healthy for this case profile.", tags: ["speed"] },
  { id: "p15", text: "This recommendation aligns with your selected side ({filingSide}) and forum context.", tags: ["general"] },
  { id: "p16", text: "Fit quality rises because your selected court, party profile, and side are directionally aligned.", tags: ["general"] },
  { id: "p17", text: "The lawyer’s historical data is fully eCourts-backed, improving trust in comparability.", tags: ["general"] },
  { id: "p18", text: "Your provided case details add specificity, improving this match confidence.", tags: ["details"] },
  { id: "p19", text: "This profile combines negotiation optionality with adjudication readiness.", tags: ["settlement", "balance"] },
  { id: "p20", text: "The record suggests stable performance under mixed-case complexity.", tags: ["balance"] },
  { id: "p21", text: "Prior bench familiarity can reduce early-stage procedural friction.", tags: ["judge"] },
  { id: "p22", text: "Comparable matters in {court} indicate contextual readiness for this dispute track.", tags: ["court"] },
  { id: "p23", text: "This lawyer’s exposure to property disputes supports issue-spotting precision.", tags: ["general"] },
  { id: "p24", text: "A healthy settle channel complements litigation strength for risk-managed outcomes.", tags: ["settlement"] },
  { id: "p25", text: "Outcome dispersion suggests resilience rather than one-dimensional strategy.", tags: ["balance"] },
  { id: "p26", text: "The profile has enough case depth to avoid single-case luck distortion.", tags: ["volume"] },
  { id: "p27", text: "Historical performance indicates tactical adaptability across hearing phases.", tags: ["general"] },
  { id: "p28", text: "This match is strengthened by court-context continuity and measurable track record.", tags: ["court", "volume"] },
  { id: "p29", text: "Judge-linked history provides an evidence-based confidence layer for this recommendation.", tags: ["judge"] },
  { id: "p30", text: "The lawyer’s disposition pattern supports both contested and negotiated pathways.", tags: ["settlement", "balance"] },
  { id: "p31", text: "For {partyType} positioning, this profile shows pragmatic result orientation.", tags: ["homebuyer", "builder"] },
  { id: "p32", text: "The recommendation benefits from consistent analytics across win, loss, and settlement dimensions.", tags: ["balance"] },
  { id: "p33", text: "Historical closure behavior suggests disciplined matter progression.", tags: ["speed"] },
  { id: "p34", text: "The lawyer’s case rhythm and outcomes indicate low noise, high signal fit.", tags: ["speed", "balance"] },
  { id: "p35", text: "Selected-input alignment (court/side/profile) materially improves candidate relevance.", tags: ["general"] },
  { id: "p36", text: "This profile ranks well because quality outcomes and volume both remain credible.", tags: ["volume", "balance"] },
  { id: "p37", text: "The historical mix supports strategic optionality if the case posture changes mid-way.", tags: ["settlement"] },
  { id: "p38", text: "Your opponent context ({opponent}) is factored into this compatibility estimate.", tags: ["opponent"] },
  { id: "p39", text: "Bench and forum continuity can improve predictability in early hearings.", tags: ["judge", "court"] },
  { id: "p40", text: "This candidate shows repeatable performance rather than isolated high points.", tags: ["volume"] },
];

const NEGATIVE_TEMPLATES: SummaryTemplate[] = [
  { id: "n1", text: "Loss exposure near {lossRate}% suggests tighter strategy control is required.", tags: ["balance"] },
  { id: "n2", text: "A settlement-heavy profile may trade certainty for speed in some scenarios.", tags: ["settlement"] },
  { id: "n3", text: "If your priority is decisive adjudication, negotiated closure bias should be reviewed.", tags: ["settlement"] },
  { id: "n4", text: "Average duration of {avgDays} days may feel long for urgency-sensitive matters.", tags: ["speed"] },
  { id: "n5", text: "No direct bench history before {judge} increases forecasting uncertainty.", tags: ["judge"] },
  { id: "n6", text: "Limited judge-specific data can reduce confidence in bench-tailored tactics.", tags: ["judge"] },
  { id: "n7", text: "Opponent-specific history against {opponent} appears thin; expect exploratory early rounds.", tags: ["opponent"] },
  { id: "n8", text: "Where opponent data is sparse, matching relies more on broad trends than direct precedents.", tags: ["opponent"] },
  { id: "n9", text: "Moderate case volume ({totalCases}) may limit confidence for edge-case prediction.", tags: ["volume"] },
  { id: "n10", text: "Volume depth should be weighed against result quality before final selection.", tags: ["volume", "balance"] },
  { id: "n11", text: "A high favorable rate can still mask variability across judge and opponent combinations.", tags: ["judge", "opponent"] },
  { id: "n12", text: "Historical trends do not guarantee identical outcomes in new fact patterns.", tags: ["general"] },
  { id: "n13", text: "Case complexity in property matters can widen duration and outcome variance.", tags: ["general"] },
  { id: "n14", text: "If your matter is evidence-heavy, timeline risk may increase beyond historical averages.", tags: ["details"] },
  { id: "n15", text: "Respondent-side matters sometimes show higher procedural drag in this profile.", tags: ["builder"] },
  { id: "n16", text: "Complainant-side expectations should account for settlement probability, not only win probability.", tags: ["homebuyer", "settlement"] },
  { id: "n17", text: "Court-level backlog effects can dilute lawyer-specific speed advantages.", tags: ["court", "speed"] },
  { id: "n18", text: "Bench assignment changes can materially alter historical comparability.", tags: ["judge"] },
  { id: "n19", text: "If immediate relief is critical, average hearing pace warrants caution.", tags: ["speed"] },
  { id: "n20", text: "Outcome volatility may remain if the opposite party contests aggressively.", tags: ["opponent"] },
  { id: "n21", text: "Some matters in this profile close via compromise rather than strict merits victory.", tags: ["settlement"] },
  { id: "n22", text: "Rank score strength should be validated against your exact filing objective.", tags: ["general"] },
  { id: "n23", text: "Where facts are unusual, historical pattern transfer can weaken.", tags: ["details"] },
  { id: "n24", text: "A broad profile may reduce specialization signal for niche sub-issues.", tags: ["general"] },
  { id: "n25", text: "Judge-context certainty is lower when direct prior bench overlap is absent.", tags: ["judge"] },
  { id: "n26", text: "Opponent compatibility may be directional, not deterministic.", tags: ["opponent"] },
  { id: "n27", text: "Settlement utility is positive, but may be perceived as lower assertiveness by some users.", tags: ["settlement"] },
  { id: "n28", text: "High-volume lawyers can face scheduling load; confirm responsiveness expectations.", tags: ["volume", "speed"] },
  { id: "n29", text: "Case-duration averages can hide long-tail delays in contested matters.", tags: ["speed"] },
  { id: "n30", text: "Forum-specific behavior in {court} may diverge by bench and docket seasonality.", tags: ["court", "judge"] },
  { id: "n31", text: "Loss pockets in historical data suggest selective matchup sensitivity.", tags: ["balance"] },
  { id: "n32", text: "Even with favorable trends, enforceability timelines can remain unpredictable.", tags: ["general"] },
  { id: "n33", text: "If your risk appetite is low, weigh timeline and settlement trade-offs carefully.", tags: ["settlement", "speed"] },
  { id: "n34", text: "Builder-heavy dockets may alter hearing cadence and strategic posture.", tags: ["builder", "speed"] },
  { id: "n35", text: "Homebuyer-centric expectations should include fallback negotiation scenarios.", tags: ["homebuyer", "settlement"] },
  { id: "n36", text: "This recommendation is data-informed, but factual nuance from pleadings can shift fit.", tags: ["details"] },
  { id: "n37", text: "Predictability reduces when opponent behavior differs from prior patterns.", tags: ["opponent"] },
  { id: "n38", text: "Use this as shortlist guidance, then validate with consultation-level specifics.", tags: ["general"] },
  { id: "n39", text: "Court process constraints can override lawyer-level optimization in some cycles.", tags: ["court"] },
  { id: "n40", text: "Historical averages should be interpreted as directional evidence, not guarantees.", tags: ["general"] },
];

const hashString = (input: string) => {
  let h = 0;
  for (let i = 0; i < input.length; i += 1) {
    h = (h << 5) - h + input.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
};

const fillTemplate = (text: string, c: TemplateContext) =>
  text
    .replaceAll("{lawyerName}", c.lawyerName || "This lawyer")
    .replaceAll("{court}", c.court || "the selected court")
    .replaceAll("{judge}", c.judge || "the selected adjudicating member")
    .replaceAll("{opponent}", c.opponent || "the opposite party")
    .replaceAll("{partyType}", c.partyType || "property")
    .replaceAll("{filingSide}", c.filingSide || "your side")
    .replaceAll("{totalCases}", String(c.totalCases))
    .replaceAll("{winRate}", `${c.winRate.toFixed(1)}%`)
    .replaceAll("{lossRate}", `${c.lossRate.toFixed(1)}%`)
    .replaceAll("{settlementRate}", `${c.settlementRate.toFixed(1)}%`)
    .replaceAll("{avgDays}", String(c.avgDays))
    .replaceAll("{rankScore}", c.rankScore.toFixed(1))
    .replaceAll("{favorablePct}", `${c.favorablePct}%`)
    .replaceAll("{judgeCases}", String(c.judgeCases))
    .replaceAll("{judgeCompatPct}", `${c.judgeCompatPct}%`);

const scoreTemplate = (tpl: SummaryTemplate, c: TemplateContext, isPositive: boolean) => {
  let score = 0;
  if (tpl.tags.includes("judge")) score += c.judge ? 4 : -2;
  if (tpl.tags.includes("opponent")) score += c.opponent ? 4 : -2;
  if (tpl.tags.includes("court")) score += c.court ? 2 : 0;
  if (tpl.tags.includes("details")) score += c.detailsGiven ? 2 : 0;
  if (tpl.tags.includes("homebuyer")) score += c.partyType === "Homebuyer" ? 3 : 0;
  if (tpl.tags.includes("builder")) score += c.partyType === "Builder/Promoter" ? 3 : 0;
  if (tpl.tags.includes("speed")) {
    if (isPositive) score += c.avgDays <= 120 ? 2 : 0;
    else score += c.avgDays >= 160 ? 3 : 0;
  }
  if (tpl.tags.includes("volume")) {
    if (isPositive) score += c.totalCases >= 20 ? 2 : 0;
    else score += c.totalCases < 10 ? 2 : 0;
  }
  if (tpl.tags.includes("balance")) {
    if (isPositive) score += c.favorablePct >= 55 ? 2 : 0;
    else score += c.lossRate >= 35 ? 2 : 0;
  }
  if (tpl.tags.includes("settlement")) {
    if (isPositive) score += c.settlementRate >= 15 ? 1 : 0;
    else score += c.settlementRate >= 40 ? 2 : 0;
  }
  return score;
};

const pickTemplates = (pool: SummaryTemplate[], count: number, c: TemplateContext, seedKey: string, isPositive: boolean) => {
  const seed = hashString(seedKey);
  return [...pool]
    .sort((a, b) => {
      const sa = scoreTemplate(a, c, isPositive);
      const sb = scoreTemplate(b, c, isPositive);
      if (sb !== sa) return sb - sa;
      const ha = hashString(`${a.id}-${seed}`);
      const hb = hashString(`${b.id}-${seed}`);
      return ha - hb;
    })
    .slice(0, count)
    .map((t) => fillTemplate(t.text, c));
};

const pickTemplatesWithUsageCap = (
  pool: SummaryTemplate[],
  count: number,
  c: TemplateContext,
  seedKey: string,
  isPositive: boolean,
  usage: Map<string, number>,
  maxUse = 2
) => {
  const seed = hashString(seedKey);
  const ranked = [...pool].sort((a, b) => {
    const sa = scoreTemplate(a, c, isPositive);
    const sb = scoreTemplate(b, c, isPositive);
    if (sb !== sa) return sb - sa;
    const ha = hashString(`${a.id}-${seed}`);
    const hb = hashString(`${b.id}-${seed}`);
    return ha - hb;
  });

  const picked: string[] = [];
  for (const tpl of ranked) {
    if (picked.length >= count) break;
    const used = usage.get(tpl.id) ?? 0;
    if (used >= maxUse) continue;
    usage.set(tpl.id, used + 1);
    picked.push(fillTemplate(tpl.text, c));
  }

  // Safety fallback (in case caps exhaust all high-ranked options).
  if (picked.length < count) {
    for (const tpl of ranked) {
      if (picked.length >= count) break;
      const rendered = fillTemplate(tpl.text, c);
      if (!picked.includes(rendered)) picked.push(rendered);
    }
  }
  return picked.slice(0, count);
};

export default function FindLawyerWizard({ onViewDetails }: { onViewDetails: (id: string) => void }) {
  const [step, setStep] = useState<Step>("caseType");
  const [busy, setBusy] = useState(false);

  // Answers
  const [caseType, setCaseType] = useState<string>("");
  const [court, setCourt] = useState<string>("");
  const [filingSide, setFilingSide] = useState<"Complainant" | "Respondent" | "">("");
  const [partyType, setPartyType] = useState<"Homebuyer" | "Builder/Promoter" | "">("");
  const [opponent, setOpponent] = useState<string>("");
  const [details, setDetails] = useState<string>("");
  const [judge, setJudge] = useState<string>("");

  // Data
  const [lawyers, setLawyers] = useState<LawyerRow[]>([]);
  const [analytics, setAnalytics] = useState<Map<string, LawyerAnalytics>>(new Map());
  const [lawyerJudge, setLawyerJudge] = useState<JudgePerf[]>([]);
  const [judges, setJudges] = useState<JudgeRow[]>([]);
  const [courts, setCourts] = useState<string[]>([]);
  const [currentOffset, setCurrentOffset] = useState(0);
  const [fadePhase, setFadePhase] = useState<"in" | "out">("in");
  const [results, setResults] = useState<
    Array<{
      id: string;
      name: string | null;
      score: number;
      totalCases: number;
      winRate: number;
      lossRate: number;
      settlementRate: number;
      avgDays: number;
      aiSummary: string;
      strengthA: string;
      strengthB: string;
      riskA: string;
      riskB: string;
    }>
  >([]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const supabase = getSupabase();
        const [lawyersRes, analyticsRes, ljRes] = await Promise.all([
          supabase.from("lawyers").select("id,name,specialization,courts").order("name", { ascending: true }),
          supabase
            .from("lawyer_analytics")
            .select("lawyer_id,lawyer_name,total_cases,won_cases,lost_cases,settled_cases,win_rate,loss_rate,settlement_rate,avg_case_duration_days")
            .range(0, 9999),
          supabase
            .from("lawyer_judge_analytics")
            .select("lawyer_id,judge_id,judge_name,total_cases,won_cases,lost_cases,settled_cases")
            .range(0, 9999),
        ]);
        const judgesRes = await supabase
          .from("judges")
          .select("id,name,courts,designation")
          .order("name", { ascending: true })
          .range(0, 4999);
        const courtsRes = await supabase
          .from("court_analytics")
          .select("court_name,total_cases")
          .order("total_cases", { ascending: false })
          .range(0, 4999);
        if (!mounted) return;
        setLawyers((lawyersRes.data ?? []) as LawyerRow[]);
        const a = new Map<string, LawyerAnalytics>();
        (analyticsRes.data ?? ([] as any[])).forEach((r: any) => a.set(r.lawyer_id, r as LawyerAnalytics));
        setAnalytics(a);
        setLawyerJudge((ljRes.data ?? []) as JudgePerf[]);
        setJudges((judgesRes.data ?? []) as JudgeRow[]);
        const courtSet = new Set<string>();
        ((courtsRes.data ?? []) as Array<{ court_name: string | null }>).forEach((r) => {
          const n = (r.court_name ?? "").trim();
          if (n) courtSet.add(n);
        });
        // Fallback for environments where court_analytics is sparse.
        if (courtSet.size === 0) {
          ((lawyersRes.data ?? []) as LawyerRow[]).forEach((l) => (l.courts ?? []).forEach((c) => c && courtSet.add(c)));
        }
        setCourts(Array.from(courtSet).sort((x, y) => x.localeCompare(y)));
      } catch {
        // ignore
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const canNext = useMemo(() => {
    if (step === "caseType") return !!caseType;
    if (step === "court") return !!court;
    if (step === "filingSide") return !!filingSide;
    if (step === "partyType") return !!partyType;
    if (step === "opponent") return true; // optional
    if (step === "details") return true; // optional
    if (step === "judge") return true; // optional
    return true;
  }, [step, caseType, court, filingSide, partyType]);

  const next = async () => {
    if (!canNext || busy) return;
    if (step === "judge") {
      setStep("loading");
      setBusy(true);
      // Simulate analysis (3.5s)
      setTimeout(() => {
        personalize();
        setBusy(false);
        setStep("results");
      }, 3500);
      return;
    }
    const order: Step[] = ["caseType", "court", "filingSide", "partyType", "opponent", "details", "judge"];
    const idx = order.indexOf(step);
    setFadePhase("out");
    setTimeout(() => {
      setStep(order[idx + 1] ?? "judge");
      setFadePhase("in");
    }, 180);
  };

  const personalize = () => {
    // Score: base rankScore + bonuses for matches
    const scored = lawyers.map((l) => {
      const a = analytics.get(l.id);
      const tri = calculateTriFactorRank({
        wins: a?.won_cases ?? 0,
        losses: a?.lost_cases ?? 0,
        settlements: a?.settled_cases ?? 0,
        avgHearings: 6,
        avgDurationDays: Math.round(a?.avg_case_duration_days ?? 0),
      });
      // Base score primarily driven by WinRate, lightly by Experience/Speed
      let score = tri.winRateScore + 0.3 * tri.experienceScore + 0.2 * tri.velocityScore;
      // Court bonus
      if (court && (l.courts ?? []).some((c) => c.toLowerCase().includes(court.toLowerCase()))) {
        score += 12;
      }
      // Case type bonus (via specialization tag)
      if (caseType && (l.specialization ?? []).some((s) => s.toLowerCase().includes(caseType.toLowerCase()))) {
        score += 14;
      }
      // Judge synergy bonus: if selected judge present in lawyer_judge_analytics with meaningful total
      if (judge) {
        const hasJudge = lawyerJudge.some((r) => r.lawyer_id === l.id && r.judge_name?.toLowerCase() === judge.toLowerCase() && (r.total_cases ?? 0) >= 3);
        if (hasJudge) score += 10;
      }
      // Opponent heuristic: if opponent is a builder and this lawyer has higher win than loss overall, small boost
      if (opponent.trim().length >= 3 && (a?.won_cases ?? 0) > (a?.lost_cases ?? 0)) {
        score += 4;
      }
      if (partyType === "Homebuyer" && (a?.win_rate ?? 0) >= 50) score += 4;
      if (partyType === "Builder/Promoter" && (a?.settlement_rate ?? 0) >= 20) score += 3;
      if (filingSide === "Respondent" && (a?.loss_rate ?? 0) <= 35) score += 3;

      const totalCases = a?.total_cases ?? 0;
      const winRate = a?.win_rate ?? 0;
      const lossRate = a?.loss_rate ?? 0;
      const settlementRate = a?.settlement_rate ?? 0;
      const avgDays = Math.round(a?.avg_case_duration_days ?? 0);
      const judgeRow = judge
        ? lawyerJudge.find(
            (r) =>
              r.lawyer_id === l.id &&
              (r.judge_name ?? "").trim().toLowerCase() === judge.trim().toLowerCase()
          )
        : null;
      const judgeCases = judgeRow?.total_cases ?? 0;
      const judgeGood = (judgeRow?.won_cases ?? 0) + (judgeRow?.settled_cases ?? 0);
      const judgeCompatPct = judgeCases > 0 ? Math.round((judgeGood * 100) / judgeCases) : 0;
      const favorablePct = Math.round(winRate + settlementRate);
      const aiSummary = `Fit: ${partyType || "General"} • ${court || "Selected court"} • ${judge ? "Judge-aware" : "No judge provided"} • ${totalCases} historical cases.`;
      const templateCtx: TemplateContext = {
        lawyerName: l.name ?? "This lawyer",
        court,
        judge,
        opponent: opponent.trim(),
        partyType,
        filingSide,
        totalCases,
        winRate,
        lossRate,
        settlementRate,
        avgDays,
        rankScore: score,
        favorablePct,
        judgeCases,
        judgeCompatPct,
        detailsGiven: details.trim().length > 0,
      };
      return {
        id: l.id,
        name: l.name,
        score,
        totalCases,
        winRate,
        lossRate,
        settlementRate,
        avgDays,
        aiSummary,
        strengthA: "",
        strengthB: "",
        riskA: "",
        riskB: "",
        _templateCtx: templateCtx,
      };
    });
    const all = scored.sort((x, y) => y.score - x.score);
    const positiveUsage = new Map<string, number>();
    const negativeUsage = new Map<string, number>();
    const assigned = all.map((r) => {
      const [strengthA, strengthB] = pickTemplatesWithUsageCap(
        POSITIVE_TEMPLATES,
        2,
        (r as any)._templateCtx as TemplateContext,
        `${r.id}-pos-${court}-${judge}-${opponent}-${partyType}-${filingSide}`,
        true,
        positiveUsage,
        2
      );
      const [riskA, riskB] = pickTemplatesWithUsageCap(
        NEGATIVE_TEMPLATES,
        2,
        (r as any)._templateCtx as TemplateContext,
        `${r.id}-neg-${court}-${judge}-${opponent}-${partyType}-${filingSide}`,
        false,
        negativeUsage,
        2
      );
      const { _templateCtx, ...clean } = r as any;
      return { ...clean, strengthA, strengthB, riskA, riskB };
    });
    setCurrentOffset(0);
    setResults(assigned as any);
  };

  const visibleResults = results.slice(currentOffset, currentOffset + 5);
  const hasMore = currentOffset + 5 < results.length;
  const judgesForCourt = useMemo(() => {
    const selected = court.trim().toLowerCase();
    const names = new Set<string>();
    if (selected) {
      judges.forEach((j) => {
        const byCourts = (j.courts ?? []).some((c) => c.toLowerCase().includes(selected));
        const byDesignation = (j.designation ?? "").toLowerCase().includes(selected);
        if (byCourts || byDesignation) {
          const name = (j.name ?? "").trim();
          if (name) names.add(name);
        }
      });
    }
    // Fallback: derive from lawyer_judge_analytics
    if (names.size === 0 && selected) {
      lawyerJudge.forEach((r) => {
        const name = (r.judge_name ?? "").trim();
        if (name) names.add(name);
      });
    }
    return Array.from(names).sort((a, b) => a.localeCompare(b));
  }, [court, judges, lawyerJudge]);

  return (
    <div className="min-h-[72vh] flex items-center justify-center">
      <div className="w-full max-w-4xl bg-white border border-[#e0e3e7] rounded-xl p-6 shadow-sm">
      <h1 className="text-2xl font-bold text-[#1a2332] mb-4">Find a Lawyer</h1>
      <p className="text-sm text-[#5f6368] mb-6">We’ll personalize suggestions based on your case and preferences.</p>

      {step === "caseType" && (
        <div className={`transition-all duration-300 ease-in-out ${fadePhase === "in" ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-1"}`}>
          <label className="block text-sm font-semibold text-[#1a2332] mb-2">What type of case is this?</label>
          <select
            value={caseType}
            onChange={(e) => setCaseType(e.target.value)}
            className="w-full px-4 py-2.5 border border-[#e0e3e7] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1e40af] bg-white text-[#1a2332] font-medium"
          >
            <option value="">Select case type</option>
            <option value="Property">Property</option>
          </select>
        </div>
      )}

      {step === "court" && (
        <div className={`transition-all duration-300 ease-in-out ${fadePhase === "in" ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-1"}`}>
          <label className="block text-sm font-semibold text-[#1a2332] mb-2">Which court/tribunal?</label>
          <select
            value={court}
            onChange={(e) => setCourt(e.target.value)}
            className="w-full px-4 py-2.5 border border-[#e0e3e7] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1e40af] bg-white text-[#1a2332] font-medium"
          >
            <option value="">Select court</option>
            {courts.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
      )}

      {step === "filingSide" && (
        <div className={`transition-all duration-300 ease-in-out ${fadePhase === "in" ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-1"}`}>
          <label className="block text-sm font-semibold text-[#1a2332] mb-3">Did you file the case or was the case filed against you?</label>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setFilingSide("Complainant")}
              className={`rounded-lg border px-4 py-3 text-sm font-semibold ${filingSide === "Complainant" ? "border-[#10b981] bg-[#ecfdf5] text-[#065f46]" : "border-[#e0e3e7] text-[#1a2332]"}`}
            >
              I filed the case (Complainant)
            </button>
            <button
              onClick={() => setFilingSide("Respondent")}
              className={`rounded-lg border px-4 py-3 text-sm font-semibold ${filingSide === "Respondent" ? "border-[#b91c1c] bg-[#fef2f2] text-[#7f1d1d]" : "border-[#e0e3e7] text-[#1a2332]"}`}
            >
              Case filed against me (Respondent)
            </button>
          </div>
        </div>
      )}

      {step === "partyType" && (
        <div className={`transition-all duration-300 ease-in-out ${fadePhase === "in" ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-1"}`}>
          <label className="block text-sm font-semibold text-[#1a2332] mb-3">Which profile best describes you?</label>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setPartyType("Homebuyer")}
              className={`rounded-lg border px-4 py-3 text-sm font-semibold ${partyType === "Homebuyer" ? "border-[#10b981] bg-[#ecfdf5] text-[#065f46]" : "border-[#e0e3e7] text-[#1a2332]"}`}
            >
              Homebuyer
            </button>
            <button
              onClick={() => setPartyType("Builder/Promoter")}
              className={`rounded-lg border px-4 py-3 text-sm font-semibold ${partyType === "Builder/Promoter" ? "border-[#1e40af] bg-[#eff6ff] text-[#1e3a8a]" : "border-[#e0e3e7] text-[#1a2332]"}`}
            >
              Builder / Promoter
            </button>
          </div>
        </div>
      )}

      {step === "opponent" && (
        <div className={`transition-all duration-300 ease-in-out ${fadePhase === "in" ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-1"}`}>
          <label className="block text-sm font-semibold text-[#1a2332] mb-2">Name of the opposite party (optional)</label>
          <input
            value={opponent}
            onChange={(e) => setOpponent(e.target.value)}
            placeholder="e.g., Macrotech Developers"
            className="w-full px-4 py-2.5 border border-[#e0e3e7] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1e40af] bg-white text-[#1a2332] font-medium"
          />
        </div>
      )}

      {step === "details" && (
        <div className={`transition-all duration-300 ease-in-out ${fadePhase === "in" ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-1"}`}>
          <label className="block text-sm font-semibold text-[#1a2332] mb-2">Brief details (optional)</label>
          <textarea
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            placeholder="Tell us anything important that can improve matching…"
            rows={4}
            className="w-full px-4 py-2.5 border border-[#e0e3e7] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1e40af] bg-white text-[#1a2332] font-medium"
          />
        </div>
      )}

      {step === "judge" && (
        <div className={`transition-all duration-300 ease-in-out ${fadePhase === "in" ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-1"}`}>
          <label className="block text-sm font-semibold text-[#1a2332] mb-2">Judge name (optional, if already filed)</label>
          <select
            value={judge}
            onChange={(e) => setJudge(e.target.value)}
            className="w-full px-4 py-2.5 border border-[#e0e3e7] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1e40af] bg-white text-[#1a2332] font-medium"
          >
            <option value="">Skip for now</option>
            {judgesForCourt.map((j) => (
              <option key={j} value={j}>
                {j}
              </option>
            ))}
          </select>
          <p className="mt-2 text-xs text-[#5f6368]">
            Showing judges mapped to the selected court.
          </p>
        </div>
      )}

      {step === "loading" && (
        <div className="flex items-center gap-3 text-[#1a2332]">
          <Loader2 className="w-5 h-5 animate-spin text-[#1e40af]" />
          <div className="text-sm">Analyzing your inputs and preparing personalized options…</div>
        </div>
      )}

      {step === "results" && (
        <div className="transition-opacity duration-300 ease-in-out opacity-100">
          <div className="mb-4">
            <h2 className="text-lg font-bold text-[#1a2332]">Top 5 Matches</h2>
            <p className="text-sm text-[#5f6368]">Based on case type, court, judge familiarity and performance.</p>
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            {visibleResults.map((r) => (
              <div key={r.id} className="space-y-2">
                <button
                  onClick={() => onViewDetails(r.id)}
                  className="w-full text-left group bg-white rounded-xl border border-[#e0e3e7] p-4 hover:shadow-xl hover:border-[#3b82f6]/40 transition-all"
                >
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-bold text-[#1a2332] group-hover:text-[#1e40af] transition-colors">
                        {r.name ?? "Unnamed Lawyer"}
                      </h3>
                      <span className="text-xs font-semibold text-[#1e40af] bg-[#e8f0fe] px-2 py-1 rounded-md">
                        Score {Math.round(r.score)}
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="text-center bg-gradient-to-br from-[#ecfdf5] to-[#d1fae5] p-2 rounded-lg border border-[#10b981]/20">
                        <div className="flex items-center justify-center gap-1 mb-0.5">
                          <TrendingUp className="w-3.5 h-3.5 text-[#047857]" />
                          <span className="text-sm font-bold text-[#047857]">{r.winRate.toFixed(1)}%</span>
                        </div>
                        <p className="text-[10px] font-bold text-[#065f46] uppercase">Win</p>
                      </div>
                      <div className="text-center bg-gradient-to-br from-[#fef2f2] to-[#fee2e2] p-2 rounded-lg border border-[#dc2626]/20">
                        <div className="flex items-center justify-center gap-1 mb-0.5">
                          <TrendingDown className="w-3.5 h-3.5 text-[#b91c1c]" />
                          <span className="text-sm font-bold text-[#b91c1c]">{r.lossRate.toFixed(1)}%</span>
                        </div>
                        <p className="text-[10px] font-bold text-[#991b1b] uppercase">Loss</p>
                      </div>
                      <div className="text-center bg-gradient-to-br from-[#fef3c7] to-[#fde68a] p-2 rounded-lg border border-[#d97706]/20">
                        <div className="flex items-center justify-center gap-1 mb-0.5">
                          <Handshake className="w-3.5 h-3.5 text-[#92400e]" />
                          <span className="text-sm font-bold text-[#92400e]">{r.settlementRate.toFixed(1)}%</span>
                        </div>
                        <p className="text-[10px] font-bold text-[#78350f] uppercase">Settle</p>
                      </div>
                      <div className="text-center bg-[#f0f2f5] p-2 rounded-lg col-span-3">
                        <div className="flex items-center justify-center gap-3">
                          <div className="flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5 text-[#d97706]" />
                            <span className="text-sm font-bold text-[#1a2332]">{r.avgDays}d</span>
                            <span className="text-xs text-[#5f6368]">avg duration</span>
                          </div>
                          <div className="w-px h-4 bg-[#e0e3e7]" />
                          <div className="flex items-center gap-1">
                            <Briefcase className="w-3.5 h-3.5 text-[#1e40af]" />
                            <span className="text-sm font-bold text-[#1a2332]">{r.totalCases}</span>
                            <span className="text-xs text-[#5f6368]">cases</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </button>
                <TrustRiskMatrix
                  benchTrackRecordText={r.strengthA}
                  verifiedDataText={r.strengthB}
                  highAdjournmentText={r.riskA}
                  promoterHeavyText={r.riskB}
                />
              </div>
            ))}
            {visibleResults.length === 0 && (
              <div className="flex items-center gap-2 text-sm text-[#5f6368]">
                <Search className="w-4 h-4" />
                No matches found. Try adjusting inputs.
              </div>
            )}
          </div>

          {hasMore && (
            <div className="mt-5 flex justify-center">
              <button
                onClick={() => setCurrentOffset((o) => o + 5)}
                className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-[#1e40af] to-[#3b82f6] px-4 py-2 text-white font-semibold hover:shadow-lg"
              >
                Load next top 5 choices
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {!hasMore && results.length > 5 && (
            <div className="mt-5 flex justify-center">
              <button
                onClick={() => setCurrentOffset(0)}
                className="inline-flex items-center gap-2 rounded-lg border border-[#e0e3e7] bg-white px-4 py-2 text-[#1a2332] font-semibold hover:bg-[#f8fafc]"
              >
                Back to first 5
              </button>
            </div>
          )}
        </div>
      )}

      {/* Controls */}
      {step !== "loading" && step !== "results" && (
        <div className="mt-6 flex justify-end">
          <button
            onClick={next}
            disabled={!canNext || busy}
            className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-[#1e40af] to-[#3b82f6] px-4 py-2 text-white font-semibold hover:shadow-lg disabled:opacity-50"
          >
            Continue
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}
      </div>
    </div>
  );
}

