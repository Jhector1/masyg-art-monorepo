// NOTE: no "use client" here — this is a Server Component

type Col<Row> = {
  key: keyof Row | string;
  header: React.ReactNode;
  render?: (row: Row) => React.ReactNode;
  className?: string;
};

export default function DataTable<Row>({
  rows,
  cols,
  empty = "No records.",
}: {
  rows: Row[];
  cols: Col<Row>[];
  empty?: string;
}) {
  return (
    <div className="rounded-2xl border overflow-x-auto">
      <table className="min-w-full">
        <thead>
          <tr>
            {cols.map((c, i) => (
              <th
                key={i}
                className="px-3 py-2 text-left text-sm text-muted-foreground"
              >
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td className="px-3 py-6 text-sm text-muted-foreground" colSpan={cols.length}>
                {empty}
              </td>
            </tr>
          ) : (
            rows.map((r, i) => (
              <tr key={i} className="border-t">
                {cols.map((c, j) => (
                  <td key={j} className={`px-3 py-2 text-sm ${c.className ?? ""}`}>
                    {c.render ? c.render(r) : (r as any)[c.key as string]}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
