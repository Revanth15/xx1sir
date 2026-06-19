import { NextRequest } from "next/server";

import { ApiError, successResponse, withApiHandler } from "@/utils/api";
import { createAdminClient } from "@/utils/supabase/admin";
import {
  CLOSED_REPORT_STATUSES,
  normalizeRoomBlock,
  normalizeRoomUnitNumber,
} from "@/utils/rooms";

type RoomActiveReportRecord = {
  id: string;
  case_reference: string;
  type: string;
  status: string;
  description: string;
  date_reported: string;
  is_urgent: boolean;
  damage_tag_placed: boolean;
  asset_id: string | null;
  asset: {
    id: string;
    asset_code: string;
    display_name: string | null;
    last_serviceability_status: string | null;
  } | null;
};

export const GET = withApiHandler<{ params: Promise<Record<string, string>> }>(
  async (req: NextRequest) => {
    const { searchParams } = new URL(req.url);
    const block = normalizeRoomBlock(searchParams.get("block"));
    const unitNumber = normalizeRoomUnitNumber(searchParams.get("unit_number"));

    if (!block || !unitNumber) {
      throw new ApiError(400, "block and unit_number are required.");
    }

    const supabaseAdmin = createAdminClient();
    let query = supabaseAdmin
      .from("barrack_damage")
      .select(
        `
        id,
        case_reference,
        type,
        status,
        description,
        date_reported,
        is_urgent,
        damage_tag_placed,
        asset_id,
        asset:assets (
          id,
          asset_code,
          display_name,
          last_serviceability_status
        )
      `
      )
      .eq("block", block)
      .eq("unit_number", unitNumber)
      .order("date_reported", { ascending: false });

    for (const status of CLOSED_REPORT_STATUSES) {
      query = query.neq("status", status);
    }

    const { data, error } = await query.returns<RoomActiveReportRecord[]>();

    if (error) {
      throw new ApiError(500, "Failed to fetch active room reports.", error);
    }

    return successResponse({
      room: {
        block,
        unit_number: unitNumber,
      },
      reports: data ?? [],
    });
  }
);
