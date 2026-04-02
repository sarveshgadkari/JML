import React, { useMemo, useState } from "react";
import { Database, Server, Settings } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../ui/tabs";
import QueueManager from "./QueueManager";
import ThreadConfigurator, { ProcessingThread } from "./ThreadConfigurator";
import ProcessingDashboard, { QueueStats } from "./ProcessingDashboard";
import ProcessingEngine from "./ProcessingEngine";
import MasterAnalysis from "./MasterAnalysis";
import RankCommandCenter from "./RankCommandCenter";

/**
 * Admin Data Tools: PDF Judgment Extraction Engine
 * - Three tabs: Upload & Queue, Thread Configuration, Processing Status
 * - This component owns the shared mock state for the demo (queue + threads + stats).
 * - Styling: premium administrative look using Tailwind + semantic status colors.
 *
 * NOTE: Backend concept (explained in child components as well):
 * - There is ONLY ONE central queue (e.g., table public.pdf_queue).
 * - Threads claim a batch by UPDATE ... WHERE status='pending' ORDER BY created_at LIMIT X FOR UPDATE SKIP LOCKED,
 *   then set status='processing' and claimed_by='{threadName}' atomically, so other threads skip those rows.
 */
export default function PdfExtractionDashboard() {
  // Mock queue rows
  const [queue, setQueue] = useState<Array<{
    id: string;
    filename: string;
    uploadedAt: string;
    status: "Pending" | "Processing" | "Completed" | "Failed";
    claimedBy?: string | null;
  }>>([]);

  // Mock processing threads
  const [threads, setThreads] = useState<ProcessingThread[]>([]);

  // Derived queue stats for the Processing view
  const stats: QueueStats = useMemo(() => {
    const total = queue.length;
    const pending = queue.filter(q => q.status === "Pending").length;
    const processing = queue.filter(q => q.status === "Processing").length;
    const extracted = queue.filter(q => q.status === "Completed").length;
    return { total, pending, processing, extracted };
  }, [queue]);

  return (
    <div className="bg-slate-50 border rounded-xl p-4 md:p-6">
      <div className="flex items-center gap-3 mb-4">
        <Database className="w-5 h-5 text-slate-700" />
        <h2 className="text-xl font-semibold text-slate-900">PDF Judgment Extraction Engine</h2>
      </div>
      <p className="text-sm text-slate-600 mb-6">
        Upload PDF judgments, manage AI worker threads, and monitor extraction progress in real-time. The central queue
        is persistent; interrupted processing can safely resume.
      </p>

      <Tabs defaultValue="queue" className="w-full">
        <TabsList className="grid grid-cols-5 w-full md:w-full bg-white border rounded-lg">
          <TabsTrigger value="queue" className="data-[state=active]:bg-slate-100">
            <Server className="w-4 h-4 mr-2" /> Upload & Queue
          </TabsTrigger>
          <TabsTrigger value="threads" className="data-[state=active]:bg-slate-100">
            <Settings className="w-4 h-4 mr-2" /> Thread Configuration
          </TabsTrigger>
          <TabsTrigger value="processing" className="data-[state=active]:bg-slate-100">
            <Database className="w-4 h-4 mr-2" /> Processing Status
          </TabsTrigger>
          <TabsTrigger value="analysis" className="data-[state=active]:bg-slate-100">
            <Database className="w-4 h-4 mr-2" /> Table Analysis
          </TabsTrigger>
          <TabsTrigger value="ranks" className="data-[state=active]:bg-slate-100">
            <Database className="w-4 h-4 mr-2" /> Compute Ranks
          </TabsTrigger>
        </TabsList>

        <TabsContent value="queue" className="mt-6">
          <QueueManager queue={queue} onUpdateQueue={setQueue} />
        </TabsContent>

        <TabsContent value="threads" className="mt-6">
          <ThreadConfigurator threads={threads} onChange={setThreads} />
        </TabsContent>

        <TabsContent value="processing" className="mt-6 space-y-6">
          <ProcessingEngine threads={threads} />
          <ProcessingDashboard stats={stats} threads={threads} queue={queue} onSyncQueue={setQueue} />
        </TabsContent>

        <TabsContent value="analysis" className="mt-6">
          <MasterAnalysis />
        </TabsContent>

        <TabsContent value="ranks" className="mt-6">
          <RankCommandCenter />
        </TabsContent>
      </Tabs>

      {/*
        @note Backend alignment for AI webhook:
        The AI returns an ARRAY of objects per PDF (one per complaint when multiple are present).
        Backend must iterate this array and map fields into master cases:
          - petitioner_lawyers (string[]) and respondent_lawyers (string[]) must be mapped into wide columns
            petitioner_lawyer_1..5 and respondent_lawyer_1..5 (truncate or pad with nulls as needed).
          - judge (string) can be mapped into judge_1 (additional judges null).
          - filing_date and judgement_date should parse as DATE.
          - complaint_number maps to cases.case_number (unique upsert key).
          - status/outcome follow strict mappings from the prompt and should be stored as-is into cases.status/cases.outcome.

        // @note: ONEDRIVE WORKER LOGIC
        // 1. The worker must fetch() the 'direct_download_url' from the queue.
        // 2. Fetch MUST be configured to follow redirects (e.g., axios or node-fetch with redirect: 'follow'), because
        //    OneDrive dynamic links often redirect to a temporary SharePoint CDN URL before streaming the PDF.
        // 3. Buffer the response arrayBuffer() and send it to the AI Provider as base64 or via their Files API.
        // 4. Provide the 'public_viewer_url' to the AI in the system instructions so it can map it to the 'judgement_link'
        //    output field exactly as received.
      */}
    </div>
  );
}

