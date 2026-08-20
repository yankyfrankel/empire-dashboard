/* ================= MASS UPDATE ================= */
let MU = null;
function muMatch(){
  const name=(document.getElementById("muName").value||"").toLowerCase();
  const st=document.getElementById("muState").value, un=document.getElementById("muUnion").value;
  const below=parseFloat(document.getElementById("muBelow").value);
  const accs = ext().filter(a=> (!name||a.n.toLowerCase().includes(name)) && (!st||a.state===st) && (!un||a.u===un));
  const set = new Set(accs.map(a=>a.cid));
  return DATA.lines.filter(l=> l.sec==="Payroll" && set.has(l.cid) && l.rt!=null && (isNaN(below)||N(l.rt)<below));
}
function muNewRate(rt){
  const rule=document.getElementById("muRule").value, v=parseFloat(document.getElementById("muVal").value);
  if(isNaN(v)) return null;
  return rule==="set"? v : rule==="add"? N(rt)+v : N(rt)*(1+v/100);
}
function muPreview(){
  const ls = muMatch();
  const v = parseFloat(document.getElementById("muVal").value);
  const sum = document.getElementById("muSummary");
  if(!ls.length || isNaN(v)){ sum.innerHTML = `<div class="panel">${!ls.length?"No payroll lines match those filters.":"Enter a rule value."}</div>`;
    document.getElementById("muWrap").style.display="none"; document.getElementById("muApplyBtn").style.display="none"; MU=null; return; }
  const byAcc = {};
  ls.forEach(l=>{ (byAcc[l.cid]=byAcc[l.cid]||[]).push(l); });
  const rows = [];
  let totOld=0, totNew=0;
  for(const cid of Object.keys(byAcc)){
    const a = DATA.accounts.find(x=>x.cid===cid);
    const affected = byAcc[cid];
    const orig = affected.map(l=>l.rt);
    const mOld = calc(a);
    affected.forEach(l=>{ l.rt = +muNewRate(l.rt).toFixed(2); });
    // matching PTO lines follow the payroll rate when the wage matches the same rate
    const ptoTouched = [];
    (byCid[cid]||[]).forEach(p=>{
      if(p.sec==="PTO"){
        const twin = affected.find((l,i)=> Math.abs(N(orig[i])-N(p.rt))<0.005);
        if(twin){ ptoTouched.push([p, p.rt]); p.rt = twin.rt; }
      }
    });
    const mNew = calc(a);
    affected.forEach((l,i)=>{ l.rt = orig[i]; });
    ptoTouched.forEach(([p,r])=>{ p.rt = r; });
    rows.push({a, n:affected.length, oldR:orig, newR:affected.map(l=>+muNewRate(l.rt).toFixed(2)), reqOld:mOld.REQ, reqNew:mNew.REQ});
    totOld += mOld.REQ; totNew += mNew.REQ;
  }
  rows.sort((x,y)=> (y.reqNew-y.reqOld)-(x.reqNew-x.reqOld));
  MU = { ls, rows };
  sum.innerHTML = `<div class="grid">
    ${kpi(ls.length,"Payroll lines affected")} ${kpi(rows.length,"Accounts impacted")}
    ${kpi(fm$(totNew-totOld),"Monthly required-billing change","good")} ${kpi(fm$((totNew-totOld)*12),"Annualized","good")}
  </div>`;
  let h = `<thead><tr><th>Account</th><th class="r">Lines</th><th class="r">Rate change</th><th class="r">Required now</th><th class="r">Required after</th><th class="r">Change</th></tr></thead><tbody>`;
  rows.forEach(r=>{
    const ex = `$${N(r.oldR[0]).toFixed(2)} → $${N(r.newR[0]).toFixed(2)}${r.n>1?" (+"+(r.n-1)+" more)":""}`;
    h += `<tr class="rowlink" data-cid="${esc(r.a.cid)}"><td>${esc(r.a.n)}</td><td class="r num">${r.n}</td><td class="r num">${ex}</td>
      <td class="r num">${fm$(r.reqOld)}</td><td class="r num">${fm$(r.reqNew)}</td>
      <td class="r num" style="font-weight:700;color:${r.reqNew-r.reqOld>=0?'var(--green)':'var(--red)'}">${fm$(r.reqNew-r.reqOld)}</td></tr>`;
  });
  document.getElementById("muTbl").innerHTML = h+"</tbody>";
  document.getElementById("muWrap").style.display="block";
  document.getElementById("muApplyBtn").style.display="";
}
function muApply(){
  if(!MU) return;
  const orig = {};
  MU.rows.forEach(r=>{
    const affected = MU.ls.filter(l=>l.cid===r.a.cid);
    affected.forEach(l=>{
      const oldRt = l.rt;
      l.rt = +muNewRate(l.rt).toFixed(2);
      (byCid[r.a.cid]||[]).forEach(p=>{ if(p.sec==="PTO" && Math.abs(N(p.rt)-N(oldRt))<0.005) p.rt = l.rt; });
    });
    markDirty(r.a);
  });
  toast(`Applied to ${MU.rows.length} accounts — review, then Publish.`);
  MU=null; document.getElementById("muApplyBtn").style.display="none";
  renderAll(); muPreviewClear();
}
function muPreviewClear(){ document.getElementById("muWrap").style.display="none"; document.getElementById("muSummary").innerHTML=""; }

/* ================= PUBLISH ================= */
function toast(msg, err){
  const t = document.getElementById("toast");
  t.textContent = msg; t.className = err?"err":""; t.style.display="block";
  setTimeout(()=>{ t.style.display="none"; }, 4000);
}
async function publish(){
  const msg = document.getElementById("pubMsg").value.trim() || `Updated ${DIRTY.size} account(s): ${[...DIRTY].slice(0,4).join(", ")}${DIRTY.size>4?"…":""}`;
  const btn = document.getElementById("pubBtn");
  btn.disabled = true;
  try {
    const j = await api("/api/save", { method:"POST", body: JSON.stringify({ data: DATA, summary: msg, sha: SHA }) });
    SHA = j.sha; DIRTY.clear(); document.getElementById("pubMsg").value="";
    pubbar(); renderAll(); toast("Published. Changes are live and logged.");
  } catch(e){
    toast(e.status===409 ? "Data changed elsewhere — reload before publishing." : ("Publish failed: "+e.message), true);
  } finally { btn.disabled = false; }
}
async function discard(){
  if(!confirm("Throw away all unpublished changes and reload?")) return;
  const j = await api("/api/data"); DIRTY.clear(); boot(j); toast("Reverted to last published data.");
}

function showTab(t){
  for(const [id,tab] of [["viewDash","tabDash"],["viewAcc","tabAcc"],["viewMass","tabMass"]]){
    document.getElementById(id).style.display = (id==="view"+t[0].toUpperCase()+t.slice(1))?"block":"none";
    document.getElementById(tab).classList.toggle("on", tab==="tab"+t[0].toUpperCase()+t.slice(1));
  }
}
tryStored();
