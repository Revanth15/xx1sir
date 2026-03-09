// app/dashboard/columns.tsx
"use client"

import { ColumnDef } from "@tanstack/react-table"
import { Badge } from "@/components/ui/badge"
import { CheckCircle2, AlertCircle, Clock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Eye } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"


export type BarrackDamage = {
  id: string
  case_reference: string
  is_urgent: boolean
  company: string
  damage_tag_placed: boolean
  reported_by: string
  type: string
  location: string
  unit_number: string
  description: string
  image_urls: string[]
  status: string
  approved_by_coy: boolean
  date_reported: string
  ifm_reported_date: string | null
  ifm_target_date: string | null
  repaired_date: string | null
}

export const columns: ColumnDef<BarrackDamage>[] = [
  {
    accessorKey: "case_reference",
    header: "Case Ref",
    enableColumnFilter: false,
    cell: ({ row }) => {
      const isUrgent = row.original.is_urgent
      return (
        <div className="flex items-center gap-2 font-medium">
          {row.getValue("case_reference")}
          {isUrgent && (
            <Badge variant="destructive" className="h-5 px-1.5 text-[10px]">
              Urgent
            </Badge>
          )}
        </div>
      )
    },
  },
  {
    accessorKey: "company",
    header: "Company",
  },
  {
    accessorKey: "location",
    header: "Location",
    cell: ({ row }) => {
      return (
        <div className="flex flex-col">
          {/* Unit Number on top, Location below as requested */}
          <span className="font-medium">{row.original.unit_number}</span>
          <span className="text-xs text-muted-foreground">
            {row.getValue("location")}
          </span>
        </div>
      )
    },
  },
  {
    accessorKey: "type",
    header: "Type",
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => {
      const status = row.getValue("status") as string
      return (
        <Badge variant={status === "PENDING_COY" ? "secondary" : "default"}>
          {status.replace(/_/g, ' ')}
        </Badge>
      )
    },
  },
  {
    accessorKey: "description",
    header: "Description",
    enableColumnFilter: false,
    cell: ({ row }) => {
      // Truncate the description so it doesn't break the table layout on long texts
      return (
        <div
          className="max-w-[200px] truncate text-sm"
          title={row.getValue("description")}
        >
          {row.getValue("description")}
        </div>
      )
    },
  },
  {
    accessorKey: "date_reported",
    header: "Date Reported",
    enableColumnFilter: false,
    cell: ({ row }) => {
      return (
        <div className="flex flex-col">
          {/* Date on top, Reported by below */}
          <span>
            {new Date(row.getValue("date_reported")).toLocaleDateString()}
          </span>
          <span className="text-xs text-muted-foreground">
            By: {row.original.reported_by}
          </span>
        </div>
      )
    },
  },
  {
    id: "actions",
    enableColumnFilter: false,
    cell: ({ row }) => {
      const report = row.original

      return (
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm" className="h-8">
              <Eye className="w-4 h-4 mr-2" />
              View
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Report Details: {report.case_reference}</DialogTitle>
            </DialogHeader>
            {/* Raw JSON Dump for now, wrapped in a pre tag for formatting */}
            <div className="mt-4 max-h-[60vh] overflow-y-auto rounded-md bg-slate-950 p-4">
              <pre className="text-sm text-slate-50">
                {JSON.stringify(report, null, 2)}
              </pre>
            </div>
          </DialogContent>
        </Dialog>
      )
    },
  },
]