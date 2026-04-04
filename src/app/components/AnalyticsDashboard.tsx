"use client";

import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import ClientRepresentationChart from "./charts/ClientRepresentationChart";
import HearingVelocityChart from "./charts/HearingVelocityChart";
import TopOpponentLawyersOutcomeChart from "./charts/TopOpponentLawyersOutcomeChart";
import RERAResolutionMatrix from "./charts/RERAResolutionMatrix";
import TopSettlementRatesChart from "./charts/TopSettlementRatesChart";
import TopRespondentsOutcomeChart from "./charts/TopRespondentsOutcomeChart";
import AvgDurationByLawyer from "./charts/AvgDurationByLawyer";

export default function AnalyticsDashboard({
  loading = false,
  caseBase = 0,
  topOpponentLawyers = [],
  clientRepresentationData,
  hearingVelocityData,
  topOpponentsData,
  topOpponentLawyersCases,
  topJudgesCases,
  settlementRatesData,
  reraResolutionData,
  context = "lawyer",
  avgDurationTopLawyers,
  respondentOutcomeRows,
  bases,
  courtAvg,
}: {
  loading?: boolean;
  caseBase?: number;
  topOpponentLawyers?: Array<{ name: string; cases: number; winRate: number; lossRate: number; settlementRate: number }>;
  clientRepresentationData?: Array<{ name: string; value: number; fill: string }>;
  hearingVelocityData?: Array<{ bucket: string; cases: number }>;
  topOpponentsData?: Array<{ name: string; cases: number; winRate: number; lossRate: number; settlementRate: number }>;
  topOpponentLawyersCases?: Array<{ name: string; cases: number; winRate: number; lossRate: number; settlementRate: number }>;
  topJudgesCases?: Array<{ name: string; cases: number; winRate: number; lossRate: number; settlementRate: number }>;
  settlementRatesData?: Array<{ label: string; pct: number; n: number; kind?: string | null }>;
  reraResolutionData?: Array<{ year: string; refund: number; possession: number; conciliation: number; dismissed: number }>;
  context?: "lawyer" | "judge";
  avgDurationTopLawyers?: Array<{ name: string; avgDays: number }>;
  respondentOutcomeRows?: Array<{ name: string; cases: number; won: number; lost: number; settled: number }>;
  bases?: { client?: number; hearings?: number; respondents?: number; duration?: number; opponents?: number };
  courtAvg?: { favorComplainant: number; favorRespondent: number; settlementRate: number; avgDays: number; avgHearings: number };
}) {
  const txt = (n?: number) => (n && n > 0 ? `Based on ${n.toLocaleString()} cases` : "Based on 0 cases");
  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
      <Card className="rounded-sm border border-slate-300 bg-white shadow-sm">
        <CardHeader>
          <CardTitle className="text-base font-semibold text-slate-900">{context === "judge" ? "Top Lawyers Before The Judge (Top 5)" : "Client Representation"}</CardTitle>
          <CardDescription className="text-sm text-slate-700 leading-relaxed font-medium">
            {context === "judge"
              ? "Outcome split (win/loss/settlement) for the five most frequent advocates appearing before this judge."
              : "Case counts where this lawyer appeared on the complainant (petitioner) side versus the respondent side (from lawyer_analytics chart columns)."}
          </CardDescription>
        </CardHeader>
        <CardContent className="relative pb-10">
          {context === "judge" ? (
            <TopOpponentLawyersOutcomeChart data={topOpponentLawyers} loading={loading} />
          ) : (
            <ClientRepresentationChart data={clientRepresentationData} />
          )}
          <div className="absolute bottom-3 right-4 text-xs text-slate-400">
            {context === "judge" ? txt(bases?.opponents ?? caseBase) : txt(bases?.client ?? caseBase)}
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-sm border border-slate-300 bg-white shadow-sm">
        <CardHeader>
          <CardTitle className="text-base font-semibold text-slate-900">Hearings per Case</CardTitle>
          <CardDescription className="text-sm text-slate-700 leading-relaxed font-medium">
            {context === "judge"
              ? "How many hearings typical cases require before this bench. More hearings often imply higher adjournments."
              : "Buckets cases by number of hearings. More hearings usually means more adjournments and a longer, more stressful timeline."}
          </CardDescription>
        </CardHeader>
        <CardContent className="relative pb-10">
          <HearingVelocityChart data={hearingVelocityData} loading={loading} />
          <div className="absolute bottom-3 right-4 text-xs text-slate-400">
            {txt(bases?.hearings ?? caseBase)}
            {context === "judge" && courtAvg ? ` • Court Avg Hearings: ${courtAvg.avgHearings}` : null}
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-sm border border-slate-300 bg-white shadow-sm">
        <CardHeader>
          <CardTitle className="text-base font-semibold text-slate-900">{context === "judge" ? "Respondent Outcomes (Top Respondents)" : "Top Opponents"}</CardTitle>
          <CardDescription className="text-sm text-slate-700 leading-relaxed font-medium">
            {context === "judge"
              ? "Win / Loss / Settled percentages against the most frequent respondents (promoters) before this judge."
              : "Top opposing parties (complainant or respondent, depending on side) by number of cases (precomputed in lawyer_analytics)."}
          </CardDescription>
        </CardHeader>
        <CardContent className="relative pb-10">
          {context === "judge" ? (
            <TopRespondentsOutcomeChart data={respondentOutcomeRows} loading={loading} />
          ) : (
            <TopOpponentLawyersOutcomeChart
              data={topOpponentsData}
              emptyMessage="No opponent breakdown data in analytics."
            />
          )}
          <div className="absolute bottom-3 right-4 text-xs text-slate-400">
            {txt(bases?.respondents ?? caseBase)}
            {context === "judge" && courtAvg ? ` • Court Avg Win/Loss/Settle: ${courtAvg.favorComplainant}% / ${courtAvg.favorRespondent}% / ${courtAvg.settlementRate}%` : null}
          </div>
        </CardContent>
      </Card>

      {context === "judge" ? (
        <Card className="rounded-sm border border-slate-300 bg-white shadow-sm">
          <CardHeader>
          <CardTitle className="text-base font-semibold text-slate-900">Average Case Duration • Top Lawyers</CardTitle>
            <CardDescription className="text-sm text-slate-700 leading-relaxed font-medium">
              Average disposal time (days) for the most frequent advocates appearing before this judge.
            </CardDescription>
          </CardHeader>
          <CardContent className="relative pb-10">
            <AvgDurationByLawyer data={avgDurationTopLawyers} loading={loading} />
            <div className="absolute bottom-3 right-4 text-xs text-slate-400">
              {txt(bases?.duration ?? caseBase)}
              {context === "judge" && courtAvg ? ` • Court Avg Duration: ${courtAvg.avgDays}d` : null}
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="rounded-sm border border-slate-300 bg-white shadow-sm">
          <CardHeader>
            <CardTitle className="text-base font-semibold text-slate-900">
              {context === "judge" ? "RERA Resolution Matrix" : "Top 5 Settlement Rates"}
            </CardTitle>
            <CardDescription className="text-sm text-slate-700 leading-relaxed font-medium">
              {context === "judge"
                ? "Shows how cases ended over time—refund orders, possession orders, settlements through conciliation, and dismissals."
                : "Highest observed settlement rates against a specific opposing counsel or before a specific judge (minimum 3 cases in that context)."}
            </CardDescription>
          </CardHeader>
          <CardContent className="relative pb-10">
            {context === "judge" ? (
              <RERAResolutionMatrix data={reraResolutionData} />
            ) : (
              <TopSettlementRatesChart data={settlementRatesData} />
            )}
            <div className="absolute bottom-3 right-4 text-xs text-slate-400">{txt(caseBase)}</div>
          </CardContent>
        </Card>
      )}

      {context !== "judge" ? (
        <Card className="rounded-sm border border-slate-300 bg-white shadow-sm">
          <CardHeader>
            <CardTitle className="text-base font-semibold text-slate-900">Opponent Lawyers (Top 5)</CardTitle>
            <CardDescription className="text-sm text-slate-700 leading-relaxed font-medium">
              Win / Loss / Settled breakdown against the five most frequent opposing lawyers.
            </CardDescription>
          </CardHeader>
          <CardContent className="relative pb-10">
            <TopOpponentLawyersOutcomeChart
              data={topOpponentLawyersCases}
              emptyMessage="No opponent-lawyer breakdown data in analytics."
            />
            <div className="absolute bottom-3 right-4 text-xs text-slate-400">{txt(bases?.opponents ?? caseBase)}</div>
          </CardContent>
        </Card>
      ) : null}

      {context === "lawyer" && (
        <Card className="rounded-sm border border-slate-300 bg-white shadow-sm">
          <CardHeader>
            <CardTitle className="text-base font-semibold text-slate-900">Judges (Top 5)</CardTitle>
            <CardDescription className="text-sm text-slate-700 leading-relaxed font-medium">
              Win / Loss / Settled breakdown before each of the five most common judges.
            </CardDescription>
          </CardHeader>
          <CardContent className="relative pb-10">
            <TopOpponentLawyersOutcomeChart
              data={topJudgesCases}
              emptyMessage="No judge breakdown data in analytics."
            />
            <div className="absolute bottom-3 right-4 text-xs text-slate-400">{txt(caseBase)}</div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

