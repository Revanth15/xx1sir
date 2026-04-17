'use client';

import { AssetDisplayedStatus } from '@/lib/types/assets';
import { Badge } from '@/components/ui/badge';

const statusStyles: Record<AssetDisplayedStatus, string> = {
  SERVICEABLE:
    'bg-green-100 text-green-800 border-transparent dark:bg-green-500/15 dark:text-green-400',
  UNSERVICEABLE:
    'bg-red-100 text-red-800 border-transparent dark:bg-red-500/15 dark:text-red-400',
  OUTDATED:
    'bg-yellow-100 text-yellow-800 border-transparent dark:bg-yellow-500/15 dark:text-yellow-400',
};

export function AssetStatusBadge({
  status,
}: {
  status: AssetDisplayedStatus;
}) {
  return <Badge className={statusStyles[status]}>{status}</Badge>;
}
