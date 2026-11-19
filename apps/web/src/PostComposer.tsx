import { FormEvent, useState } from 'react'
import './composer.css'

const platforms=[
  {key:'facebook',label:'Facebook'},{key:'instagram',label:'Instagram'},
  {key:'tiktok',label:'TikTok'},{key:'youtube',label:'YouTube'},
  {key:'whatsapp_channels',label:'WhatsApp Channels'},{key:'telegram',label:'Telegram'},
]
export default function PostComposer({onDone}:{onDone:()=>void}) {
  const [caption,setCaption]=useState('')
  const [selected,setSelected]=useState<string[]>(['facebook','instagram'])
  const [busy,setBusy]=useState(false)
  const [message,setMessage]=useState('')
  const [saved,setSaved]=useState(false)
  function toggle(key:string){setSelected(old=>old.includes(key)?old.filter(x=>x!==key):[...old,key])}
  async function submit(e:FormEvent){
    e.preventDefault();setMessage('')
    const token=sessionStorage.getItem('lfc_access_token')
    const api=(import.meta.env.VITE_API_BASE_URL as string|undefined)?.replace(/\/$/,'')
    if(!token||!api){setMessage('Sign in through the connected workspace to save posts.');return}
    if(!selected.length){setMessage('Choose at least one platform.');return}
    setBusy(true)
    try{
      const response=await fetch(api+'/api/v1/posts',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify({status:'draft',variants:selected.map(platform=>({platform,caption}))})})
      const body=await response.json()
      if(!response.ok)throw new Error(body.detail||'Could not save this draft.')
      setSaved(true);setMessage('Your post has been saved as a draft.')
    }catch(err){setMessage(err instanceof Error?err.message:'Something went wrong.')}
    finally{setBusy(false)}
  }
  return <form className="composer panel" onSubmit={submit}>
    <div className="composer-heading"><div><span>CONTENT WORKFLOW</span><h2>Create a post</h2><p>Write your message and choose where it should appear. This saves a draft; it does not publish anything.</p></div><div className="draft-pill">Draft</div></div>
    <label className="composer-label">Publish to</label>
    <div className="platform-picker">{platforms.map(p=><button type="button" key={p.key} className={selected.includes(p.key)?'platform-choice chosen':'platform-choice'} onClick={()=>toggle(p.key)}><span>{selected.includes(p.key)?'✓':'+'}</span>{p.label}</button>)}</div>
    <label className="composer-label" htmlFor="post-caption">Post caption</label>
    <textarea id="post-caption" value={caption} onChange={e=>setCaption(e.target.value)} placeholder="What would you like to share with your church community?" maxLength={10000} required/>
    <div className="composer-meta"><span>{caption.length.toLocaleString()} / 10,000 characters</span><span>One caption copied to selected channels</span></div>
    {message&&<div className={saved?'composer-success':'composer-error'} role="status">{message}</div>}
    <div className="composer-actions"><button type="button" className="cancel" onClick={onDone}>Back to queue</button>{saved?<button type="button" className="save-draft" onClick={onDone}>View publishing queue</button>:<button className="save-draft" disabled={busy||!caption.trim()}>{busy?'Saving…':'Save draft'}</button>}</div>
  </form>
}
