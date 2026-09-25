import { z } from 'zod';

import { publicUrlSchema } from '@/validation/common';

/** Payload accepted by the "Analyse link" endpoint. */
export const analyzeUrlSchema = z.object({
  url: publicUrlSchema,
});

export type AnalyzeUrlInput = z.infer<typeof analyzeUrlSchema>;

export const settingsSchema = z.object({
  site_name: z.string().trim().min(1).max(60),
  site_description: z.string().trim().max(200),
  logo_url: z.string().trim().max(2048).nullable(),
  affiliate_disclosure: z.string().trim().min(20).max(500),
  default_currency: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{3}$/),
  default_market: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{2}$/),
  /**
   * `direct`   — MODE B: the CTA links straight to the affiliate URL and the
   *              click is recorded with a beacon (always allowed).
   * `redirect` — MODE A: the CTA goes through /go/[offerId]. Only legal when the
   *              affiliate program explicitly allows intermediate redirects.
   */
  outbound_tracking_mode: z.enum(['direct', 'redirect']),
});

export type SettingsInput = z.infer<typeof settingsSchema>;
export type SettingKey = keyof SettingsInput;

export const outboundEventSchema = z.object({
  offerId: z.string().uuid(),
  productId: z.string().uuid().optional(),
  source: z.string().trim().max(64).optional(),
  campaign: z.string().trim().max(64).optional(),
});

export type OutboundEventInput = z.infer<typeof outboundEventSchema>;
