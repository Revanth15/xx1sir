"use client"

import { useState, useEffect } from "react"
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
  getExpandedRowModel,
  ExpandedState,
} from "@tanstack/react-table"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useRouter, useSearchParams, usePathname } from "next/navigation"
import { BD_STATUS_OPTIONS, BD_COMPANY_OPTIONS, BD_DAMAGE_TYPE_OPTIONS } from "@/lib/defaults"
import { cn } from "@/lib/utils"

// ... (Keep STATUS_OPTIONS, COMPANY_OPTIONS, TYPE_OPTIONS, and DebouncedInput the same) ...
const STATUS_OPTIONS = BD_STATUS_OPTIONS
const COMPANY_OPTIONS = BD_COMPANY_OPTIONS
const TYPE_OPTIONS = BD_DAMAGE_TYPE_OPTIONS

function DebouncedInput({ value: initialValue, onChange, debounce = 500, ...props }: any) {
  const [value, setValue] = useState(initialValue)
  useEffect(() => { setValue(initialValue) }, [initialValue])
  useEffect(() => {
    if (value === initialValue) return;
    const timeout = setTimeout(() => onChange(value), debounce)
    return () => clearTimeout(timeout)
  }, [value, debounce, initialValue, onChange])
  return <Input {...props} value={value} onChange={(e) => setValue(e.target.value)} />
}

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[]
  data: TData[]
  pageCount: number
}

export function DataTable<TData, TValue>({ columns, data, pageCount }: DataTableProps<TData, TValue>) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const currentPage = Number(searchParams.get("page")) || 1
  const globalSearch = searchParams.get("search") || ""

  // NEW: State to track which rows are expanded to show duplicates
  const [expanded, setExpanded] = useState<ExpandedState>({})

  const table = useReactTable({
    data,
    columns,
    pageCount,
    state: { expanded },
    onExpandedChange: setExpanded,
    // NEW: Tells the table how to find the stacked duplicates
    getSubRows: (row: any) => row.subRows, 
    getCoreRowModel: getCoreRowModel(),
    getExpandedRowModel: getExpandedRowModel(), 
    manualPagination: true,
    manualFiltering: true,
  })

  const updateUrlParams = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString())
    if (value && value !== "all") params.set(key, value)
    else params.delete(key)
    if (key !== "page") params.set("page", "1")
    router.push(`${pathname}?${params.toString()}`)
  }

  const getDropdownOptions = (columnId: string) => {
    switch (columnId) {
      case 'status': return STATUS_OPTIONS;
      case 'company': return COMPANY_OPTIONS;
      case 'type': return TYPE_OPTIONS;
      default: return [];
    }
  }

  return (
    <div>
      <div className="flex items-center py-4">
        <DebouncedInput
          value={globalSearch}
          onChange={(value: any) => updateUrlParams("search", String(value))}
          className="max-w-sm"
          placeholder="Search all records..."
        />
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
             {/* ... (Keep your existing TableHeader code exactly the same) ... */}
             {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  const columnId = header.column.id
                  const canFilter = header.column.getCanFilter()
                  const currentFilterValue = searchParams.get(columnId) || ""
                  const isDropdownFilter = ['status', 'company', 'type'].includes(columnId)

                  return (
                    <TableHead key={header.id} className="align-top py-3">
                      <div className="flex flex-col gap-2">
                        <div>
                          {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                        </div>
                        {canFilter && (
                          isDropdownFilter ? (
                            <Select value={currentFilterValue || "all"} onValueChange={(value) => updateUrlParams(columnId, value)}>
                              <SelectTrigger className="h-8 text-xs font-normal">
                                <SelectValue placeholder={`Filter ${header.column.columnDef.header}...`} />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="all">All</SelectItem>
                                {getDropdownOptions(columnId).map((option) => (
                                  <SelectItem key={option} value={option}>
                                    {option.replace(/_/g, ' ')} 
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            <DebouncedInput
                              value={currentFilterValue}
                              onChange={(value: any) => updateUrlParams(columnId, String(value))}
                              placeholder={`Filter ${header.column.columnDef.header}...`}
                              className="h-8 text-xs font-normal"
                            />
                          )
                        )}
                      </div>
                    </TableHead>
                  )
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow 
                  key={row.id} 
                  className={cn(row.depth > 0 && "bg-muted/30 hover:bg-muted/50 border-l-4 border-l-purple-500")}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell 
                      key={cell.id}
                      className={cn(row.depth > 0 && cell.column.id === 'case_reference' && "pl-8")}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center">
                  No results found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-center space-x-2 py-4">
        <Button variant="outline" size="sm" onClick={() => updateUrlParams("page", String(currentPage - 1))} disabled={currentPage <= 1}>
          Previous
        </Button>
        <span className="text-sm text-muted-foreground">
          Page {currentPage} of {pageCount || 1}
        </span>
        <Button variant="outline" size="sm" onClick={() => updateUrlParams("page", String(currentPage + 1))} disabled={currentPage >= pageCount}>
          Next
        </Button>
      </div>
    </div>
  )
}