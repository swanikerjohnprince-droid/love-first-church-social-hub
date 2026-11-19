import { ChangeEvent, FormEvent, useState } from 'react'
import { ImagePlus, Film, X, Clock3, Settings2, UploadCloud } from 'lucide-react'
import './composer.css'

const platforms = [
  { key:'facebook', label:'Facebook', formats:['Feed post','Reel','Story'] },
  { key:'instagram', label:'Instagram', formats:['Feed post','Carousel','Reel','Story'] },
  { key:'tiktok', label:'TikTok', formats:['Video','Photo post'] },
  { key:'youtube', label:'YouTube', formats:['Video','Short'] },
  { key:'whatsapp_channels', label:'WhatsApp Channels', formats:['Text','Photo','Video'] },
  { key:'telegram', label:'Telegram', formats:['Message','Photo album','Video'] },
] as const
type PlatformKey = typeof platforms[number]['key']
type UploadedMedia = { id:string; name:string; mime_type:string; size_bytes:number; preview:string }
type Field = { key:string; label:string; type:'text'|'select'|'checkbox'; options?:string[]; placeholder?:string }
const fields:Record<PlatformKey,Field[]> = {
  facebook:[
    {key:'format',label:'Post format',type:'select',options:['Feed post','Reel','Story']},
    {key:'link',label:'Link attachment',type:'text',placeholder:'https://…'},
    {key:'first_comment',label:'First comment',type:'text',placeholder:'Optional first comment'},
    {key:'share_to_story',label:'Also share to Story',type:'checkbox'},
  ],
  instagram:[
    {key:'format',label:'Post format',type:'select',options:['Feed post','Carousel','Reel','Story']},
    {key:'alt_text',label:'Accessibility alt text',type:'text',placeholder:'Describe the image for screen readers'},
    {key:'location',label:'Location',type:'text',placeholder:'Add a location'},
    {key:'first_comment',label:'First comment',type:'text',placeholder:'Optional first comment / hashtags'},
    {key:'share_to_facebook',label:'Also share to connected Facebook account',type:'checkbox'},
  ],
  tiktok:[
    {key:'format',label:'Post format',type:'select',options:['Video','Photo post']},
    {key:'privacy_level',label:'Who can view',type:'select',options:['Public','Friends','Only you']},
    {key:'cover_timestamp',label:'Cover frame timestamp (seconds)',type:'text',placeholder:'0'},
    {key:'allow_comments',label:'Allow comments',type:'checkbox'},
    {key:'allow_duet',label:'Allow Duet',type:'checkbox'},
    {key:'allow_stitch',label:'Allow Stitch',type:'checkbox'},
    {key:'commercial_content',label:'Disclose promotional content',type:'checkbox'},
  ],
  youtube:[
    {key:'format',label:'Video format',type:'select',options:['Video','Short']},
    {key:'title',label:'Video title',type:'text',placeholder:'Title shown on YouTube'},
    {key:'description',label:'Description',type:'text',placeholder:'Video description'},
    {key:'visibility',label:'Visibility',type:'select',options:['Private','Unlisted','Public']},
    {key:'category',label:'Category',type:'select',options:['People & Blogs','Education','Nonprofits & Activism','Entertainment','Music']},
    {key:'tags',label:'Tags (comma separated)',type:'text',placeholder:'church, worship, faith'},
    {key:'playlist',label:'Playlist',type:'text',placeholder:'Optional playlist name'},
    {key:'made_for_kids',label:'Made for kids',type:'checkbox'},
  ],
  whatsapp_channels:[
    {key:'format',label:'Message type',type:'select',options:['Text','Photo','Video']},
    {key:'link',label:'Link',type:'text',placeholder:'Optional link to include'},
  ],
  telegram:[
    {key:'format',label:'Message type',type:'select',options:['Message','Photo album','Video']},
    {key:'parse_mode',label:'Text formatting',type:'select',options:['Plain text','Markdown','HTML']},
    {key:'silent',label:'Send silently',type:'checkbox'},
    {key:'protect_content',label:'Restrict forwarding and saving',type:'checkbox'},
    {key:'disable_link_preview',label:'Disable link previews',type:'checkbox'},
  ],
}
const defaults:Record<PlatformKey,Record<string,string|boolean>> = {
  facebook:{format:'Feed post'},
  instagram:{format:'Feed post'},
  tiktok:{format:'Video',privacy_level:'Public',allow_comments:true,allow_duet:true,allow_stitch:true},
  youtube:{format:'Video',visibility:'Public',category:'People & Blogs',made_for_kids:false},
  whatsapp_channels:{format:'Text'},
  telegram:{format:'Message',parse_mode:'Plain text',silent:false,protect_content:false,disable_link_preview:false},
}
const humanSize=(n:number)=>n<1024*1024?Math.round(n/1024)+' KB':(n/1024/1024).toFixed(1)+' MB'

