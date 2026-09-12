import express from 'express';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import OpenAI from 'openai';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = Number(process.env.PORT || 3000);
const DATA = path.join(__dirname, 'data');
fs.mkdirSync(DATA, { recursive: true });
const STORE = path.join(DATA, 'sara-store.json');
const sessions = new Map();
const env = (k, d='') => process.env[k] || d;

app.use(express.json({ limit: '2mb' }));
app.use(express.static(path.join(__dirname, 'public')));

function load(){
  try { return JSON.parse(fs.readFileSync(STORE, 'utf8')); }
  catch { return { memories: [], history: [], tiktok: null, analytics: { questions:0, answers:0, liveMinutes:0 } }; }
}
function save(x){ fs.writeFileSync(STORE, JSON.stringify(x, null, 2)); }
function key(){
  const raw = env('APP_ENCRYPTION_KEY');
  return raw ? crypto.createHash('sha256').update(raw).digest() : null;
}
function protect(obj){
  const k=key(); if(!k) return { plain: obj };
  const iv=crypto.randomBytes(12); const c=crypto.createCipheriv('aes-256-gcm',k,iv);
  const data=Buffer.concat([c.update(JSON.stringify(obj),'utf8'),c.final()]);
  return { enc:1, iv:iv.toString('base64'), tag:c.getAuthTag().toString('base64'), data:data.toString('base64') };
}
function unprotect(box){
  if(!box) return null; if(box.plain) return box.plain;
  try { const k=key(); if(!k) return null; const d=crypto.createDecipheriv('aes-256-gcm',k,Buffer.from(box.iv,'base64')); d.setAuthTag(Buffer.from(box.tag,'base64')); return JSON.parse(Buffer.concat([d.update(Buffer.from(box.data,'base64')),d.final()]).toString('utf8')); } catch { return null; }
}

app.get('/api/config', (req,res)=>res.json({
  did: { enabled: !!(env('DID_AGENT_ID') && env('DID_CLIENT_KEY')), agentId: env('DID_AGENT_ID'), clientKey: env('DID_CLIENT_KEY') },
  openai: !!env('OPENAI_API_KEY'),
  tiktok: !!(env('TIKTOK_CLIENT_KEY') && env('TIKTOK_CLIENT_SECRET') && env('TIKTOK_REDIRECT_URI')),
  liveProvider: env('LIVE_PROVIDER','obs'),
  appOrigin: `${req.protocol}://${req.get('host')}`
}));

app.get('/api/health',(req,res)=>res.json({
  ok:true, app:'SARA AI Creator PRO',
  did:!!(env('DID_AGENT_ID')&&env('DID_CLIENT_KEY')),
  openai:!!env('OPENAI_API_KEY'),
  tiktok:!!(env('TIKTOK_CLIENT_KEY')&&env('TIKTOK_CLIENT_SECRET')&&env('TIKTOK_REDIRECT_URI')),
  liveProvider:env('LIVE_PROVIDER','obs')
}));

app.get('/api/memory',(req,res)=>res.json(load()));
app.post('/api/memory',(req,res)=>{
  const text=String(req.body?.text||'').trim(); if(!text) return res.status(400).json({error:'text required'});
  const s=load(); s.memories.push(text.slice(0,500)); s.memories=s.memories.slice(-300); save(s); res.json({ok:true});
});

app.post('/api/chat',async(req,res)=>{
  try{
    if(!env('OPENAI_API_KEY')) return res.status(503).json({error:'OPENAI_API_KEY is not configured'});
    const message=String(req.body?.message||'').trim(); if(!message) return res.status(400).json({error:'message required'});
    const s=load(); s.analytics.questions++;
    const client=new OpenAI({apiKey:env('OPENAI_API_KEY')});
    const input=[
      {role:'system',content:`You are SARA, a warm, funny, confident adult female TikTok creator and LIVE host. Speak naturally in English, Urdu or Roman Urdu. Keep LIVE replies concise (usually 1-3 sentences), playful and conversational. Never claim an external action happened unless this backend confirms it. Remember the supplied memories. Memories:\n${s.memories.slice(-40).map(x=>'- '+x).join('\n')||'- none'}`},
      ...s.history.slice(-12).flatMap(x=>[{role:'user',content:x.user},{role:'assistant',content:x.assistant}]),
      {role:'user',content:message}
    ];
    const r=await client.responses.create({model:env('OPENAI_MODEL','gpt-4.1-mini'),input});
    const answer=(r.output_text||'Mujhe jawab nahi mila.').trim();
    s.history.push({at:new Date().toISOString(),user:message,assistant:answer}); s.history=s.history.slice(-400); s.analytics.answers++; save(s);
    res.json({ok:true,answer});
  }catch(e){res.status(500).json({error:e.message||'AI error'});}
});

