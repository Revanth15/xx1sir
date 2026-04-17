import Link from "next/link"
import { DataTable } from "./data-table"
import { columns } from "./columns"
import { DashboardStats } from "./dashboard-stats";
import { Button } from "@/components/ui/button";
import { BD_STATUS_OPTIONS } from "@/lib/defaults";
import { getReports } from "./report-data";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | undefined }> 
}) {
  const params = await searchParams
  const { reports, metadata } = await getReports(params) 

  return (
    <div className="container mx-auto px-4 py-6 sm:px-6 sm:py-10">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold">Barrack Damages Dashboard</h1>
        <Button asChild variant="outline">
          <Link href="/dashboard/archive">View Completed Archive</Link>
        </Button>
      </div>

      <DashboardStats />
      <DataTable 
        columns={columns} 
        data={reports} 
        pageCount={metadata.totalPages} 
        statusOptions={BD_STATUS_OPTIONS.filter((status) => status !== "COMPLETED")}
      />
    </div>
  )
}
