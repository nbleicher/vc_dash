import type { WeeklyTarget } from '../types'
import { Button, Field, FieldLabel, Input } from './ui'

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
    <div className="space-y-3 border-t border-dashed border-slate-300 pt-4">
      <h3>Weekly Targets (set on Monday)</h3>
      <form key={formKey} className="form-grid" onSubmit={onSubmit}>
        <Field>
          <FieldLabel>Target Sales Count</FieldLabel>
          <Input name="targetSales" type="number" min={0} defaultValue={target?.targetSales ?? 0} />
        </Field>
        <Field>
          <FieldLabel>Target CPA</FieldLabel>
          <Input name="targetCpa" type="number" min={0} defaultValue={target?.targetCpa ?? 0} />
        </Field>
        <Button type="submit" variant="default" className="w-fit self-end">
          Save Target
        </Button>
      </form>
      <p className="text-sm text-slate-500">
        Current: Sales {target ? target.targetSales : 'N/A'} | CPA {target ? `$${target.targetCpa}` : 'N/A'}
      </p>
    </div>
  )
}
