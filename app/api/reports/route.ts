import { NextRequest } from "next/server";
import { withApiHandler, successResponse, ApiError } from "../../../utils/api";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";

export const POST = withApiHandler(async (req: NextRequest) => {
  const body = await req.json();
  const supabaseAdmin = createAdminClient();

  const shortId = Math.random().toString(36).substring(2, 6).toUpperCase();
  const caseRef = `REQ-${new Date().getFullYear()}-${shortId}`;

  const { data, error } = await supabaseAdmin
    .from("barrack_damage")
    .insert([
      {
        ...body,
        case_reference: caseRef,
        status: "PENDING_COY",
        approved_by_coy: false,
      },
    ])
    .select()
    .single();

  if (error) {
    console.error("RAW SUPABASE ERROR:", JSON.stringify(error, null, 2));
    throw new ApiError(500, "Failed to save the report.", error);
  }

  return successResponse(data, 201);
});

export const GET = withApiHandler(async (req: NextRequest) => {
  const { searchParams } = new URL(req.url);
  const company = searchParams.get("company");
  const status = searchParams.get("status");

  // flag to bypass pagination
  const fetchAll = searchParams.get("fetchAll") === "true";

  // 1. Setup Pagination Parameters
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "10");
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  const supabase = await createClient();

  // 2. Base query with `{ count: 'exact' }`
  let query = supabase
    .from("barrack_damage")
    .select("*", { count: "exact" })
    .order("date_reported", { ascending: false });

  // Apply filters if they are provided
  if (company) query = query.eq("company", company);
  if (status) query = query.eq("status", status);

  // 3. Conditionally apply pagination
  if (!fetchAll) {
    query = query.range(from, to);
  }

  const { data, error, count } = await query;

  if (error) {
    throw new ApiError(500, "Failed to fetch reports.", error);
  }

  // Calculate metadata safely
  const totalRecords = count || 0;
  // If fetching all, there is technically only 1 "page" containing everything
  const totalPages = fetchAll ? 1 : Math.ceil(totalRecords / limit);

  // 4. Return data along with consistent pagination metadata
  return successResponse({
    reports: data,
    metadata: {
      total: totalRecords,
      page: fetchAll ? 1 : page,
      limit: fetchAll ? totalRecords : limit,
      totalPages,
    },
  });
});

export const PATCH = withApiHandler(async (req: NextRequest) => {
  const body = await req.json();
  const { id, status } = body;

  if (!id || !status) {
    throw new ApiError(400, "Report ID and new status are required.", null);
  }

  const supabaseAdmin = createAdminClient();

  const { data, error } = await supabaseAdmin
    .from("barrack_damage")
    .update({ status })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("RAW SUPABASE ERROR:", JSON.stringify(error, null, 2));
    throw new ApiError(500, "Failed to update the report status.", error);
  }

  return successResponse(data, 200);
});
