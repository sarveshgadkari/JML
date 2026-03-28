"use client";

import React from "react";
import { AlertOctagon, CheckCircle2, Flag, Info, Landmark } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";

type Props = {
  benchTrackRecordText?: string;
  benchTrackRecordTooltip?: string;
  verifiedDataText?: string;
  highAdjournmentText?: string;
  promoterHeavyText?: string;
};

export default function TrustRiskMatrix({
  benchTrackRecordText = "Bench Track Record: Secured favorable rulings in 85% of matters (38/45 cases) before the current Adjudicating Member.",
  benchTrackRecordTooltip = "Data based strictly on historical public records. Does not guarantee future outcomes.",
  verifiedDataText = "100% eCourts Verified Data.",
  highAdjournmentText = "High Adjournment Rate: Averages 20 hearings per case (Tribunal avg is 6). Strong indicator of procedural delays.",
  promoterHeavyText = "Promoter-Heavy Portfolio: Historical data shows 75% of appearances are defending Developers/Promoters rather than representing Homebuyers.",
}: Props) {
  return (
    <Card className="gap-0 overflow-hidden rounded-sm border-2 border-slate-300 bg-white shadow-sm">
      <CardHeader className="px-4 pt-4 pb-1">
        <CardTitle className="font-serif text-lg text-slate-900">AI Summary</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {/* Strengths */}
        <div className="px-4 pb-3">
          <div className="text-xs font-bold tracking-wider text-slate-500 uppercase">Verified Strengths</div>
          <div className="mt-2 space-y-2">
            <div className="flex gap-3">
              <div className="mt-0.5 flex h-7 w-7 items-center justify-center rounded-sm bg-green-50">
                <Landmark className="h-4.5 w-4.5 text-green-800" />
              </div>
              <div className="min-w-0">
                <div className="flex items-start gap-2">
                  <p className="text-xs text-slate-800 leading-snug">{benchTrackRecordText}</p>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        className="mt-0.5 inline-flex h-6 w-6 items-center justify-center rounded-md text-slate-500 hover:bg-slate-50 hover:text-slate-700"
                        aria-label="Bench track record tooltip"
                      >
                        <Info className="h-4 w-4" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent sideOffset={6} className="max-w-[280px]">
                      {benchTrackRecordTooltip}
                    </TooltipContent>
                  </Tooltip>
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <div className="mt-0.5 flex h-7 w-7 items-center justify-center rounded-sm bg-green-50">
                <CheckCircle2 className="h-4.5 w-4.5 text-green-800" />
              </div>
              <p className="text-xs text-slate-800 leading-snug">{verifiedDataText}</p>
            </div>
          </div>
        </div>

        {/* Risks */}
        <div className="border-t border-slate-200 bg-red-50/30 px-4 py-3">
          <div className="text-xs font-bold tracking-wider text-red-700 uppercase">Identified Risk Factors</div>
          <div className="mt-2 space-y-2">
            <div className="flex gap-3">
              <div className="mt-0.5 flex h-7 w-7 items-center justify-center rounded-sm bg-red-100">
                <AlertOctagon className="h-4.5 w-4.5 text-red-800" />
              </div>
              <p className="text-xs text-slate-800 leading-snug">{highAdjournmentText}</p>
            </div>
            <div className="flex gap-3">
              <div className="mt-0.5 flex h-7 w-7 items-center justify-center rounded-sm bg-red-100">
                <Flag className="h-4.5 w-4.5 text-red-800" />
              </div>
              <p className="text-xs text-slate-800 leading-snug">{promoterHeavyText}</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
