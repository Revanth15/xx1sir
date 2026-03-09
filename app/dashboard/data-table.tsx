// app/dashboard/data-table.tsx
"use client"

import { useState, useEffect } from "react"
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useRouter, useSearchParams, usePathname } from "next/navigation"
import { BD_STATUS_OPTIONS, BD_COMPANY_OPTIONS, BD_DAMAGE_TYPE_OPTIONS } from "@/lib/defaults"

// --- Define your finite options here ---
const STATUS_OPTIONS = BD_STATUS_OPTIONS
const COMPANY_OPTIONS = BD_COMPANY_OPTIONS
const TYPE_OPTIONS = BD_DAMAGE_TYPE_OPTIONS

// --- Debounced Input Helper ---
function DebouncedInput({
  value: initialValue,
  onChange,
  debounce = 500,
  ...props
}: {
  value: string | number
  onChange: (value: string | number) => void
  debounce?: number
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange">) {
  const [value, setValue] = useState(initialValue)

  useEffect(() => {
    setValue(initialValue)
  }, [initialValue])

  useEffect(() => {
    if (value === initialValue) return;

    const timeout = setTimeout(() => {
      onChange(value)
    }, debounce)

    return () => clearTimeout(timeout)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, debounce])

  return (
    <Input
      {...props}
      value={value}
      onChange={(e) => setValue(e.target.value)}
    />
  )
}
// ---------------------------------------------------

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[]
  data: TData[]
  pageCount: number
}

export function DataTable<TData, TValue>({
  columns,
  data,
  pageCount,
}: DataTableProps<TData, TValue>) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const currentPage = Number(searchParams.get("page")) || 1
  const globalSearch = searchParams.get("search") || ""

  const table = useReactTable({
    data,
    columns,
    pageCount,
    manualPagination: true,
    manualFiltering: true,
    getCoreRowModel: getCoreRowModel(),
  })

  const updateUrlParams = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString())
    
    // If "all" or empty string is passed, remove the filter entirely
    if (value && value !== "all") {
      params.set(key, value)
    } else {
      params.delete(key)
    }
    
    if (key !== "page") {
      params.set("page", "1")
    }
    
    router.push(`${pathname}?${params.toString()}`)
  }

  // Helper function to get dropdown options based on column ID
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
      {/* Global Search */}
      <div className="flex items-center py-4">
        <DebouncedInput
          value={globalSearch}
          onChange={(value) => updateUrlParams("search", String(value))}
          className="max-w-sm"
          placeholder="Search all records..."
        />
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  const columnId = header.column.id
                  const canFilter = header.column.getCanFilter()
                  const currentFilterValue = searchParams.get(columnId) || ""
                  
                  // Check if this column should be a dropdown
                  const isDropdownFilter = ['status', 'company', 'type'].includes(columnId)

                  return (
                    <TableHead key={header.id} className="align-top py-3">
                      <div className="flex flex-col gap-2">
                        {/* Render Header Name */}
                        <div>
                          {header.isPlaceholder
                            ? null
                            : flexRender(
                                header.column.columnDef.header,
                                header.getContext()
                              )}
                        </div>
                        
                        {/* Render Filters conditionally */}
                        {canFilter && (
                          isDropdownFilter ? (
                            <Select
                              value={currentFilterValue || "all"} // default to "all" to show placeholder state properly
                              onValueChange={(value) => updateUrlParams(columnId, value)}
                            >
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
                              onChange={(value) => updateUrlParams(columnId, String(value))}
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
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
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

      {/* Pagination Controls */}
      <div className="flex items-center justify-center space-x-2 py-4">
        <Button
          variant="outline"
          size="sm"
          onClick={() => updateUrlParams("page", String(currentPage - 1))}
          disabled={currentPage <= 1}
        >
          Previous
        </Button>
        <span className="text-sm text-muted-foreground">
          Page {currentPage} of {pageCount || 1}
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={() => updateUrlParams("page", String(currentPage + 1))}
          disabled={currentPage >= pageCount}
        >
          Next
        </Button>
      </div>
    </div>
  )
}