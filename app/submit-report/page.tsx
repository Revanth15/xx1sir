"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// ─── Schema ────────────────────────────────────────────────────────────────────

const REPORT_STATUS = ["PENDING_COY", "PENDING_IFM", "IN_PROGRESS", "RESOLVED"] as const;

const schema = z.object({
  company:           z.string().min(1, "Select a company"),
  damage_tag_placed: z.boolean(),
  is_urgent:         z.boolean(),
  reported_by:       z.string().min(2, "Enter rank and name"),
  type:              z.string().min(1, "Select a damage type"),
  location:          z.string().min(2, "Location is required"),
  unit_number:       z.string().min(1, "Unit number is required"),
  description:       z.string().min(20, "Description must be at least 20 characters"),
  image_urls:        z.array(z.string()),
  status:            z.enum(REPORT_STATUS),
  approved_by_coy:   z.boolean(),
});

type FormValues = z.infer<typeof schema>;

// ─── Exported report type (for edit mode) ─────────────────────────────────────

export type BarrackDamageReport = {
  id: string;
  case_reference: string;
  date_reported: string;
} & FormValues;

// ─── Static data ──────────────────────────────────────────────────────────────

const COMPANIES = ["ALPHA", "BRAVO", "CHARLIE", "SUPPORT", "MSC", "HQ"];

const DAMAGE_TYPES = ["Electrical", "Plumbing", "Infra", "Aircon", "Fire alarm"];

const LEVELS = ["1", "2", "3", "4", "5", "6"];

// Block number → descriptive label shown as a reference hint
const BLOCK_REFS: { block: string; label: string }[] = [
  { block: "Blk265", label: "Alpha training shed" },
  { block: "Blk264", label: "Charlie training shed" },
  { block: "Blk263", label: "Alpha / Bravo / Charlie buildings" },
  { block: "Blk262", label: "Bravo training shed" },
  { block: "Blk261", label: "Support training shed" },
  { block: "Blk260", label: "Support building" },
  { block: "Blk235", label: "HQ building" },
];

// The selectable block values (just the number part, e.g. "265")
const BLOCKS = BLOCK_REFS.map((r) => r.block.replace("Blk", ""));

// ─── Theme tokens ──────────────────────────────────────────────────────────────

const H = "h-10";

