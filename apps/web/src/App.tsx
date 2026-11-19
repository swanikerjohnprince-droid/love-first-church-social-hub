import { useEffect, useState } from 'react'
import { Activity, Bell, CalendarDays, Check, ChevronDown, ChevronRight, CircleHelp, Clock3, FileImage, Home, Instagram, LayoutDashboard, ListChecks, Menu, MessageCircle, MoreHorizontal, Plus, Search, Send, Settings, ShieldCheck, Sparkles, Users, Youtube, Facebook, Music2, Megaphone, ChartNoAxesCombined } from 'lucide-react'

type Page = 'Overview' | 'Calendar' | 'Create post' | 'Publishing queue' | 'Approvals' | 'Media library' | 'Campaigns' | 'Analytics' | 'Team' | 'Settings'
const nav: { label: Page; icon: typeof Home; group: string }[] = [
  { label: 'Overview', icon: Home, group: 'WORKSPACE' },
  { label: 'Calendar', icon: CalendarDays, group: 'PUBLISH' },
  { label: 'Create post', icon: Plus, group: 'PUBLISH' },
  { label: 'Publishing queue', icon: Send, group: 'PUBLISH' },
  { label: 'Approvals', icon: ListChecks, group: 'PUBLISH' },
  { label: 'Media library', icon: FileImage, group: 'CONTENT' },
  { label: 'Campaigns', icon: Megaphone, group: 'CONTENT' },
  { label: 'Analytics', icon: ChartNoAxesCombined, group: 'INSIGHTS' },
  { label: 'Team', icon: Users, group: 'ADMINISTRATION' },
  { label: 'Settings', icon: Settings, group: 'ADMINISTRATION' },
]
const channels = [
  { name: 'Facebook', sub: 'Page publishing', icon: Facebook, color: '#78a7ff', mode: 'Connect' },
  { name: 'Instagram', sub: 'Professional account', icon: Instagram, color: '#e69ac7', mode: 'Connect' },
  { name: 'TikTok', sub: 'Video publishing', icon: Music2, color: '#d8e0e2', mode: 'Connect' },
  { name: 'YouTube', sub: 'Videos and Shorts', icon: Youtube, color: '#ff7777', mode: 'Connect' },
  { name: 'WhatsApp Channels', sub: 'Assisted publishing', icon: MessageCircle, color: '#70d6a0', mode: 'Set up' },
  { name: 'Telegram', sub: 'Channel publishing', icon: Send, color: '#79c9e8', mode: 'Connect' },
]
const upcoming = [
  { date: '20', month: 'NOV', title: 'A moment from Sunday', channels: 'Instagram · TikTok', time: '12:30 PM', status: 'Needs approval', tone: 'amber' },
  { date: '21', month: 'NOV', title: 'Weekend service invitation', channels: 'All channels', time: '6:00 PM', status: 'Draft', tone: 'slate' },
  { date: '23', month: 'NOV', title: 'A word to carry into the week', channels: 'Facebook · Telegram', time: '9:00 AM', status: 'Scheduled', tone: 'green' },
]
const descriptions: Record<Page,string> = {
  'Overview': 'Here is what is happening across Love First Church social channels.',
  'Calendar': 'Plan, organise and manage upcoming church content.',
  'Create post': 'Prepare content once and tailor it for every channel.',
  'Publishing queue': 'Review scheduled content and publishing status.',
  'Approvals': 'Review content and keep publishing workflows on track.',
  'Media library': 'Your shared home for church photos, videos and designs.',
  'Campaigns': 'Bring event announcements and themed content together.',
  'Analytics': 'Understand how your church content is performing.',
  'Team': 'Manage the people who help run your church channels.',
  'Settings': 'Configure your workspace, accounts and preferences.',
}
type WorkspaceData = { name:string; timezone:string; platforms:{key:string;name:string;connection:string}[] }
export default function App() {
  const [workspace,setWorkspace] = useState<WorkspaceData|null>(null)
  useEffect(()=>{
    const token=sessionStorage.getItem('lfc_access_token')
    const api=(import.meta.env.VITE_API_BASE_URL as string|undefined)?.replace(/\/$/,'')
    if(!token || !api) return
    fetch(api+'/api/v1/workspace',{headers:{Authorization:'Bearer '+token}})
      .then(async response=>{if(!response.ok) throw new Error('Workspace request failed');return response.json()})
      .then(data=>setWorkspace(data))
      .catch(()=>{})
  },[])
  const [page,setPage] = useState<Page>('Overview')
  const [menu,setMenu] = useState(false)
  const [toast,setToast] = useState('')
  const [search,setSearch] = useState('')
  const notify = (s:string) => { setToast(s); window.setTimeout(()=>setToast(''),2600) }
  const filtered = nav.filter(n=>n.label.toLowerCase().includes(search.toLowerCase()))
  return <div className="shell">
    {menu && <button className="scrim" onClick={()=>setMenu(false)} aria-label="Close menu" />}
    <aside className={menu?'sidebar open':'sidebar'}>
      <div className="brand"><div className="brand-icon"><Sparkles size={19}/></div><div><b>LFC Social Hub</b><small>LOVE FIRST CHURCH</small></div></div>
      <button className="workspace"><div className="church-mark">LF</div><div><b>{workspace?.name || 'Love First Church'}</b><small>Church workspace</small></div><ChevronDown size={15}/></button>
      <div className="search"><Search size={15}/><input placeholder="Find a page..." value={search} onChange={e=>setSearch(e.target.value)}/></div>
      <nav>{['WORKSPACE','PUBLISH','CONTENT','INSIGHTS','ADMINISTRATION'].map(group=><section key={group}><label>{group}</label>{filtered.filter(n=>n.group===group).map(n=>{const I=n.icon;return <button key={n.label} className={page===n.label?'nav active':'nav'} onClick={()=>{setPage(n.label);setMenu(false)}}><I size={17}/>{n.label}{n.label==='Approvals'&&<i>2</i>}</button>})}</section>)}</nav>
      <div className="side-bottom"><div className="help"><CircleHelp size={17}/><div><b>Need a hand?</b><small>Help centre</small></div></div><div className="user"><div className="avatar">LF</div><div><b>Workspace owner</b><small>Administrator</small></div><MoreHorizontal size={18}/></div></div>
    </aside>
    <main>
      <header><div className="crumb"><button className="hamb" onClick={()=>setMenu(true)}><Menu size={19}/></button>Workspace <ChevronRight size={14}/><b>{page}</b></div><div className="head-actions"><span className="online"><i/> All systems operational</span><button className="bell" onClick={()=>notify('You are all caught up.')}><Bell size={18}/></button><div className="avatar">LF</div></div></header>
      <div className="content">
        <div className="intro"><div><div className="eyebrow"><i/> LOVE FIRST CHURCH · SOCIAL WORKSPACE</div><h1>{page==='Overview'?'Good evening.':page}</h1><p>{descriptions[page]}</p></div><button className="primary" onClick={()=>setPage('Create post')}><Plus size={17}/> Create a post</button></div>
        {page==='Overview'?<>
          <div className="stats">
            <Stat title="Scheduled posts" value="08" note="Across your channels" icon={CalendarDays} color="purple"/>
            <Stat title="Awaiting approval" value="02" note="Needs your attention" icon={ShieldCheck} color="amber"/>
            <Stat title="Published this month" value="24" note="Since November 1" icon={Send} color="green"/>
            <Stat title="Connected accounts" value={workspace ? `${workspace.platforms.filter(p=>p.connection==="connected").length} / 6` : "0 / 6"} note={workspace ? "Live workspace connections" : "Connect your channels"} icon={Activity} color="blue"/>
          </div>
          <div className="columns">
            <section className="panel calendar"><div className="panel-head"><div><h2>Content calendar</h2><p>Your publishing schedule at a glance</p></div><button className="link" onClick={()=>setPage('Calendar')}>Full calendar ↗</button></div><div className="month">November 2026 <span>‹　Today　›</span></div><div className="days">{['SUN','MON','TUE','WED','THU','FRI','SAT'].map(d=><b key={d}>{d}</b>)}{Array.from({length:35},(_,i)=>{const d=i-5;const n=d<=0?31+d:d>30?d-30:d;return <button key={i} className={(d===19?'today ':'')+([19,20,21,23,25,28].includes(d)?'marked':'')}>{n}</button>})}</div><div className="legend"><span><i/> Scheduled</span><span><i/> Needs approval</span><span><i/> Draft</span></div></section>
            <section className="panel accounts"><div className="panel-head"><div><h2>Social accounts</h2><p>Your publishing destinations</p></div><button className="dots"><Settings size={16}/></button></div>{channels.map(c=>{const I=c.icon;const state=workspace?.platforms.find(p=>p.name===c.name)?.connection;return <div className="channel" key={c.name}><div className="channel-icon" style={{color:c.color}}><I size={18}/></div><div className="channel-name"><b>{c.name}</b><small>{state==='connected'?'Connected':state==='manual_setup'?'Assisted setup':c.sub}</small></div><button onClick={()=>notify(state==='connected'?c.name+' is connected.':c.name+' integration will be configured in the integrations milestone.')}>{state==='connected'?'Connected':c.mode} ↗</button></div>})}<button className="manage" onClick={()=>setPage('Settings')}>Manage integrations ↗</button></section>
          </div>
          <div className="columns lower"><section className="panel"><div className="panel-head"><div><h2>Coming up next</h2><p>Keep an eye on what's going out</p></div><button className="link" onClick={()=>setPage('Publishing queue')}>View queue ↗</button></div>{upcoming.map(p=><div className="post" key={p.title}><div className="date"><b>{p.date}</b><small>{p.month}</small></div><div className="post-info"><b>{p.title}</b><small>{p.channels}</small><small className="time"><Clock3 size={12}/> {p.time}</small></div><span className={'status '+p.tone}>{p.status}</span></div>)}</section><section className="panel activity"><div className="panel-head"><div><h2>Team activity</h2><p>Recent workspace updates</p></div><MoreHorizontal size={17}/></div><div className="empty"><div><Activity size={22}/></div><b>Your team's activity will appear here</b><p>When your team creates, reviews or publishes content, you'll see it here.</p></div></section></div>
          <div className="footnote"><Sparkles size={14}/> Your workspace is ready. Connect a social account to begin.</div>
        </>:<section className="panel coming"><div className="coming-icon"><LayoutDashboard size={26}/></div><h2>{page} is in the next build milestone</h2><p>The application shell and navigation are working. This module will be implemented with its real data and workflows in the upcoming milestones.</p><button onClick={()=>setPage('Overview')}>Back to overview</button></section>}
      </div>
    </main>
    {toast&&<div className="toast"><Check size={16}/>{toast}</div>}
  </div>
}
function Stat({title,value,note,icon:Icon,color}:{title:string,value:string,note:string,icon:typeof Home,color:string}){return <div className="stat"><div><span>{title}</span><i className={color}><Icon size={17}/></i></div><strong>{value}</strong><small>{note}</small></div>}