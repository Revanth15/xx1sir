import { NextRequest, NextResponse } from 'next/server';

type ApiDetails = unknown;

export class ApiError extends Error {
  constructor(public statusCode: number, message: string, public details?: ApiDetails) {
    super(message);
    this.name = 'ApiError';
  }
}

export function successResponse<T>(data: T, status = 200) {
  return NextResponse.json({ success: true, data }, { status });
}

export function errorResponse(message: string, status = 400, details?: ApiDetails) {
  const payload: Record<string, unknown> = { success: false, error: message };
  if (details !== undefined) {
    payload.details = details;
  }

  return NextResponse.json(payload, { status });
}

type ApiHandler<TContext = undefined> = (
  req: NextRequest,
  context: TContext
) => Promise<NextResponse>;

function getRequestMeta(req: NextRequest) {
  const forwardedFor = req.headers.get('x-forwarded-for');
  const ip = forwardedFor ? forwardedFor.split(',')[0].trim() : 'unknown';

  return {
    method: req.method,
    url: req.nextUrl.pathname,
    ip,
    userAgent: req.headers.get('user-agent') || 'unknown',
  };
}

export function withApiHandler<TContext = undefined>(
  handler: ApiHandler<TContext>
): ApiHandler<TContext> {
  return async (req: NextRequest, context: TContext) => {
    const startTime = performance.now();
    const meta = getRequestMeta(req);

    try {
      const response = await handler(req, context);
      const duration = performance.now() - startTime;
      
      // Structured JSON log perfectly formatted for ingestion tools like Axiom
      console.log(JSON.stringify({
        level: 'info',
        message: 'API Request successful',
        ...meta,
        status: response.status,
        durationMs: Math.round(duration)
      }));

      return response;
    } catch (error: unknown) {
      const duration = performance.now() - startTime;
      const message = error instanceof Error ? error.message : 'Internal Server Error';
      const stack = error instanceof Error ? error.stack : undefined;
      
      if (error instanceof ApiError) {
        console.warn(JSON.stringify({
          level: 'warn',
          message: error.message,
          ...meta,
          status: error.statusCode,
          durationMs: Math.round(duration)
        }));
        return errorResponse(error.message, error.statusCode, error.details);
      }

      console.error(JSON.stringify({
        level: 'error',
        message,
        stack,
        ...meta,
        status: 500,
        durationMs: Math.round(duration)
      }));

      return errorResponse('An unexpected error occurred.', 500);
    }
  };
}
