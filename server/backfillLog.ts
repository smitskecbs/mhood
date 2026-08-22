export class BackfillStageError extends Error {
  readonly stage: string;
  readonly status: number;

  constructor(stage: string, message: string, status: number) {
    super(message);
    this.name = 'BackfillStageError';
    this.stage = stage;
    this.status = status;
  }
}

export function backfillLog(message: string, extra?: unknown): void {
  if (extra === undefined) {
    console.info(`[MoginHood backfill] ${message}`);
    return;
  }
  console.info(`[MoginHood backfill] ${message}`, extra);
}

export function stageErrorBody(err: BackfillStageError): {
  ok: false;
  stage: string;
  error: string;
} {
  return { ok: false, stage: err.stage, error: err.message };
}
