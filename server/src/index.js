import express from 'express';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import bcrypt from 'bcryptjs';
import pg from 'pg';
import { WebSocketServer } from 'ws';
import { createServer } from 'node:http';
import { randomBytes, createHash, timingSafeEqual } from 'node:crypto';
import { shuffle, compare } from './engine.js';

const app=express();app.disable('x-powered-by');app.use(helmet({contentSecurityPolicy:false}));app.use(express.json({limit:'20kb'}));app.use(cookieParser());
const port=Number(process.env.PORT||3000);
const db=process.env.DATABASE_URL?new pg.Pool({connectionString:process.env.DATABASE_URL,ssl:process.env.PGSSLMODE==='require'?{rejectUnauthorized:true}:undefined}):null;
const sessions=new Map(), tables=new Map();
const hash=t=>createHash('sha256').update(t).digest('hex');
const token=()=>randomBytes(32).toString('hex');
const clean=s=>String(s||'').trim().slice(0,32);
const validName=s=>/^[a-zA-Z0-9_ ]{3,24}$/.test(s);
async function init(){
 if(!db){console.warn('DATABASE_URL missing: using temporary in-memory mode');return;}
 await db.query(`CREATE TABLE IF NOT EXISTS players (id TEXT PRIMARY KEY, name TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL, chips INTEGER NOT NULL DEFAULT 1000 CHECK(chips>=0), created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`);
 await db.query(`CREATE TABLE IF NOT EXISTS ledger (id BIGSERIAL PRIMARY KEY, player_id TEXT NOT NULL, delta INTEGER NOT NULL, reason TEXT NOT NULL, created_at TIMESTAMPTZ DEFAULT NOW())`);
}
const memory=new Map();
async function getPlayer(id){if(db){const r=await db.query('SELECT id,name,chips FROM players WHERE id=$1',[id]);return r.rows[0];}const p=memory.get(id);return p&&{id:p.id,name:p.name,chips:p.chips};}
async function auth(req,res,next){const t=req.headers.authorization?.replace(/^Bearer /,'')||req.cookies.admin_session;const s=t&&sessions.get(hash(t));if(!s||s.expires<Date.now())return res.status(401).json({error:'Login required'});req.user=s;next();}
app.get('/health',(req,res)=>res.json({ok:true,service:'teenpatti',mode:db?'postgres':'temporary'}));
app.post('/api/register',async(req,res)=>{try{
 const name=clean(req.body.name),pass=String(req.body.password||'');
 if(!validName(name)||pass.length<10||pass.length>128)return res.status(400).json({error:'Name 3-24 characters; password 10+ characters'});
 const id=randomBytes(12).toString('hex'),password_hash=await bcrypt.hash(pass,12);
 if(db)await db.query('INSERT INTO players(id,name,password_hash) VALUES($1,$2,$3)',[id,name,password_hash]);
 else {if([...memory.values()].some(p=>p.name===name))return res.status(409).json({error:'Name taken'});memory.set(id,{id,name,password_hash,chips:1000});}
 res.status(201).json({message:'Account created'});
 }catch(e){res.status(409).json({error:'Registration failed or name taken'});}});
