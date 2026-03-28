"use client";

import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import ClientRepresentationChart from "./charts/ClientRepresentationChart";
import HearingVelocityChart from "./charts/HearingVelocityChart";
import TopOpponentsChart from "./charts/TopOpponentsChart";
import RERAResolutionMatrix from "./charts/RERAResolutionMatrix";
import TopOpponentLawyersOutcomeChart from "./charts/TopOpponentLawyersOutcomeChart";
import TopJudgesOutcomeChart from "./charts/TopJudgesOutcomeChart";
import TopRespondentsOutcomeChart from "./charts/TopRespondentsOutcomeChart";
import AvgDurationByLawyer from "./charts/AvgDurationByLawyer";

export default function AnalyticsDashboard({
  caseBase = 0,
  topOpponentLawyers = [],
  topJudges = [],
  clientRepresentationData,
  hearingVelocityData,
  topOpponentsData,
  reraResolutionData,
  context = "lawyer",
  avgDurationTopLawyers,
  respondentOutcomeRows,
  bases,
  courtAvg,
}: {
  caseBase?: number;
  topOpponentLawyers?: Array<{ name: string; cases: number; won: number; lost: number; settled: number }>;
  topJudges?: Array<{ name: string; cases: number; won: number; lost: number; settled: number }>;
  clientRepresentationData?: Array<{ name: string; value: number; fill: string }>;
  hearingVelocityData?: Array<{ bucket: string; cases: number }>;
  topOpponentsData?: Array<{ name: string; cases: number; winRate: number }>;
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
              : "Shows whether this lawyer mostly represents homebuyers (allottees) or defends builders (promoters) in MahaRERA matters."}
          </CardDescription>
        </CardHeader>
        <CardContent className="relative pb-10">
          {context === "judge" ? (
            <TopOpponentLawyersOutcomeChart data={topOpponentLawyers} />
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
          <HearingVelocityChart data={hearingVelocityData} />
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
              : "Lists the builders this lawyer faces most often, along with how frequently they appear and the win rate in those matchups."}
          </CardDescription>
        </CardHeader>
        <CardContent className="relative pb-10">
          {context === "judge" ? <TopRespondentsOutcomeChart data={respondentOutcomeRows} /> : <TopOpponentsChart data={topOpponentsData} />}
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
            <AvgDurationByLawyer data={avgDurationTopLawyers} />
            <div className="absolute bottom-3 right-4 text-xs text-slate-400">
              {txt(bases?.duration ?? caseBase)}
              {context === "judge" && courtAvg ? ` • Court Avg Duration: ${courtAvg.avgDays}d` : null}
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="rounded-sm border border-slate-300 bg-white shadow-sm">
          <CardHeader>
            <CardTitle className="text-base font-semibold text-slate-900">RERA Resolution Matrix</CardTitle>
            <CardDescription className="text-sm text-slate-700 leading-relaxed font-medium">
              Shows how cases ended over time—refund orders, possession orders, settlements through conciliation, and dismissals.
            </CardDescription>
          </CardHeader>
          <CardContent className="relative pb-10">
            <RERAResolutionMatrix data={reraResolutionData} />
            <div className="absolute bottom-3 right-4 text-xs text-slate-400">{txt(caseBase)}</div>
          </CardContent>
        </Card>
      )}

      {context !== "judge" ? (
        <Card className="rounded-sm border border-slate-300 bg-white shadow-sm">
          <CardHeader>
            <CardTitle className="text-base font-semibold text-slate-900">Opponent Lawyers (Top 5)</CardTitle>
            <CardDescription className="text-sm text-slate-700 leading-relaxed font-medium">
              Outcome split (win/loss/settlement) against the five most frequent opposing lawyers in this dataset.
            </CardDescription>
          </CardHeader>
          <CardContent className="relative pb-10">
            <TopOpponentLawyersOutcomeChart data={topOpponentLawyers} />
            <div className="absolute bottom-3 right-4 text-xs text-slate-400">{txt(bases?.opponents ?? caseBase)}</div>
          </CardContent>
        </Card>
      ) : null}

      {context === "lawyer" && (
        <Card className="rounded-sm border border-slate-300 bg-white shadow-sm">
          <CardHeader>
            <CardTitle className="text-base font-semibold text-slate-900">Judges (Top 5)</CardTitle>
            <CardDescription className="text-sm text-slate-700 leading-relaxed font-medium">
              Outcome split (win/loss/settlement) across the five adjudicating members this lawyer appears before most often.
            </CardDescription>
          </CardHeader>
          <CardContent className="relative pb-10">
            <TopJudgesOutcomeChart data={topJudges} />
            <div className="absolute bottom-3 right-4 text-xs text-slate-400">{baseText}</div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

