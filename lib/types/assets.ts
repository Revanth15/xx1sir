export type AssetServiceabilityStatus = "SERVICEABLE" | "UNSERVICEABLE";

export type AssetDisplayedStatus =
  | AssetServiceabilityStatus
  | "OUTDATED";

export type AssetChecklistField = {
  type: "boolean" | "text" | "number";
  required?: boolean;
  label?: string;
};

export type AssetChecklistSchema = Record<string, AssetChecklistField>;

export interface AssetTypeConfig {
  code: string;
  label: string;
  inspection_frequency_days: number;
  checklist_schema_json: AssetChecklistSchema;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface AssetRecord {
  id: string;
  asset_code: string;
  unit_code: string;
  block_code: string;
  level_code: string;
  asset_type_code: string;
  serial_number: string;
  display_name: string | null;
  location_note: string | null;
  is_active: boolean;
  last_inspected_at: string | null;
  last_inspected_by: string | null;
  last_serviceability_status: AssetServiceabilityStatus | null;
  last_check_summary_json: Record<string, unknown> | null;
  latest_inspection_id: string | null;
  created_at: string;
  created_by: string;
  updated_at: string;
  updated_by: string;
}

export interface AssetInspectionRecord {
  id: string;
  asset_id: string;
  inspected_at: string;
  inspected_by_user_id: string | null;
  inspected_by_name: string;
  serviceability_status: AssetServiceabilityStatus;
  core_notes: string | null;
  check_results_json: Record<string, unknown>;
  linked_report_id: string | null;
  created_at: string;
}

export interface AssetLinkedReportRecord {
  id: string;
  case_reference: string;
  block: string;
  unit_number: string;
  location: string;
  type: string;
  description: string;
  status: string;
  date_reported: string;
  asset_id: string | null;
  source_inspection_id: string | null;
}

export interface CreateAssetRequest {
  unit_code: string;
  block_code: string;
  level_code: string;
  asset_type_code: string;
  serial_number: string;
  display_name?: string;
  location_note?: string;
  is_active?: boolean;
}

export interface UpdateAssetRequest extends CreateAssetRequest {
  is_active?: boolean;
}

export interface BulkCreateAssetsRequest {
  unit_code: string;
  block_code: string;
  level_code: string;
  asset_type_code: string;
  serial_start: string;
  quantity: number;
  display_name_prefix?: string;
  location_note?: string;
  is_active?: boolean;
}

export interface CreateInspectionRequest {
  serviceability_status: AssetServiceabilityStatus;
  notes?: string;
  check_results_json: Record<string, unknown>;
}

export interface AssetLookupRequest {
  raw_qr_code: string;
}

export interface AssetLookupResponse {
  asset: AssetWithStatus | null;
  error?: string;
}

export interface AssetWithRelations extends AssetRecord {
  asset_type_configs?: AssetTypeConfig | null;
  asset_type_config?: AssetTypeConfig | null;
  asset_inspections?: AssetInspectionRecord[];
  linked_reports?: AssetLinkedReportRecord[];
}

export interface AssetWithStatus extends AssetWithRelations {
  asset_type_config: AssetTypeConfig | null;
  due_date: string | null;
  freshness: "CURRENT" | "OUTDATED";
  displayed_status: AssetDisplayedStatus;
}
