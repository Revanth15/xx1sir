import { NextRequest, NextResponse } from 'next/server';

export class ApiError extends Error {
  constructor(public statusCode: number, message: string, public details?: any) {
    super(message);
    this.name = 'ApiError';
  }
}

export function successResponse<T>(data: T, status = 200) {
  return NextResponse.json({ success: true, data }, { status });
}

export function errorResponse(message: string, status = 400, details?: any) {
  return NextResponse.json(
    { success: false, error: message, ...(details && { details }) },
    { status }
  );
}

type ApiHandler = (req: NextRequest, context: any) => Promise<NextResponse>;

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

export function withApiHandler(handler: ApiHandler): ApiHandler {
  return async (req: NextRequest, context: any) => {
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
    } catch (error: any) {
      const duration = performance.now() - startTime;
      
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
        message: error.message || 'Internal Server Error',
        stack: error.stack,
        ...meta,
        status: 500,
        durationMs: Math.round(duration)
      }));

      return errorResponse('An unexpected error occurred.', 500);
    }
  };
}