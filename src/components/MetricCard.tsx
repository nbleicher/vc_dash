export function MetricCard({ title, value }: { title: string; value: string | number }) {
  return (
    <div className="stat-card">
      <p className="metric-title">{title}</p>
      <strong className="metric-value">{value}</strong>
    </div>
  )
}
