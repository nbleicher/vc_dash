import type { DataStore } from '../data'
import { Badge, Button, Card, CardTitle, DataTable, Field, FieldLabel, Input, TableWrap } from '../components'
import type { ExportFlags } from '../types'
import { formatTimestamp } from '../utils'

type Props = {
  agents: DataStore['agents']
  setAgents: DataStore['setAgents']
  newAgent: string
  setNewAgent: (s: string) => void
  exportFlags: ExportFlags
  setExportFlags: React.Dispatch<React.SetStateAction<ExportFlags>>
  onAddAgent: (e: React.FormEvent) => void
  onRunExport: () => void
}

export function SettingsPage({
  agents,
  setAgents,
  newAgent,
  setNewAgent,
  exportFlags,
  setExportFlags,
  onAddAgent,
  onRunExport,
}: Props) {
  return (
    <div className="page-grid">
      <Card className="space-y-4">
        <CardTitle>Settings - Agent Management</CardTitle>
        <form className="row-wrap" onSubmit={onAddAgent}>
          <Field className="min-w-[280px]">
            <FieldLabel>Add Agent</FieldLabel>
            <Input
            value={newAgent}
            onChange={(e) => setNewAgent(e.target.value)}
            placeholder="Add agent name"
            />
          </Field>
          <Button type="submit" variant="default" className="mt-5">
            Add Agent
          </Button>
        </form>
        <TableWrap>
          <DataTable>
            <thead>
              <tr>
                <th>Agent</th>
                <th>Status</th>
                <th>Created</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {agents.length === 0 && (
                <tr>
                  <td colSpan={4}>N/A - add your first agent.</td>
                </tr>
              )}
              {agents.map((a) => (
                <tr key={a.id}>
                  <td>{a.name}</td>
                  <td>{a.active ? <Badge variant="success">On Track</Badge> : <Badge variant="warning">Needs Review</Badge>}</td>
                  <td>{formatTimestamp(a.createdAt)}</td>
                  <td>
                    <Button
                      variant={a.active ? 'danger' : 'secondary'}
                      onClick={() =>
                        setAgents((prev) =>
                          prev.map((x) => (x.id === a.id ? { ...x, active: !x.active } : x))
                        )
                      }
                    >
                      {a.active ? 'Deactivate' : 'Reactivate'}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </DataTable>
        </TableWrap>
      </Card>

      <Card className="space-y-4">
        <CardTitle>Export (CSV)</CardTitle>
        <div className="row-wrap">
          {(Object.keys(exportFlags) as Array<keyof ExportFlags>).map((key) => (
            <label key={key} className="flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
              <input
                type="checkbox"
                checked={exportFlags[key]}
                onChange={() => setExportFlags((prev) => ({ ...prev, [key]: !prev[key] }))}
              />
              {key}
            </label>
          ))}
          <Button onClick={onRunExport} variant="default">
            Download CSV
          </Button>
        </div>
      </Card>
    </div>
  )
}
