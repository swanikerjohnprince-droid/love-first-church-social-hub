import { FormEvent, useEffect, useState } from 'react'
import { CheckCircle2, Circle, ExternalLink, Link2, LockKeyhole, RefreshCw, Unplug } from 'lucide-react'
import './settings.css'

type Integration = { key:string; name:string; connection:string; account_name?:string|null }
const API=(import.meta.env.VITE_API_BASE_URL as string|undefined)?.replace(/\/$/,'')
const token=()=>sessionStorage.getItem('lfc_access_token')||''
const headers=()=>({Authorization:'Bearer '+token()})

export default function SettingsPage(){
  const [items,setItems]=useState<Integration[]>([])
  const [botToken,setBotToken]=useState('')
  const [channelId,setChannelId]=useState('')
  const [busy,setBusy]=useState(false)
  const [loading,setLoading]=useState(true)
  const [notice,setNotice]=useState('')
  const [error,setError]=useState('')
  const telegram=items.find(x=>x.key==='telegram')
  async function refresh(){
    if(!API){setLoading(false);return}
    setLoading(true)
    try{
      const response=await fetch(API+'/api/v1/integrations',{headers:headers()})
      const data=await response.json()
      if(!response.ok)throw new Error(data.detail||'Could not load integrations.')
      setItems(data.integrations||[])
    }catch(e){setError(e instanceof Error?e.message:'Could not load integrations.')}
    finally{setLoading(false)}
  }
  useEffect(()=>{void refresh()},[])
  async function connect(e:FormEvent){
    e.preventDefault();setBusy(true);setError('');setNotice('')
    try{
      const response=await fetch(API+'/api/v1/integrations/telegram/connect',{method:'POST',headers:{...headers(),'Content-Type':'application/json'},body:JSON.stringify({bot_token:botToken.trim(),channel_id:channelId.trim()})})
      const data=await response.json()
      if(!response.ok)throw new Error(data.detail||'Telegram connection failed.')
      setBotToken('');setChannelId('');setNotice(data.message||'Telegram connected.');await refresh()
    }catch(e){setError(e instanceof Error?e.message:'Telegram connection failed.')}
    finally{setBusy(false)}
  }
  async function disconnect(){
    if(!window.confirm('Disconnect the Telegram channel from this workspace?'))return
    setBusy(true);setError('');setNotice('')
    try{
      const response=await fetch(API+'/api/v1/integrations/telegram',{method:'DELETE',headers:headers()})
      const data=await response.json()
      if(!response.ok)throw new Error(data.detail||'Could not disconnect Telegram.')
      setNotice('Telegram has been disconnected.');await refresh()
    }catch(e){setError(e instanceof Error?e.message:'Could not disconnect Telegram.')}
    finally{setBusy(false)}
  }
  const others=items.filter(x=>x.key!=='telegram')
  return <div className="settings-page">
    <section className="panel integration-intro"><div className="integration-lock"><LockKeyhole size={20}/></div><div><h2>Social account connections</h2><p>Connect official platform accounts to prepare direct publishing. Credentials are handled by the backend and are never sent to the browser after saving.</p></div><button className="refresh-integrations" onClick={()=>void refresh()} disabled={loading}><RefreshCw size={14}/> Refresh</button></section>
    <section className="panel integration-card">
      <div className="integration-card-head"><div className="integration-brand telegram-brand">✈</div><div className="integration-title"><h3>Telegram</h3><p>Publish messages to a channel through the official Telegram Bot API.</p></div><span className={telegram?.connection==='connected'?'integration-status connected':'integration-status'}>{telegram?.connection==='connected'?<CheckCircle2 size={13}/>:<Circle size={12}/>} {telegram?.connection==='connected'?'Connected':'Not connected'}</span></div>
      {telegram?.connection==='connected'?<div className="connected-details"><div><b>{telegram.account_name||'Telegram channel'}</b><small>Bot access verified · channel administrator permission confirmed</small></div><button className="disconnect-button" onClick={disconnect} disabled={busy}><Unplug size={14}/> Disconnect</button></div>:<form className="telegram-connect" onSubmit={connect}>
        <div className="setup-note"><b>Before connecting</b><ol><li>Create a bot using Telegram's official BotFather and copy its API token.</li><li>Add the bot to your church's Telegram channel as an administrator.</li><li>Enable permission to post messages, then enter the channel username (for example, @yourchannel).</li></ol></div>
        <label>Bot API token<input type="password" autoComplete="off" value={botToken} onChange={e=>setBotToken(e.target.value)} placeholder="Paste your bot token" required minLength={20}/><small>Only sent to your encrypted backend connection endpoint. Never paste it into a public issue or chat.</small></label>
        <label>Channel username or ID<input value={channelId} onChange={e=>setChannelId(e.target.value)} placeholder="@love_first_church" required/></label>
        <button className="connect-button" disabled={busy||!API}>{busy?'Verifying connection…':<><Link2 size={15}/> Connect Telegram channel</>}</button>
      </form>}
    </section>
    <section className="panel upcoming-integrations"><div className="panel-head"><div><h2>Other platforms</h2><p>Official OAuth integrations will be enabled as each developer app is configured.</p></div></div>
      {others.map(item=><div className="other-integration" key={item.key}><div><b>{item.name}</b><small>{item.key==='whatsapp_channels'?'No generally available official public Channels publishing API is currently supported.':'OAuth app credentials and platform approval are required before connecting.'}</small></div><span>{item.connection==='connected'?'Connected':item.connection==='manual_setup'?'Manual workflow':'Setup pending'}</span></div>)}
    </section>
    {notice&&<div className="integration-message success"><CheckCircle2 size={15}/>{notice}</div>}
    {error&&<div className="integration-message error" role="alert">{error}</div>}
    <p className="integration-footnote"><ExternalLink size={13}/> Direct publishing is being enabled platform by platform. Saving a post or schedule does not publish it until its integration is active.</p>
  </div>
}
