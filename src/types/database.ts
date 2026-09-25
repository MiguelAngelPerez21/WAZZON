/**
 * Database types.
 *
 * Hand-maintained to mirror `supabase/migrations/*.sql`. Regenerate with
 * `npx supabase gen types typescript --project-id <id> > src/types/database.ts`
 * once the project is linked; the shape below is intentionally identical to
 * what the generator produces.
 */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type AppRole = 'admin' | 'editor' | 'viewer';
export type ProductStatus = 'draft' | 'published' | 'hidden' | 'archived';
export type OfferStatus = 'draft' | 'active' | 'expired' | 'hidden';
export type DeviceType = 'mobile' | 'tablet' | 'desktop' | 'unknown';

export type ProfileRow = {
  id: string;
  email: string;
  full_name: string | null;
  role: AppRole;
  created_at: string;
  updated_at: string;
};

export type CategoryRow = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  image_url: string | null;
  icon: string | null;
  seo_title: string | null;
  seo_description: string | null;
  active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type ProviderRow = {
  id: string;
  name: string;
  slug: string;
  domains: string[];
  allows_redirect_tracking: boolean;
  notes: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
};

export type ProductRow = {
  id: string;
  title: string;
  slug: string;
  short_description: string | null;
  description: string | null;
  category_id: string | null;
  status: ProductStatus;
  featured: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  published_at: string | null;
};

export type ProductImageRow = {
  id: string;
  product_id: string;
  url: string;
  alt: string | null;
  position: number;
  created_at: string;
};

export type OfferRow = {
  id: string;
  product_id: string;
  provider_id: string;
  market: string;
  currency: string;
  current_price: string | null;
  previous_price: string | null;
  discount_percentage: number | null;
  affiliate_url: string;
  original_url: string | null;
  canonical_url: string | null;
  dedupe_key: string | null;
  external_id: string | null;
  coupon_code: string | null;
  coupon_description: string | null;
  starts_at: string | null;
  expires_at: string | null;
  status: OfferStatus;
  last_checked_at: string | null;
  created_at: string;
  updated_at: string;
};

export type OutboundEventRow = {
  id: string;
  product_id: string | null;
  offer_id: string | null;
  source: string | null;
  campaign: string | null;
  referrer_host: string | null;
  device_type: DeviceType;
  created_at: string;
};

export type SettingRow = {
  key: string;
  value: Json;
  updated_at: string;
};

type Insertable<TRow, TRequired extends keyof TRow> = Pick<TRow, TRequired> &
  Partial<Omit<TRow, TRequired>>;

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: ProfileRow;
        Insert: Insertable<ProfileRow, 'id' | 'email'>;
        Update: Partial<ProfileRow>;
        Relationships: [];
      };
      categories: {
        Row: CategoryRow;
        Insert: Insertable<CategoryRow, 'name' | 'slug'>;
        Update: Partial<CategoryRow>;
        Relationships: [];
      };
      providers: {
        Row: ProviderRow;
        Insert: Insertable<ProviderRow, 'name' | 'slug'>;
        Update: Partial<ProviderRow>;
        Relationships: [];
      };
      products: {
        Row: ProductRow;
        Insert: Insertable<ProductRow, 'title' | 'slug'>;
        Update: Partial<ProductRow>;
        Relationships: [
          {
            foreignKeyName: 'products_category_id_fkey';
            columns: ['category_id'];
            isOneToOne: false;
            referencedRelation: 'categories';
            referencedColumns: ['id'];
          },
        ];
      };
      product_images: {
        Row: ProductImageRow;
        Insert: Insertable<ProductImageRow, 'product_id' | 'url'>;
        Update: Partial<ProductImageRow>;
        Relationships: [
          {
            foreignKeyName: 'product_images_product_id_fkey';
            columns: ['product_id'];
            isOneToOne: false;
            referencedRelation: 'products';
            referencedColumns: ['id'];
          },
        ];
      };
      offers: {
        Row: OfferRow;
        Insert: Insertable<
          Omit<OfferRow, 'discount_percentage'>,
          'product_id' | 'provider_id' | 'affiliate_url'
        >;
        Update: Partial<Omit<OfferRow, 'discount_percentage'>>;
        Relationships: [
          {
            foreignKeyName: 'offers_product_id_fkey';
            columns: ['product_id'];
            isOneToOne: false;
            referencedRelation: 'products';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'offers_provider_id_fkey';
            columns: ['provider_id'];
            isOneToOne: false;
            referencedRelation: 'providers';
            referencedColumns: ['id'];
          },
        ];
      };
      outbound_events: {
        Row: OutboundEventRow;
        Insert: Insertable<OutboundEventRow, 'offer_id'>;
        Update: Partial<OutboundEventRow>;
        Relationships: [
          {
            foreignKeyName: 'outbound_events_product_id_fkey';
            columns: ['product_id'];
            isOneToOne: false;
            referencedRelation: 'products';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'outbound_events_offer_id_fkey';
            columns: ['offer_id'];
            isOneToOne: false;
            referencedRelation: 'offers';
            referencedColumns: ['id'];
          },
        ];
      };
      settings: {
        Row: SettingRow;
        Insert: Insertable<SettingRow, 'key' | 'value'>;
        Update: Partial<SettingRow>;
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: {
      is_admin: { Args: Record<string, never>; Returns: boolean };
      expire_stale_offers: { Args: Record<string, never>; Returns: number };
      analytics_clicks_by_day: {
        Args: { p_days?: number };
        Returns: { day: string; clicks: number }[];
      };
      analytics_top_products: {
        Args: { p_days?: number; p_limit?: number };
        Returns: { product_id: string; title: string; slug: string; clicks: number }[];
      };
      analytics_clicks_by_category: {
        Args: { p_days?: number };
        Returns: { category_id: string; name: string; clicks: number }[];
      };
      analytics_clicks_by_provider: {
        Args: { p_days?: number };
        Returns: { provider_id: string; name: string; clicks: number }[];
      };
      analytics_clicks_by_source: {
        Args: { p_days?: number };
        Returns: { source: string; clicks: number }[];
      };
      analytics_product_click_counts: {
        Args: { p_product_ids: string[] };
        Returns: { product_id: string; clicks: number }[];
      };
      list_catalog_products: {
        Args: {
          p_category_id?: string | null;
          p_provider_id?: string | null;
          p_query?: string | null;
          p_featured?: boolean | null;
          p_with_offer?: boolean;
          p_min_price?: number | null;
          p_max_price?: number | null;
          p_sort?: string;
          p_limit?: number;
          p_offset?: number;
        };
        Returns: { product_id: string; total_count: number }[];
      };
    };
    Enums: {
      app_role: AppRole;
      product_status: ProductStatus;
      offer_status: OfferStatus;
      device_type: DeviceType;
    };
    CompositeTypes: { [_ in never]: never };
  };
}