export default function PostComposer({onDone}:{onDone:()=>void}) {
  const [caption,setCaption]=useState('')
  const [captions,setCaptions]=useState<Partial<Record<PlatformKey,string>>>({})
  const [selected,setSelected]=useState<PlatformKey[]>(['facebook','instagram'])
  const [active,setActive]=useState<PlatformKey>('facebook')
  const [options,setOptions]=useState<Record<PlatformKey,Record<string,string|boolean>>>(defaults)
  const [media,setMedia]=useState<UploadedMedia[]>([])
  const [busy,setBusy]=useState(false)
  const [uploading,setUploading]=useState(false)
  const [message,setMessage]=useState('')
  const [saved,setSaved]=useState(false)
  const [schedule,setSchedule]=useState(false)
  const [scheduledAt,setScheduledAt]=useState('')
  const api=(import.meta.env.VITE_API_BASE_URL as string|undefined)?.replace(/\/$/,'')
  const token=sessionStorage.getItem('lfc_access_token')
  function toggle(key:PlatformKey){
    setSelected(old=>{
      const next=old.includes(key)?old.filter(x=>x!==key):[...old,key]
      if(next.length && !next.includes(active))setActive(next[0])
      return next
    })
  }
  function setOption(key:string,value:string|boolean){
    setOptions(old=>({...old,[active]:{...old[active],[key]:value}}))
  }
  async function addFiles(e:ChangeEvent<HTMLInputElement>){
    const files=Array.from(e.target.files||[])
    e.target.value=''
    if(!files.length)return
    if(!api||!token){setMessage('Connect the backend before uploading media.');return}
    setUploading(true);setMessage('')
    try{
      const uploaded:UploadedMedia[]=[]
      for(const file of files){
        if(file.size>100*1024*1024)throw new Error(file.name+' is larger than the 100 MB upload limit.')
        const body=new FormData();body.append('file',file)
        const response=await fetch(api+'/api/v1/media',{method:'POST',headers:{Authorization:'Bearer '+token},body})
        const result=await response.json()
        if(!response.ok)throw new Error(result.detail||'Could not upload '+file.name)
        uploaded.push({...result,preview:URL.createObjectURL(file)})
      }
      setMedia(old=>[...old,...uploaded])
    }catch(err){setMessage(err instanceof Error?err.message:'Media upload failed.')}
    finally{setUploading(false)}
  }
  function removeMedia(id:string){
    setMedia(old=>{const item=old.find(x=>x.id===id);if(item)URL.revokeObjectURL(item.preview);return old.filter(x=>x.id!==id)})
  }
  async function submit(e:FormEvent){
    e.preventDefault();setMessage('')
    if(!token||!api){setMessage('Sign in through the connected workspace to save posts.');return}
    if(!selected.length){setMessage('Choose at least one platform.');return}
    if(schedule&&!scheduledAt){setMessage('Choose a date and time for your scheduled post.');return}
    if(schedule&&new Date(scheduledAt).getTime()<=Date.now()){setMessage('Choose a future date and time.');return}
    setBusy(true)
    try{
      const response=await fetch(api+'/api/v1/posts',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify({
        status:schedule?'scheduled':'draft',
        scheduled_at:schedule?new Date(scheduledAt).toISOString():null,
        variants:selected.map(platform=>({platform,caption:captions[platform]??caption,media_asset_ids:media.map(item=>item.id),options:options[platform]}))
      })})
      const body=await response.json()
      if(!response.ok)throw new Error(body.detail||'Could not save this post.')
      setSaved(true);setMessage(schedule?'Your post and scheduled time have been saved. Automatic publishing is not active yet.':'Your post has been saved as a draft.')
    }catch(err){setMessage(err instanceof Error?err.message:'Something went wrong.')}
    finally{setBusy(false)}
  }
  return <form className="composer panel" onSubmit={submit}>
    <div className="composer-heading"><div><span>CONTENT WORKFLOW</span><h2>Create a post</h2><p>Prepare one post, tailor it for each channel, attach media and save it as a draft or schedule it.</p></div><div className="draft-pill">{schedule?'Scheduled':'Draft'}</div></div>
    <label className="composer-label">Publish to</label>
    <div className="platform-picker">{platforms.map(p=><button type="button" key={p.key} className={selected.includes(p.key)?'platform-choice chosen':'platform-choice'} onClick={()=>toggle(p.key)}><span>{selected.includes(p.key)?'✓':'+'}</span>{p.label}</button>)}</div>
    <div className="composer-section-head"><label className="composer-label">Media attachments</label><small>Images and videos · up to 100 MB each</small></div>
    <label className="media-drop">
      <input type="file" accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/quicktime" multiple onChange={addFiles}/>
      <UploadCloud size={22}/><b>{uploading?'Uploading media…':'Drop images or videos here, or browse'}</b><small>JPG, PNG, WebP, GIF, MP4 and MOV</small>
    </label>
    {media.length>0&&<div className="media-grid">{media.map(item=><div className="media-item" key={item.id}>{item.mime_type.startsWith('video/')?<video src={item.preview} controls/>:<img src={item.preview} alt={item.name}/>}<button type="button" onClick={()=>removeMedia(item.id)} aria-label={'Remove '+item.name}><X size={14}/></button><div><b>{item.name}</b><small>{humanSize(item.size_bytes)}</small></div></div>)}</div>}
    <label className="composer-label" htmlFor="post-caption">Main caption</label>
    <textarea id="post-caption" value={caption} onChange={e=>setCaption(e.target.value)} placeholder="What would you like to share with your church community?" maxLength={10000}/>
    <div className="composer-meta"><span>{caption.length.toLocaleString()} / 10,000 characters</span><span>Use platform tabs below to customise each version</span></div>
    <div className="platform-editor">
      <div className="platform-tabs">{selected.map(key=><button type="button" key={key} className={active===key?'active':''} onClick={()=>setActive(key)}>{platforms.find(p=>p.key===key)?.label}</button>)}</div>
      {selected.length>0?<div className="platform-settings">
        <div className="settings-title"><Settings2 size={15}/><b>{platforms.find(p=>p.key===active)?.label} settings</b><small>Options depend on the platform's publishing API.</small></div>
        <label className="composer-label">Platform caption</label>
        <textarea value={captions[active]??caption} onChange={e=>setCaptions(old=>({...old,[active]:e.target.value}))} placeholder="Customise this platform's caption…" maxLength={10000}/>
        <div className="option-grid">{fields[active].map(field=><label className={field.type==='checkbox'?'option-check':'option-field'} key={field.key}>{field.type==='checkbox'?<><input type="checkbox" checked={Boolean(options[active][field.key])} onChange={e=>setOption(field.key,e.target.checked)}/>{field.label}</>:<>{field.label}{field.type==='select'?<select value={String(options[active][field.key]??field.options?.[0]??'')} onChange={e=>setOption(field.key,e.target.value)}>{field.options?.map(value=><option key={value}>{value}</option>)}</select>:<input value={String(options[active][field.key]??'')} placeholder={field.placeholder} onChange={e=>setOption(field.key,e.target.value)}/>}</>}</label>)}</div>
        {active==='youtube'&&<p className="api-note">YouTube-specific metadata is stored with this draft. Thumbnail upload and playlist selection will be completed when YouTube account publishing is connected.</p>}
      </div>:<p className="api-note">Choose one or more platforms to configure their individual post settings.</p>}
    </div>
    <div className="schedule-box"><label className="option-check"><input type="checkbox" checked={schedule} onChange={e=>setSchedule(e.target.checked)}/><Clock3 size={15}/> Schedule this post</label>{schedule&&<label className="schedule-date">Date and time<input type="datetime-local" value={scheduledAt} onChange={e=>setScheduledAt(e.target.value)}/><small>Uses your workspace timezone (Africa/Accra). This saves the schedule only; automatic publishing will be enabled after the channel integrations are connected.</small></label>}</div>
    {message&&<div className={saved?'composer-success':'composer-error'} role="status">{message}</div>}
    <div className="composer-actions"><button type="button" className="cancel" onClick={onDone}>Back to queue</button>{saved?<button type="button" className="save-draft" onClick={onDone}>View publishing queue</button>:<button className="save-draft" disabled={busy||uploading||(!caption.trim()&&!media.length)}>{busy?'Saving…':schedule?'Save scheduled post':'Save draft'}</button>}</div>
    <p className="api-note footer-note"><ImagePlus size={13}/> Media is uploaded to the configured backend. Direct publishing is not active until each social account's official API connection is configured.</p>
  </form>
}
