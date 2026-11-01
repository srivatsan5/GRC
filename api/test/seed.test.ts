import { describe, expect, it } from 'vitest'
import { TABLES, isWritable } from '../src/tables/registry.js'
import { normalizePayload } from '../src/tables/validate.js'
// @ts-expect-error plain ESM helper without type declarations
import { demoRows } from '../../db/seed/demo-rows.mjs'

const SERVER_SET = new Set(['CREATED_BY', 'CREATED_ON', 'UPDATED_BY', 'UPDATED_ON', 'RECORDED_BY', 'ENTERED_BY', 'APPROVED_ON'])

describe('demo seed data', () => {
  const rows = (demoRows as () => Record<string, Record<string, unknown>[]>)()
  for (const [table, list] of Object.entries(rows)) {
    it(`${table}: every row passes the API's validation (so it also fits the database constraints)`, () => {
      const def = TABLES[table.toLowerCase()]
      expect(def, `${table} missing from registry`).toBeDefined()
      if (!def || !isWritable(def)) return // workflow tables are written via /api/workflow
      for (const row of list) {
        const payload = Object.fromEntries(
          Object.entries(row)
            .filter(([k]) => !SERVER_SET.has(k))
            .map(([k, v]) => [k, v && typeof v === 'object' && '$ref' in (v as object) ? 1 : v]),
        )
        const { ignoredFields } = normalizePayload(def, payload, 'create')
        expect(ignoredFields, `${table} sends columns the API doesn't know`).toEqual([])
      }
    })
  }
})
