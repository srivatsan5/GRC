'use client'

/**
 * The printable "board pack" page used by /reports: serif title, generated-at line, headline figures,
 * numbered sections (charts / breakdowns), the detail table, CSV + Print. Printing uses the light tokens
 * (globals.css); this component drops shadows, keeps hairlines and avoids breaking sections across pages.
 */
import React, { useState } from 'react'
import { FileDown, Printer } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DataState } from '@/components/data-state'
import { useAuth } from '@/components/providers/auth-provider'
import { useOrgSettings } from '@/lib/settings'
import { DASH, formatDateTime, formatNumber } from '@/lib/format'
import { cn } from '@/lib/utils'
import { exportCsv, fileDate, type CsvColumn } from '@/components/analytics/csv'
import { Headline } from './kit'

export const TABLE_LIMIT = 100

export interface QueryLike {
  isLoading: boolean
  isError: boolean
  error: unknown
  refetch: () => unknown
  dataUpdatedAt: number
}

export interface ReportColumn<T> extends CsvColumn<T> {
  render?: (row: T) => React.ReactNode
  align?: 'right'
  /** Exported to CSV but not shown in the on-screen table. */
  hidden?: boolean
  /** Extra classes for the cell (e.g. a max width) */
  className?: string
  /** Left out of the printed board pack (kept on screen and in the CSV) so the table fits A4 */
  printHidden?: boolean
}

export interface ReportSection {
  title: string
  meta?: React.ReactNode
  body: React.ReactNode
  /** Span the full width of the section grid */
  wide?: boolean
}

export const text = (v: unknown) => (v === null || v === undefined || String(v).trim() === '' ? DASH : String(v))

