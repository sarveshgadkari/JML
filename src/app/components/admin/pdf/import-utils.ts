import getSupabase from "../../../../utils/supabase/client";

type ExtractionRow = Record<string, any>;

function stripTicks(value: any) {
  return typeof value === "string" ? value.replace(/^`+|`+$/g, "").trim() : value;
}

/** Preserve court-specific formats (slashes, prefixes, mixed case); only light cleanup. */
function normalizeCaseNumber(value: any) {
  const stripped = stripTicks(value);
  if (stripped === null || stripped === undefined) return null;
  const normalized = String(stripped)
    .replace(/\u00a0/g, " ")
    .replace(/[–—]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
  return normalized || null;
}

function lawyersToWideColumns(prefix: "petitioner_lawyer_" | "respondent_lawyer_", names: string[]) {
  const out: Record<string, string | null> = {};
  for (let i = 0; i < 5; i += 1) {
    out[`${prefix}${i + 1}`] = names[i] ?? null;
  }
  return out;
}

function normalizeDate(value: any) {
  if (typeof value !== "string") return value ?? null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const ddmmyyyy = trimmed.match(/^(\d{2})[-./](\d{2})[-./](\d{4})$/);
  if (ddmmyyyy) return `${ddmmyyyy[3]}-${ddmmyyyy[2]}-${ddmmyyyy[1]}`;
  return trimmed;
}

function toStringArray(value: any) {
  if (Array.isArray(value)) {
    return value.map(stripTicks).filter(Boolean);
  }
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed.map(stripTicks).filter(Boolean) : [];
    } catch {
      return value.trim() ? [value.trim()] : [];
    }
  }
  return [];
}

export function buildImportPayloadFromExtractionRows(rows: ExtractionRow[]) {
  return rows.flatMap((obj) => {
    const cleaned = obj || {};
    const appealFromOrder =
      cleaned.appeal_from_order ??
      cleaned["Appeal from Order"] ??
      cleaned.appeal_from_order_description ??
      null;
    const petitioners = toStringArray(cleaned.petitioner_lawyers);
    const respondents = toStringArray(cleaned.respondent_lawyers);
    const link = stripTicks(cleaned.judgement_link);
    const courtType = stripTicks(cleaned.court_type);
    const summaryParts = [
      courtType ? `court_type: ${courtType}` : "",
      link ? `judgement_link: ${link}` : "",
    ].filter(Boolean);
    const summary = summaryParts.length ? summaryParts.join(" | ") : null;

    return [{
      // Some courts/models may provide APPEAL FROM ORDER but set complaint_number = null.
      case_number: normalizeCaseNumber(cleaned.complaint_number ?? cleaned.case_number ?? appealFromOrder),
      case_title: stripTicks(cleaned.case_title),
      case_type: stripTicks(cleaned.case_type) || null,
      court_name: stripTicks(cleaned.court_name ?? cleaned.court) || null,
      petitioner_name:
        stripTicks(cleaned.petitioner_name ?? cleaned.complainant ?? cleaned.parties?.petitioner) || null,
      respondent_name:
        stripTicks(cleaned.respondent_name ?? cleaned.respondent ?? cleaned.parties?.respondent) || null,
      judge_1: stripTicks(cleaned.judge) || null,
      ...lawyersToWideColumns("petitioner_lawyer_", petitioners),
      ...lawyersToWideColumns("respondent_lawyer_", respondents),
      filing_date: normalizeDate(stripTicks(cleaned.filing_date)),
      judgment_date: normalizeDate(stripTicks(cleaned.judgment_date ?? cleaned.judgement_date)),
      total_hearings: cleaned.total_hearings ?? null,
      status: stripTicks(cleaned.status),
      outcome: stripTicks(cleaned.outcome),
      appeal_from_order:
        stripTicks(
          cleaned.appeal_from_order ??
            cleaned["Appeal from Order"] ??
            cleaned.appeal_from_order_description
        ) || null,
      summary,
      data_source: "pdf_ai",
    }];
  }).filter((row) => row.case_number);
}

export async function importCasesPayload(payload: Array<Record<string, any>>) {
  if (payload.length === 0) return;
  const supabase = getSupabase();
  const chunkSize = 100;
  for (let i = 0; i < payload.length; i += chunkSize) {
    const slice = payload.slice(i, i + chunkSize);
    const { error } = await supabase.rpc("admin_import_cases_json_skip_sync", {
      p_rows: slice,
      p_replace_existing: false,
      p_skip_sync: i + chunkSize < payload.length,
    });
    if (error) throw error;
  }
}
