import Link from "next/link";
import { Button } from "@/components/ui/button";
import { columns } from "../columns";
import { DataTable } from "../data-table";
import { getReports } from "../report-data";

export default async function DashboardArchivePage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | undefined }>;
}) {
  const params = await searchParams;
  const { reports, metadata } = await getReports(params, "completed");

  return (
    <div className="container mx-auto px-4 py-6 sm:px-6 sm:py-10">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Completed Reports Archive</h1>
          <p className="text-sm text-muted-foreground">
            Closed cases are separated here to keep the main dashboard focused on active work.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/dashboard">Back to Active Dashboard</Link>
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={reports}
        pageCount={metadata.totalPages}
        hiddenFilters={["status"]}
        emptyMessage="No completed reports found."
      />
    </div>
  );
}
