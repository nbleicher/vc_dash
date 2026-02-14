import type { WeeklyTarget } from '../types'

type Props = {
  target: WeeklyTarget | null
  onSave: (sales: number, cpa: number) => void
}

export function WeeklyTargetEditor({ target, onSave }: Props) {
  const formKey = `${target?.weekKey ?? 'no-target'}_${target?.setAt ?? 'none'}`
  const onSubmit = (e: React.FormEvent<HTMLFormElement>): void => {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    const sales = Number(form.get('targetSales') ?? 0)
    const cpa = Number(form.get('targetCpa') ?? 0)
    onSave(Number.isFinite(sales) ? sales : 0, Number.isFinite(cpa) ? cpa : 0)
  }
  return (
    <div className="target-box">
      <h3>Weekly Targets (set on Monday)</h3>
      <form key={formKey} className="row gap-sm" onSubmit={onSubmit}>
        <label>Target Sales Count<input name="targetSales" type="number" min={0} defaultValue={target?.targetSales ?? 0} /></label>
        <label>Target CPA<input name="targetCpa" type="number" min={0} defaultValue={target?.targetCpa ?? 0} /></label>
        <button type="submit">Save Target</button>
      </form>
      <p className="muted">Current: Sales {target ? target.targetSales : 'N/A'} | CPA {target ? `$${target.targetCpa}` : 'N/A'}</p>
    </div>
  )
}
