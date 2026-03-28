import React, { useMemo, useState } from 'react';
import { Trophy, Briefcase, TrendingUp, Clock, Calendar, CheckCircle, AlertCircle } from 'lucide-react';
import { Badge } from './ui/badge';
import { mockCourts, Lawyer as LawyerType } from '../data/mockData';
import MetricExplanationSheet from './MetricExplanationSheet';

interface LawyerCardProps {
  lawyer: LawyerType;
  onClick?: (id: string) => void;
}

// Simple circular radial progress using SVG
function RadialProgress({ value }: { value: number }) {
  const radius = 36;
  const stroke = 8;
  const normalized = Math.max(0, Math.min(100, value));
  const circ = 2 * Math.PI * radius;
  const dash = (normalized / 100) * circ;

  return (
    <svg width={radius * 2 + stroke} height={radius * 2 + stroke} viewBox={`0 0 ${radius * 2 + stroke} ${radius * 2 + stroke}`}>
      <g transform={`translate(${stroke / 2},${stroke / 2})`}>
        <circle
          r={radius}
          cx={radius + stroke / 2}
          cy={radius + stroke / 2}
          fill="none"
          stroke="#f1f5f9"
          strokeWidth={stroke}
        />
        <circle
          r={radius}
          cx={radius + stroke / 2}
          cy={radius + stroke / 2}
          fill="none"
          stroke="#10b981"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circ - dash}`}
          transform={`rotate(-90 ${radius + stroke / 2} ${radius + stroke / 2})`}
        />
        <text x="50%" y="50%" dominantBaseline="central" textAnchor="middle" fontSize="14" fontWeight={700} fill="#0f172a">
          {Math.round(normalized)}
        </text>
      </g>
    </svg>
  );
}

export default function LawyerCard({ lawyer, onClick }: LawyerCardProps) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetTitle, setSheetTitle] = useState('');
  const [sheetBody, setSheetBody] = useState<React.ReactNode>(null);
  // Determine court averages (use first court if available)
  const courtAverages = useMemo(() => {
    const courtName = lawyer.courts && lawyer.courts.length ? lawyer.courts[0] : undefined;
    const court = courtName ? mockCourts.find(c => c.name === courtName) : undefined;
    if (court) return { avgCaseDuration: court.avgCaseDuration, avgHearings: court.avgHearings };
    const avgDuration = Math.round(mockCourts.reduce((s, c) => s + c.avgCaseDuration, 0) / mockCourts.length);
    const avgHearings = +(mockCourts.reduce((s, c) => s + c.avgHearings, 0) / mockCourts.length).toFixed(1);
    return { avgCaseDuration: avgDuration, avgHearings };
  }, [lawyer.courts]);

  // Duration comparison percent
  const durationDeltaPercent = useMemo(() => {
    const diff = courtAverages.avgCaseDuration - (lawyer.avgCaseDuration || courtAverages.avgCaseDuration);
    return Math.round((diff / courtAverages.avgCaseDuration) * 100);
  }, [courtAverages, lawyer.avgCaseDuration]);

  // Behavioral tag heuristic (assumption-based)
  const behaviorTag = useMemo(() => {
    if (lawyer.settlementRate >= 10) return 'Conciliation Expert';
    if (lawyer.winRate >= 75 && lawyer.settlementRate < 6) return 'Aggressive Litigator';
    if (lawyer.experience >= 15) return 'Seasoned Advocate';
    return 'Balanced Litigator';
  }, [lawyer.settlementRate, lawyer.winRate, lawyer.experience]);

  // Trust score heuristic (0-100)
  const trustScore = useMemo(() => {
    const win = lawyer.winRate || 0; // 0-100
    const speedFactor = Math.max(0, Math.min(100, (courtAverages.avgCaseDuration / (lawyer.avgCaseDuration || courtAverages.avgCaseDuration)) * 100));
    const experienceFactor = Math.max(0, Math.min(100, (lawyer.experience / 25) * 100));
    const settlementPenalty = Math.max(0, 100 - lawyer.settlementRate * 2);

    // Weighted combination
    const score = (win * 0.55) + (speedFactor * 0.2) + (experienceFactor * 0.15) + (settlementPenalty * 0.1);
    return Math.round(Math.max(0, Math.min(100, score)));
  }, [lawyer, courtAverages]);

  return (
    <>
    <div
      onClick={() => onClick?.(lawyer.id)}
      className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-lg transition cursor-pointer flex flex-col md:flex-row items-stretch gap-4"
    >
      <div className="flex items-center gap-4">
        <div className="flex-shrink-0">
          <div className={`w-14 h-14 rounded-full flex items-center justify-center ${
            lawyer.rank === 1 ? 'bg-yellow-100' : lawyer.rank === 2 ? 'bg-gray-100' : 'bg-blue-50'
          }`}>
            {lawyer.rank <= 3 ? (
              <Trophy className={`w-6 h-6 ${lawyer.rank === 1 ? 'text-yellow-600' : 'text-orange-600'}`} />
            ) : (
              <span className="text-lg font-bold text-blue-600">#{lawyer.rank}</span>
            )}
          </div>
        </div>

        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <h3 className="text-lg font-semibold text-gray-900 truncate">{lawyer.name}</h3>
            <Badge variant="secondary" className="hidden sm:inline-flex">{behaviorTag}</Badge>
          </div>
          <p className="text-sm text-gray-500">{lawyer.experience} yrs • {lawyer.barRegistration}</p>
          <div className="flex flex-wrap gap-2 mt-2">
            {lawyer.specialization.map((s, i) => (
              <span key={i} className="px-2 py-0.5 bg-blue-50 text-blue-700 text-xs rounded-full">{s}</span>
            ))}
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        {/* Trust radial */}
        <div className="flex items-center gap-3">
          <div className="w-24 h-24 flex items-center justify-center">
            <RadialProgress value={trustScore} />
          </div>
          <div>
            <div className="text-sm font-semibold text-gray-700">Transparency & Trust</div>
            <div className="text-xs text-gray-500">Composite trust score (0–100)</div>
          </div>
        </div>

        {/* Key metrics with comparative badges */}
        <div className="flex gap-4 items-center">
          <div className="text-center">
            <div className="flex items-center gap-1 justify-center mb-1">
              <TrendingUp className="w-4 h-4 text-green-600" />
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setSheetTitle('Win Rate');
                  setSheetBody(
                    <>
                      <p className="mb-2">This is the percentage of cases the lawyer won out of their recorded cases. Higher is generally better, but context matters (case complexity, court, and client inputs).</p>
                      <p className="text-sm text-[#6b7280]">Tip: Compare against court averages for a fair view.</p>
                    </>
                  );
                  setSheetOpen(true);
                }}
                className="text-sm font-bold text-green-600 underline decoration-dashed decoration-1 underline-offset-2"
              >
                {lawyer.winRate}%
              </button>
            </div>
            <div className="text-xs text-gray-500">Win Rate</div>
          </div>

          <div className="text-center">
            <div className="flex items-center gap-1 justify-center mb-1">
              <Clock className="w-4 h-4 text-orange-600" />
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setSheetTitle('Average Case Duration');
                  setSheetBody(
                    <>
                      <p className="mb-2">This shows the typical time (in days) a case takes with this lawyer. Shorter durations can indicate quicker settlements or efficient case handling.</p>
                      <p className="text-sm text-[#6b7280]">Tip: If this is much faster than court averages, ask about settlement strategies; if slower, ask about case complexity.</p>
                    </>
                  );
                  setSheetOpen(true);
                }}
                className="text-sm font-semibold text-gray-900 underline decoration-dashed decoration-1 underline-offset-2"
              >
                {lawyer.avgCaseDuration}d
              </button>
            </div>
            <div className="text-xs text-gray-500">Avg Duration</div>
            <div className="mt-2">
              {lawyer.avgCaseDuration < courtAverages.avgCaseDuration ? (
                <Badge variant="default">⚡ {Math.abs(durationDeltaPercent)}% Faster than Court Average</Badge>
              ) : (
                <Badge variant="outline" className="text-amber-700">⚠️ High Delay Risk</Badge>
              )}
            </div>
          </div>

          <div className="text-center">
            <div className="flex items-center gap-1 justify-center mb-1">
              <Calendar className="w-4 h-4 text-purple-600" />
              <div className="text-sm font-semibold text-gray-900">{lawyer.avgHearings}</div>
            </div>
            <div className="text-xs text-gray-500">Avg Hearings</div>
            <div className="mt-2">
              {lawyer.avgHearings <= courtAverages.avgHearings ? (
                <Badge variant="default">⚡ {Math.round(((courtAverages.avgHearings - lawyer.avgHearings) / courtAverages.avgHearings) * 100)}% Fewer Hearings vs Court</Badge>
              ) : (
                <Badge variant="outline" className="text-amber-700">⚠️ More Hearings than Court</Badge>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
    {sheetOpen && (
      <MetricExplanationSheet
        open={sheetOpen}
        title={sheetTitle}
        onClose={() => setSheetOpen(false)}
      >
        {sheetBody}
      </MetricExplanationSheet>
    )}
    </>
  );
}
