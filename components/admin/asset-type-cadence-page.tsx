"use client";

import { useMemo, useState } from "react";
import { Check, Plus, Save, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type {
  AssetChecklistField,
  AssetChecklistSchema,
  AssetTypeConfig,
} from "@/lib/types/assets";
import { cn } from "@/lib/utils";
import { notify } from "@/utils/toast";

type QuestionType = AssetChecklistField["type"];

type QuestionDraft = {
  id: string;
  key: string;
  label: string;
  type: QuestionType;
  required: boolean;
};

type EditableAssetType = {
  code: string;
  label: string;
  inspection_frequency_days: string;
  is_active: boolean;
  questions: QuestionDraft[];
};

type AssetTypeCadencePageProps = {
  initialAssetTypeConfigs: AssetTypeConfig[];
};

const QUESTION_TYPES: Array<{ value: QuestionType; label: string }> = [
  { value: "boolean", label: "Yes / No" },
  { value: "date", label: "Date" },
  { value: "text", label: "Text" },
  { value: "number", label: "Number" },
];

function makeId() {
  return crypto.randomUUID();
}

function normalizeQuestionKey(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function questionsFromSchema(schema: AssetChecklistSchema): QuestionDraft[] {
  return Object.entries(schema).map(([key, field]) => ({
    id: makeId(),
    key,
    label: field.label || key.replace(/_/g, " "),
    type: field.type,
    required: field.required ?? false,
  }));
}

function toEditable(config: AssetTypeConfig): EditableAssetType {
  return {
    code: config.code,
    label: config.label,
    inspection_frequency_days: String(config.inspection_frequency_days),
    is_active: config.is_active,
    questions: questionsFromSchema(config.checklist_schema_json ?? {}),
  };
}

function questionsToSchema(questions: QuestionDraft[]): AssetChecklistSchema {
  return Object.fromEntries(
    questions.map((question) => [
      question.key,
      {
        type: question.type,
        label: question.label.trim(),
        required: question.required,
      },
    ])
  );
}

function configSignature(config: AssetTypeConfig) {
  return JSON.stringify({
    label: config.label,
    inspection_frequency_days: config.inspection_frequency_days,
    is_active: config.is_active,
    checklist_schema_json: config.checklist_schema_json ?? {},
  });
}

function editableSignature(assetType: EditableAssetType) {
  return JSON.stringify({
    label: assetType.label,
    inspection_frequency_days: Number(assetType.inspection_frequency_days),
    is_active: assetType.is_active,
    checklist_schema_json: questionsToSchema(assetType.questions),
  });
}

function buildEmptyAssetType(): EditableAssetType {
  return {
    code: "",
    label: "",
    inspection_frequency_days: "30",
    is_active: true,
    questions: [
      {
        id: makeId(),
        key: "condition_ok",
        label: "Condition is acceptable",
        type: "boolean",
        required: true,
      },
    ],
  };
}

export function AssetTypeCadencePage({
  initialAssetTypeConfigs,
}: AssetTypeCadencePageProps) {
  const [assetTypes, setAssetTypes] = useState<EditableAssetType[]>(
    () => initialAssetTypeConfigs.map(toEditable)
  );
  const [savedAssetTypes, setSavedAssetTypes] = useState<AssetTypeConfig[]>(
    initialAssetTypeConfigs
  );
  const [selectedCode, setSelectedCode] = useState(
    initialAssetTypeConfigs[0]?.code ?? ""
  );
  const [savingCode, setSavingCode] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [newAssetType, setNewAssetType] = useState<EditableAssetType>(
    () => buildEmptyAssetType()
  );

  const savedByCode = useMemo(
    () => new Map(savedAssetTypes.map((config) => [config.code, config])),
    [savedAssetTypes]
  );

  const selectedAssetType =
    assetTypes.find((assetType) => assetType.code === selectedCode) ??
    assetTypes[0] ??
    null;

  const updateAssetType = (
    code: string,
    updater: (assetType: EditableAssetType) => EditableAssetType
  ) => {
    setAssetTypes((current) =>
      current.map((assetType) =>
        assetType.code === code ? updater(assetType) : assetType
      )
    );
  };

  const updateQuestion = (
    code: string,
    questionId: string,
    updater: (question: QuestionDraft) => QuestionDraft
  ) => {
    updateAssetType(code, (assetType) => ({
      ...assetType,
      questions: assetType.questions.map((question) =>
        question.id === questionId ? updater(question) : question
      ),
    }));
  };

  const addQuestion = (code: string) => {
    updateAssetType(code, (assetType) => {
      const nextIndex = assetType.questions.length + 1;
      return {
        ...assetType,
        questions: [
          ...assetType.questions,
          {
            id: makeId(),
            key: `question_${nextIndex}`,
            label: `Question ${nextIndex}`,
            type: "boolean",
            required: true,
          },
        ],
      };
    });
  };

  const removeQuestion = (code: string, questionId: string) => {
    updateAssetType(code, (assetType) => ({
      ...assetType,
      questions: assetType.questions.filter((question) => question.id !== questionId),
    }));
  };

  const validateAssetType = (assetType: EditableAssetType) => {
    const label = assetType.label.trim();
    const cadence = Number(assetType.inspection_frequency_days);

    if (!assetType.code.trim()) return "Asset type code is required.";
    if (!/^[A-Z0-9]+$/.test(assetType.code.trim().toUpperCase())) {
      return "Asset type code can only contain letters and numbers.";
    }
    if (!label) return "Asset type label is required.";
    if (!Number.isInteger(cadence) || cadence < 1) {
      return "Inspection cadence must be at least 1 day.";
    }

    const keys = new Set<string>();
    for (const question of assetType.questions) {
      if (!question.label.trim()) return "Each question needs a label.";
      if (!question.key.trim()) return "Each question needs a field key.";
      if (keys.has(question.key)) return "Question field keys must be unique.";
      keys.add(question.key);
    }

    return null;
  };

  const saveAssetType = async (assetType: EditableAssetType, method: "POST" | "PATCH") => {
    const validationError = validateAssetType(assetType);
    if (validationError) {
      notify.error(validationError);
      return null;
    }

    const code = assetType.code.trim().toUpperCase();
    const payload = {
      code,
      label: assetType.label.trim(),
      inspection_frequency_days: Number(assetType.inspection_frequency_days),
      is_active: assetType.is_active,
      checklist_schema_json: questionsToSchema(assetType.questions),
    };

    try {
      setSavingCode(code);
      const response = await fetch("/api/admin/asset-types", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to save asset type");
      }

      const updated = result.data.assetTypeConfig as AssetTypeConfig;
      setSavedAssetTypes((current) => {
        const exists = current.some((config) => config.code === updated.code);
        return exists
          ? current.map((config) => (config.code === updated.code ? updated : config))
          : [...current, updated].sort((a, b) => a.label.localeCompare(b.label));
      });
      setAssetTypes((current) => {
        const editable = toEditable(updated);
        const exists = current.some((config) => config.code === updated.code);
        return exists
          ? current.map((config) => (config.code === updated.code ? editable : config))
          : [...current, editable].sort((a, b) => a.label.localeCompare(b.label));
      });
      setSelectedCode(updated.code);
      notify.success(method === "POST" ? "Asset type created." : "Asset type saved.");
      return updated;
    } catch (error) {
      notify.error(error instanceof Error ? error.message : "Failed to save asset type");
      return null;
    } finally {
      setSavingCode(null);
    }
  };

  const handleCreate = async () => {
    const created = await saveAssetType(
      { ...newAssetType, code: newAssetType.code.trim().toUpperCase() },
      "POST"
    );
    if (!created) return;

    setCreateOpen(false);
    setNewAssetType(buildEmptyAssetType());
  };

  const renderBuilder = (assetType: EditableAssetType, mode: "create" | "edit") => {
    const saved = savedByCode.get(assetType.code);
    const dirty =
      mode === "create" ||
      !saved ||
      editableSignature(assetType) !== configSignature(saved);
    const isSaving = savingCode === assetType.code;

    const setAssetType =
      mode === "create"
        ? setNewAssetType
        : (updater: (current: EditableAssetType) => EditableAssetType) =>
            updateAssetType(assetType.code, updater);

    const updateDraftQuestion = (
      questionId: string,
      updater: (question: QuestionDraft) => QuestionDraft
    ) => {
      setAssetType((current) => ({
        ...current,
        questions: current.questions.map((question) =>
          question.id === questionId ? updater(question) : question
        ),
      }));
    };

    const addDraftQuestion = () => {
      setAssetType((current) => ({
        ...current,
        questions: [
          ...current.questions,
          {
            id: makeId(),
            key: `question_${current.questions.length + 1}`,
            label: `Question ${current.questions.length + 1}`,
            type: "boolean",
            required: true,
          },
        ],
      }));
    };

    const removeDraftQuestion = (questionId: string) => {
      setAssetType((current) => ({
        ...current,
        questions: current.questions.filter((question) => question.id !== questionId),
      }));
    };

    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-[0.7fr_1fr_0.45fr]">
          <div className="space-y-2">
            <Label htmlFor={`${mode}-asset-code`}>Code</Label>
            <Input
              id={`${mode}-asset-code`}
              value={assetType.code}
              disabled={mode === "edit"}
              onChange={(event) =>
                setAssetType((current) => ({
                  ...current,
                  code: event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""),
                }))
              }
              placeholder="EXITLIGHT"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`${mode}-asset-label`}>Name</Label>
            <Input
              id={`${mode}-asset-label`}
              value={assetType.label}
              onChange={(event) =>
                setAssetType((current) => ({ ...current, label: event.target.value }))
              }
              placeholder="Exit Light"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`${mode}-asset-cadence`}>Cadence</Label>
            <div className="flex items-center gap-2">
              <Input
                id={`${mode}-asset-cadence`}
                type="number"
                min={1}
                max={3650}
                value={assetType.inspection_frequency_days}
                onChange={(event) =>
                  setAssetType((current) => ({
                    ...current,
                    inspection_frequency_days: event.target.value,
                  }))
                }
              />
              <span className="text-sm text-muted-foreground">days</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Checkbox
            id={`${mode}-asset-active`}
            checked={assetType.is_active}
            onCheckedChange={(checked) =>
              setAssetType((current) => ({ ...current, is_active: checked === true }))
            }
          />
          <Label htmlFor={`${mode}-asset-active`}>Available when creating assets</Label>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="font-medium">Inspection Questions</h3>
              <p className="text-sm text-muted-foreground">
                These fields appear when a user logs an inspection for this asset type.
              </p>
            </div>
            <Button type="button" variant="outline" onClick={mode === "edit" ? () => addQuestion(assetType.code) : addDraftQuestion}>
              <Plus className="h-4 w-4" />
              Add Question
            </Button>
          </div>

          <div className="space-y-3">
            {assetType.questions.map((question, index) => {
              const applyQuestionUpdate =
                mode === "edit"
                  ? (updater: (question: QuestionDraft) => QuestionDraft) =>
                      updateQuestion(assetType.code, question.id, updater)
                  : (updater: (question: QuestionDraft) => QuestionDraft) =>
                      updateDraftQuestion(question.id, updater);

              return (
                <div
                  key={question.id}
                  className="grid gap-3 rounded-lg border border-border bg-muted/20 p-3 md:grid-cols-[1fr_0.7fr_0.55fr_auto]"
                >
                  <div className="space-y-2">
                    <Label htmlFor={`${mode}-${question.id}-label`}>
                      Question {index + 1}
                    </Label>
                    <Input
                      id={`${mode}-${question.id}-label`}
                      value={question.label}
                      onChange={(event) => {
                        const label = event.target.value;
                        applyQuestionUpdate((current) => ({
                          ...current,
                          label,
                          key: normalizeQuestionKey(label),
                        }));
                      }}
                      placeholder="Light is on"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor={`${mode}-${question.id}-key`}>Field key</Label>
                    <Input
                      id={`${mode}-${question.id}-key`}
                      value={question.key}
                      onChange={(event) =>
                        applyQuestionUpdate((current) => ({
                          ...current,
                          key: normalizeQuestionKey(event.target.value),
                        }))
                      }
                      placeholder="light_on"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Answer type</Label>
                    <Select
                      value={question.type}
                      onValueChange={(value) =>
                        applyQuestionUpdate((current) => ({
                          ...current,
                          type: value as QuestionType,
                        }))
                      }
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {QUESTION_TYPES.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            {type.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-end gap-3">
                    <div className="flex h-8 items-center gap-2">
                      <Checkbox
                        id={`${mode}-${question.id}-required`}
                        checked={question.required}
                        onCheckedChange={(checked) =>
                          applyQuestionUpdate((current) => ({
                            ...current,
                            required: checked === true,
                          }))
                        }
                      />
                      <Label htmlFor={`${mode}-${question.id}-required`} className="text-sm">
                        Required
                      </Label>
                    </div>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      onClick={() =>
                        mode === "edit"
                          ? removeQuestion(assetType.code, question.id)
                          : removeDraftQuestion(question.id)
                      }
                      aria-label="Remove question"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              );
            })}

            {assetType.questions.length === 0 && (
              <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                No custom inspection questions yet.
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end">
          <Button
            type="button"
            disabled={!dirty || isSaving}
            onClick={() =>
              mode === "create" ? handleCreate() : saveAssetType(assetType, "PATCH")
            }
          >
            {mode === "create" ? <Plus className="h-4 w-4" /> : <Save className="h-4 w-4" />}
            {isSaving ? "Saving" : mode === "create" ? "Create Asset Type" : "Save Changes"}
          </Button>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background p-6 text-foreground md:p-12">
      <div className="mx-auto max-w-7xl space-y-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="space-y-1.5">
            <h1 className="text-3xl font-semibold tracking-tight">Asset Type Builder</h1>
            <p className="text-sm text-muted-foreground md:text-base">
              Create asset types, set inspection cadence, and build the questions shown during inspections.
            </p>
          </div>
          <Button type="button" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" />
            New Asset Type
          </Button>
        </div>

        <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
          <Card className="h-fit border-border bg-card shadow-sm">
            <CardHeader>
              <CardTitle>Types</CardTitle>
              <CardDescription>Select a type to edit its cadence and questions.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {assetTypes.map((assetType) => {
                const saved = savedByCode.get(assetType.code);
                const dirty =
                  !saved || editableSignature(assetType) !== configSignature(saved);

                return (
                  <button
                    key={assetType.code}
                    type="button"
                    onClick={() => setSelectedCode(assetType.code)}
                    className={cn(
                      "flex w-full items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left transition-colors hover:bg-muted",
                      selectedAssetType?.code === assetType.code
                        ? "border-primary bg-muted"
                        : "border-border"
                    )}
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">
                        {assetType.label}
                      </span>
                      <span className="block truncate font-mono text-xs text-muted-foreground">
                        {assetType.code}
                      </span>
                    </span>
                    <span className="flex shrink-0 items-center gap-1">
                      {assetType.is_active && (
                        <Badge variant="secondary" className="gap-1">
                          <Check className="h-3 w-3" />
                          Active
                        </Badge>
                      )}
                      {dirty && <span className="size-2 rounded-full bg-primary" />}
                    </span>
                  </button>
                );
              })}

              {assetTypes.length === 0 && (
                <div className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
                  Create the first asset type to start using the asset inspection workflow.
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-border bg-card shadow-sm">
            <CardHeader>
              <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div>
                  <CardTitle>
                    {selectedAssetType?.label ?? "No Asset Type Selected"}
                  </CardTitle>
                  <CardDescription>
                    Cadence drives due dates. Questions define the inspection form.
                  </CardDescription>
                </div>
                {selectedAssetType && (
                  <Badge variant={selectedAssetType.is_active ? "secondary" : "outline"}>
                    {selectedAssetType.is_active ? "Active" : "Inactive"}
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {selectedAssetType ? (
                renderBuilder(selectedAssetType, "edit")
              ) : (
                <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                  No asset types found.
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>New Asset Type</DialogTitle>
            <DialogDescription>
              Start with a code, display name, inspection cadence, and the questions inspectors answer.
            </DialogDescription>
          </DialogHeader>
          {renderBuilder(newAssetType, "create")}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
