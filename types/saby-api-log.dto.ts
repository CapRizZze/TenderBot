export interface SabyApiCallLogEntry {
  id: string;
  operation: string;
  method: string;
  endpoint: string;
  requestName?: string | null;
  tenderExternalId?: string | null;
  tenderNumber?: string | null;
  status: string;
  httpStatus?: number | null;
  durationMs: number;
  usedRequests?: number | null;
  dayCounterBefore?: number | null;
  dayCounterAfter?: number | null;
  dayRemainingBefore?: number | null;
  dayRemainingAfter?: number | null;
  error?: string | null;
  createdAt: string;
}
