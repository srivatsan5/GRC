import type { OrdsClient, OrdsRow } from './client.js'

/** Read every row of a table through ORDS paging (stops at `cap`). */
export async function loadAll(ords: OrdsClient, table: string, opts: { q?: string; cap?: number } = {}): Promise<{ rows: OrdsRow[]; truncated: boolean }> {
  const cap = opts.cap ?? 20_000
  const rows: OrdsRow[] = []
  for (let offset = 0; ; offset += 1000) {
    const chunk = await ords.list(table, { limit: 1000, offset, q: opts.q })
    rows.push(...chunk.items)
    if (!chunk.hasMore || chunk.items.length === 0) return { rows, truncated: false }
    if (rows.length >= cap) return { rows, truncated: true }
  }
}
