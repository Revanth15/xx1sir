import { DataTable } from "./data-table"
import { columns } from "./columns"
import { createClient } from '@/utils/supabase/server'

async function getReports(params: Record<string, string | undefined>) {
  const page = Number(params.page) || 1;
  const limit = 10;
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  const supabase = await createClient();

  // 1. Fetch Primary reports AND their nested incident data, 
  // including ALL reports linked to that incident (the duplicates)
  let query = supabase
    .from('barrack_damage')
    .select(`
      *,
      incident:damage_incident (
        *,
        barrack_damage (*)
      )
    `, { count: 'exact' })
    // Hide merged reports from the top-level view so they can be stacked!
    .neq('status', 'MERGED') 
    .order('date_reported', { ascending: false })
    .range(from, to);

  // --- GLOBAL SEARCH ---
  if (params.search) {
    const searchTerm = `%${params.search}%`;
    query = query.or(
      `case_reference.ilike.${searchTerm},description.ilike.${searchTerm},location.ilike.${searchTerm},unit_number.ilike.${searchTerm},company.ilike.${searchTerm},type.ilike.${searchTerm}`
    );
  }

  // --- COLUMN SPECIFIC FILTERS ---
  if (params.company) query = query.ilike('company', `%${params.company}%`);
  if (params.location) query = query.ilike('location', `%${params.location}%`);
  if (params.type) query = query.ilike('type', `%${params.type}%`);
  if (params.status) query = query.eq('status', params.status.toUpperCase());
  
  const { data, error, count } = await query;

  if (error) {
    console.error("Supabase Error:", error);
    throw new Error("Failed to fetch reports directly");
  }

  // 2. Transform the data to create the "Stack" (subRows)
  const formattedData = data?.map((report: any) => {
    // Look at the incident, find the other reports, filter out the current one
    const duplicates = report.incident?.barrack_damage?.filter(
      (r: any) => r.id !== report.id && r.status === 'MERGED'
    ) || [];

    return {
      ...report,
      // TanStack table automatically looks for a 'subRows' array to create stacked rows
      subRows: duplicates.length > 0 ? duplicates : undefined 
    }
  }) || [];

  const totalPages = count ? Math.ceil(count / limit) : 0;

  return {
    reports: formattedData,
    metadata: { total: count, page, limit, totalPages }
  };
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | undefined }> 
}) {
  const params = await searchParams
  const { reports, metadata } = await getReports(params) 

  return (
    <div className="container mx-auto py-10">
      <h1 className="text-2xl font-bold mb-5">Barrack Damages Dashboard</h1>
      <DataTable 
        columns={columns} 
        data={reports} 
        pageCount={metadata.totalPages} 
      />
    </div>
  )
}