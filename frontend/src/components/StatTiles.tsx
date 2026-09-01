interface Stat {
  label: string
  value: string
  hint?: string
}

export function StatTiles({ stats, loading }: { stats: Stat[]; loading: boolean }) {
  return (
    <div className="tiles">
      {stats.map((s) => (
        <div key={s.label} className="tile">
          <span className="tile__label">{s.label}</span>
          <strong className={`tile__value${loading ? ' skeleton-text' : ''}`}>{loading ? '' : s.value}</strong>
          {s.hint && <span className="tile__hint">{s.hint}</span>}
        </div>
      ))}
    </div>
  )
}
