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
    console.log(`[MoginHood backfill] ${message}`);
    return;
  }
  console.log(`[MoginHood backfill] ${message}`, extra);
}

export const HANDLER_DEADLINE_MS = 20_000;

export async function runWithDeadline<T>(
  work: (signal: AbortSignal) => Promise<T>,
  deadlineMs: number = HANDLER_DEADLINE_MS,
): Promise<T> {
  const controller = new AbortController();
  const seconds = Math.max(1, Math.round(deadlineMs / 1000));
  const timeoutMessage = `Backfill exceeded ${seconds} second deadline`;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new BackfillStageError('handler-timeout', timeoutMessage, 503));
    }, deadlineMs);
  });
  try {
    return await Promise.race([work(controller.signal), timeout]);
  } finally {
    if (timer) clearTimeout(timer);
    if (!controller.signal.aborted) controller.abort();
  }
}

export function stageErrorBody(err: BackfillStageError): {
  ok: false;
  stage: string;
  error: string;
} {
  return { ok: false, stage: err.stage, error: err.message };
}
