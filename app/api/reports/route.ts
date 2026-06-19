import { NextRequest } from "next/server";
import { z } from "zod";

import { withApiHandler, successResponse, ApiError } from "../../../utils/api";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import type { AssetInspectionRecord } from "@/lib/types/assets";
import { summarizeCheckResults } from "@/utils/assets";
import { normalizeRoomBlock, normalizeRoomUnitNumber } from "@/utils/rooms";

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

const CLOSED_REPORT_STATUSES = new Set(["COMPLETED", "REJECTED", "MERGED"]);

type ReportAssetLinkState = {
  id: string;
  asset_id: string | null;
  source_inspection_id: string | null;
  status: string;
};

type LinkedReportStatusRecord = {
  id: string;
  status: string;
};

async function ensureActiveAsset(
  supabaseAdmin: ReturnType<typeof createAdminClient>,
  assetId: string
) {
  const { data: asset, error } = await supabaseAdmin
    .from("assets")
    .select("id")
    .eq("id", assetId)
    .eq("is_active", true)
    .maybeSingle<{ id: string }>();

  if (error) {
    throw new ApiError(500, "Failed to verify linked asset.", error);
  }

  if (!asset) {
    throw new ApiError(400, "Linked asset was not found.");
  }
}

async function ensureInspectionLinkable(
  supabaseAdmin: ReturnType<typeof createAdminClient>,
  inspectionId: string,
  assetId: string,
  reportId?: string
) {
  const { data: inspection, error } = await supabaseAdmin
    .from("asset_inspections")
    .select("id, asset_id, linked_report_id")
    .eq("id", inspectionId)
    .maybeSingle<{
      id: string;
      asset_id: string;
      linked_report_id: string | null;
    }>();

  if (error) {
    throw new ApiError(500, "Failed to verify linked inspection.", error);
  }

  if (!inspection || inspection.asset_id !== assetId) {
    throw new ApiError(400, "Linked inspection does not match the linked asset.");
  }

  if (inspection.linked_report_id && inspection.linked_report_id !== reportId) {
    throw new ApiError(400, "Linked inspection already has a damage report.");
  }
}

