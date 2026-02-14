import type { DataStore } from '../data'
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
    <>
      <section className="panel">
        <h2>Settings - Agent Management</h2>
        <form className="row gap-sm" onSubmit={onAddAgent}>
          <input
            value={newAgent}
            onChange={(e) => setNewAgent(e.target.value)}
            placeholder="Add agent name"
          />
          <button type="submit">Add Agent</button>
        </form>
        <div className="table-wrap">
          <table>
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
                  <td>{a.active ? 'Active' : 'Deactivated'}</td>
                  <td>{formatTimestamp(a.createdAt)}</td>
                  <td>
                    <button
                      onClick={() =>
                        setAgents((prev) =>
                          prev.map((x) => (x.id === a.id ? { ...x, active: !x.active } : x))
                        )
                      }
                    >
                      {a.active ? 'Deactivate' : 'Reactivate'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel">
        <h2>Export (CSV)</h2>
        <div className="row wrap gap-sm">
          {(Object.keys(exportFlags) as Array<keyof ExportFlags>).map((key) => (
            <label key={key} className="inline">
              <input
                type="checkbox"
                checked={exportFlags[key]}
                onChange={() => setExportFlags((prev) => ({ ...prev, [key]: !prev[key] }))}
              />
              {key}
            </label>
          ))}
          <button onClick={onRunExport}>Download CSV</button>
        </div>
      </section>
    </>
  )
}
