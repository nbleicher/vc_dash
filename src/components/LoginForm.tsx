import { useState } from 'react'
import { Button, Card, Field, FieldLabel, Input } from './ui'

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
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md space-y-4">
        <div className="space-y-1 text-center">
          <h1>vc.jawnix.com</h1>
          <p className="text-sm text-slate-500">Management login (default: admin / admin)</p>
        </div>
        {error ? (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
            {error}
          </p>
        ) : null}
        <form className="space-y-3" onSubmit={handleSubmit}>
          <Field>
            <FieldLabel>Username</FieldLabel>
            <Input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="admin" />
          </Field>
          <Field>
            <FieldLabel>Password</FieldLabel>
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="admin" />
          </Field>
          <Button type="submit" variant="default" className="w-full">
            Sign In
          </Button>
        </form>
      </Card>
    </div>
  )
}
