'use client';

import { useActionState } from 'react';

import { expireOffersAction } from '@/app/admin/(panel)/offers/actions';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { idleState, type ActionState } from '@/lib/action-state';

export function ExpireOffersButton() {
  const { toast } = useToast();
  const [, action, pending] = useActionState(async (previous: ActionState) => {
    const result = await expireOffersAction(previous);
    if (result.status !== 'idle' && result.message) {
      toast({ tone: result.status === 'error' ? 'error' : 'success', title: result.message });
    }
    return result;
  }, idleState);

  return (
    <form action={action}>
      <Button type="submit" variant="secondary" disabled={pending}>
        {pending ? 'Revisando…' : 'Caducar ofertas vencidas'}
      </Button>
    </form>
  );
}
