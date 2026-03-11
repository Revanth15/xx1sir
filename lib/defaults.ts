export const BD_STATUS_OPTIONS = ['PENDING_COY', 'PENDING_S4', 'REPORTED_IFM', 'MERGED', 'COMPLETED', 'REJECTED']

export const BD_STATUS_STYLES: Record<string, string> = {
  PENDING_COY: "bg-yellow-100 text-yellow-800 border-transparent hover:bg-yellow-200 dark:bg-yellow-500/15 dark:text-yellow-400",
  PENDING_S4: "bg-orange-100 text-orange-800 border-transparent hover:bg-orange-200 dark:bg-orange-500/15 dark:text-orange-400",
  REPORTED_IFM: "bg-blue-100 text-blue-800 border-transparent hover:bg-blue-200 dark:bg-blue-500/15 dark:text-blue-400",
  MERGED: "bg-pink-100 text-pink-800 border-transparent hover:bg-pink-200 dark:bg-pink-500/15 dark:text-pink-400",
  COMPLETED: "bg-green-100 text-green-800 border-transparent hover:bg-green-200 dark:bg-green-500/15 dark:text-green-400",
  REJECTED: "bg-red-100 text-red-800 border-transparent hover:bg-red-200 dark:bg-red-500/15 dark:text-red-400",
  DEFAULT: "bg-secondary text-secondary-foreground border-transparent hover:bg-secondary/80",
}

export const BD_COMPANY_OPTIONS = ["ALPHA", "BRAVO", "CHARLIE", "SUPPORT", "MSC", "HQ"]

export const BD_DAMAGE_TYPE_OPTIONS = [
    "Electrical",
    "Plumbing",
    "Infra",
    "Aircon",
    "Fire alarm",
  ];

export const BD_LEVELS_OPTIONS = ["1", "2", "3", "4", "5", "6"]

export const BD_REPORT_STATUS_OPTIONS = [
    "PENDING_COY",
    "PENDING_IFM",
    "IN_PROGRESS",
    "RESOLVED",
  ] as const;

export const BD_BLOCK_REFS: { block: string; label: string }[] = [
    { block: "Blk 265", label: "Alpha training shed" },
    { block: "Blk 264", label: "Charlie training shed" },
    { block: "Blk 263", label: "Alpha / Bravo / Charlie" },
    { block: "Blk 262", label: "Bravo training shed" },
    { block: "Blk 261", label: "Support training shed" },
    { block: "Blk 260", label: "Support building" },
    { block: "Blk 235", label: "HQ building" },
  ];

export const BD_ROLES_REF = [
    { value: 'user',   label: 'Standard User' },
    { value: 'coy_ic', label: 'Company IC' },
    { value: 's4_brn', label: 'S4 Branch' },
    { value: 'admin',  label: 'System Admin' },
  ] as const

// export const BD_ROLES = []