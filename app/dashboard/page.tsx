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
    <div className="min-h-[calc(100vh-3.5rem)] w-full bg-[#050607] bg-[radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.12)_1px,transparent_0)] bg-[length:22px_22px]">
      <div className="container mx-auto px-4 py-4 sm:px-6 sm:py-8">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Barrack Damages Dashboard</h1>
            <p className="mt-1 text-sm text-white/55">
              Monitor company workload, hotspots, and report status at a glance.
            </p>
          </div>
        </div>

        <DashboardStats params={params} />
        <div className="rounded-xl border border-white/10 bg-black/35 p-3 backdrop-blur-sm sm:p-4">
          <DataTable 
            columns={columns} 
            data={reports} 
            pageCount={metadata.totalPages} 
            statusOptions={BD_STATUS_OPTIONS.filter((status) => status !== "COMPLETED")}
          />
        </div>
      </div>
    </div>
  )
}