export function BoardPack<T>({
  title,
  description,
  entity,
  queries,
  rows,
  columns,
  emptyTitle,
  emptyDescription,
  figures,
  figureCols = 4,
  sections = [],
  tableNote,
}: {
  title: string
  description: string
  entity: string
  queries: QueryLike[]
  rows: T[]
  columns: ReportColumn<T>[]
  emptyTitle: string
  emptyDescription?: string
  figures?: React.ReactNode
  figureCols?: 3 | 4
  sections?: ReportSection[]
  tableNote?: string
}) {
  const { settings } = useOrgSettings()
  const { user } = useAuth()
  const [generatedAt] = useState(() => new Date().toISOString())
  const loaded = queries.every(q => !q.isLoading && !q.isError)
  const updatedAt = Math.max(...queries.map(q => q.dataUpdatedAt || 0))
  const onExport = () =>
    exportCsv({
      filename: `${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${fileDate()}`,
      entity,
      description: `Exported report: ${title}`,
      rows,
      columns,
    })
  const shown = rows.slice(0, TABLE_LIMIT)
  const screen = columns.filter(c => !c.hidden)

  return (
    <article className="surface-panel min-w-0 overflow-hidden animate-fade-in print:overflow-visible print:rounded-none print:bg-card" aria-labelledby="report-title">
      {/* Title block */}
      <div className="border-b px-6 pt-7 pb-6 sm:px-10 print:px-4 print:pt-2">
        <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0 space-y-1.5">
            <p className="label-caps">{settings.orgName} · Board report</p>
            <h2 id="report-title" className="font-display text-title text-foreground">
              {title}
            </h2>
            <p className="max-w-2xl text-body text-muted-foreground">{description}</p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2 print:hidden">
            <Button variant="secondary" onClick={() => window.print()} disabled={!loaded}>
              <Printer aria-hidden="true" />
              Print
            </Button>
            <Button onClick={onExport} disabled={!loaded || rows.length === 0}>
              <FileDown aria-hidden="true" />
              Export CSV
            </Button>
          </div>
        </div>
        <dl className="mt-5 flex flex-wrap gap-x-6 gap-y-1 text-caption text-muted-foreground">
          <div>
            <dt className="inline">Generated </dt>
            <dd className="inline text-foreground-secondary">{formatDateTime(generatedAt)}</dd>
          </div>
          <div>
            <dt className="inline">Data as of </dt>
            <dd className="inline text-foreground-secondary">{loaded && updatedAt ? formatDateTime(new Date(updatedAt).toISOString()) : 'loading…'}</dd>
          </div>
          {user?.name && (
            <div>
              <dt className="inline">Prepared by </dt>
              <dd className="inline text-foreground-secondary">{user.name}</dd>
            </div>
          )}
          <div>
            <dt className="inline">Source </dt>
            <dd className="inline font-mono text-foreground-secondary">{entity}</dd>
          </div>
        </dl>
      </div>

      <DataState query={queries} empty={rows.length === 0} emptyTitle={emptyTitle} emptyDescription={emptyDescription}>
        {figures && (
          <Headline bare cols={figureCols} className={cn('border-b', figureCols === 4 ? 'print:grid-cols-4' : 'print:grid-cols-3')}>
            {figures}
          </Headline>
        )}

        {sections.length > 0 && (
          <div className="grid grid-cols-1 gap-px border-b bg-border md:grid-cols-2 print:grid-cols-2">
            {sections.map((s, i) => (
              <section
                key={s.title}
                aria-labelledby={`report-sec-${i}`}
                className={cn('min-w-0 break-inside-avoid bg-card px-6 py-6 sm:px-10 print:px-4 print:py-4', s.wide && 'md:col-span-2 print:col-span-2', !s.wide && i === sections.length - 1 && sectionsBeforeLastOdd(sections) && 'md:col-span-2 print:col-span-2')}
              >
                <div className="mb-4 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                  <h3 id={`report-sec-${i}`} className="flex items-baseline gap-3">
                    <span className="font-mono text-caption text-muted-foreground">{String(i + 1).padStart(2, '0')}</span>
                    <span className="font-display text-section text-foreground">{s.title}</span>
                  </h3>
                  {s.meta && <span className="text-caption text-muted-foreground">{s.meta}</span>}
                </div>
                {s.body}
              </section>
            ))}
          </div>
        )}

        {/* Detail table */}
        <section aria-labelledby="report-detail" className="pt-6">
          <div className="flex items-baseline justify-between gap-3 px-6 pb-3 sm:px-10 print:px-4">
            <h3 id="report-detail" className="flex items-baseline gap-3">
              <span className="font-mono text-caption text-muted-foreground">{String(sections.length + 1).padStart(2, '0')}</span>
              <span className="font-display text-section text-foreground">Detail</span>
            </h3>
            <span className="text-caption text-muted-foreground">
              {formatNumber(rows.length)} {rows.length === 1 ? 'row' : 'rows'}
            </span>
          </div>
          <div className="relative overflow-x-auto print:overflow-visible">
            <table className="enterprise-table print:text-[8pt] [&_td:first-child]:pl-6 sm:[&_td:first-child]:pl-10 [&_td:last-child]:pr-6 sm:[&_td:last-child]:pr-10 [&_th:first-child]:pl-6 sm:[&_th:first-child]:pl-10 [&_th:last-child]:pr-6 sm:[&_th:last-child]:pr-10 print:[&_td]:h-7 print:[&_td:first-child]:pl-4 print:[&_th:first-child]:pl-4 print:[&_td:last-child]:pr-4 print:[&_th:last-child]:pr-4 print:[&_td]:px-1.5 print:[&_th]:px-1.5">
              <thead>
                <tr>
                  {screen.map(c => (
                    <th key={c.header} data-numeric={c.align === 'right' ? '' : undefined} className={c.printHidden ? 'print:hidden' : undefined}>
                      {c.header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {shown.map((row, i) => (
                  <tr key={i}>
                    {screen.map(c => (
                      <td key={c.header} data-numeric={c.align === 'right' ? '' : undefined} className={cn('py-1.5', c.className, c.printHidden && 'print:hidden')}>
                        {c.render ? c.render(row) : text(c.value(row))}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <div className="flex flex-col gap-1 px-6 py-5 text-caption text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-10 print:px-4">
          <span>
            {rows.length > TABLE_LIMIT ? `Showing the first ${TABLE_LIMIT} of ${rows.length} rows; the CSV export contains all of them. ` : ''}
            {tableNote}
          </span>
          <span className="shrink-0">
            {settings.orgName} · {title} · generated {formatDateTime(generatedAt)}
          </span>
        </div>
      </DataState>
    </article>
  )
}

/** When the non-wide sections before the last leave it alone on its row, let it span the grid. */
function sectionsBeforeLastOdd(sections: ReportSection[]): boolean {
  let col = 0
  for (let i = 0; i < sections.length - 1; i++) {
    const s = sections[i]!
    if (s.wide) col = 0
    else col = (col + 1) % 2
  }
  return col === 0
}
