"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { ColumnDef, Row } from "@tanstack/react-table"
import { Badge } from "@/components/ui/badge"
import { badgeVariants } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import {
  MoreHorizontal, Eye, Edit, Merge, Trash2, Copy, Check,
  ChevronRight, ChevronDown, CornerDownRight
} from "lucide-react"

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"

import DamageReportForm from "../submit-report/page"
import { BD_STATUS_OPTIONS, BD_STATUS_STYLES } from "@/lib/defaults"
import { toast } from "sonner"

export type DamageIncident = {
  id: string
  incident_reference?: string 
  incident_status: string
  ifm_reported_date: string | null
  ifm_target_date: string | null
  repaired_date: string | null
}

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
  incident_id: string | null
  incident: DamageIncident | null
  subRows?: BarrackDamage[]
}

export const columns: ColumnDef<BarrackDamage>[] = [
  {
    accessorKey: "case_reference",
    header: "Case Ref",
    enableColumnFilter: false,
    cell: ({ row }) => <CaseRefCell row={row} />, 
  },
  {
    accessorKey: "company", header: "Company",
  },
  {
    accessorKey: "location", header: "Location",
    cell: ({ row }) => (
      <div className="flex flex-col">
        <span className="font-medium">{row.original.unit_number}</span>
        <span className="text-xs text-muted-foreground">{row.getValue("location")}</span>
      </div>
    ),
  },
  { accessorKey: "type", header: "Type" },
  {
    accessorKey: "status", header: "Status",
    cell: ({ row }) => <StatusCell report={row.original} />,
  },
  {
    accessorKey: "description", header: "Description", enableColumnFilter: false,
    cell: ({ row }) => <div className="max-w-[200px] truncate text-sm" title={row.getValue("description")}>{row.getValue("description")}</div>,
  },
  {
    accessorKey: "date_reported", header: "Date Reported", enableColumnFilter: false,
    cell: ({ row }) => (
      <div className="flex flex-col">
        <span>{new Date(row.getValue("date_reported")).toLocaleDateString()}</span>
        <span className="text-xs text-muted-foreground">By: {row.original.reported_by}</span>
      </div>
    ),
  },
  {
    id: "actions", enableColumnFilter: false,
    cell: ({ row }) => <ActionCell report={row.original} isSubRow={row.depth > 0} />,
  },
]

