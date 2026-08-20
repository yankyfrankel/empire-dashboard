
/* ================= LOCK ================= */
const KEY_STORE = "qfs_costing_key";
let PW=null, ROLE="viewer", SHA=null, DATA=null;
const DIRTY = new Set();

async function api(path, opts={}){
  const res = await fetch(path, { ...opts, headers: { "x-app-key": PW, "Content-Type":"application/json", ...(opts.headers||{}) } });
  const body = await res.json().catch(()=>({}));
  if(!res.ok) throw { status: res.status, message: body.error || "Request failed." };
  return body;
}
async function unlock(){
  const pw = document.getElementById("pw").value;
  const btn = document.getElementById("unlockBtn"), msg = document.getElementById("doorMsg");
  if(!pw){ msg.textContent = "Enter the password."; return; }
  btn.disabled = true; msg.style.color="#B9C4D6"; msg.textContent = "Checking…";
  try { PW = pw; const j = await api("/api/data"); boot(j);
    sessionStorage.setItem(KEY_STORE, pw);
  } catch(e){
    PW = null; msg.style.color="#FF9A8B";
    msg.textContent = e.status===429 ? "Locked out — too many wrong tries. Wait 15 minutes." :
                      e.status===401 ? "Wrong password." : e.message;
  } finally { btn.disabled = false; }
}
document.getElementById("pw").addEventListener("keydown", e=>{ if(e.key==="Enter") unlock(); });
async function tryStored(){
  const pw = sessionStorage.getItem(KEY_STORE); if(!pw) return;
  try { PW = pw; const j = await api("/api/data"); boot(j); }
  catch { PW = null; sessionStorage.removeItem(KEY_STORE); }
}
function relock(){ sessionStorage.removeItem(KEY_STORE); location.reload(); }
window.addEventListener("beforeunload", e=>{ if(DIRTY.size){ e.preventDefault(); e.returnValue=""; } });

/* ================= ENGINE (verified vs Salesforce 249/249) ================= */
const GL_PCT = 0.0235, WK_MO = 4.34, MGMT_STD = 0.105, MGMT_SEC = 0.101;
const N = v => { const x = parseFloat(v); return isFinite(x) ? x : 0; };
let byCid = {};
function reindex(){ byCid = {}; for(const l of DATA.lines) (byCid[l.cid] = byCid[l.cid]||[]).push(l); }
function calc(a, ls){
  ls = ls || byCid[a.cid] || [];
  let P=0, PTO=0, EQ=0, HC=0;
  for(const l of ls){
    if(l.sec==="Payroll"){ const ct=(l.ct==null?1:N(l.ct)); P += ct*N(l.rt)*(N(l.rh)+1.5*N(l.ot)); HC += ct; }
    else if(l.sec==="PTO"){ const ct=(l.ct==null?1:N(l.ct)); PTO += ct*N(l.rt)*N(l.pto)/12; }
    else if(l.sec==="Equipment"){
      const qty=N(l.qty);
      EQ += (l.fq==="One Time") ? N(l.cost)*qty/Math.max(N(l.lt),1) : N(l.cost)*qty;
    }
  }
  P *= WK_MO;
  const rate = N(a.fica)+N(a.suta)+N(a.mta)+N(a.wc)+N(a.oth);
  const TAX = (P+PTO)*rate + N(a.futa)*HC;
  const MG = (P+PTO+TAX)*(a.svc==="Security/Concierge" ? MGMT_SEC : MGMT_STD);
  const f = a.funds||{};
  const BEN = N(f.legal)+N(f.lm)+N(f.pen)+N(f.sup)+N(f.hw);
  const SUB = P+PTO+EQ+TAX+MG+BEN;
  const GL = N(a.bill)*GL_PCT;
  const TOT = SUB+GL;
  const PROF = N(a.bill)-TOT;
  const M = a.bill ? PROF/N(a.bill) : 0;
  const REQ = (1-GL_PCT-N(a.tm))>0 ? SUB/(1-GL_PCT-N(a.tm)) : 0;
  return { P, PTO, EQ, HC, TAX, MG, BEN, SUB, GL, TOT, PROF, M, REQ };
}
function ext(){ return DATA.accounts.filter(a=>a.st==="Extracted"); }
function metrics(){ return ext().map(a=>({a, m:calc(a)})); }

