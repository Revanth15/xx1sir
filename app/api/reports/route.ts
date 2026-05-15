import { NextRequest } from "next/server";
import { z } from "zod";

import { withApiHandler, successResponse, ApiError } from "../../../utils/api";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";

const optionalUuidSchema = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z.string().uuid().optional()
);

const createReportSchema = z.object({
  company: z.string().trim().min(1),
  damage_tag_placed: z.boolean().default(false),
  is_urgent: z.boolean().default(false),
  reported_by: z.string().trim().min(2),
  type: z.string().trim().min(1),
  block: z.string().trim().min(1),
  location: z.string().trim().min(2),
  unit_number: z.string().trim().min(1),
  description: z.string().trim().min(20),
  image_urls: z.array(z.string().trim().min(1)).default([]),
  asset_id: optionalUuidSchema,
  source_inspection_id: optionalUuidSchema,
});

export const POST = withApiHandler<{ params: Promise<Record<string, string>> }>(
  async (req: NextRequest) => {
    const body = await req.json();
    const parsed = createReportSchema.safeParse(body);

    if (!parsed.success) {
      throw new ApiError(
        400,
        "Invalid report payload.",
        parsed.error.flatten()
      );
    }

    const report = parsed.data;
    const supabaseAdmin = createAdminClient();
    const assetId = report.asset_id ?? null;
    const sourceInspectionId = report.source_inspection_id ?? null;

    if (sourceInspectionId && !assetId) {
      throw new ApiError(400, "Linked inspection requires a linked asset.");
    }

    if (assetId) {
      const { data: asset, error: assetError } = await supabaseAdmin
        .from("assets")
        .select("id")
        .eq("id", assetId)
        .eq("is_active", true)
        .maybeSingle<{ id: string }>();

      if (assetError) {
        throw new ApiError(500, "Failed to verify linked asset.", assetError);
      }

      if (!asset) {
        throw new ApiError(400, "Linked asset was not found.");
      }
    }

    if (sourceInspectionId) {
      const { data: inspection, error: inspectionError } = await supabaseAdmin
        .from("asset_inspections")
        .select("id, asset_id, linked_report_id")
        .eq("id", sourceInspectionId)
        .maybeSingle<{
          id: string;
          asset_id: string;
          linked_report_id: string | null;
        }>();

      if (inspectionError) {
        throw new ApiError(
          500,
          "Failed to verify linked inspection.",
          inspectionError
        );
      }

      if (!inspection || inspection.asset_id !== assetId) {
        throw new ApiError(400, "Linked inspection does not match the linked asset.");
      }

      if (inspection.linked_report_id) {
        throw new ApiError(400, "Linked inspection already has a damage report.");
      }
    }

    const shortId = Math.random().toString(36).substring(2, 6).toUpperCase();
    const year = new Date().getFullYear();

    const caseRef = `REQ-${year}-${shortId}`;
    const incidentRef = `INC-${year}-${shortId}`;

    const { data: incidentData, error: incidentError } = await supabaseAdmin
      .from("damage_incident")
      .insert([{
        incident_reference: incidentRef,
        type: report.type,
        block: report.block,
        location: report.location,
        unit_number: report.unit_number,
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
        company: report.company,
        damage_tag_placed: report.damage_tag_placed,
        is_urgent: report.is_urgent,
        reported_by: report.reported_by,
        type: report.type,
        block: report.block,
        location: report.location,
        unit_number: report.unit_number,
        description: report.description,
        image_urls: report.image_urls,
        asset_id: assetId,
        source_inspection_id: sourceInspectionId,
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

    if (sourceInspectionId) {
      const { error: inspectionLinkError } = await supabaseAdmin
        .from("asset_inspections")
        .update({ linked_report_id: reportData.id })
        .eq("id", sourceInspectionId);

      if (inspectionLinkError) {
        console.error("INSPECTION REPORT LINK ERROR:", inspectionLinkError);
      }
    }

    if (assetId) {
      const { error: assetStatusError } = await supabaseAdmin
        .from("assets")
        .update({
          last_serviceability_status: "UNSERVICEABLE",
          updated_at: new Date().toISOString(),
        })
        .eq("id", assetId);

      if (assetStatusError) {
        console.error("ASSET STATUS UPDATE ERROR:", assetStatusError);
        throw new ApiError(
          500,
          "Report saved, but failed to mark the linked asset unserviceable.",
          assetStatusError
        );
      }
    }

    return successResponse(reportData, 201);
  }
);

export const GET = withApiHandler<{ params: Promise<Record<string, string>> }>(
  async (req: NextRequest) => {
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
  }
);

export const PATCH = withApiHandler<{ params: Promise<Record<string, string>> }>(
  async (req: NextRequest) => {
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
  }
);

export const PUT = withApiHandler<{ params: Promise<Record<string, string>> }>(
  async (req: NextRequest) => {
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
  }
);