const T = {
  input:
    `w-full ${H} rounded-md border border-zinc-700 bg-zinc-800 px-3 text-sm text-white ` +
    "placeholder-zinc-500 focus:border-blue-500 focus:outline-none focus:ring-2 " +
    "focus:ring-blue-500/20 transition-colors",
  inputUrgent:
    `w-full ${H} rounded-md border border-red-700/60 bg-zinc-800 px-3 text-sm text-white ` +
    "placeholder-zinc-500 focus:border-red-500 focus:outline-none focus:ring-2 " +
    "focus:ring-red-500/20 transition-colors",
  select:
    `w-full ${H} rounded-md border border-zinc-700 bg-zinc-800 px-3 text-sm text-white ` +
    "focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 " +
    "data-[placeholder]:text-zinc-500 transition-colors",
  selectUrgent:
    `w-full ${H} rounded-md border border-red-700/60 bg-zinc-800 px-3 text-sm text-white ` +
    "focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/20 " +
    "data-[placeholder]:text-zinc-500 transition-colors",
  label:         "mb-1.5 block text-xs font-semibold uppercase tracking-wider text-zinc-400",
  selectContent: "border-zinc-700 bg-zinc-900 text-white",
  selectItem:    "cursor-pointer text-zinc-200 focus:bg-zinc-700 focus:text-white",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseLocation(loc: string): { block: string; level: string; area: string } {
  const blockMatch = loc.match(/Block\s+(\S+)/i);
  const levelMatch = loc.match(/Level\s+(\d+)/i);
  const block = blockMatch ? blockMatch[1] : "";
  const level = levelMatch ? levelMatch[1] : "";
  const area = loc.replace(/Block\s+\S+,?\s*/i, "").replace(/Level\s+\d+,?\s*/i, "").trim();
  return { block, level, area };
}

function deriveLevel(unitNumber: string): string {
  const firstChar = (unitNumber ?? "").replace(/^#/, "").charAt(0);
  return /[1-6]/.test(firstChar) ? firstChar : "";
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p className="mt-1.5 flex items-center gap-1.5 text-xs text-red-400">
      <svg className="h-3 w-3 shrink-0" viewBox="0 0 12 12" fill="currentColor">
        <path d="M6 1a5 5 0 100 10A5 5 0 006 1zm-.5 2.5h1v3h-1v-3zm0 4h1v1h-1v-1z" />
      </svg>
      {message}
    </p>
  );
}

/** Numbered question wrapper — matches the reference form's layout */
function Question({
  n, label, sub, required, children,
}: {
  n: number;
  label: string;
  sub?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-semibold text-white">
          <span className="mr-1.5 text-zinc-500">{n}.</span>
          {label}
          {required && <span className="ml-1 text-red-500">*</span>}
        </p>
        {sub && <p className="mt-0.5 text-xs text-zinc-500">{sub}</p>}
      </div>
      {children}
    </div>
  );
}

/** Yes / No two-button selector */
function YesNo({ value, onChange, urgent }: { value: boolean; onChange: (v: boolean) => void; urgent: boolean }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {([false, true] as const).map((v) => {
        const active = value === v;
        const isYes  = v === true;
        const activeClass = active
          ? isYes
            ? urgent
              ? "border-red-500/50 bg-red-500/10 text-red-300"
              : "border-green-500/50 bg-green-500/10 text-green-300"
            : "border-zinc-500/40 bg-zinc-700 text-zinc-200"
          : "border-zinc-700 bg-zinc-800/50 text-zinc-500 hover:border-zinc-600 hover:text-zinc-400";
        return (
          <button
            key={String(v)}
            type="button"
            onClick={() => onChange(v)}
            className={`flex items-center justify-center gap-2 rounded-md border py-2.5 text-sm font-medium transition-all duration-150 ${activeClass}`}
          >
            {isYes ? (
              <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l3.5 3.5L13 4.5" />
              </svg>
            ) : (
              <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" d="M4 4l8 8M12 4l-8 8" />
              </svg>
            )}
            {isYes ? "Yes" : "No"}
          </button>
        );
      })}
    </div>
  );
}

