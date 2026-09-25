import type { ActionState } from '@/lib/action-state';

/**
 * Result of the product Server Actions.
 *
 * Lives outside `actions.ts` on purpose: a `"use server"` module may only
 * export async functions, so the initial-state constant below cannot be
 * declared there. Client components import from here and call the actions from
 * `actions.ts`.
 */
export interface ProductActionState extends ActionState {
  product?: { id: string; slug: string; status: string };
}

export const idleProductState: ProductActionState = { status: 'idle' };