app.post('/api/login',async(req,res)=>{const name=clean(req.body.name),pass=String(req.body.password||'');let p;
 if(db){const r=await db.query('SELECT * FROM players WHERE name=$1',[name]);p=r.rows[0];}else p=[...memory.values()].find(x=>x.name===name);
 if(!p||!await bcrypt.compare(pass,p.password_hash))return res.status(401).json({error:'Invalid credentials'});
 const t=token();sessions.set(hash(t),{id:p.id,name:p.name,role:'player',expires:Date.now()+86400000});res.json({token:t,name:p.name,chips:p.chips});
});
const adminUser=process.env.ADMIN_USER,adminPass=process.env.ADMIN_PASSWORD;
app.post('/admin/login',async(req,res)=>{
 if(!adminUser||!adminPass)return res.status(503).json({error:'Admin not configured'});
 const a=Buffer.from(String(req.body.username||'')),b=Buffer.from(adminUser);
 const usernameOk=a.length===b.length&&timingSafeEqual(a,b);
 const passOk=await bcrypt.compare(String(req.body.password||''),adminPass.startsWith('$2')?adminPass:await bcrypt.hash(adminPass,10));
 if(!usernameOk||!passOk)return res.status(401).json({error:'Invalid credentials'});
 const t=token();sessions.set(hash(t),{id:'admin',name:adminUser,role:'admin',expires:Date.now()+3600000});
 res.cookie('admin_session',t,{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'strict',maxAge:3600000}).json({ok:true});
});
app.post('/admin/logout',auth,(req,res)=>{sessions.delete(hash(req.cookies.admin_session||''));res.clearCookie('admin_session').json({ok:true});});
app.get('/admin/api/summary',auth,async(req,res)=>{if(req.user.role!=='admin')return res.sendStatus(403);
 const users=db?Number((await db.query('SELECT COUNT(*)::int AS n FROM players')).rows[0].n):memory.size;
 res.json({users,tables:tables.size,online:[...tables.values()].reduce((n,t)=>n+t.players.length,0),mode:db?'postgres':'temporary'});
});
app.get('/admin/api/users',auth,async(req,res)=>{if(req.user.role!=='admin')return res.sendStatus(403);
 const users=db?(await db.query('SELECT id,name,chips,created_at FROM players ORDER BY created_at DESC LIMIT 100')).rows:[...memory.values()].map(({id,name,chips})=>({id,name,chips}));
 res.json({users});
});
app.post('/admin/api/chips',auth,async(req,res)=>{if(req.user.role!=='admin')return res.sendStatus(403);
 const id=String(req.body.id||''),delta=Number(req.body.delta);
 if(!Number.isSafeInteger(delta)||delta===0||Math.abs(delta)>10000)return res.status(400).json({error:'Invalid delta'});
 if(db){const c=await db.connect();try{await c.query('BEGIN');const r=await c.query('UPDATE players SET chips=chips+$1 WHERE id=$2 AND chips+$1>=0 RETURNING chips',[delta,id]);if(!r.rowCount){await c.query('ROLLBACK');return res.status(400).json({error:'Unknown user or insufficient chips'});}await c.query('INSERT INTO ledger(player_id,delta,reason) VALUES($1,$2,$3)',[id,delta,'admin_adjustment']);await c.query('COMMIT');return res.json({chips:r.rows[0].chips});}catch(e){await c.query('ROLLBACK');return res.sendStatus(500);}finally{c.release();}}
 const p=memory.get(id);if(!p||p.chips+delta<0)return res.sendStatus(400);p.chips+=delta;res.json({chips:p.chips});
});
app.get('/admin',(_,res)=>res.sendFile(new URL('../public/admin.html',import.meta.url).pathname));
const server=createServer(app),wss=new WebSocketServer({server,path:'/game'});
const send=(ws,obj)=>{if(ws.readyState===1)ws.send(JSON.stringify(obj));};
function publish(t){for(const p of t.players)send(p.ws,{type:'table',table:t.id,players:t.players.map(x=>({name:x.name,packed:x.packed,seen:x.seen})),pot:t.pot,turn:t.players[t.turn]?.name||null,state:t.state,hand:t.state==='playing'?p.hand:null});}
function next(t){let n=t.turn;for(let i=0;i<t.players.length;i++){n=(n+1)%t.players.length;if(!t.players[n].packed){t.turn=n;return;}}}
wss.on('connection',ws=>{let player=null,table=null;
 ws.on('message',raw=>{try{const msg=JSON.parse(String(raw));if(!player){if(msg.type!=='auth')throw Error('Authenticate first');const s=sessions.get(hash(String(msg.token||'')));if(!s||s.expires<Date.now()||s.role!=='player')throw Error('Invalid session');player={id:s.id,name:s.name,ws,packed:false,seen:false,hand:null};return send(ws,{type:'authenticated'});}
 if(msg.type==='join'){if(table)throw Error('Already at a table');const id=String(msg.table||'lobby').slice(0,24);let t=tables.get(id);if(!t){t={id,players:[],pot:0,turn:0,state:'waiting'};tables.set(id,t);}if(t.state!=='waiting'||t.players.length>=6||t.players.some(p=>p.id===player.id))throw Error('Table unavailable');t.players.push(player);table=t;publish(t);}
 else if(msg.type==='start'){if(!table||table.players[0]!==player||table.state!=='waiting'||table.players.length<2)throw Error('Cannot start');const deck=shuffle();table.players.forEach(p=>{p.hand=deck.splice(0,3);p.packed=false;p.seen=false;});table.state='playing';table.turn=0;publish(table);}
 else if(msg.type==='seen'){if(!table||table.state!=='playing')throw Error('No hand');player.seen=true;publish(table);}
 else if(msg.type==='pack'){if(!table||table.state!=='playing')throw Error('No hand');player.packed=true;const active=table.players.filter(p=>!p.packed);if(active.length===1){table.state='finished';table.winner=active[0].name;for(const p of table.players)send(p.ws,{type:'result',winner:table.winner});}else if(table.players[table.turn]===player)next(table);publish(table);}
 else if(msg.type==='show'){if(!table||table.state!=='playing'||table.players[table.turn]!==player)throw Error('Not your turn');const active=table.players.filter(p=>!p.packed);if(active.length!==2)throw Error('Show requires two active players');const other=active.find(p=>p!==player);const winner=compare(player.hand,other.hand)>=0?player:other;table.state='finished';table.winner=winner.name;for(const p of table.players)send(p.ws,{type:'result',winner:winner.name,hands:active.map(x=>({name:x.name,hand:x.hand}))});publish(table);}
 else if(msg.type==='chaal'){throw Error('Chaal disabled until atomic chip settlement is implemented');}
 else throw Error('Unknown action');
 }catch(e){send(ws,{type:'error',message:e.message});}});
 ws.on('close',()=>{if(!table)return;table.players=table.players.filter(p=>p!==player);if(table.state==='playing'){table.state='finished';for(const p of table.players)send(p.ws,{type:'result',winner:null,message:'Player disconnected; hand cancelled'});}if(!table.players.length)tables.delete(table.id);else{table.turn=0;publish(table);}});
});
await init();server.listen(port,'0.0.0.0',()=>console.log('Teen Patti server listening on',port));