/** Image upload zone with previews */
function ImageUploader({ value, onChange, urgent }: { value: string[]; onChange: (urls: string[]) => void; urgent: boolean }) {
  const inputRef  = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const processFiles = useCallback((files: FileList | null) => {
    if (!files) return;
    const next: string[] = [];
    Array.from(files).forEach((file) => {
      if (!file.type.startsWith("image/") || file.size > 4 * 1024 * 1024) return;
      next.push(URL.createObjectURL(file));
    });
    onChange([...value, ...next]);
  }, [value, onChange]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragging(false); processFiles(e.dataTransfer.files);
  }, [processFiles]);

  const remove = (i: number) => onChange(value.filter((_, idx) => idx !== i));

  const accentBorder = urgent ? "border-red-500 bg-red-500/10" : "border-blue-500 bg-blue-500/10";
  const idleBorder   = urgent
    ? "border-red-900/40 bg-zinc-800/30 hover:border-red-700/50"
    : "border-zinc-700 bg-zinc-800/30 hover:border-zinc-500";

  return (
    <div className="space-y-3">
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed px-4 py-8 transition-all duration-200 ${dragging ? accentBorder : idleBorder}`}
      >
        <svg className="h-8 w-8 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
        </svg>
        <p className="text-sm text-zinc-400">
          <span className={`font-medium ${urgent ? "text-red-400" : "text-blue-400"}`}>Choose file</span> or drag and drop here
        </p>
        <input ref={inputRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => processFiles(e.target.files)} />
      </div>
      <p className="text-xs text-zinc-600">Maximum file size: 4 MB</p>
      {value.length > 0 && (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
          {value.map((url, i) => (
            <div key={i} className="group relative aspect-square">
              <img src={url} alt={`Upload ${i + 1}`} className="h-full w-full rounded-md border border-zinc-700 object-cover" />
              <button type="button" onClick={() => remove(i)} className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-white opacity-0 shadow transition-opacity group-hover:opacity-100">
                <svg className="h-3 w-3" viewBox="0 0 12 12" fill="none" stroke="currentColor"><path strokeLinecap="round" d="M2 2l8 8M10 2l-8 8" strokeWidth={2} /></svg>
              </button>
              <div className="absolute bottom-0 left-0 right-0 rounded-b-md bg-black/60 px-1 py-0.5 text-center text-[10px] text-zinc-400">{i + 1}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface DamageReportFormProps {
  report?:   BarrackDamageReport;
  onSuccess?: (data: FormValues, id?: string) => void;
}

export default function DamageReportForm({ report, onSuccess }: DamageReportFormProps) {
  const isEditMode = !!report;
  const [submitted,  setSubmitted]  = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Location sub-field state (block dropdown + level dropdown + free-text area)
  const [locBlock, setLocBlock] = useState("");
  const [locLevel, setLocLevel] = useState("");
  const [locArea,  setLocArea]  = useState("");

  const { handleSubmit, control, watch, reset, register, setValue, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      company: "", damage_tag_placed: false, is_urgent: false,
      reported_by: "", type: "", location: "", unit_number: "",
      description: "", image_urls: [], status: "PENDING_COY", approved_by_coy: false,
    },
  });

  // Populate in edit mode
  useEffect(() => {
    if (!report) return;
    const { block, level, area } = parseLocation(report.location);
    setLocBlock(block); setLocLevel(level); setLocArea(area);
    reset({
      company: report.company, damage_tag_placed: report.damage_tag_placed,
      is_urgent: report.is_urgent, reported_by: report.reported_by,
      type: report.type, location: report.location, unit_number: report.unit_number,
      description: report.description, image_urls: report.image_urls,
      status: report.status, approved_by_coy: report.approved_by_coy,
    });
  }, [report, reset]);

  const isUrgent   = watch("is_urgent");
  const unitNumber = watch("unit_number") ?? "";
  const derivedLevel = deriveLevel(unitNumber);

  const inputCls  = isUrgent ? T.inputUrgent : T.input;
  const selectCls = isUrgent ? T.selectUrgent : T.select;
  const divider   = <div className={`h-px ${isUrgent ? "bg-red-900/30" : "bg-zinc-800"}`} />;

  // Location sync
  const syncLocation = useCallback((block: string, level: string, area: string) => {
    const parts = [block ? `Block ${block}` : "", level ? `Level ${level}` : "", area].filter(Boolean);
    setValue("location", parts.join(", "), { shouldValidate: true });
  }, [setValue]);

  const handleBlockChange = (block: string) => { setLocBlock(block); syncLocation(block, locLevel || derivedLevel, locArea); };
  const handleLocLevelChange = (level: string) => { setLocLevel(level); syncLocation(locBlock, level, locArea); };
  const handleAreaChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const area = e.target.value; setLocArea(area); syncLocation(locBlock, locLevel || derivedLevel, area);
  };

  // Unit number — enforce # prefix, re-derive level for location
  const handleUnitNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value;
    if (!val.startsWith("#")) val = "#" + val.replace(/^#+/, "");
    setValue("unit_number", val, { shouldValidate: true });
    if (!locLevel) {
      const newDerived = deriveLevel(val);
      if (newDerived !== derivedLevel) syncLocation(locBlock, newDerived, locArea);
    }
  };

  const onSubmit = async (data: FormValues) => {
    setSubmitting(true);
    // Create:  await fetch("/api/damage-reports", { method: "POST", body: JSON.stringify(data) });
    // Update:  await fetch(`/api/damage-reports/${report!.id}`, { method: "PATCH", body: JSON.stringify(data) });
    console.log(isEditMode ? "Updated:" : "Created:", data);
    await new Promise((r) => setTimeout(r, 900));
    setSubmitting(false);
    if (onSuccess) { onSuccess(data, report?.id); } else { setSubmitted(true); }
  };

  const handleReset = () => {
    setSubmitted(false); setLocBlock(""); setLocLevel(""); setLocArea("");
    reset({ company: "", damage_tag_placed: false, is_urgent: false, reported_by: "", type: "",
      location: "", unit_number: "", description: "", image_urls: [], status: "PENDING_COY", approved_by_coy: false });
  };

  // ── Success screen ─────────────────────────────────────────────────────────
  if (submitted && !isEditMode) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-950 px-4">
        <div className="w-full max-w-md rounded-xl border border-zinc-800 bg-zinc-900 p-10 text-center shadow-2xl">
          <span className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-green-500/15 text-green-400 ring-1 ring-green-500/30">
            <svg className="h-7 w-7" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </span>
          <h2 className="mb-2 text-lg font-semibold text-white">Report Submitted</h2>
          <p className="mb-6 text-sm text-zinc-400">Your damage report has been logged and is pending company review.</p>
          <button onClick={handleReset} className="w-full rounded-md bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-500 transition-colors">
            Submit Another Report
          </button>
        </div>
      </div>
    );
  }

  // ── Form ──────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-zinc-950 px-4 py-10">
      {/* Header */}
      <div className="mx-auto mb-8 max-w-2xl">
        <div className="mb-1 flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
          <span className="text-xs font-medium uppercase tracking-widest text-zinc-500">Facilities Management</span>
        </div>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
              {isEditMode ? "Edit Damage Report" : "Barrack Damage Report"}
            </h1>
            {isEditMode && report?.case_reference && (
              <p className="mt-1 font-mono text-sm text-zinc-500">Ref: <span className="text-zinc-300">{report.case_reference}</span></p>
            )}
          </div>
          {isEditMode && (
            <span className="mt-1 shrink-0 rounded-md border border-blue-500/30 bg-blue-500/10 px-2.5 py-1 text-xs font-semibold text-blue-400">EDITING</span>
          )}
        </div>
        {!isEditMode && <p className="mt-1.5 text-sm text-zinc-500">Complete all required fields. Reports are submitted to Company for initial approval.</p>}
      </div>

      <form
        onSubmit={handleSubmit(onSubmit)}
        className={`mx-auto max-w-2xl rounded-xl border p-6 shadow-2xl transition-all duration-300 sm:p-8 ${
          isUrgent ? "border-red-700/50 bg-zinc-900 shadow-red-950/40" : "border-zinc-800 bg-zinc-900 shadow-black/40"
        }`}
      >
        <div className="space-y-8">

          {/* ── 1. Company ── */}
          <Question n={1} label="Company" required>
            <Controller
              name="company"
              control={control}
              render={({ field }) => (
                <Select onValueChange={field.onChange} value={field.value ?? ""}>
                  <SelectTrigger className={selectCls}>
                    <SelectValue placeholder="Select company…" />
                  </SelectTrigger>
                  <SelectContent className={T.selectContent}>
                    {COMPANIES.map((c) => (
                      <SelectItem key={c} value={c} className={T.selectItem}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            <FieldError message={errors.company?.message} />
          </Question>

          {divider}

          {/* ── 2. Damage tag ── */}
          <Question
            n={2}
            label="Damage Report Tag placed on damage"
            sub="Ensure report tag is placed by coy COS / barrack damage IC"
          >
            <Controller
              name="damage_tag_placed"
              control={control}
              render={({ field }) => <YesNo value={field.value} onChange={field.onChange} urgent={isUrgent} />}
            />
          </Question>

          {divider}

          {/* ── 3. Urgent ── */}
          <Question
            n={3}
            label="Reported as urgent damage to 1SIR Barrack Damages IFM"
            sub="Report submitted to WhatsApp group chat"
          >
            <Controller
              name="is_urgent"
              control={control}
              render={({ field }) => <YesNo value={field.value} onChange={field.onChange} urgent={isUrgent} />}
            />
            <div className={`overflow-hidden transition-all duration-300 ${isUrgent ? "max-h-10 opacity-100" : "max-h-0 opacity-0"}`}>
              <p className="flex items-center gap-1.5 text-xs text-red-400">
                <svg className="h-3.5 w-3.5 shrink-0" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M8 1a7 7 0 100 14A7 7 0 008 1zm-.75 3.5h1.5v4.5h-1.5V4.5zm0 5.5h1.5V11.5h-1.5V10z" />
                </svg>
                This report will be escalated to IFM immediately upon submission.
              </p>
            </div>
          </Question>

          {divider}

          {/* ── 4. Reported by ── */}
          <Question n={4} label="Reported by" sub="Rank & Name" required>
            <input {...register("reported_by")} placeholder="e.g. CPL Tan Wei Ming" className={inputCls} />
            <FieldError message={errors.reported_by?.message} />
          </Question>

          {divider}

          {/* ── 5. Type of damages ── */}
          <Question n={5} label="Type of damages" required>
            <Controller
              name="type"
              control={control}
              render={({ field }) => (
                <Select onValueChange={field.onChange} value={field.value ?? ""}>
                  <SelectTrigger className={selectCls}>
                    <SelectValue placeholder="Select damage type…" />
                  </SelectTrigger>
                  <SelectContent className={T.selectContent}>
                    {DAMAGE_TYPES.map((t) => (
                      <SelectItem key={t} value={t} className={T.selectItem}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            <FieldError message={errors.type?.message} />
          </Question>

          {divider}

          {/* ── 6. Location — Block + Level + Area ── */}
          <Question n={6} label="Location" sub="(Bunk, Toilet, Office, Armskote etc.)" required>
            {/* Hidden RHF field stores the assembled string */}
            <input type="hidden" {...register("location")} />
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-[1fr_1fr_2fr]">
              {/* Block */}
              <Select onValueChange={handleBlockChange} value={locBlock}>
                <SelectTrigger className={selectCls}>
                  <SelectValue placeholder="Block…" />
                </SelectTrigger>
                <SelectContent className={T.selectContent}>
                  {BLOCKS.map((b) => (
                    <SelectItem key={b} value={b} className={T.selectItem}>Blk{b}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {/* Level — pre-filled from unit number first digit, overridable */}
              <Select onValueChange={handleLocLevelChange} value={locLevel || derivedLevel}>
                <SelectTrigger className={selectCls}>
                  <SelectValue placeholder="Level…" />
                </SelectTrigger>
                <SelectContent className={T.selectContent}>
                  {LEVELS.map((l) => (
                    <SelectItem key={l} value={l} className={T.selectItem}>Level {l}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {/* Free-text specific area */}
              <input
                value={locArea}
                onChange={handleAreaChange}
                placeholder="Specific area (e.g. toilet, corridor)"
                className={`col-span-2 sm:col-span-1 ${inputCls}`}
              />
            </div>
            {/* Live preview */}
            {(locBlock || locLevel || derivedLevel || locArea) && (
              <p className="mt-1.5 text-xs text-zinc-500">
                <span className={isUrgent ? "text-red-400" : "text-blue-400"}>
                  {[locBlock ? `Blk${locBlock}` : "", (locLevel || derivedLevel) ? `Level ${locLevel || derivedLevel}` : "", locArea].filter(Boolean).join(", ")}
                </span>
              </p>
            )}
            <FieldError message={errors.location?.message} />
          </Question>

          {divider}

          {/* ── 7. Unit number ── */}
          <Question n={7} label="Unit number" required>
            {/* Block reference legend */}
            <div className="mb-3 grid grid-cols-1 gap-1.5 rounded-md border border-zinc-800 bg-zinc-800/40 p-3 sm:grid-cols-2">
              {BLOCK_REFS.map(({ block, label }) => (
                <div key={block} className="flex items-baseline gap-2">
                  <span className={`shrink-0 font-mono text-xs font-semibold ${isUrgent ? "text-red-400" : "text-blue-400"}`}>{block}</span>
                  <span className="text-xs text-zinc-500">{label}</span>
                </div>
              ))}
            </div>
            {/* # prefix adornment */}
            <div className="flex items-stretch">
              <span className={`flex items-center rounded-l-md border border-r-0 px-3 font-mono text-sm font-semibold select-none transition-colors ${
                isUrgent ? "border-red-700/60 bg-zinc-800 text-red-400" : "border-zinc-700 bg-zinc-800 text-zinc-400"
              }`}>
                #
              </span>
              <input
                value={unitNumber.replace(/^#/, "")}
                onChange={handleUnitNumberChange}
                placeholder="e.g. Blk263 01-04"
                className={`min-w-0 flex-1 rounded-l-none rounded-r-md border border-l-0 px-3 font-mono text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 transition-colors ${H} ${
                  isUrgent
                    ? "border-red-700/60 bg-zinc-800 focus:border-red-500 focus:ring-red-500/20"
                    : "border-zinc-700 bg-zinc-800 focus:border-blue-500 focus:ring-blue-500/20"
                }`}
              />
            </div>
            {derivedLevel && (
              <p className="mt-1.5 text-xs text-zinc-500">
                Level <span className={isUrgent ? "text-red-400" : "text-blue-400"}>{derivedLevel}</span> detected — pre-filled in location above
              </p>
            )}
            <FieldError message={errors.unit_number?.message} />
          </Question>

          {divider}

          {/* ── 8. Description ── */}
          <Question
            n={8}
            label="Description of damage"
            sub="(e.g. U06 flushing spoilt, ceiling lights spoiled, C03 toilet bowl choked)"
            required
          >
            <textarea
              {...register("description")}
              rows={4}
              placeholder="Describe the damage — what, where, how severe…"
              className={`${inputCls} h-auto resize-none py-2.5`}
            />
            <div className="mt-1 flex items-start justify-between gap-2">
              <FieldError message={errors.description?.message} />
              <span className="ml-auto shrink-0 text-xs text-zinc-600">min. 20 characters</span>
            </div>
          </Question>

          {divider}

          {/* ── 9. Image (optional) ── */}
          <Question n={9} label="Image of damage" sub="For white zone areas only">
            <Controller
              name="image_urls"
              control={control}
              render={({ field }) => (
                <ImageUploader value={field.value} onChange={field.onChange} urgent={isUrgent} />
              )}
            />
          </Question>

        </div>

        {/* Submit */}
        <div className={`mt-8 border-t pt-6 ${isUrgent ? "border-red-900/40" : "border-zinc-800"}`}>
          <div className="flex flex-col gap-3 sm:flex-row-reverse sm:items-center">
            <button
              type="submit"
              disabled={submitting}
              className={`flex flex-1 items-center justify-center gap-2 rounded-md px-6 py-2.5 text-sm font-semibold text-white transition-all duration-200 disabled:opacity-50 ${
                isUrgent
                  ? "bg-red-600 hover:bg-red-500 shadow-lg shadow-red-950/50"
                  : "bg-blue-600 hover:bg-blue-500 shadow-lg shadow-blue-950/50"
              }`}
            >
              {submitting ? (
                <>
                  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                  </svg>
                  {isEditMode ? "Saving…" : "Submitting…"}
                </>
              ) : (
                <>
                  {isUrgent && (
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                    </svg>
                  )}
                  {isEditMode ? "Save Changes" : isUrgent ? "Submit Now (Urgent)" : "Submit Now"}
                </>
              )}
            </button>
            <p className="text-center text-xs text-zinc-600 sm:text-left">
              Fields marked <span className="text-red-500">*</span> are required
            </p>
          </div>
        </div>
      </form>

      <div className="mx-auto mt-6 max-w-2xl text-center text-xs text-zinc-700">
        Barrack Damage Reporting System · {new Date().getFullYear()}
      </div>
    </div>
  );
}