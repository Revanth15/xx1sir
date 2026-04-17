import { createClient } from "@/utils/supabase/server";

type SearchParams = Record<string, string | undefined>;
type DashboardScope = "active" | "completed";

type DamageIncident = {
  id: string;
  incident_reference?: string;
  incident_status: string;
  ifm_reported_date: string | null;
  ifm_target_date: string | null;
  repaired_date: string | null;
  block?: string;
  unit_number?: string;
  location?: string;
};

type DashboardBarrackDamage = {
  id: string;
  case_reference: string;
  is_urgent: boolean;
  company: string;
  damage_tag_placed: boolean;
  reported_by: string;
  type: string;
  block: string;
  location: string;
  unit_number: string;
  description: string;
  image_urls: string[];
  status: string;
  approved_by_coy: boolean;
  date_reported: string;
  incident_id: string | null;
  incident: DamageIncident | null;
  subRows?: DashboardBarrackDamage[];
};

type RelatedReport = DashboardBarrackDamage;

type DashboardReportRecord = {
  id: DashboardBarrackDamage["id"];
  case_reference: DashboardBarrackDamage["case_reference"];
  is_urgent: DashboardBarrackDamage["is_urgent"];
  company: DashboardBarrackDamage["company"];
  damage_tag_placed: DashboardBarrackDamage["damage_tag_placed"];
  reported_by: DashboardBarrackDamage["reported_by"];
  type: DashboardBarrackDamage["type"];
  block: DashboardBarrackDamage["block"];
  location: DashboardBarrackDamage["location"];
  unit_number: DashboardBarrackDamage["unit_number"];
  description: DashboardBarrackDamage["description"];
  image_urls: DashboardBarrackDamage["image_urls"];
  status: DashboardBarrackDamage["status"];
  approved_by_coy: DashboardBarrackDamage["approved_by_coy"];
  date_reported: DashboardBarrackDamage["date_reported"];
  incident_id: DashboardBarrackDamage["incident_id"];
  incident?: {
    id: string;
    incident_reference?: string;
    incident_status: string;
    ifm_reported_date: string | null;
    ifm_target_date: string | null;
    repaired_date: string | null;
    block?: string;
    unit_number?: string;
    location?: string;
    barrack_damage?: RelatedReport[] | null;
  } | null;
};

export async function getReports(
  params: SearchParams,
  scope: DashboardScope = "active"
) {
  const page = Number(params.page) || 1;
  const limit = 10;
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  const supabase = await createClient();
  const normalizedStatus = params.status?.toUpperCase();
  const showMergedAsTopLevel = normalizedStatus === "MERGED";

  let query = supabase
    .from("barrack_damage")
    .select(
      `
      *,
      incident:damage_incident (
        *,
        barrack_damage (*)
      )
    `,
      { count: "exact" }
    )
    .order("date_reported", { ascending: false })
    .range(from, to);

  if (params.search) {
    const searchTerm = `%${params.search}%`;
    query = query.or(
      `case_reference.ilike.${searchTerm},description.ilike.${searchTerm},location.ilike.${searchTerm},unit_number.ilike.${searchTerm},company.ilike.${searchTerm},type.ilike.${searchTerm}`
    );
  }

  if (params.company) query = query.ilike("company", `%${params.company}%`);
  if (params.location) query = query.ilike("location", `%${params.location}%`);
  if (params.type) query = query.ilike("type", `%${params.type}%`);
  if (params.block) query = query.eq("block", params.block);

  if (params.unit_location) {
    const cleanSearch = params.unit_location.replace(/^[#0]+/, "");
    query = query.or(
      `unit_number.ilike.%${cleanSearch}%,location.ilike.%${cleanSearch}%`
    );
  }

  if (params.urgent === "true") {
    query = query.eq("is_urgent", true);
  }

  if (scope === "completed") {
    query = query.eq("status", "COMPLETED");
  } else if (normalizedStatus) {
    query = query.eq("status", normalizedStatus);
  } else {
    query = query.neq("status", "MERGED").neq("status", "COMPLETED");
  }

  const { data, error, count } = await query;

  if (error) {
    console.error("Supabase Error:", error);
    throw new Error("Failed to fetch reports directly");
  }

  const formattedData: DashboardBarrackDamage[] =
    (data as DashboardReportRecord[] | null)?.map((report) => {
      const duplicates = showMergedAsTopLevel
        ? []
        : report.incident?.barrack_damage?.filter(
            (relatedReport) =>
              relatedReport.id !== report.id && relatedReport.status === "MERGED"
          ) || [];

      return {
        ...report,
        subRows: duplicates.length > 0 ? duplicates : undefined,
      } as DashboardBarrackDamage;
    }) || [];

  const totalPages = count ? Math.ceil(count / limit) : 0;

  return {
    reports: formattedData,
    metadata: { total: count, page, limit, totalPages },
  };
}
