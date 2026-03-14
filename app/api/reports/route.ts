import { NextRequest } from "next/server";
import { withApiHandler, successResponse, ApiError } from "../../../utils/api";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";

export const POST = withApiHandler(async (req: NextRequest) => {
  const body = await req.json();
  const supabaseAdmin = createAdminClient();

  const shortId = Math.random().toString(36).substring(2, 6).toUpperCase();
  const year = new Date().getFullYear();
  
  const caseRef = `REQ-${year}-${shortId}`;
  const incidentRef = `INC-${year}-${shortId}`; 

  const { data: incidentData, error: incidentError } = await supabaseAdmin
    .from("damage_incident")
    .insert([{
      incident_reference: incidentRef,
      type: body.type,
      block: body.block,
      location: body.location, 
      unit_number: body.unit_number,
      incident_status: "PENDING",
    }])
    .select()
    .single();

  if (incidentError) {
    console.error("INCIDENT CREATION ERROR:", incidentError);
    throw new ApiError(500, "Failed to create master incident.", incidentError);
  }

  const { data: reportData, error: reportError } = await supabaseAdmin
    .from("barrack_damage")
    .insert([{
      ...body, 
      case_reference: caseRef,
      status: "PENDING_COY",
      approved_by_coy: false,
      incident_id: incidentData.id,
    }])
    .select()
    .single();

  if (reportError) {
    console.error("REPORT CREATION ERROR:", reportError);
    throw new ApiError(500, "Failed to save the report.", reportError);
  }

  return successResponse(reportData, 201);
});

export const GET = withApiHandler(async (req: NextRequest) => {
  const { searchParams } = new URL(req.url);
  const company = searchParams.get("company");
  const status = searchParams.get("status");
  const block = searchParams.get("block");
  const search = searchParams.get("search");
  const unitLocation = searchParams.get("unit_location");
  const urgent = searchParams.get("urgent");
  const fetchAll = searchParams.get("fetchAll") === "true";

  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "10");
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  const supabase = await createClient();

  let query = supabase
    .from("barrack_damage")
    .select("*, incident:damage_incident(*)", { count: "exact" })
    .order("date_reported", { ascending: false });

  if (company) query = query.eq("company", company);
  if (status) query = query.eq("status", status);
  if (block) query = query.eq("block", block);
  if (search) {
    query = query.or(`unit_number.ilike.%${search}%,location.ilike.%${search}%,case_reference.ilike.%${search}%`);
  }
  if (unitLocation) {
    const cleanSearch = unitLocation.replace(/^[#0]+/, '');
    query = query.or(`unit_number.ilike.%${cleanSearch}%,location.ilike.%${cleanSearch}%`);
  }

  if (urgent === "true") { 
    query = query.eq("is_urgent", true);
  }

  if (!fetchAll) query = query.range(from, to);

  const { data, error, count } = await query;

  if (error) throw new ApiError(500, "Failed to fetch reports.", error);

  const totalRecords = count || 0;
  const totalPages = fetchAll ? 1 : Math.ceil(totalRecords / limit);

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

export const PUT = withApiHandler(async (req: NextRequest) => {
  const body = await req.json();
  const { id, incident_id, ...updateData } = body;

  if (!id) {
    throw new ApiError(400, "Report ID is required for updating.", null);
  }

  const supabaseAdmin = createAdminClient();

  const { data: reportData, error: reportError } = await supabaseAdmin
    .from("barrack_damage")
    .update({
      company: updateData.company,
      damage_tag_placed: updateData.damage_tag_placed,
      is_urgent: updateData.is_urgent,
      reported_by: updateData.reported_by,
      type: updateData.type,
      block: updateData.block, // ADDED
      location: updateData.location,
      unit_number: updateData.unit_number,
      description: updateData.description,
      image_urls: updateData.image_urls,
    })
    .eq("id", id)
    .select()
    .single();

  if (reportError) {
    console.error("REPORT UPDATE ERROR:", reportError);
    throw new ApiError(500, "Failed to update the report.", reportError);
  }

  if (incident_id) {
    const { error: incidentError } = await supabaseAdmin
      .from("damage_incident")
      .update({
        type: updateData.type,
        block: updateData.block, // ADDED
        location: updateData.location,
        unit_number: updateData.unit_number,
      })
      .eq("id", incident_id);

    if (incidentError) {
      console.error("INCIDENT SYNC ERROR:", incidentError);
    }
  }

  return successResponse(reportData, 200);
});