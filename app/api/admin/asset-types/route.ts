import { NextRequest } from "next/server";
import { z } from "zod";

import { requireApiAdmin } from "@/lib/server-auth";
import type { AssetChecklistSchema, AssetTypeConfig } from "@/lib/types/assets";
import { ApiError, successResponse, withApiHandler } from "@/utils/api";
import { normalizeAssetCodePart } from "@/utils/assets";
import { createAdminClient } from "@/utils/supabase/admin";

const checklistFieldSchema = z.object({
  type: z.enum(["boolean", "date", "text", "number"]),
  label: z.string().trim().min(1).optional(),
  required: z.boolean().optional(),
});

const assetTypePayloadSchema = z.object({
  code: z.string().trim().min(1),
  label: z.string().trim().min(1),
  inspection_frequency_days: z.number().int().min(1).max(3650),
  is_active: z.boolean(),
  checklist_schema_json: z.record(z.string().trim().min(1), checklistFieldSchema),
});

function normalizeChecklistSchema(schema: AssetChecklistSchema) {
  return Object.fromEntries(
    Object.entries(schema).map(([key, field]) => [
      key.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, ""),
      {
        type: field.type,
        label: field.label?.trim() || key.replace(/_/g, " "),
        required: field.required ?? false,
      },
    ])
  );
}

type EmptyRouteContext = { params: Promise<Record<string, string>> };

export const GET = withApiHandler<EmptyRouteContext>(
  async (req: NextRequest, context: EmptyRouteContext) => {
    void req;
    void context;
    await requireApiAdmin();

    const supabaseAdmin = createAdminClient();
    const { data, error } = await supabaseAdmin
      .from("asset_type_configs")
      .select("*")
      .order("label")
      .returns<AssetTypeConfig[]>();

    if (error) {
      throw new ApiError(500, "Failed to fetch asset type settings.", error);
    }

    return successResponse({ assetTypeConfigs: data ?? [] });
  }
);

export const PATCH = withApiHandler<EmptyRouteContext>(
  async (req: NextRequest, context: EmptyRouteContext) => {
    void context;
    await requireApiAdmin();

    const payload = await req.json();
    const parsed = assetTypePayloadSchema.safeParse(payload);

    if (!parsed.success) {
      throw new ApiError(400, "Invalid asset type settings.", parsed.error.flatten());
    }

    const body = parsed.data;
    const checklistSchema = normalizeChecklistSchema(body.checklist_schema_json);
    const supabaseAdmin = createAdminClient();
    const { data, error } = await supabaseAdmin
      .from("asset_type_configs")
      .update({
        label: body.label.trim(),
        inspection_frequency_days: body.inspection_frequency_days,
        checklist_schema_json: checklistSchema,
        is_active: body.is_active,
        updated_at: new Date().toISOString(),
      })
      .eq("code", normalizeAssetCodePart(body.code))
      .select("*")
      .single<AssetTypeConfig>();

    if (error) {
      throw new ApiError(500, "Failed to update asset type settings.", error);
    }

    return successResponse({ assetTypeConfig: data });
  }
);

export const POST = withApiHandler<EmptyRouteContext>(
  async (req: NextRequest, context: EmptyRouteContext) => {
    void context;
    await requireApiAdmin();

    const payload = await req.json();
    const parsed = assetTypePayloadSchema.safeParse(payload);

    if (!parsed.success) {
      throw new ApiError(400, "Invalid asset type settings.", parsed.error.flatten());
    }

    const body = parsed.data;
    const code = normalizeAssetCodePart(body.code);

    if (!/^[A-Z0-9]+$/.test(code)) {
      throw new ApiError(400, "Asset type code can only contain letters and numbers.");
    }

    const supabaseAdmin = createAdminClient();
    const { data, error } = await supabaseAdmin
      .from("asset_type_configs")
      .insert([
        {
          code,
          label: body.label.trim(),
          inspection_frequency_days: body.inspection_frequency_days,
          checklist_schema_json: normalizeChecklistSchema(body.checklist_schema_json),
          is_active: body.is_active,
        },
      ])
      .select("*")
      .single<AssetTypeConfig>();

    if (error) {
      if (error.code === "23505") {
        throw new ApiError(409, `Asset type ${code} already exists.`);
      }

      throw new ApiError(500, "Failed to create asset type.", error);
    }

    return successResponse({ assetTypeConfig: data }, 201);
  }
);
