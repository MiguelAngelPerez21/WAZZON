'use server';

import { revalidatePath } from 'next/cache';

import { errorState, successState, type ActionState } from '@/lib/action-state';
import { requireAdmin } from '@/lib/auth/session';
import { logger } from '@/lib/logger';
import { expireStaleOffers } from '@/services/product-service';

/**
 * Manual trigger for the offer-expiry sweep.
 *
 * Kept manual on purpose: a free deployment has no guaranteed cron, so an admin
 * can always run it, and the same SQL function can later be scheduled.
 */
export async function expireOffersAction(_previous: ActionState): Promise<ActionState> {
  await requireAdmin();

  try {
    const expired = await expireStaleOffers();
    revalidatePath('/admin/offers');
    revalidatePath('/', 'layout');
    return successState(
      expired > 0 ? `${expired} oferta(s) marcadas como caducadas.` : 'No había ofertas vencidas.',
    );
  } catch (error) {
    logger.error('offers.expire_failed', { error });
    return errorState('No se han podido caducar las ofertas.');
  }
}
