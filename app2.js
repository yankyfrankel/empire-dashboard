/* ================= DRAWER ================= */
let CUR = null;
function markDirty(a){ DIRTY.add(a.n); pubbar(); }
function pubbar(){
  const bar = document.getElementById("pubbar");
  bar.style.display = (ROLE==="admin" && DIRTY.size) ? "block" : "none";
  document.getElementById("pubCount").textContent = DIRTY.size;
}
function openDrawer(cid){
  const a = DATA.accounts.find(x=>x.cid===cid); if(!a) return;
  CUR = a; renderDrawer();
  document.getElementById("ovl").style.display="block";
  document.getElementById("drawer").style.display="block";
}
function closeDrawer(){
  document.getElementById("ovl").style.display="none";
  document.getElementById("drawer").style.display="none";
  CUR=null; renderAll();
}
document.addEventListener("keydown", e=>{ if(e.key==="Escape") closeDrawer(); });

function fld(label, html){ return `<div class="fld"><label>${label}</label>${html}</div>`; }
function inp(id, val, step, ph){ return `<input id="${id}" type="number" step="${step}" value="${val==null?"":val}" placeholder="${ph||""}">`; }

function renderDrawer(){
  const a = CUR, m = calc(a);
  const ls = byCid[a.cid]||[];
  const admin = ROLE==="admin";
  const row = (l,v,b)=>`<div class="rowline${b?' total':''}"><span>${l}</span><b class="num">${v}</b></div>`;
  let head = `
    <div class="dhead">
      <button class="dclose" onclick="closeDrawer()">✕</button>
      <h3>${esc(a.n)}</h3>
      <div class="sub">${a.u==="Yes"?"EFS / Union":"QFS"} ${a.state?("· "+esc(a.state)):""} ${a.city?("· "+esc(a.city)):""} ${a.am?("· AM: "+esc(a.am)):""}</div>
      <div style="margin-top:10px"><span class="badge ${bcls(m.M)}" id="dMargin">Margin ${fmP(m.M)}</span>
      ${DIRTY.has(a.n)?'<span class="tag dirty" style="margin-left:8px">UNPUBLISHED EDITS</span>':''}</div>
    </div>`;
  if(a.st!=="Extracted"){
    document.getElementById("drawer").innerHTML = head+`<div class="dbody"><p>No costing record in Salesforce yet — lines to be entered${admin?" (add them below once line-adding lands for empty accounts, or ask Claude to seed them)":""}.</p></div>`;
    return;
  }
  let body = `<div class="dbody">`;
  if(admin){
    body += `<h2 class="sec">Account assumptions</h2><div class="grid2">
      ${fld("Monthly billing $", inp("eBill", a.bill, "0.01"))}
      ${fld("Target margin %", inp("eTm", a.tm==null?null:+(a.tm*100).toFixed(2), "0.1"))}
      ${fld("FICA %", inp("eFica", a.fica==null?null:+(a.fica*100).toFixed(3), "0.01"))}
      ${fld("SUTA %", inp("eSuta", a.suta==null?null:+(a.suta*100).toFixed(3), "0.01"))}
      ${fld("MTA %", inp("eMta", a.mta==null?null:+(a.mta*100).toFixed(3), "0.01"))}
      ${fld("WC %", inp("eWc", a.wc==null?null:+(a.wc*100).toFixed(3), "0.01"))}
      ${fld("Other / unalloc. %", inp("eOth", a.oth==null?null:+(a.oth*100).toFixed(3), "0.01"))}
      ${fld("FUTA $/EE/mo", inp("eFuta", a.futa, "0.01"))}
      ${fld("Service type", `<select id="eSvc"><option${a.svc!=="Security/Concierge"?" selected":""}>Standard</option><option${a.svc==="Security/Concierge"?" selected":""}>Security/Concierge</option></select>`)}
      ${fld("Union job", `<select id="eU"><option${a.u!=="Yes"?" selected":""}>No</option><option${a.u==="Yes"?" selected":""}>Yes</option></select>`)}
    </div>
    <div class="grid2" style="grid-template-columns:repeat(5,1fr)">
      ${fld("Legal fund $", inp("eLegal", a.funds?.legal, "0.01"))}
      ${fld("LM Coop $", inp("eLm", a.funds?.lm, "0.01"))}
      ${fld("Pension $", inp("ePen", a.funds?.pen, "0.01"))}
      ${fld("Supp Ret $", inp("eSup", a.funds?.sup, "0.01"))}
      ${fld("H&W $", inp("eHw", a.funds?.hw, "0.01"))}
    </div>`;
  }
  body += `<h2 class="sec">Monthly cost build-up <span style="font-weight:400;font-size:11px;color:var(--mute)">(live)</span></h2>
    <div id="dCalc">${drawerCalcHtml(a)}</div>`;
  const sect = (name, cols, rows, addBtn) => `
    <h2 class="sec" style="display:flex;justify-content:space-between;align-items:center">${name}
      ${admin?`<button class="btn ghost" style="font-size:11px;padding:4px 10px" onclick="addLine('${name.split(" ")[0]}')">+ Add</button>`:""}</h2>
    <table class="mini"><tr>${cols}</tr>${rows}</table>`;
  const pay = ls.filter(l=>l.sec==="Payroll"), pto = ls.filter(l=>l.sec==="PTO"), eq = ls.filter(l=>l.sec==="Equipment");
  const idxOf = l => DATA.lines.indexOf(l);
  if(admin){
    body += sect("Payroll lines","<th>Line</th><th>Ct</th><th>Rate $</th><th>Hrs/wk</th><th>OT</th><th class='r'>Monthly</th><th></th>",
      pay.map(l=>`<tr><td><input data-i="${idxOf(l)}" data-f="it" value="${esc(l.it)}"></td>
        <td><input class="w-num" data-i="${idxOf(l)}" data-f="ct" type="number" step="1" value="${l.ct==null?"":l.ct}"></td>
        <td><input class="w-rate" data-i="${idxOf(l)}" data-f="rt" type="number" step="0.01" value="${l.rt??""}"></td>
        <td><input class="w-num" data-i="${idxOf(l)}" data-f="rh" type="number" step="0.5" value="${l.rh??""}"></td>
        <td><input class="w-num" data-i="${idxOf(l)}" data-f="ot" type="number" step="0.5" value="${l.ot??""}"></td>
        <td class="r num" data-mo="${idxOf(l)}"></td>
        <td><button class="btn danger" onclick="delLine(${idxOf(l)})">✕</button></td></tr>`).join(""));
    body += sect("PTO lines","<th>Line</th><th>Ct</th><th>Rate $</th><th>PTO hrs/yr</th><th class='r'>Monthly</th><th></th>",
      pto.map(l=>`<tr><td><input data-i="${idxOf(l)}" data-f="it" value="${esc(l.it)}"></td>
        <td><input class="w-num" data-i="${idxOf(l)}" data-f="ct" type="number" step="1" value="${l.ct==null?"":l.ct}"></td>
        <td><input class="w-rate" data-i="${idxOf(l)}" data-f="rt" type="number" step="0.01" value="${l.rt??""}"></td>
        <td><input class="w-num" data-i="${idxOf(l)}" data-f="pto" type="number" step="1" value="${l.pto??""}"></td>
        <td class="r num" data-mo="${idxOf(l)}"></td>
        <td><button class="btn danger" onclick="delLine(${idxOf(l)})">✕</button></td></tr>`).join(""));
    body += sect("Equipment & supplies","<th>Item</th><th>Cost $</th><th>Freq</th><th>Life</th><th>Qty</th><th class='r'>Monthly</th><th></th>",
      eq.map(l=>`<tr><td><input data-i="${idxOf(l)}" data-f="it" value="${esc(l.it)}"></td>
        <td><input class="w-rate" data-i="${idxOf(l)}" data-f="cost" type="number" step="0.01" value="${l.cost??""}"></td>
        <td><select data-i="${idxOf(l)}" data-f="fq"><option${l.fq!=="One Time"?" selected":""}>Monthly</option><option${l.fq==="One Time"?" selected":""}>One Time</option></select></td>
        <td><input class="w-num" data-i="${idxOf(l)}" data-f="lt" type="number" step="1" value="${l.lt??""}"></td>
        <td><input class="w-num" data-i="${idxOf(l)}" data-f="qty" type="number" step="1" value="${l.qty??""}"></td>
        <td class="r num" data-mo="${idxOf(l)}"></td>
        <td><button class="btn danger" onclick="delLine(${idxOf(l)})">✕</button></td></tr>`).join(""));
  } else {
    if(pay.length) body += sect("Payroll lines","<th>Line</th><th class='r'>Ct</th><th class='r'>Rate</th><th class='r'>Hrs/wk</th><th class='r'>Monthly</th>",
      pay.map(l=>`<tr><td>${esc(l.it)}</td><td class="r num">${l.ct??1}</td><td class="r num">$${N(l.rt).toFixed(2)}</td><td class="r num">${l.rh||0}${l.ot?"+"+l.ot+"OT":""}</td><td class="r num">${fm$((l.ct==null?1:N(l.ct))*N(l.rt)*(N(l.rh)+1.5*N(l.ot))*WK_MO)}</td></tr>`).join(""));
    if(pto.length) body += sect("PTO lines","<th>Line</th><th class='r'>Rate</th><th class='r'>PTO hrs/yr</th><th class='r'>Monthly</th>",
      pto.map(l=>`<tr><td>${esc(l.it)}</td><td class="r num">$${N(l.rt).toFixed(2)}</td><td class="r num">${l.pto||0}</td><td class="r num">${fm$((l.ct==null?1:N(l.ct))*N(l.rt)*N(l.pto)/12)}</td></tr>`).join(""));
    if(eq.length) body += sect("Equipment & supplies","<th>Item</th><th class='r'>Cost</th><th class='r'>Freq</th><th class='r'>Monthly</th>",
      eq.map(l=>`<tr><td>${esc(l.it)}</td><td class="r num">${l.cost!=null?fm$(N(l.cost)):"—"}</td><td class="r">${esc(l.fq)||"Monthly"}</td><td class="r num">${fm$(l.fq==="One Time"?N(l.cost)*N(l.qty)/Math.max(N(l.lt),1):N(l.cost)*N(l.qty))}</td></tr>`).join(""));
  }
  body += `</div>`;
  document.getElementById("drawer").innerHTML = head+body;
  if(admin){
    const map = { eBill:["bill",1], eTm:["tm",.01], eFica:["fica",.01], eSuta:["suta",.01], eMta:["mta",.01],
                  eWc:["wc",.01], eOth:["oth",.01], eFuta:["futa",1] };
    for(const [id,[k,mult]] of Object.entries(map)){
      const el = document.getElementById(id);
      if(el) el.addEventListener("input", ()=>{ a[k] = el.value===""?null:parseFloat(el.value)*mult; markDirty(a); refreshCalc(); });
    }
    document.getElementById("eSvc").addEventListener("change", e=>{ a.svc = e.target.value; markDirty(a); refreshCalc(); });
    document.getElementById("eU").addEventListener("change", e=>{ a.u = e.target.value; markDirty(a); refreshCalc(); });
    const fmap = { eLegal:"legal", eLm:"lm", ePen:"pen", eSup:"sup", eHw:"hw" };
    for(const [id,k] of Object.entries(fmap)){
      const el = document.getElementById(id);
      el.addEventListener("input", ()=>{ a.funds = a.funds||{}; a.funds[k] = el.value===""?null:parseFloat(el.value); markDirty(a); refreshCalc(); });
    }
    document.querySelectorAll("#drawer [data-i]").forEach(el=>{
      el.addEventListener(el.tagName==="SELECT"?"change":"input", ()=>{
        const l = DATA.lines[+el.dataset.i], f = el.dataset.f;
        l[f] = (el.type==="number") ? (el.value===""?null:parseFloat(el.value)) : el.value;
        markDirty(a); refreshCalc();
      });
    });
    refreshCalc();
  }
}
function drawerCalcHtml(a){
  const m = calc(a);
  const row = (l,v,b)=>`<div class="rowline${b?' total':''}"><span>${l}</span><b class="num">${v}</b></div>`;
  return row(`Payroll (${m.HC} heads)`, fm$(m.P)) + row("PTO", fm$(m.PTO)) + row("Equipment & supplies", fm$(m.EQ)) +
    row("Payroll taxes", fm$(m.TAX)) + row("Management", fm$(m.MG)) +
    (m.BEN ? row("Union benefits (funds)", fm$(m.BEN)) : "") +
    row("GL insurance", fm$(m.GL)) + row("TOTAL COST", fm$(m.TOT), true) +
    row("Monthly billing", a.bill!=null?fm$(N(a.bill)):"—", true) +
    row("Profit / month", fm$(m.PROF), true) +
    row(`REQUIRED BILLING @ ${a.tm!=null?fmP(N(a.tm)):"target"}`, fm$(m.REQ), true);
}
function refreshCalc(){
  if(!CUR) return;
  const m = calc(CUR);
  document.getElementById("dCalc").innerHTML = drawerCalcHtml(CUR);
  const badge = document.getElementById("dMargin");
  badge.textContent = "Margin "+fmP(m.M); badge.className = "badge "+bcls(m.M);
  document.querySelectorAll("#drawer [data-mo]").forEach(td=>{
    const l = DATA.lines[+td.dataset.mo]; if(!l) return;
    let v = 0;
    if(l.sec==="Payroll") v = (l.ct==null?1:N(l.ct))*N(l.rt)*(N(l.rh)+1.5*N(l.ot))*WK_MO;
    else if(l.sec==="PTO") v = (l.ct==null?1:N(l.ct))*N(l.rt)*N(l.pto)/12;
    else v = l.fq==="One Time" ? N(l.cost)*N(l.qty)/Math.max(N(l.lt),1) : N(l.cost)*N(l.qty);
    td.textContent = fm$(v);
  });
}
function addLine(kind){
  const sec = kind==="Payroll"?"Payroll":kind==="PTO"?"PTO":"Equipment";
  const tpl = sec==="Payroll" ? {cid:CUR.cid, sec, it:"New position", ct:1, rt:null, rh:null, ot:null}
            : sec==="PTO" ? {cid:CUR.cid, sec, it:"New PTO line", ct:1, rt:null, pto:null}
            : {cid:CUR.cid, sec, it:"New item", cost:null, fq:"Monthly", lt:null, qty:1};
  DATA.lines.push(tpl); reindex(); markDirty(CUR); renderDrawer();
}
function delLine(i){
  const l = DATA.lines[i];
  if(!confirm(`Remove line "${l.it}"?`)) return;
  DATA.lines.splice(i,1); reindex(); markDirty(CUR); renderDrawer();
}