/* ================= APP ================= */
const fm$ = n => "$" + Math.round(n).toLocaleString("en-US");
const fmM = n => Math.abs(n) >= 1e6 ? "$" + (n/1e6).toFixed(2) + "M" : fm$(n);
const fmP = n => (n*100).toFixed(1) + "%";
const mcls = m => m<0?"m-neg":m<.10?"m-low":m<.20?"m-mid":"m-hi";
const bcls = m => m<0?"neg":m<.10?"low":m<.20?"mid":"hi";
const esc = s => String(s??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/"/g,"&quot;");

function boot(j){
  ROLE = j.role; SHA = j.sha;
  DATA = { meta:j.meta, accounts:j.accounts, lines:j.lines };
  reindex();
  document.getElementById("door").style.display="none";
  document.getElementById("app").style.display="block";
  const rb = document.getElementById("roleBadge");
  rb.textContent = ROLE==="admin" ? "ADMIN — EDITING ENABLED" : "VIEWER";
  rb.className = "rolebadge" + (ROLE==="admin" ? " admin" : "");
  if(ROLE==="admin") document.getElementById("tabMass").style.display="";
  buildFilters(); renderAll();
}
function renderAll(){ buildDashboard(); renderAccounts(); pubbar(); }
function buildFilters(){
  const states = [...new Set(ext().map(a=>a.state).filter(Boolean))].sort();
  for(const id of ["fState","muState"]){
    const sel = document.getElementById(id);
    sel.length = 1;
    states.forEach(s=>{ const o=document.createElement("option"); o.value=s; o.textContent=(id==="fState"?"State: ":"")+s; sel.appendChild(o); });
  }
}
function kpi(v,label,cls=""){ return `<div class="kpi ${cls}"><div class="v num">${v}</div><div class="l">${label}</div></div>`; }

function buildDashboard(){
  const ms = metrics();
  const bill = ms.reduce((s,x)=>s+N(x.a.bill),0);
  const cost = ms.reduce((s,x)=>s+x.m.TOT,0);
  const prof = ms.reduce((s,x)=>s+x.m.PROF,0);
  document.getElementById("kpiMain").innerHTML =
    kpi(fmM(bill),"Monthly billing")+kpi(fmM(cost),"Monthly cost")+
    kpi(fmM(prof),"Monthly profit","good")+kpi(fmP(bill?prof/bill:0),"Blended margin","good")+
    kpi(fmM(bill*12),"Annualized billing")+kpi(ms.length,"Accounts costed");
  const un = ms.filter(x=>x.a.u==="Yes");
  const ub = un.reduce((s,x)=>s+N(x.a.bill),0), up = un.reduce((s,x)=>s+x.m.PROF,0);
  document.getElementById("kpiUnion").innerHTML =
    kpi(un.length,"Union / EFS accounts","gold")+kpi(fmM(ub),"Union monthly billing","gold")+
    kpi(fmP(ub?up/ub:0),"Union blended margin", (ub?up/ub:0)<.10?"warn":"gold")+
    kpi(fmM(un.reduce((s,x)=>s+x.m.BEN,0)),"Union funds / month","gold");
  const neg = ms.filter(x=>x.m.M<0);
  document.getElementById("kpiRisk").innerHTML =
    kpi(neg.length,"Negative-margin accounts","bad")+
    kpi(ms.filter(x=>x.m.M<.10).length,"Below 10% margin","bad")+
    kpi(fmM(neg.reduce((s,x)=>s+x.m.PROF,0)),"Monthly $ lost to negative accts","bad")+
    kpi(ms.filter(x=>x.m.M<.20).length,"Below 20%","warn");
  const bands = [
    {k:"Negative",c:"#C0392B",f:m=>m<0},{k:"0–10%",c:"#D98E04",f:m=>m>=0&&m<.10},
    {k:"10–20%",c:"#FFC000",f:m=>m>=.10&&m<.20,dark:true},
    {k:"20–30%",c:"#2E7D32",f:m=>m>=.20&&m<.30},{k:"30%+",c:"#1B5E20",f:m=>m>=.30}];
  let rib="",leg="";
  bands.forEach(b=>{
    const n = ms.filter(x=>b.f(x.m.M)).length, pct = n/ms.length*100;
    rib += `<div class="rib" style="width:${pct}%;background:${b.c};${b.dark?'color:#132A4F':''}" title="${b.k}: ${n}">${n}</div>`;
    leg += `<span><span class="dot" style="background:${b.c}"></span>${b.k} — <b>${n}</b></span>`;
  });
  document.getElementById("ribbon").innerHTML = rib;
  document.getElementById("ribLegend").innerHTML = leg;
  const worst = [...ms].sort((x,y)=>x.m.M-y.m.M).slice(0,10);
  let h = `<thead><tr><th>Account</th><th class="r">Margin</th><th class="r">Billing</th><th class="r">Profit</th><th class="r">Needed @ 15%</th></tr></thead><tbody>`;
  worst.forEach(x=>{
    h += `<tr class="rowlink" data-cid="${esc(x.a.cid)}"><td>${esc(x.a.n)}</td><td class="r num ${mcls(x.m.M)}">${fmP(x.m.M)}</td>
      <td class="r num">${fm$(N(x.a.bill))}</td><td class="r num ${x.m.PROF<0?'m-neg':''}">${fm$(x.m.PROF)}</td>
      <td class="r num">${fm$(x.m.SUB/(1-GL_PCT-0.15))}</td></tr>`;
  });
  document.getElementById("bottomTbl").innerHTML = h+"</tbody>";
}

let sortKey="n", sortDir=1;
function setSort(k){ if(sortKey===k) sortDir*=-1; else { sortKey=k; sortDir = k==="n"?1:-1; } renderAccounts(); }
function renderAccounts(){
  const q=(document.getElementById("q").value||"").toLowerCase();
  const fu=document.getElementById("fUnion").value, fs=document.getElementById("fState").value, fb=document.getElementById("fBand").value;
  let rows = metrics().filter(x=>
    (!q || x.a.n.toLowerCase().includes(q)) && (!fu || x.a.u===fu) && (!fs || x.a.state===fs) &&
    (!fb || (fb==="neg"?x.m.M<0 : fb==="lt10"?x.m.M<.10 : fb==="lt20"?x.m.M<.20 : x.m.M>=.20)));
  const key = x => sortKey==="n"?x.a.n : sortKey==="bill"?N(x.a.bill) : sortKey==="cost"?x.m.TOT : sortKey==="prof"?x.m.PROF : x.m.M;
  rows.sort((a,b)=>{ const x=key(a),y=key(b); return (typeof x==="string"?x.localeCompare(y):x-y)*sortDir; });
  document.getElementById("cnt").textContent = rows.length+" of "+ext().length+" accounts";
  const arr = k => sortKey===k?`<span class="arr">${sortDir>0?"▲":"▼"}</span>`:"";
  let h = `<thead><tr><th class="sortable" onclick="setSort('n')">Account ${arr("n")}</th><th>Type</th><th>State</th>
    <th class="r sortable" onclick="setSort('bill')">Billing ${arr("bill")}</th>
    <th class="r sortable" onclick="setSort('cost')">Cost ${arr("cost")}</th>
    <th class="r sortable" onclick="setSort('prof')">Profit ${arr("prof")}</th>
    <th class="r sortable" onclick="setSort('m')">Margin ${arr("m")}</th></tr></thead><tbody>`;
  rows.forEach(x=>{
    h += `<tr class="rowlink" data-cid="${esc(x.a.cid)}"><td>${esc(x.a.n)} ${DIRTY.has(x.a.n)?'<span class="tag dirty">EDITED</span>':''}</td>
      <td>${x.a.u==="Yes"?'<span class="tag efs">EFS</span>':'<span class="tag grey">QFS</span>'}</td>
      <td>${esc(x.a.state)||"—"}</td>
      <td class="r num">${x.a.bill!=null?fm$(N(x.a.bill)):"—"}</td>
      <td class="r num">${fm$(x.m.TOT)}</td>
      <td class="r num ${x.m.PROF<0?'m-neg':''}">${fm$(x.m.PROF)}</td>
      <td class="r num ${mcls(x.m.M)}">${fmP(x.m.M)}</td></tr>`;
  });
  document.getElementById("accTbl").innerHTML = h+"</tbody>";
}
document.addEventListener("click", e=>{
  const tr = e.target.closest("tr.rowlink");
  if(tr && !e.target.closest("input,select,button")) openDrawer(tr.dataset.cid);
});

