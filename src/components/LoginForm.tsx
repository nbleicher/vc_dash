import { useState } from 'react'

type Props = {
  onLogin: (username: string, password: string) => Promise<void> | void
  error?: string | null
}

export function LoginForm({ onLogin, error }: Props) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')

  const handleSubmit = (e: React.FormEvent): void => {
    e.preventDefault()
    void onLogin(username, password)
  }

  return (
    <div className="auth-shell">
      <form className="panel auth-panel" onSubmit={handleSubmit}>
        <h1>vc.jawnix.com</h1>
        <p className="muted">Management login (default: admin / admin)</p>
        {error ? <p className="muted" role="alert">{error}</p> : null}
        <label>
          Username
          <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="admin" />
        </label>
        <label>
          Password
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="admin" />
        </label>
        <button type="submit">Sign In</button>
      </form>
    </div>
  )
}
