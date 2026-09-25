import type { JsonLdNode } from '@/lib/seo/json-ld';

/**
 * Renders structured data.
 *
 * The payload is always built by us from database values, and `<` is escaped so
 * a product title can never close the `<script>` tag.
 */
export function JsonLd({ data }: { data: JsonLdNode | JsonLdNode[] }) {
  const json = JSON.stringify(data).replace(/</g, '\\u003c');

  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />;
}