async function refreshAssetServiceability(
  supabaseAdmin: ReturnType<typeof createAdminClient>,
  assetId: string
) {
  const { data: linkedReports, error: linkedReportsError } = await supabaseAdmin
    .from("barrack_damage")
    .select("id, status")
    .eq("asset_id", assetId)
    .returns<LinkedReportStatusRecord[]>();

  if (linkedReportsError) {
    throw new ApiError(500, "Failed to refresh linked asset reports.", linkedReportsError);
  }

  const hasOpenLinkedReport = (linkedReports ?? []).some(
    (report) => !CLOSED_REPORT_STATUSES.has(report.status)
  );

  if (hasOpenLinkedReport) {
    const { error } = await supabaseAdmin
      .from("assets")
      .update({
        last_serviceability_status: "UNSERVICEABLE",
        updated_at: new Date().toISOString(),
      })
      .eq("id", assetId);

    if (error) {
      throw new ApiError(500, "Failed to mark the linked asset unserviceable.", error);
    }

    return;
  }

  const { data: latestInspection, error: latestInspectionError } = await supabaseAdmin
    .from("asset_inspections")
    .select("*")
    .eq("asset_id", assetId)
    .order("inspected_at", { ascending: false })
    .limit(1)
    .maybeSingle<AssetInspectionRecord>();

  if (latestInspectionError) {
    throw new ApiError(500, "Failed to fetch latest asset inspection.", latestInspectionError);
  }

  const updatePayload = latestInspection
    ? {
        last_inspected_at: latestInspection.inspected_at,
        last_inspected_by: latestInspection.inspected_by_name,
        last_serviceability_status: latestInspection.serviceability_status,
        last_check_summary_json: summarizeCheckResults(
          latestInspection.check_results_json ?? {}
        ),
        latest_inspection_id: latestInspection.id,
        updated_at: new Date().toISOString(),
      }
    : {
        last_inspected_at: null,
        last_inspected_by: null,
        last_serviceability_status: null,
        last_check_summary_json: null,
        latest_inspection_id: null,
        updated_at: new Date().toISOString(),
      };

  const { error } = await supabaseAdmin
    .from("assets")
    .update(updatePayload)
    .eq("id", assetId);

  if (error) {
    throw new ApiError(500, "Failed to refresh linked asset status.", error);
  }
}

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

    const report = {
      ...parsed.data,
      block: normalizeRoomBlock(parsed.data.block),
      unit_number: normalizeRoomUnitNumber(parsed.data.unit_number),
    };

    if (!report.block || !report.unit_number) {
      throw new ApiError(400, "Block and unit number are required.");
    }

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

  if (data.asset_id) {
    await refreshAssetServiceability(supabaseAdmin, data.asset_id);
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

  const hasAssetField = Object.prototype.hasOwnProperty.call(body, "asset_id");
  const hasInspectionField = Object.prototype.hasOwnProperty.call(
    body,
    "source_inspection_id"
  );

  const parsedAssetId = optionalUuidSchema.safeParse(body.asset_id);
  const parsedInspectionId = optionalUuidSchema.safeParse(body.source_inspection_id);

  if (hasAssetField && !parsedAssetId.success) {
    throw new ApiError(400, "Invalid linked asset ID.", parsedAssetId.error.flatten());
  }

  if (hasInspectionField && !parsedInspectionId.success) {
    throw new ApiError(
      400,
      "Invalid linked inspection ID.",
      parsedInspectionId.error.flatten()
    );
  }

  const { data: existingReport, error: existingReportError } = await supabaseAdmin
    .from("barrack_damage")
    .select("id, asset_id, source_inspection_id, status")
    .eq("id", id)
    .single<ReportAssetLinkState>();

  if (existingReportError || !existingReport) {
    throw new ApiError(404, "Report not found.", existingReportError);
  }

  const nextAssetId = hasAssetField
    ? parsedAssetId.success
      ? parsedAssetId.data ?? null
      : null
    : existingReport.asset_id;
  const nextInspectionId = hasInspectionField
    ? parsedInspectionId.success
      ? parsedInspectionId.data ?? null
      : null
    : existingReport.source_inspection_id;

  if (nextInspectionId && !nextAssetId) {
    throw new ApiError(400, "Linked inspection requires a linked asset.");
  }

  if (nextAssetId) {
    await ensureActiveAsset(supabaseAdmin, nextAssetId);
  }

  if (nextInspectionId && nextAssetId) {
    await ensureInspectionLinkable(supabaseAdmin, nextInspectionId, nextAssetId, id);
  }

  const normalizedUpdateData = {
    ...updateData,
    block: normalizeRoomBlock(updateData.block),
    unit_number: normalizeRoomUnitNumber(updateData.unit_number),
  };

  if (!normalizedUpdateData.block || !normalizedUpdateData.unit_number) {
    throw new ApiError(400, "Block and unit number are required.");
  }

  const { data: reportData, error: reportError } = await supabaseAdmin
    .from("barrack_damage")
    .update({
      company: normalizedUpdateData.company,
      damage_tag_placed: normalizedUpdateData.damage_tag_placed,
      is_urgent: normalizedUpdateData.is_urgent,
      reported_by: normalizedUpdateData.reported_by,
      type: normalizedUpdateData.type,
      block: normalizedUpdateData.block,
      location: normalizedUpdateData.location,
      unit_number: normalizedUpdateData.unit_number,
      description: normalizedUpdateData.description,
      image_urls: normalizedUpdateData.image_urls,
      asset_id: nextAssetId,
      source_inspection_id: nextInspectionId,
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
        type: normalizedUpdateData.type,
        block: normalizedUpdateData.block,
        location: normalizedUpdateData.location,
        unit_number: normalizedUpdateData.unit_number,
      })
      .eq("id", incident_id);

    if (incidentError) {
      console.error("INCIDENT SYNC ERROR:", incidentError);
    }
  }

  if (
    existingReport.source_inspection_id &&
    existingReport.source_inspection_id !== nextInspectionId
  ) {
    const { error: deleteInspectionError } = await supabaseAdmin
      .from("asset_inspections")
      .delete()
      .eq("id", existingReport.source_inspection_id)
      .eq("linked_report_id", id);

    if (deleteInspectionError) {
      throw new ApiError(
        500,
        "Failed to delete the previous linked asset inspection.",
        deleteInspectionError
      );
    }
  }

  if (nextInspectionId) {
    const { error: linkInspectionError } = await supabaseAdmin
      .from("asset_inspections")
      .update({ linked_report_id: id })
      .eq("id", nextInspectionId);

    if (linkInspectionError) {
      throw new ApiError(
        500,
        "Failed to link the asset inspection.",
        linkInspectionError
      );
    }
  }

  const assetIdsToRefresh = new Set<string>();
  if (existingReport.asset_id) {
    assetIdsToRefresh.add(existingReport.asset_id);
  }
  if (nextAssetId) {
    assetIdsToRefresh.add(nextAssetId);
  }

  await Promise.all(
    Array.from(assetIdsToRefresh).map((assetId) =>
      refreshAssetServiceability(supabaseAdmin, assetId)
    )
  );

    return successResponse(reportData, 200);
  }
);
