/**
 * Shared shape for Server Action results consumed by `useActionState`.
 *
 * `fieldErrors` mirrors Zod's flattened output so forms can show messages next
 * to each input instead of a single opaque banner.
 */
export interface ActionState {
  status: 'idle' | 'success' | 'error';
  message?: string;
  fieldErrors?: Record<string, string[]>;
}

export const idleState: ActionState = { status: 'idle' };

export function errorState(message: string, fieldErrors?: Record<string, string[]>): ActionState {
  return fieldErrors ? { status: 'error', message, fieldErrors } : { status: 'error', message };
}

export function successState(message: string): ActionState {
  return { status: 'success', message };
}

/** Accepts only in-app absolute paths, so `?next=` can never leave the site. */
export function safeInternalPath(value: string | null | undefined, fallback: string): string {
  if (!value) return fallback;
  if (!value.startsWith('/') || value.startsWith('//')) return fallback;
  return value;
}
