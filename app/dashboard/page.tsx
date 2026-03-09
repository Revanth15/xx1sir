// app/dashboard/page.tsx
import { DataTable } from "./data-table"
import { columns } from "./columns"
import { createClient } from '@/utils/supabase/server'

// Pass down the entire params object to easily construct the query
async function getReports(params: Record<string, string | undefined>) {
  const page = Number(params.page) || 1;
  const limit = 10;
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  const supabase = await createClient();

  let query = supabase
    .from('barrack_damage')
    .select('*', { count: 'exact' })
    .order('date_reported', { ascending: false })
    .range(from, to);

  // --- GLOBAL SEARCH ---
  // Searches across multiple columns if the generic 'search' param is present
  if (params.search) {
    const searchTerm = `%${params.search}%`;
    query = query.or(
      `case_reference.ilike.${searchTerm},description.ilike.${searchTerm},location.ilike.${searchTerm},unit_number.ilike.${searchTerm},company.ilike.${searchTerm},type.ilike.${searchTerm}`
    );
  }

  // --- COLUMN SPECIFIC FILTERS ---
  // Matches the accessorKeys defined in columns.tsx
  if (params.company) query = query.ilike('company', `%${params.company}%`);
  if (params.location) query = query.ilike('location', `%${params.location}%`);
  if (params.type) query = query.ilike('type', `%${params.type}%`);
  
  // For exact matches like status, use .eq instead of .ilike
  if (params.status) query = query.eq('status', params.status.toUpperCase());
  
  // Note: Coy Approval and Date Reported might require specific type parsing (boolean/date)
  // depending on your exact requirements, but this covers the primary text fields.

  const { data, error, count } = await query;

  if (error) {
    console.error("Supabase Error:", error);
    throw new Error("Failed to fetch reports directly");
  }

  const totalPages = count ? Math.ceil(count / limit) : 0;

  return {
    reports: data,
    metadata: {
      total: count,
      page,
      limit,
      totalPages,
    }
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
        data={reports || []} 
        pageCount={metadata.totalPages} 
      />
    </div>
  )
}