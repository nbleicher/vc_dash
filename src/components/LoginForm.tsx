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
        <h1 className="auth-title">vc.jawnix.com</h1>
        <p className="muted auth-subtitle">Management login (default: admin / admin)</p>
        {error ? (
          <p className="auth-error" role="alert">
            {error}
          </p>
        ) : null}
        <div className="form-grid auth-fields">
          <label>
            Username
            <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="admin" />
          </label>
          <label>
            Password
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="admin" />
          </label>
        </div>
        <button type="submit" className="auth-submit">
          Sign In
        </button>
      </form>
    </div>
  )
}