const CaseRefCell = ({ row }: { row: Row<BarrackDamage> }) => {
  const [copied, setCopied] = useState(false)
  const report = row.original

  const onCopy = () => {
    navigator.clipboard.writeText(report.case_reference)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="flex flex-col gap-1 font-medium">
      <div className="flex items-center gap-1">
        {/* If it's a stacked item, show a threaded L-arrow */}
        {row.depth > 0 && <CornerDownRight className="h-4 w-4 text-muted-foreground mr-1" />}
        
        {/* Expand/Collapse Button for Master reports that have duplicates */}
        {row.getCanExpand() ? (
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-5 w-5 p-0 hover:bg-muted" 
            onClick={row.getToggleExpandedHandler()}
          >
            {row.getIsExpanded() ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </Button>
        ) : (
          row.depth === 0 && <div className="w-5" /> // Alignment spacer for top-level rows without children
        )}

        <span>{report.case_reference}</span>
        
        <Button variant="ghost" size="icon" className="h-5 w-5 hover:bg-muted" onClick={onCopy} title="Copy Case Reference">
          {copied ? <Check className="h-3 w-3 text-green-600" /> : <Copy className="h-3 w-3 text-muted-foreground" />}
        </Button>
        
        {/* If this row has stacked items, show a pill indicating how many */}
        {row.getCanExpand() && (
           <Badge variant="secondary" className="h-5 px-1.5 text-[10px] bg-purple-100 text-purple-800 hover:bg-purple-100">
             +{row.original.subRows?.length} Merged
           </Badge>
        )}
      </div>
    </div>
  )
}

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
    <Select value={currentStatus} onValueChange={updateStatus} disabled={isPending}>
      <SelectTrigger className={cn(badgeVariants({ variant: "outline" }), badgeStyle, "h-7 w-[140px] flex justify-between cursor-pointer focus:ring-0 focus:ring-offset-0 uppercase tracking-wider text-[10px]", isPending && "opacity-50 cursor-not-allowed")}>
        <SelectValue placeholder="Status" />
      </SelectTrigger>
      <SelectContent>
        {BD_STATUS_OPTIONS.map((statusOption) => (
          <SelectItem key={statusOption} value={statusOption} className="text-xs uppercase font-medium">
            {statusOption.replace(/_/g, ' ')}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

const ActionCell = ({ report, isSubRow }: { report: BarrackDamage, isSubRow: boolean }) => {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [showViewDialog, setShowViewDialog] = useState(false)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [showMergeDialog, setShowMergeDialog] = useState(false)
  const [duplicateRefInput, setDuplicateRefInput] = useState("")

  const handleMerge = async () => {
    const formattedCaseRef = duplicateRefInput.trim().toUpperCase()

    try {
      const response = await fetch('/api/reports/merge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          masterReportId: report.id,
          subsumedCaseRef: formattedCaseRef, 
        }),
      })

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.message || 'Failed to merge report');
      }

      setShowMergeDialog(false)
      setDuplicateRefInput("") 
      
      startTransition(() => {
        router.refresh()
      })

    } catch (error: any) {
      console.error("Error merging report:", error)
      toast.error(error.message)
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="h-8 w-8 p-0">
            <span className="sr-only">Open menu</span>
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-40">
          <DropdownMenuGroup>
            <DropdownMenuItem onSelect={() => setShowViewDialog(true)}>
              <Eye className="mr-2 h-4 w-4" /> View
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setShowEditDialog(true)}>
              <Edit className="mr-2 h-4 w-4" /> Edit
            </DropdownMenuItem>
            {!isSubRow && (
              <DropdownMenuItem onSelect={() => setShowMergeDialog(true)}>
                <Merge className="mr-2 h-4 w-4" /> Merge Duplicate In
              </DropdownMenuItem>
            )}
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuItem className="text-destructive focus:text-destructive focus:bg-destructive/10">
              <Trash2 className="mr-2 h-4 w-4" /> Delete
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={showViewDialog} onOpenChange={setShowViewDialog}>
        <DialogContent 
          className="!max-w-[70vw] !w-[70vw] p-0 h-[90vh] overflow-y-auto border-none bg-transparent shadow-none scrollbar-hide" 
          style={{ scrollbarWidth: 'none' }}
        >
          <DialogHeader className="sr-only">
            <DialogTitle>View Report Details: {report.case_reference}</DialogTitle>
          </DialogHeader>
          <DamageReportForm report={report} mode="view" />
        </DialogContent>
      </Dialog>

      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent 
          className="!max-w-[70vw] !w-[70vw] p-0 h-[90vh] overflow-y-auto border-none bg-transparent shadow-none scrollbar-hide" 
          style={{ scrollbarWidth: 'none' }}
        >
          <DialogHeader className="sr-only">
            <DialogTitle>Edit Report Details: {report.case_reference}</DialogTitle>
          </DialogHeader>
          <DamageReportForm 
            report={report} 
            mode="edit" 
            onSuccess={() => setShowEditDialog(false)} 
          />
        </DialogContent>
      </Dialog>

      <Dialog open={showMergeDialog} onOpenChange={setShowMergeDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Pull/Merge Duplicate Report</DialogTitle>
            <DialogDescription>
              Paste the Case Ref (e.g., REQ-...) of the duplicate report you want to pull INTO this one. 
              <br/><br/>
              <span className="font-semibold text-destructive">The pasted report will be marked as MERGED.</span>
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center space-x-2 py-4">
            <div className="grid flex-1 gap-2 relative">
              <Input
                id="duplicate_ref"
                placeholder="e.g. REQ-2026-ABCD"
                value={duplicateRefInput}
                onChange={(e) => setDuplicateRefInput(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter className="sm:justify-end">
            <Button type="button" variant="secondary" onClick={() => setShowMergeDialog(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={handleMerge} disabled={!duplicateRefInput}>
              Confirm Merge
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}