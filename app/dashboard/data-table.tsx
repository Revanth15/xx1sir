"use client";

import { type ComponentProps, useEffect, useState } from "react";
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
}: Omit<ComponentProps<typeof Input>, "value" | "onChange"> & {
  value: string;
  onChange: (value: string) => void;
  debounce?: number;
}) {
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
  statusOptions?: string[];
  hiddenFilters?: string[];
  emptyMessage?: string;
}

export function DataTable<TData, TValue>({
  columns,
  data,
  pageCount,
  statusOptions = STATUS_OPTIONS,
  hiddenFilters = [],
  emptyMessage = "No results found.",
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
    getSubRows: (row) => (row as TData & { subRows?: TData[] }).subRows,
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
        return statusOptions;
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

  const getColumnMinWidth = (columnId: string) => {
    switch (columnId) {
      case "case_reference":
        return 220;
      case "company":
        return 120;
      case "block":
        return 100;
      case "unit_location":
        return 170;
      case "type":
        return 140;
      case "status":
        return 170;
      case "description":
        return 240;
      case "date_reported":
        return 170;
      case "actions":
        return 72;
      default:
        return 140;
    }
  };

  return (
    <div>
      <div className="flex flex-col gap-2 py-4 sm:flex-row sm:items-center">
        <DebouncedInput
          value={globalSearch}
          onChange={(value) => updateUrlParams("search", value)}
          className="w-full sm:max-w-sm"
          placeholder="Search all records..."
        />

        <Button
          variant="outline"
          onClick={() => updateUrlParams("urgent", isUrgentFilter ? "" : "true")}
          className={cn(
            "w-full shrink-0 transition-all duration-200 sm:w-auto",
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
        <Table className="w-full min-w-[1080px]">
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  const columnId = header.column.id;
                  const canFilter = header.column.getCanFilter();
                  const showFilter = canFilter && !hiddenFilters.includes(columnId);
                  const currentFilterValue = searchParams.get(columnId) || "";
                  const isDropdownFilter = [
                    "status",
                    "company",
                    "type",
                    "block",
                  ].includes(columnId);

                  return (
                    <TableHead key={header.id} className="align-top px-2 py-3">
                      <div
                        className="flex min-w-0 flex-col gap-2"
                        style={{ minWidth: getColumnMinWidth(columnId) }}
                      >
                        <div className="font-semibold text-foreground">
                          {header.isPlaceholder
                            ? null
                            : flexRender(
                                header.column.columnDef.header,
                                header.getContext()
                              )}
                        </div>

                        {showFilter &&
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
                              onChange={(value) => updateUrlParams(columnId, value)}
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
                const isUrgent = Boolean(
                  (row.original as { is_urgent?: boolean }).is_urgent
                );
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
                          "px-2 py-3 align-top",
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
                  {emptyMessage}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex flex-col items-center justify-center gap-2 py-4 sm:flex-row">
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
