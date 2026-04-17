import { NextRequest } from "next/server";
import { withApiHandler, successResponse, ApiError } from "@/utils/api";
import { createAdminClient } from "@/utils/supabase/admin";

export const POST = withApiHandler(
  async (
    req: NextRequest,
    _context: { params: Promise<Record<string, string>> }
  ) => {
    const body = await req.json();
  
  const { masterReportId, subsumedCaseRef, actorName, actorId } = body;

  if (!masterReportId || !subsumedCaseRef) {
    throw new ApiError(400, "Master Report ID and Duplicate Case Ref are required.", null);
  }

  const supabaseAdmin = createAdminClient();

  const { data: masterReport, error: masterError } = await supabaseAdmin
    .from("barrack_damage")
    .select("incident_id")
    .eq("id", masterReportId)
    .single();

  if (masterError || !masterReport?.incident_id) {
    throw new ApiError(404, "Master report or its incident not found.", masterError);
  }

  const survivingIncidentId = masterReport.incident_id;

  const { data: duplicateReport, error: duplicateError } = await supabaseAdmin
    .from("barrack_damage")
    .select("id, incident_id")
    .eq("case_reference", subsumedCaseRef)
    .single();

  if (duplicateError || !duplicateReport) {
    throw new ApiError(
      404, 
      `Duplicate Report ${subsumedCaseRef} not found. Please verify the Case Reference.`, 
      duplicateError
    );
  }

  const duplicateReportId = duplicateReport.id;
  const oldIncidentId = duplicateReport.incident_id;

  if (oldIncidentId === survivingIncidentId) {
    throw new ApiError(400, "These reports are already merged together.", null);
  }

  const { data: updatedReport, error: updateError } = await supabaseAdmin
    .from("barrack_damage")
    .update({ 
      incident_id: survivingIncidentId,
      status: "MERGED" 
    })
    .eq("id", duplicateReportId)
    .select()
    .single();

  if (updateError) {
    throw new ApiError(500, "Failed to merge the report.", updateError);
  }

  const { error: logError } = await supabaseAdmin
    .from("case_timeline_log")
    .insert([{
      damage_id: duplicateReportId,
      incident_id: survivingIncidentId,
      action_taken: "MERGED_INTO_INCIDENT",
      actor_name: actorName || "System Admin",
      actor_id: actorId || null,
    }]);

  if (logError) {
    console.error("Failed to create audit log for merge:", logError);
  }

  if (oldIncidentId) {
    const { error: deleteError } = await supabaseAdmin
      .from("damage_incident")
      .delete()
      .eq("id", oldIncidentId);

    if (deleteError) {
      console.error(`Failed to delete orphaned incident ${oldIncidentId}:`, deleteError);
    }
  }

    return successResponse(updatedReport, 200);
  }
);
