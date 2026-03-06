import { NextRequest, NextResponse } from 'next/server';

export class ApiError extends Error {
    constructor(public statusCode: number, message: string, public details?: any) {
      super(message);
      this.name = 'ApiError';
    }
  }

/**
 * Standardizes successful API responses.
 */
export function successResponse<T>(data: T, status = 200) {
  return NextResponse.json(
    { success: true, data },
    { status }
  );
}

/**
 * Standardizes error API responses, making them easier to log and handle.
 */
export function errorResponse(message: string, status = 400, details?: any) {
  // You can easily plug in a logger like Axiom or Winston here before returning
  console.error(`[API Error ${status}]:`, message, details || '');
  
  return NextResponse.json(
    { success: false, error: message, ...(details && { details }) },
    { status }
  );
}

// Example usage in app/api/route.ts:
// return successResponse({ user: "John" });
// return errorResponse("Failed to fetch external transit data", 502);

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

/**
 * Wraps your Next.js API routes to provide automatic try/catch, 
 * performance timing, and standardized logging.
 */
export function withApiHandler(handler: ApiHandler): ApiHandler {
  return async (req: NextRequest, context: any) => {
    const startTime = performance.now();
    const meta = getRequestMeta(req);

    try {
      // Execute the actual route logic
      const response = await handler(req, context);
      
      const duration = performance.now() - startTime;
      
      // Log successful requests (Optional: pipe this to Axiom, Datadog, etc.)
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
      
      // Check if it's a known error we intentionally threw
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

      // Handle unexpected, unhandled server errors (e.g., database crashes)
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

// export const GET = withApiHandler(async (req: NextRequest) => {
//     const searchParams = req.nextUrl.searchParams;
//     const stopCode = searchParams.get('stopCode');
  
//     // 1. Validation: Throw a custom error. The wrapper automatically catches it 
//     // and formats it as a 400 Bad Request with your message.
//     if (!stopCode) {
//       throw new ApiError(400, 'Missing required parameter: stopCode');
//     }
  
//     // 2. Authorization example
//     const authHeader = req.headers.get('Authorization');
//     if (authHeader !== `Bearer ${process.env.API_SECRET}`) {
//       throw new ApiError(401, 'Unauthorized access');
//     }
  
//     // 3. Main Logic (e.g., fetching from an upstream API or database)
//     const data = await fetchUpstreamData(stopCode);
  
//     // 4. Return success
//     return successResponse({
//       stop: stopCode,
//       arrivals: data,
//     });
//   });