import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Merges Tailwind classes without style conflicts.
 * Extremely useful for building reusable React components.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Example usage in a component:
// <div className={cn("bg-blue-500 text-white p-4", props.className)}>