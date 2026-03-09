"use client";

import { useState, useCallback, useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { CheckCircle2, Clock } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { ImageUploader } from "@/components/imageUploader";
import {
  BD_BLOCK_REFS,
  BD_COMPANY_OPTIONS,
  BD_DAMAGE_TYPE_OPTIONS,
  BD_LEVELS_OPTIONS,
  BD_STATUS_OPTIONS,
} from "@/lib/defaults";

const REPORT_STATUS = BD_STATUS_OPTIONS;

const schema = z.object({
  company: z.string().min(1, "Select a company"),
  damage_tag_placed: z.boolean(),
  is_urgent: z.boolean(),
  reported_by: z.string().min(2, "Enter rank and name"),
  type: z.string().min(1, "Select a damage type"),
  location: z.string().min(2, "Location is required"),
  unit_number: z.string().min(1, "Unit number is required"),
  description: z.string().min(20, "Description must be at least 20 characters"),
  image_urls: z.array(z.string()),
  status: z.enum(REPORT_STATUS),
  approved_by_coy: z.boolean(),
});

type FormValues = z.infer<typeof schema>;

export type BarrackDamageReport = {
  id: string;
  case_reference: string;
  date_reported: string;
  ifm_reported_date: string | null;
  ifm_target_date: string | null;
  repaired_date: string | null;
} & FormValues;

const COMPANIES = BD_COMPANY_OPTIONS;
const DAMAGE_TYPES = BD_DAMAGE_TYPE_OPTIONS;
const LEVELS = BD_LEVELS_OPTIONS;

const BLOCK_REFS: { block: string; label: string }[] = BD_BLOCK_REFS;

const BLOCKS = BLOCK_REFS.map((r) => r.block.replace("Blk", "").trim());

const INPUT_H = "";

function parseLocation(loc: string): {
  block: string;
  level: string;
  area: string;
} {
  if (!loc) return { block: "", level: "", area: "" };
  
  const blockMatch = loc.match(/(?:Block|Blk)\s+([a-zA-Z0-9]+)/i);
  const levelMatch = loc.match(/(?:Level|Lvl)\s+([a-zA-Z0-9]+)/i);
  
  const block = blockMatch ? blockMatch[1] : "";
  const level = levelMatch ? levelMatch[1] : "";
  
  const area = loc
    .replace(/(?:Block|Blk)\s+[a-zA-Z0-9]+,?\s*/i, "")
    .replace(/(?:Level|Lvl)\s+[a-zA-Z0-9]+,?\s*/i, "")
    .trim();
    
  return { block, level, area };
}

function deriveLevel(unitNumber: string): string {
  const firstChar = (unitNumber ?? "").replace(/^#/, "").charAt(0);
  return /[1-6]/.test(firstChar) ? firstChar : "";
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-destructive animate-in fade-in slide-in-from-top-1">
      <svg
        className="h-3.5 w-3.5 shrink-0"
        viewBox="0 0 12 12"
        fill="currentColor"
      >
        <path d="M6 1a5 5 0 100 10A5 5 0 006 1zm-.5 2.5h1v3h-1v-3zm0 4h1v1h-1v-1z" />
      </svg>
      {message}
    </p>
  );
}

function YesNo({
  value,
  onChange,
  urgent,
  disabled,
}: {
  value: boolean;
  onChange: (v: boolean) => void;
  urgent: boolean;
  disabled?: boolean;
}) {
  return (
    <div
      className={`flex w-full items-center rounded-md border bg-muted/50 p-1 ${INPUT_H} ${
        disabled ? "opacity-60 cursor-not-allowed" : ""
      }`}
    >
      {([true, false] as const).map((v) => {
        const active = value === v;
        const isYes = v === true;

        let activeClass =
          "text-muted-foreground hover:bg-muted hover:text-foreground";
        if (active) {
          if (isYes) {
            activeClass = urgent
              ? "bg-destructive text-destructive-foreground shadow-sm"
              : "bg-primary text-primary-foreground shadow-sm";
          } else {
            activeClass = "bg-background text-foreground shadow-sm";
          }
        }

        return (
          <button
            key={String(v)}
            type="button"
            disabled={disabled}
            onClick={() => !disabled && onChange(v)}
            className={`flex flex-1 h-full items-center justify-center rounded-sm text-sm font-medium transition-all ${activeClass} ${
              disabled ? "pointer-events-none" : ""
            }`}
          >
            {isYes ? "Yes" : "No"}
          </button>
        );
      })}
    </div>
  );
}

interface DamageReportFormProps {
  report?: BarrackDamageReport;
  mode?: "create" | "edit" | "view";
  onSuccess?: (data: FormValues, id?: string) => void;
}

export default function DamageReportForm({
  report,
  mode = "create",
  onSuccess,
}: DamageReportFormProps) {
  const currentMode =
    !report && mode === "edit"
      ? "create"
      : report && mode === "create"
      ? "edit"
      : mode;

  const isEditMode = currentMode === "edit";
  const isViewMode = currentMode === "view";

  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Initialize location state directly from the report prop if it exists
  const initialLocation = report
    ? parseLocation(report.location)
    : { block: "", level: "", area: "" };
    
  const [locBlock, setLocBlock] = useState(initialLocation.block);
  const [locLevel, setLocLevel] = useState(initialLocation.level);
  const [locArea, setLocArea] = useState(initialLocation.area);

  // Initialize defaultValues directly from the report prop
  const {
    handleSubmit,
    control,
    watch,
    reset,
    register,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      company: report?.company || "",
      damage_tag_placed: report?.damage_tag_placed || false,
      is_urgent: report?.is_urgent || false,
      reported_by: report?.reported_by || "",
      type: report?.type || "",
      location: report?.location || "",
      unit_number: report?.unit_number || "",
      description: report?.description || "",
      image_urls: report?.image_urls || [],
      status: report?.status || "PENDING_COY",
      approved_by_coy: report?.approved_by_coy || false,
    },
  });

  // Keep the useEffect as a fallback in case the report prop changes while mounted
  useEffect(() => {
    if (!report) return;
    const { block, level, area } = parseLocation(report.location);
    setLocBlock(block);
    setLocLevel(level);
    setLocArea(area);
    reset({
      company: report.company,
      damage_tag_placed: report.damage_tag_placed,
      is_urgent: report.is_urgent,
      reported_by: report.reported_by,
      type: report.type,
      location: report.location,
      unit_number: report.unit_number,
      description: report.description,
      image_urls: report.image_urls,
      status: report.status,
      approved_by_coy: report.approved_by_coy,
    });
  }, [report, reset]);

  const isUrgent = watch("is_urgent");
  const unitNumber = watch("unit_number") ?? "";
  const derivedLevel = deriveLevel(unitNumber);

  const syncLocation = useCallback(
    (block: string, level: string, area: string) => {
      const parts = [
        block ? `Block ${block}` : "",
        level ? `Level ${level}` : "",
        area,
      ].filter(Boolean);
      setValue("location", parts.join(", "), { shouldValidate: true });
    },
    [setValue]
  );

  const handleBlockChange = (block: string) => {
    setLocBlock(block);
    syncLocation(block, locLevel || derivedLevel, locArea);
  };
  const handleLocLevelChange = (level: string) => {
    setLocLevel(level);
    syncLocation(locBlock, level, locArea);
  };
  const handleAreaChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const area = e.target.value;
    setLocArea(area);
    syncLocation(locBlock, locLevel || derivedLevel, area);
  };

  const handleUnitNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value;
    if (!val.startsWith("#")) val = "#" + val.replace(/^#+/, "");
    setValue("unit_number", val, { shouldValidate: true });
    if (!locLevel) {
      const newDerived = deriveLevel(val);
      if (newDerived !== derivedLevel)
        syncLocation(locBlock, newDerived, locArea);
    }
  };

  const onSubmit = async (data: FormValues) => {
    if (isViewMode) return;
    setSubmitting(true);

    try {
      const response = await fetch("/api/reports", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to submit report");
      }

      if (onSuccess) {
        onSuccess(data, isEditMode ? report?.id : result.data.id);
      } else {
        setSubmitted(true);
      }
    } catch (error) {
      console.error("Submission error:", error);
      alert(
        error instanceof Error
          ? error.message
          : "An error occurred while submitting."
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = () => {
    setSubmitted(false);
    setLocBlock("");
    setLocLevel("");
    setLocArea("");
    reset({
      company: "",
      damage_tag_placed: false,
      is_urgent: false,
      reported_by: "",
      type: "",
      location: "",
      unit_number: "",
      description: "",
      image_urls: [],
      status: "PENDING_COY",
      approved_by_coy: false,
    });
  };

  if (submitted && !isEditMode && !isViewMode) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center p-4">
        <Card className="w-full max-w-md text-center shadow-lg animate-in zoom-in-95">
          <CardHeader className="pb-4">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-500">
              <svg
                className="h-8 w-8"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
            <CardTitle className="text-2xl">Report Logged</CardTitle>
            <CardDescription className="text-base">
              Your damage report has been securely submitted and is pending
              verification by the Company.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={handleReset} className="w-full h-12 text-base">
              Submit Another Report
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="bg-muted/20 px-4 py-8 sm:py-12 md:px-8">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border bg-background px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground shadow-sm">
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  isUrgent ? "bg-destructive animate-pulse" : "bg-primary"
                }`}
              />
              Facilities Management
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              {isViewMode
                ? "View Report"
                : isEditMode
                ? "Edit Report"
                : "Barrack Damage"}
            </h1>
          </div>
          {(isEditMode || isViewMode) && report?.case_reference && (
            <div className="flex flex-col items-start sm:items-end">
              <span
                className={`rounded px-2 py-0.5 text-xs font-bold ${
                  isViewMode
                    ? "bg-secondary text-secondary-foreground"
                    : "bg-primary/10 text-primary"
                }`}
              >
                {isViewMode ? "VIEW MODE" : "EDIT MODE"}
              </span>
              <p className="mt-1 font-mono text-xs text-muted-foreground">
                Ref:{" "}
                <span className="font-semibold text-foreground">
                  {report.case_reference}
                </span>
              </p>
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit(onSubmit)}>
          <Card
            className={`shadow-md transition-colors duration-300 ${
              isUrgent ? "border-destructive/50 ring-1 ring-destructive/10" : ""
            }`}
          >
            {isUrgent && (
              <div className="bg-destructive/10 px-6 py-3 text-sm font-medium text-destructive flex items-center gap-2 rounded-t-xl border-b border-destructive/20">
                <svg
                  className="h-4 w-4 shrink-0"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
                Urgent report: {isViewMode ? "Escalated" : "Will be escalated"}{" "}
                to IFM immediately.
              </div>
            )}

            <CardHeader>
              <CardTitle>Report Details</CardTitle>
              <CardDescription>
                {isViewMode
                  ? "Review the details of the reported facility issue."
                  : isEditMode
                  ? "Update the details of your facility issue."
                  : "Submit a facility issue for verification and repair."}
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-8">
            {isViewMode && report && (
              <>
                <div className="border-t border-border/50" />
                <CardContent className="bg-muted/10 rounded-b-xl">
                  <div className="space-y-4">
                    <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                      Administrative Details
                    </h3>
                    
                    <div className="grid grid-cols-2 gap-y-6 gap-x-4 md:grid-cols-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground">Status</Label>
                        <div className="font-medium text-sm">
                          {report.status.replace(/_/g, ' ')}
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground">Coy Approval</Label>
                        <div className="font-medium text-sm">
                          {report.approved_by_coy ? (
                            <span className="flex items-center gap-1.5 text-green-600">
                              <CheckCircle2 className="h-4 w-4" /> Approved
                            </span>
                          ) : (
                            <span className="flex items-center gap-1.5 text-muted-foreground">
                              <Clock className="h-4 w-4" /> Pending
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground">Date Reported</Label>
                        <div className="font-medium text-sm">
                          {new Date(report.date_reported).toLocaleDateString()}
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground">IFM Reported Date</Label>
                        <div className="font-medium text-sm">
                          {report.ifm_reported_date 
                            ? new Date(report.ifm_reported_date).toLocaleDateString() 
                            : "—"}
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground">IFM Target Date</Label>
                        <div className="font-medium text-sm">
                          {report.ifm_target_date 
                            ? new Date(report.ifm_target_date).toLocaleDateString() 
                            : "—"}
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground">Repaired Date</Label>
                        <div className="font-medium text-sm">
                          {report.repaired_date 
                            ? new Date(report.repaired_date).toLocaleDateString() 
                            : "—"}
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </>
            )}
              {/* Row 1: Basic Info */}
              <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                <div className="space-y-2.5">
                  <Label className={errors.company ? "text-destructive" : ""}>
                    Company{" "}
                    {!isViewMode && <span className="text-destructive">*</span>}
                  </Label>
                  <Controller
                    name="company"
                    control={control}
                    render={({ field }) => (
                      <Select
                        onValueChange={field.onChange}
                        value={field.value || undefined} // Force undefined if empty to trigger placeholder
                        disabled={isViewMode}
                      >
                        <SelectTrigger
                          className={`${
                            errors.type
                              ? "border-destructive focus:ring-destructive/20 w-full"
                              : " w-full"
                          } ${INPUT_H}`}
                        >
                          <SelectValue placeholder="Which Company are you from?" />
                        </SelectTrigger>
                        <SelectContent>
                          {COMPANIES.map((c) => (
                            <SelectItem key={c} value={c}>
                              {c}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                  {!isViewMode && (
                    <FieldError message={errors.company?.message} />
                  )}
                </div>

                <div className="space-y-2.5">
                  <Label
                    className={errors.reported_by ? "text-destructive" : ""}
                  >
                    Reported By (Rank & Name){" "}
                    {!isViewMode && <span className="text-destructive">*</span>}
                  </Label>
                  <Input
                    {...register("reported_by")}
                    disabled={isViewMode}
                    placeholder="e.g. CPL Tan Wei Ming"
                    className={`${
                      errors.reported_by
                        ? "border-destructive focus-visible:ring-destructive/20"
                        : ""
                    } ${INPUT_H}`}
                  />
                  {!isViewMode && (
                    <FieldError message={errors.reported_by?.message} />
                  )}
                </div>

                <div className="space-y-2.5">
                  <Label className={errors.type ? "text-destructive" : ""}>
                    Damage Category{" "}
                    {!isViewMode && <span className="text-destructive">*</span>}
                  </Label>
                  <Controller
                    name="type"
                    control={control}
                    render={({ field }) => (
                      <Select
                        onValueChange={field.onChange}
                        value={field.value || undefined} // Force undefined if empty to trigger placeholder
                        disabled={isViewMode}
                      >
                        <SelectTrigger
                          className={`${
                            errors.type
                              ? "border-destructive focus:ring-destructive/20 w-full"
                              : " w-full"
                          } ${INPUT_H}`}
                        >
                          <SelectValue placeholder="Select primary category" />
                        </SelectTrigger>
                        <SelectContent>
                          {DAMAGE_TYPES.map((t) => (
                            <SelectItem key={t} value={t}>
                              {t}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                  {!isViewMode && <FieldError message={errors.type?.message} />}
                </div>
              </div>

              {/* Row 2: Category & Status Toggles */}
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <div className="space-y-2.5">
                  <Label className="flex items-center justify-between">
                    Physical Tag Placed
                    <span className="text-[10px] font-normal text-muted-foreground uppercase tracking-wider">
                      By COS / IC
                    </span>
                  </Label>
                  <Controller
                    name="damage_tag_placed"
                    control={control}
                    render={({ field }) => (
                      <YesNo
                        value={field.value}
                        onChange={field.onChange}
                        urgent={isUrgent}
                        disabled={isViewMode}
                      />
                    )}
                  />
                </div>

                <div className="space-y-2.5">
                  <Label
                    className={`flex items-center justify-between ${
                      isUrgent ? "text-destructive font-bold" : ""
                    }`}
                  >
                    Escalate as Urgent
                    <span className="text-[10px] font-normal text-muted-foreground uppercase tracking-wider">
                      IFM WhatsApp
                    </span>
                  </Label>
                  <Controller
                    name="is_urgent"
                    control={control}
                    render={({ field }) => (
                      <YesNo
                        value={field.value}
                        onChange={field.onChange}
                        urgent={isUrgent}
                        disabled={isViewMode}
                      />
                    )}
                  />
                </div>
              </div>

              <div className="border-t border-border/50" />

              {/* Row 3: Location & Unit Info */}
              <div className="space-y-6">
                {!isViewMode && (
                  <div className="space-y-2.5">
                    <Label>Block Reference Hints</Label>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 rounded-md border bg-card p-3 sm:grid-cols-2 md:grid-cols-3">
                      {BLOCK_REFS.slice(0, 9).map(({ block, label }) => (
                        <div key={block} className="flex items-center gap-2">
                          <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 font-mono text-[13px] font-bold text-muted-foreground">
                            {block}
                          </span>
                          <span className="truncate text-[13px] text-muted-foreground">
                            {label}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Location/Unit Fields */}
                <div>
                  <Label
                    className={`mb-2.5 block ${
                      errors.location || errors.unit_number
                        ? "text-destructive"
                        : ""
                    }`}
                  >
                    Exact Location{" "}
                    {!isViewMode && <span className="text-destructive">*</span>}
                  </Label>
                  <input type="hidden" {...register("location")} />

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-4 md:grid-cols-4">
                    {/* Block Select */}
                    <Select
                      onValueChange={handleBlockChange}
                      value={locBlock || undefined} // Force undefined if empty
                      disabled={isViewMode}
                    >
                      <SelectTrigger
                        className={`${
                          errors.location
                            ? "border-destructive focus:ring-destructive/20 w-full"
                            : "w-full"
                        } ${INPUT_H}`}
                      >
                        <SelectValue placeholder="Block" />
                      </SelectTrigger>
                      <SelectContent>
                        {BLOCKS.map((b) => (
                          <SelectItem key={b} value={b}>
                            Blk {b}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    {/* Level Select */}
                    <Select
                      onValueChange={handleLocLevelChange}
                      value={locLevel || derivedLevel || undefined} // Force undefined if empty
                      disabled={isViewMode}
                    >
                      <SelectTrigger
                        className={`${
                          errors.location
                            ? "border-destructive focus:ring-destructive/20 w-full"
                            : "w-full"
                        } ${INPUT_H}`}
                      >
                        <SelectValue placeholder="Level" />
                      </SelectTrigger>
                      <SelectContent>
                        {LEVELS.map((l) => (
                          <SelectItem key={l} value={l}>
                            Lvl {l}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    {/* Unit Input */}
                    <div
                      className={`flex sm:col-span-1 md:col-span-1 items-stretch rounded-md shadow-sm ${
                        isViewMode ? "opacity-60 cursor-not-allowed" : ""
                      }`}
                    >
                      <span className="flex items-center justify-center rounded-l-md border border-r-0 border-input bg-muted px-3 font-mono text-sm text-muted-foreground select-none">
                        #
                      </span>
                      <Input
                        value={unitNumber.replace(/^#/, "")}
                        onChange={handleUnitNumberChange}
                        disabled={isViewMode}
                        placeholder="e.g. 01-04"
                        className={`rounded-l-none font-mono ${
                          errors.unit_number
                            ? "border-destructive focus-visible:ring-destructive/20"
                            : ""
                        } ${INPUT_H}`}
                      />
                    </div>

                    {/* Area Input */}
                    <Input
                      value={locArea}
                      onChange={handleAreaChange}
                      disabled={isViewMode}
                      placeholder="Specific area (e.g. Bunk 3, Toilet A)"
                      className={`${
                        errors.location
                          ? "border-destructive focus-visible:ring-destructive/20"
                          : ""
                      } ${INPUT_H} sm:col-span-4 md:col-span-1`}
                    />
                  </div>

                  {/* Combined Preview & Error Area */}
                  <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2">
                    <div>
                      {(locBlock ||
                        locLevel ||
                        derivedLevel ||
                        locArea ||
                        unitNumber) && (
                        <div className="text-xs text-muted-foreground p-2.5 rounded bg-muted/40">
                          Compiled:{" "}
                          <span className="font-medium text-foreground">
                            {[
                              locBlock ? `Blk ${locBlock}` : "",
                              locLevel || derivedLevel
                                ? `Lvl ${locLevel || derivedLevel}`
                                : "",
                              unitNumber
                                ? `#${unitNumber.replace(/^#/, "")}`
                                : "",
                              locArea,
                            ]
                              .filter(Boolean)
                              .join(", ")}
                          </span>
                        </div>
                      )}
                      {derivedLevel && !isViewMode && (
                        <p className="mt-1.5 text-[11px] font-medium text-muted-foreground pl-2.5">
                          Level{" "}
                          <span className="text-foreground">
                            {derivedLevel}
                          </span>{" "}
                          automatically inferred from unit.
                        </p>
                      )}
                    </div>
                  </div>

                  {!isViewMode && (
                    <div className="space-y-1">
                      <FieldError message={errors.location?.message} />
                      <FieldError message={errors.unit_number?.message} />
                    </div>
                  )}
                </div>
              </div>

              <div className="border-t border-border/50" />

              {/* Row 4: Description & Images */}
              <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
                <div className="space-y-2.5 flex flex-col">
                  <Label
                    className={errors.description ? "text-destructive" : ""}
                  >
                    Detailed Description{" "}
                    {!isViewMode && <span className="text-destructive">*</span>}
                  </Label>
                  <Textarea
                    {...register("description")}
                    disabled={isViewMode}
                    placeholder="Provide as much detail as possible to assist technicians (e.g., U06 flushing spoilt, ceiling light C3 blinking)..."
                    className={`flex-1 resize-none ${
                      errors.description
                        ? "border-destructive focus-visible:ring-destructive/20"
                        : ""
                    }`}
                    rows={6}
                  />
                  {!isViewMode && (
                    <div className="flex items-center justify-between mt-1">
                      <FieldError message={errors.description?.message} />
                      <span className="text-[10px] text-muted-foreground uppercase ml-auto">
                        Min 20 chars
                      </span>
                    </div>
                  )}
                </div>

                <div className="space-y-2.5">
                  <Label className="flex items-center justify-between">
                    Photographic Evidence
                    <span className="text-[10px] font-normal text-muted-foreground uppercase tracking-wider">
                      White Zone Only
                    </span>
                  </Label>
                  <Controller
                    name="image_urls"
                    control={control}
                    render={({ field }) => (
                      <ImageUploader
                        value={field.value}
                        onChange={field.onChange}
                        urgent={isUrgent}
                        disabled={isViewMode}
                      />
                    )}
                  />
                </div>
              </div>
            </CardContent>
            
            {!isViewMode && (
              <CardFooter className="flex flex-col-reverse gap-4 border-t bg-muted/20 px-6 py-6 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-muted-foreground">
                  Ensure all <span className="text-destructive font-bold">*</span>{" "}
                  fields are filled accurately.
                </p>

                <Button
                  type="submit"
                  disabled={submitting}
                  variant={isUrgent ? "destructive" : "default"}
                  className="w-full sm:w-auto min-h-[3rem] px-8 font-semibold flex items-center justify-center transition-all"
                >
                  {submitting ? (
                    <div className="flex items-center gap-2">
                      <svg
                        className="h-4 w-4 animate-spin"
                        viewBox="0 0 24 24"
                        fill="none"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8v8z"
                        />
                      </svg>
                      <span>{isEditMode ? "Saving..." : "Processing..."}</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      {isUrgent && (
                        <svg
                          className="h-4 w-4 shrink-0"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2.5}
                            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                          />
                        </svg>
                      )}
                      <span>
                        {isEditMode
                          ? "Save Changes"
                          : isUrgent
                          ? "Submit Urgent Report"
                          : "Submit Report"}
                      </span>
                    </div>
                  )}
                </Button>
              </CardFooter>
            )}
          </Card>
        </form>
      </div>
    </div>
  );
}