app.post('/api/tts',async(req,res)=>{
  try{
    if(!env('OPENAI_API_KEY')) return res.status(503).json({error:'OPENAI_API_KEY is not configured'});
    const text=String(req.body?.text||'').trim(); if(!text) return res.status(400).json({error:'text required'});
    const client=new OpenAI({apiKey:env('OPENAI_API_KEY')});
    const audio=await client.audio.speech.create({model:env('OPENAI_TTS_MODEL','gpt-4o-mini-tts'),voice:env('OPENAI_TTS_VOICE','alloy'),input:text,response_format:'mp3'});
    res.setHeader('Content-Type','audio/mpeg'); res.setHeader('Cache-Control','no-store'); res.send(Buffer.from(await audio.arrayBuffer()));
  }catch(e){res.status(500).json({error:e.message||'TTS error'});}
});

app.post('/api/live/session',(req,res)=>{
  const id=crypto.randomUUID(); const s=load();
  sessions.set(id,{id,startedAt:Date.now(),title:String(req.body?.title||'SARA LIVE').slice(0,100),status:'ready'});
  save(s); res.json({ok:true,session:sessions.get(id),mode:env('LIVE_PROVIDER','obs')});
});
app.post('/api/live/stop',(req,res)=>{
  const id=String(req.body?.id||''); const x=sessions.get(id); if(x){x.status='stopped'; x.stoppedAt=Date.now(); const s=load(); s.analytics.liveMinutes += Math.max(0,Math.round((x.stoppedAt-x.startedAt)/60000)); save(s);} res.json({ok:true});
});

app.get('/auth/tiktok',(req,res)=>{
  if(!env('TIKTOK_CLIENT_KEY')) return res.status(503).send('Configure TikTok Developer credentials first.');
  const state=crypto.randomBytes(32).toString('hex'); sessions.set('oauth:'+state,{expires:Date.now()+600000});
  const scope=env('TIKTOK_SCOPES','user.info.basic,video.list');
  const p=new URLSearchParams({client_key:env('TIKTOK_CLIENT_KEY'),response_type:'code',scope,redirect_uri:env('TIKTOK_REDIRECT_URI'),state});
  res.redirect('https://www.tiktok.com/v2/auth/authorize/?'+p.toString());
});
app.get('/auth/tiktok/callback',async(req,res)=>{
  try{
    const {code,state,error,error_description}=req.query; if(error) throw new Error(error_description||error);
    const st=sessions.get('oauth:'+state); if(!st||st.expires<Date.now()) throw new Error('Invalid/expired OAuth state'); sessions.delete('oauth:'+state);
    const body=new URLSearchParams({client_key:env('TIKTOK_CLIENT_KEY'),client_secret:env('TIKTOK_CLIENT_SECRET'),code,grant_type:'authorization_code',redirect_uri:env('TIKTOK_REDIRECT_URI')});
    const r=await fetch('https://open.tiktokapis.com/v2/oauth/token/',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body});
    const j=await r.json(); if(!r.ok||j.error) throw new Error(j.error_description||'TikTok token exchange failed');
    const s=load(); s.tiktok=protect({...j,received_at:Date.now()}); save(s);
    res.redirect('/?tiktok=connected');
  }catch(e){res.status(400).send('TikTok connection failed: '+e.message);}
});

app.get('/api/tiktok/status',(req,res)=>{ const s=load(); res.json({connected:!!s.tiktok, scopes: env('TIKTOK_SCOPES','')}); });

app.get('*',(req,res)=>res.sendFile(path.join(__dirname,'public','index.html')));
app.listen(PORT,()=>console.log(`SARA AI Creator PRO: http://localhost:${PORT}`));
