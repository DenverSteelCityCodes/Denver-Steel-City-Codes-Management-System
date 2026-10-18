interface Column<T> {
  header: string
  accessor: (row: T) => React.ReactNode
  className?: string
}

interface Props<T> {
  columns: Column<T>[]
  rows: T[]
  keyFn: (row: T) => string
  loading?: boolean
  emptyMessage?: string
}

// Admin data table (DESIGN.md › Rows and Data Tables): on the floor between 2px ink rules, a label
// header over a 1px ink line, 1px hairlines between rows, a faint hover tint. No card, no shadow,
// no uppercase. Scrolls sideways inside its frame when the columns don't fit.
export default function DataTable<T>({ columns, rows, keyFn, loading, emptyMessage = 'No data yet.' }: Props<T>) {
  return (
    <div className="overflow-x-auto border-y-2 border-ink">
      <table className="w-full border-collapse">
        <thead>
          <tr>
            {columns.map(col => (
              <th
                key={col.header}
                scope="col"
                className={`p-3 text-left align-bottom text-sm font-bold text-ink-muted whitespace-nowrap border-b border-ink ${col.className ?? ''}`}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <tr key={i} aria-hidden="true" className={i > 0 ? 'border-t border-border' : ''}>
                {columns.map(col => (
                  <td key={col.header} className="p-3">
                    <div className="h-4 w-3/4 rounded bg-surface-sunken animate-pulse" />
                  </td>
                ))}
              </tr>
            ))
          ) : rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="p-3 py-6 text-ink-muted">
                {emptyMessage}
              </td>
            </tr>
          ) : (
            rows.map((row, i) => (
              <tr key={keyFn(row)} className={`hover:bg-ink/[0.03] ${i > 0 ? 'border-t border-border' : ''}`}>
                {columns.map(col => (
                  <td key={col.header} className={`p-3 align-top ${col.className ?? ''}`}>
                    {col.accessor(row)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}
