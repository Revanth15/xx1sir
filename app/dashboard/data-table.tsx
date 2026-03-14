"use client";

import { useState, useEffect } from "react";
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
  getExpandedRowModel,
  ExpandedState,
} from "@tanstack/react-table";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import {
  BD_STATUS_OPTIONS,
  BD_COMPANY_OPTIONS,
  BD_DAMAGE_TYPE_OPTIONS,
  BD_BLOCK_REFS,
} from "@/lib/defaults";
import { cn } from "@/lib/utils";
import { AlertCircle } from "lucide-react"

const STATUS_OPTIONS = BD_STATUS_OPTIONS;
const COMPANY_OPTIONS = BD_COMPANY_OPTIONS;
const TYPE_OPTIONS = BD_DAMAGE_TYPE_OPTIONS;

function DebouncedInput({
  value: initialValue,
  onChange,
  debounce = 500,
  ...props
}: any) {
  const [value, setValue] = useState(initialValue);
  useEffect(() => {
    setValue(initialValue);
  }, [initialValue]);
  useEffect(() => {
    if (value === initialValue) return;
    const timeout = setTimeout(() => onChange(value), debounce);
    return () => clearTimeout(timeout);
  }, [value, debounce, initialValue, onChange]);
  return (
    <Input
      {...props}
      value={value}
      onChange={(e) => setValue(e.target.value)}
    />
  );
}

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  pageCount: number;
}

export function DataTable<TData, TValue>({
  columns,
  data,
  pageCount,
}: DataTableProps<TData, TValue>) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const currentPage = Number(searchParams.get("page")) || 1;
  const globalSearch = searchParams.get("search") || "";
  const isUrgentFilter = searchParams.get("urgent") === "true";

  const [expanded, setExpanded] = useState<ExpandedState>({});

  const table = useReactTable({
    data,
    columns,
    pageCount,
    state: { expanded },
    onExpandedChange: setExpanded,
    getSubRows: (row: any) => row.subRows,
    getCoreRowModel: getCoreRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    manualPagination: true,
    manualFiltering: true,
  });

  const updateUrlParams = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value && value !== "all") params.set(key, value);
    else params.delete(key);
    if (key !== "page") params.set("page", "1");
    router.push(`${pathname}?${params.toString()}`);
  };

  const getDropdownOptions = (columnId: string) => {
    switch (columnId) {
      case "status":
        return STATUS_OPTIONS;
      case "company":
        return COMPANY_OPTIONS;
      case "type":
        return TYPE_OPTIONS;
      case "block":
        return BD_BLOCK_REFS.map((ref) => ref.block.replace("Blk ", ""));
      default:
        return [];
    }
  };

  return (
    <div>
      <div className="flex items-center py-4 gap-2">
        <DebouncedInput
          value={globalSearch}
          onChange={(value: any) => updateUrlParams("search", String(value))}
          className="max-w-sm"
          placeholder="Search all records..."
        />

      <Button
        variant="outline"
        onClick={() => updateUrlParams("urgent", isUrgentFilter ? "" : "true")}
        className={cn(
          "shrink-0 transition-all duration-200",
          isUrgentFilter 
            ? "bg-destructive/10 border-destructive/30 text-destructive hover:bg-destructive/20 hover:text-destructive" 
            : "text-muted-foreground hover:text-foreground"
        )}
      >
        <AlertCircle 
          className={cn(
            "mr-2 h-4 w-4", 
            isUrgentFilter ? "text-destructive" : "text-muted-foreground"
          )} 
        />
        {isUrgentFilter ? "Urgent Only" : "Show Urgent"}
      </Button>
      </div>

      <div className="rounded-md border">
        <Table className="table-fixed w-full">
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  const columnId = header.column.id;
                  const canFilter = header.column.getCanFilter();
                  const currentFilterValue = searchParams.get(columnId) || "";
                  const isDropdownFilter = [
                    "status",
                    "company",
                    "type",
                    "block",
                  ].includes(columnId);

                  return (
                    <TableHead key={header.id} className="align-top py-3 px-2">
                      <div
                        className="flex flex-col gap-2"
                        style={{
                          width: `${header.column.getSize()}%`,
                          minWidth: "100%",
                        }}
                      >
                        <div className="truncate font-semibold text-foreground">
                          {header.isPlaceholder
                            ? null
                            : flexRender(
                                header.column.columnDef.header,
                                header.getContext()
                              )}
                        </div>

                        {canFilter &&
                          (isDropdownFilter ? (
                            <Select
                              value={currentFilterValue || "all"}
                              onValueChange={(value) =>
                                updateUrlParams(columnId, value)
                              }
                            >
                              <SelectTrigger className="h-8 text-xs font-normal w-full min-w-0">
                                <span className="truncate w-full text-left">
                                  <SelectValue placeholder={`All`} />
                                </span>
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="all">All</SelectItem>
                                {getDropdownOptions(columnId).map((option) => (
                                  <SelectItem key={option} value={option}>
                                    {columnId === "block" 
                                      ? `Blk ${option}`
                                      : option.replace(/_/g, " ")}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            <DebouncedInput
                              value={currentFilterValue}
                              onChange={(value: any) =>
                                updateUrlParams(columnId, String(value))
                              }
                              placeholder={`Filter...`}
                              className="h-8 text-xs font-normal w-full min-w-0"
                            />
                          ))}
                      </div>
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => {
                const isUrgent = (row.original as any).is_urgent;
                const isSubRow = row.depth > 0;

                return (
                  <TableRow
                    key={row.id}
                    className={cn(
                      // Default hover
                      "transition-colors hover:bg-muted/50",
                      // Sub-row styling (Purple border)
                      isSubRow && "bg-muted/30 border-l-4 border-l-purple-500",
                      // Urgent styling (Red background tint)
                      isUrgent && "bg-destructive/10 hover:bg-destructive/20",
                      // Urgent top-level row (Red border)
                      isUrgent && !isSubRow && "border-l-4 border-l-destructive/60"
                    )}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell
                        key={cell.id}
                        className={cn(
                          isSubRow && cell.column.id === "case_reference" && "pl-8"
                        )}
                      >
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext()
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                );
              })
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center"
                >
                  No results found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

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
  );
}
