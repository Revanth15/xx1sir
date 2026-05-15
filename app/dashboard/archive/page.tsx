import Link from "next/link";
import { Button } from "@/components/ui/button";
import { columns } from "../columns";
import { DataTable } from "../data-table";
import { getReports } from "../report-data";
import { Archive, ArrowLeft, CheckCircle2, ClipboardList } from "lucide-react";

export default async function DashboardArchivePage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | undefined }>;
}) {
  const params = await searchParams;
  const { reports, metadata } = await getReports(params, "completed");

  return (
    <div className="min-h-[calc(100vh-3.5rem)] w-full bg-[#050607] bg-[radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.12)_1px,transparent_0)] bg-[length:22px_22px] text-white">
      <div className="container mx-auto px-4 py-4 sm:px-6 sm:py-8">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold">Completed Reports Archive</h1>
            <p className="mt-1 text-sm text-white/55">
              Closed cases separated from the active dashboard.
            </p>
          </div>
          <Button asChild variant="outline" className="border-white/10 bg-white/[0.04] text-white hover:bg-white/[0.08] hover:text-white">
            <Link href="/dashboard">
              <ArrowLeft className="size-4" />
              Active Dashboard
            </Link>
          </Button>
        </div>

        <section className="mb-4 overflow-hidden rounded-xl border border-white/10 bg-black/35 text-white shadow-2xl shadow-black/20 backdrop-blur-sm">
          <div className="grid gap-3 p-4 sm:grid-cols-3 sm:p-5">
            <div className="rounded-xl border border-white/10 bg-black/35 p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div className="text-[11px] font-semibold uppercase tracking-widest text-white/45">
                  Total completed
                </div>
                <CheckCircle2 className="h-4 w-4 text-emerald-300" />
              </div>
              <div className="text-4xl font-bold leading-none tracking-tight">
                {metadata.total ?? 0}
              </div>
              <p className="mt-2 text-sm text-white/50">Closed reports in archive</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-black/35 p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div className="text-[11px] font-semibold uppercase tracking-widest text-white/45">
                  Current view
                </div>
                <ClipboardList className="h-4 w-4 text-blue-300" />
              </div>
              <div className="text-4xl font-bold leading-none tracking-tight">
                {reports.length}
              </div>
              <p className="mt-2 text-sm text-white/50">Rows on this page</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-black/35 p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div className="text-[11px] font-semibold uppercase tracking-widest text-white/45">
                  Archive pages
                </div>
                <Archive className="h-4 w-4 text-purple-300" />
              </div>
              <div className="text-4xl font-bold leading-none tracking-tight">
                {metadata.totalPages || 1}
              </div>
              <p className="mt-2 text-sm text-white/50">Filtered page count</p>
            </div>
          </div>
        </section>

        <div className="rounded-xl border border-white/10 bg-black/35 p-3 backdrop-blur-sm sm:p-4">
          <DataTable
            columns={columns}
            data={reports}
            pageCount={metadata.totalPages}
            hiddenFilters={["status"]}
            emptyMessage="No completed reports found."
          />
        </div>
      </div>
    </div>
  );
}
