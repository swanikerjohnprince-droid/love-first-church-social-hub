import { FormEvent, useEffect, useState } from 'react'
import { CheckCircle2, Circle, ExternalLink, Link2, LockKeyhole, RefreshCw, Unplug } from 'lucide-react'
import './settings.css'

type Integration={key:string;name:string;connection:string;account_name?:string|null}
const API=(import.meta.env.VITE_API_BASE_URL as string|undefined)?.replace(/\/$/,'')
const token=()=>sessionStorage.getItem('lfc_access_token')||''
const headers=()=>({Authorization:'Bearer '+token()})
const help:Record<string,string>={
 facebook:'Connect a Facebook Page you manage. Meta may request Page publishing permissions.',
 instagram:'Connect an Instagram Professional account linked to a Facebook Page.',
 tiktok:'Connect a TikTok account. Public posting may require TikTok app review and audit.',
 youtube:'Connect the Google account that manages your YouTube channel.',
 whatsapp_channels:'WhatsApp Channels has no generally available public publishing API; this remains assisted publishing.'
}
export default function SettingsPage(){
 const [items,setItems]=useState<Integration[]>([])
 const [botToken,setBotToken]=useState('')
 const [channelId,setChannelId]=useState('')
 const [busy,setBusy]=useState(false)
 const [loading,setLoading]=useState(true)
 const [notice,setNotice]=useState('')
 const [error,setError]=useState('')
 async function refresh(){
  if(!API){setLoading(false);return}
  setLoading(true)
  try{const r=await fetch(API+'/api/v1/integrations',{headers:headers()});const d=await r.json();if(!r.ok)throw new Error(d.detail||'Could not load integrations.');setItems(d.integrations||[])}
  catch(e){setError(e instanceof Error?e.message:'Could not load integrations.')}finally{setLoading(false)}
 }
 useEffect(()=>{
  const q=new URLSearchParams(window.location.search),status=q.get('oauth'),platform=q.get('platform')
  if(status){setNotice(status==='success'?platform+' connected successfully.':status==='denied'?platform+' authorization was cancelled.':status==='no_accounts'?'No eligible account was found.':platform+' connection did not complete. Check app setup and permissions.');window.history.replaceState({},'',window.location.pathname)}
  void refresh()
 },[])
 async function startOAuth(platform:string){
  setBusy(true);setError('');setNotice('')
  try{const r=await fetch(API+'/api/v1/integrations/'+platform+'/oauth/start',{method:'POST',headers:headers()});const d=await r.json();if(!r.ok)throw new Error(d.detail||'Could not start authorization.');window.location.assign(d.authorization_url)}
  catch(e){setError(e instanceof Error?e.message:'Could not start authorization.');setBusy(false)}
 }
 async function disconnect(platform:string){
  if(!window.confirm('Disconnect '+platform+' from this workspace?'))return
  setBusy(true);setError('')
  try{const r=await fetch(API+'/api/v1/integrations/'+platform,{method:'DELETE',headers:headers()});const d=await r.json();if(!r.ok)throw new Error(d.detail||'Could not disconnect.');setNotice(platform+' disconnected.');await refresh()}
  catch(e){setError(e instanceof Error?e.message:'Could not disconnect.')}finally{setBusy(false)}
 }
 async function connectTelegram(e:FormEvent){
  e.preventDefault();setBusy(true);setError('');setNotice('')
  try{const r=await fetch(API+'/api/v1/integrations/telegram/connect',{method:'POST',headers:{...headers(),'Content-Type':'application/json'},body:JSON.stringify({bot_token:botToken.trim(),channel_id:channelId.trim()})});const d=await r.json();if(!r.ok)throw new Error(d.detail||'Telegram connection failed.');setBotToken('');setChannelId('');setNotice(d.message||'Telegram connected.');await refresh()}
  catch(e){setError(e instanceof Error?e.message:'Telegram connection failed.')}finally{setBusy(false)}
 }
 const telegram=items.find(x=>x.key==='telegram')
 return <div className="settings-page">
  <section className="panel integration-intro"><div className="integration-lock"><LockKeyhole size={20}/></div><div><h2>Social account connections</h2><p>Authorize official platform accounts. Credentials are encrypted by the backend and never returned to the browser.</p></div><button className="refresh-integrations" onClick={()=>void refresh()} disabled={loading}><RefreshCw size={14}/> Refresh</button></section>
  {items.filter(x=>x.key!=='telegram').map(item=><section className="panel integration-card" key={item.key}>
   <div className="integration-card-head"><div className="integration-brand">{item.key==='facebook'?'f':item.key==='instagram'?'◎':item.key==='tiktok'?'♪':item.key==='youtube'?'▶':'◉'}</div><div className="integration-title"><h3>{item.name}</h3><p>{help[item.key]}</p></div><span className={item.connection==='connected'?'integration-status connected':'integration-status'}>{item.connection==='connected'?<CheckCircle2 size={13}/>:<Circle size={12}/>} {item.connection==='connected'?'Connected':item.connection==='manual_setup'?'Assisted publishing':'Not connected'}</span></div>
   {item.connection==='connected'?<div className="connected-details"><div><b>{item.account_name||item.name}</b><small>Account authorization saved securely</small></div><button className="disconnect-button" onClick={()=>void disconnect(item.key)} disabled={busy}><Unplug size={14}/> Disconnect</button></div>:item.key==='whatsapp_channels'?<div className="setup-note">{help[item.key]}</div>:<div className="oauth-action"><button className="connect-button" onClick={()=>void startOAuth(item.key)} disabled={busy||!API}><Link2 size={15}/> Connect {item.name}</button></div>}
  </section>)}
  <section className="panel integration-card">
   <div className="integration-card-head"><div className="integration-brand telegram-brand">✈</div><div className="integration-title"><h3>Telegram</h3><p>Connect a channel through the official Telegram Bot API.</p></div><span className={telegram?.connection==='connected'?'integration-status connected':'integration-status'}>{telegram?.connection==='connected'?<CheckCircle2 size={13}/>:<Circle size={12}/>} {telegram?.connection==='connected'?'Connected':'Not connected'}</span></div>
   {telegram?.connection==='connected'?<div className="connected-details"><div><b>{telegram.account_name||'Telegram channel'}</b><small>Bot administrator permission verified</small></div><button className="disconnect-button" onClick={()=>void disconnect('telegram')} disabled={busy}><Unplug size={14}/> Disconnect</button></div>:<form className="telegram-connect" onSubmit={connectTelegram}>
    <div className="setup-note"><b>Before connecting</b><ol><li>Create a bot with Telegram's BotFather.</li><li>Add it to your channel as an administrator with permission to post.</li><li>Enter the bot token and channel username or ID.</li></ol></div>
    <label>Bot API token<input type="password" autoComplete="off" value={botToken} onChange={e=>setBotToken(e.target.value)} required minLength={20}/><small>Sent only to the encrypted backend.</small></label>
    <label>Channel username or ID<input value={channelId} onChange={e=>setChannelId(e.target.value)} placeholder="@love_first_church" required/></label>
    <button className="connect-button" disabled={busy||!API}>{busy?'Verifying…':<><Link2 size={15}/> Connect Telegram</>}</button>
   </form>}
  </section>
  {notice&&<div className="integration-message success"><CheckCircle2 size={15}/>{notice}</div>}
  {error&&<div className="integration-message error" role="alert">{error}</div>}
  <p className="integration-footnote"><ExternalLink size={13}/> Account authorization is separate from actual publishing. Scheduled delivery and media publishing workers are a later milestone.</p>
 </div>
}
