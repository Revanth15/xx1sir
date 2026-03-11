// app/dashboard/columns.tsx
"use client"

import { ColumnDef } from "@tanstack/react-table"
import { Badge } from "@/components/ui/badge"
import { CheckCircle2, AlertCircle, Clock } from "lucide-react"
import { badgeVariants } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Eye } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import DamageReportForm from "../submit-report/page"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { BD_STATUS_OPTIONS, BD_STATUS_STYLES } from "@/lib/defaults"


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
      return <StatusCell report={row.original} />
    },
  },
  {
    accessorKey: "description",
    header: "Description",
    enableColumnFilter: false,
    cell: ({ row }) => {
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
          <DialogContent className="!max-w-[70vw] !w-[70vw] p-0 h-[90vh] overflow-y-auto border-none bg-transparent shadow-none scrollbar-hide" style={{ scrollbarWidth: 'none' }}>
            <DialogHeader className="sr-only">
              <DialogTitle>Report Details: {report.case_reference}</DialogTitle>
            </DialogHeader>
            
            <DamageReportForm report={report} mode="view" />
            
          </DialogContent>
        </Dialog>
      )
    },
  },
]

const StatusCell = ({ report }: { report: BarrackDamage }) => {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [currentStatus, setCurrentStatus] = useState(report.status)

  const updateStatus = async (newStatus: string) => {
    setCurrentStatus(newStatus)
    
    try {
      const response = await fetch('/api/reports', { 
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: report.id, status: newStatus }),
      })

      if (!response.ok) throw new Error('Failed to update status')

      startTransition(() => {
        router.refresh()
      })
    } catch (error) {
      console.error("Error updating status:", error)
      setCurrentStatus(report.status) 
    }
  }

  const badgeStyle = BD_STATUS_STYLES[currentStatus] || BD_STATUS_STYLES.DEFAULT

  return (
    <Select
      value={currentStatus}
      onValueChange={updateStatus}
      disabled={isPending}
    >
      <SelectTrigger 
        className={cn(
          badgeVariants({ variant: "outline" }), 
          badgeStyle, 
          "h-7 w-[140px] flex justify-between cursor-pointer focus:ring-0 focus:ring-offset-0 uppercase tracking-wider text-[10px]",
          isPending && "opacity-50 cursor-not-allowed"
        )}
      >
        <SelectValue placeholder="Status" />
      </SelectTrigger>
      <SelectContent>
        {BD_STATUS_OPTIONS.map((statusOption) => (
          <SelectItem 
            key={statusOption} 
            value={statusOption}
            className="text-xs uppercase font-medium"
          >
            {statusOption.replace(/_/g, ' ')}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}