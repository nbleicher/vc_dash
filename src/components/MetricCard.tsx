export function MetricCard({ title, value }: { title: string; value: string | number }) {
  return (
    <div className="stat-card">
      <p>{title}</p>
      <strong>{value}</strong>
    </div>
  )
}
