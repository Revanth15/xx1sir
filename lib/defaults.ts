export const BD_STATUS_OPTIONS = ['PENDING_COY', 'PENDING_S4', 'REPORTED_IFM', 'COMPLETED', 'REJECTED']

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