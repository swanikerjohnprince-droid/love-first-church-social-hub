import { FormEvent, useEffect, useState } from 'react'
import App from './App'
import './auth.css'

type User = { id:string; email:string; full_name:string; workspace_id:string; role:string }
const API = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/,'')
export default function AuthGate() {
  const [token,setToken] = useState(()=>sessionStorage.getItem('lfc_access_token') || '')
  const [user,setUser] = useState<User|null>(null)
  const [loading,setLoading] = useState(Boolean(API && token))
  const [email,setEmail] = useState('')
  const [password,setPassword] = useState('')
  const [error,setError] = useState('')
  const [busy,setBusy] = useState(false)

  useEffect(()=>{
    if (!API || !token) { setLoading(false); return }
    let active=true
    fetch(API+'/api/v1/auth/me',{headers:{Authorization:'Bearer '+token}})
      .then(async r=>{if(!r.ok) throw new Error('Your session has expired. Please sign in again.'); return r.json()})
      .then(data=>{if(active)setUser(data)})
      .catch(e=>{sessionStorage.removeItem('lfc_access_token');if(active){setToken('');setError(e.message)}})
      .finally(()=>{if(active)setLoading(false)})
    return ()=>{active=false}
  },[token])

  async function submit(e:FormEvent) {
    e.preventDefault(); setError('')
    if(!API){setError('The API address has not been configured for this deployment.');return}
    setBusy(true)
    try {
      const response=await fetch(API+'/api/v1/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password})})
      const body=await response.json()
      if(!response.ok) throw new Error(body.detail || 'Unable to sign in. Check your details and try again.')
      sessionStorage.setItem('lfc_access_token',body.access_token);setToken(body.access_token)
      const me=await fetch(API+'/api/v1/auth/me',{headers:{Authorization:'Bearer '+body.access_token}})
      if(!me.ok) throw new Error('Signed in, but your workspace could not be loaded.')
      setUser(await me.json())
    } catch(err) {setError(err instanceof Error?err.message:'Something went wrong.')}
    finally {setBusy(false)}
  }

  if(!API) return <><div className="preview-banner">Preview environment · Demo dashboard · Sign-in becomes available when the API is deployed.</div><App/></>
  if(loading) return <div className="auth-loading">Loading your workspace…</div>
  if(token && user) return <App/>
  return <div className="auth-page"><div className="auth-card">
    <div className="auth-brand"><div className="auth-mark">LF</div><div><b>LFC Social Hub</b><small>LOVE FIRST CHURCH</small></div></div>
    <div className="auth-kicker">YOUR CHURCH, CONNECTED</div><h1>Welcome back.</h1><p>Sign in to manage your church's social channels and content.</p>
    <form onSubmit={submit}><label htmlFor="email">Email address</label><input id="email" type="email" autoComplete="username" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com"/><label htmlFor="password">Password</label><input id="password" type="password" autoComplete="current-password" required value={password} onChange={e=>setPassword(e.target.value)} placeholder="Your password"/>{error&&<div className="auth-error" role="alert">{error}</div>}<button disabled={busy}>{busy?'Signing in…':'Sign in to workspace'}</button></form>
    <small className="auth-foot">Access is managed by your Love First Church workspace administrator.</small>
  </div></div>
}
