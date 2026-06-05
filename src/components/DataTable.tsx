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

export default function DataTable<T>({ columns, rows, keyFn, loading, emptyMessage = 'No data yet.' }: Props<T>) {
  return (
    <div className="bg-surface border border-border rounded-xl shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-surface-sunken border-b border-border">
              {columns.map(col => (
                <th
                  key={col.header}
                  className={`px-4 py-3 text-left font-sans font-semibold text-xs uppercase tracking-widest text-ink-muted ${col.className ?? ''}`}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <tr key={i} className="border-b border-border last:border-0">
                  {columns.map(col => (
                    <td key={col.header} className="px-4 py-3.5">
                      <div className="h-4 bg-surface-sunken rounded animate-pulse w-3/4" />
                    </td>
                  ))}
                </tr>
              ))
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-10 text-center font-sans text-ink-muted text-sm">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              rows.map(row => (
                <tr key={keyFn(row)} className="border-b border-border last:border-0 hover:bg-surface-sunken/60 transition">
                  {columns.map(col => (
                    <td key={col.header} className={`px-4 py-3.5 font-sans text-ink ${col.className ?? ''}`}>
                      {col.accessor(row)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
