import { useEffect, useState } from 'react'
import { Clock3, FileText, Plus, RefreshCw } from 'lucide-react'
import './queue.css'
type Variant={id:string;platform:string;caption:string}
type Post={id:string;status:string;scheduled_at:string|null;created_at:string;variants:Variant[]}
const names:Record<string,string>={facebook:'Facebook',instagram:'Instagram',tiktok:'TikTok',youtube:'YouTube',whatsapp_channels:'WhatsApp Channels',telegram:'Telegram'}
export default function PublishingQueue({onCreate}:{onCreate:()=>void}){
 const [posts,setPosts]=useState<Post[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState(''),[refresh,setRefresh]=useState(0)
 useEffect(()=>{
  const token=sessionStorage.getItem('lfc_access_token'),api=(import.meta.env.VITE_API_BASE_URL as string|undefined)?.replace(/\/$/,'')
  if(!token||!api){setError('Connect the deployed API to load saved posts.');setLoading(false);return}
  let active=true
  fetch(api+'/api/v1/posts',{headers:{Authorization:'Bearer '+token}})
   .then(async r=>{if(!r.ok)throw new Error('Could not load posts.');return r.json()})
   .then(data=>{if(active)setPosts(data)}).catch(e=>{if(active)setError(e instanceof Error?e.message:'Something went wrong.')})
   .finally(()=>{if(active)setLoading(false)})
  return ()=>{active=false}
 },[refresh])
 return <section className="queue-panel panel">
  <div className="queue-head"><div><span>CONTENT WORKFLOW</span><h2>Publishing queue</h2><p>Your saved drafts and scheduled content from the workspace.</p></div><button onClick={onCreate}><Plus size={15}/> New post</button></div>
  <div className="queue-toolbar"><b>{posts.length} {posts.length===1?'post':'posts'}</b><button onClick={()=>{setLoading(true);setError('');setRefresh(v=>v+1)}}><RefreshCw size={13}/> Refresh</button></div>
  {loading?<div className="queue-empty">Loading your posts…</div>:error?<div className="queue-empty queue-error">{error}</div>:posts.length===0?<div className="queue-empty"><FileText size={25}/><b>No posts yet</b><p>Create your first draft and it will appear here.</p><button onClick={onCreate}>Create a post</button></div>:posts.map(post=><article className="queue-item" key={post.id}><div className="queue-file"><FileText size={18}/></div><div className="queue-post-main"><b>{post.variants[0]?.caption?.slice(0,90)||'Untitled post'}{(post.variants[0]?.caption?.length||0)>90?'…':''}</b><small>{post.variants.map(v=>names[v.platform]||v.platform).join(' · ')}</small><small><Clock3 size={12}/> {post.scheduled_at?new Date(post.scheduled_at).toLocaleString():'Saved '+new Date(post.created_at).toLocaleDateString()}</small></div><span className={'queue-status '+post.status}>{post.status}</span></article>)}
 </section>
}
