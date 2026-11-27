(() => {
"use strict";
const el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n};
const valid=d=>/^\d{4}-\d{2}-\d{2}$/.test(d)&&Number.isFinite(Date.parse(d+"T00:00:00Z"));
const label=d=>valid(d)?new Intl.DateTimeFormat("id-ID",{weekday:"short",day:"2-digit",month:"2-digit",year:"numeric",timeZone:"UTC"}).format(new Date(d+"T00:00:00Z")):"Belum dipilih";
const split=s=>s.split(/[;\n]/).map(x=>x.trim()).filter(Boolean);
function create({getModal,api,today,readMenu,setMenu,onState,onDateChange}){
 let root=null,date="",request=0,listRequest=0,revision=0,loading=false,saving=false,applying=false,editing=false,rows=[],drafts=new Map();
 const q=s=>root?.querySelector(s), mq=s=>getModal()?.querySelector(s);
 const active=()=>root?.isConnected&&!getModal().hidden&&!root.closest(".docs-view-create")?.hidden;
 function msg(id,text,bad=false){const n=q(id);if(n){n.textContent=text;n.dataset.error=String(bad)}}
 function buttons(){const quick=q("#docsSaveDailyMenu"),save=q("#docsSavePlans"),add=q("#docsAddPlanDate");if(quick)quick.disabled=saving||loading||!valid(date)||date<today()||!readMenu().length;if(save){save.hidden=!editing;save.disabled=saving||!rows.some(r=>r.dirty)}if(add)add.disabled=saving||rows.filter(r=>r.dirty).length>=20}
 function banner(){const n=mq("#docsActiveMenu");if(n){n.textContent="Menu aktif: "+(readMenu().join(", ")||"belum diisi");n.title=n.textContent}const title=q("#docsMenuForDate");if(title)title.textContent="Menu untuk "+label(date);buttons()}
 function apply(items){applying=true;try{setMenu(items)}finally{applying=false}banner()}
 function menuChanged(){if(!root?.isConnected)return;if(!applying){revision++;if(valid(date))drafts.set(date,readMenu().slice())}banner()}
 function syncDate(preserve=false){
  if(!root?.isConnected)return;const next=mq("#docsDate").value;
  if(next===date&&!preserve)return;
  if(next!==date&&!preserve&&valid(date))drafts.set(date,readMenu().slice());
  date=next;q("#docsMenuDate").value=date;const seq=++request;loading=false;
  if(!preserve)apply(drafts.get(date)||[]);else if(readMenu().length)drafts.set(date,readMenu().slice());
  banner();renderRows();
  if(!valid(date)||date<today()){msg("#docsDailyStatus",date?"Tanggal lampau: lihat riwayat di Arsip. Isi manual bila diperlukan.":"Pilih tanggal menu.");onState();return}
  if(!active()){onState();return}
  const form=root,selected=date,rev=revision;loading=true;msg("#docsDailyStatus","Memuat menu tanggal terpilih…");buttons();onState();
  api("menus/plans?tanggal="+encodeURIComponent(selected)).then(data=>{
   if(seq!==request||root!==form||!active())return;
   const saved=data.plans?.find(p=>p.tanggal===selected);
   if(saved&&revision===rev&&!drafts.has(selected)){apply(saved.menu_items);drafts.set(selected,saved.menu_items.slice())}
   msg("#docsDailyStatus",saved?"Rencana tanggal ini tersimpan.":"Belum ada rencana; isi menu langsung.");
  }).catch(e=>{if(seq===request&&root===form&&active())msg("#docsDailyStatus","Gagal memuat rencana: "+e.message,true)})
  .finally(()=>{if(seq===request&&root===form){loading=false;buttons();onState()}});
 }
 function choose(value){if(saving)return;mq("#docsDate").value=value;syncDate();onDateChange?.()}
 function mode(value){editing=value;q("#docsQuickMode").setAttribute("aria-pressed",String(!value));q("#docsPlannerMode").setAttribute("aria-pressed",String(value));renderRows()}
 function renderRows(){
  const host=q("#docsPlanRows");if(!host)return;host.replaceChildren();
  if(!rows.length)host.append(el("p","daily-plan-empty","Belum ada rencana. Tambahkan tanggal."));
  for(const row of rows){
   const wrap=el("div","daily-plan-row"+(row.tanggal===date?" is-current":""));
   if(editing){
    const day=el("input","daily-plan-date");day.type="date";day.min=today();day.value=row.tanggal;day.disabled=row.saved||saving;day.setAttribute("aria-label","Tanggal rencana");
    const menu=el("input","daily-plan-menu");menu.type="text";menu.placeholder="Nasi; Ayam; Sayur";menu.maxLength=1450;menu.value=row.text;menu.disabled=saving;menu.setAttribute("aria-label","Komponen menu dipisah titik koma");
    const edit=()=>{row.tanggal=day.value;row.text=menu.value;row.dirty=true;buttons()};
    day.addEventListener("input",edit);menu.addEventListener("input",edit);wrap.append(day,menu);
    if(!row.saved){const remove=el("button","daily-plan-remove","×");remove.type="button";remove.disabled=saving;remove.setAttribute("aria-label","Batalkan tanggal baru");remove.onclick=()=>{rows=rows.filter(r=>r!==row);renderRows()};wrap.append(remove)}
   }else{
    const b=el("button","daily-plan-select");b.type="button";b.disabled=saving||!row.saved;b.append(el("span","daily-plan-date-label",label(row.tanggal)),el("span","daily-plan-menu-label",row.text.replaceAll("; ",", ")),el("span","daily-plan-chevron","›"));b.title=row.text;b.onclick=()=>choose(row.tanggal);wrap.append(b);
   }
   host.append(wrap)
  }buttons();
 }
 async function loadRows(){
  if(!active())return;const seq=++listRequest,form=root;
  try{const data=await api("menus/plans");if(seq!==listRequest||form!==root||!active())return;const dirty=rows.filter(r=>r.dirty),changed=new Set(dirty.map(r=>r.tanggal));rows=[...(data.plans||[]).filter(r=>r.tanggal>=today()&&!changed.has(r.tanggal)).map(r=>({tanggal:r.tanggal,text:r.menu_items.join("; "),saved:true,dirty:false})),...dirty].sort((a,b)=>a.tanggal.localeCompare(b.tanggal));renderRows();if(data.has_more)msg("#docsPlannerStatus","Menampilkan 30 rencana terdekat. Tanggal lain dapat dipilih dari kalender.")}
  catch(e){if(seq===listRequest&&form===root&&active())msg("#docsPlannerStatus","Daftar gagal dimuat: "+e.message,true)}
 }
 function addDate(){if(saving)return;mode(true);let next=new Date((valid(date)&&date>=today()?date:today())+"T00:00:00Z");const existing=new Set(rows.map(r=>r.tanggal));while(existing.has(next.toISOString().slice(0,10)))next.setUTCDate(next.getUTCDate()+1);rows.push({tanggal:next.toISOString().slice(0,10),text:"",saved:false,dirty:true});renderRows();q(".daily-plan-row:last-child .daily-plan-menu")?.focus()}
 async function save(plans,quick){
  const id=quick?"#docsDailyStatus":"#docsPlannerStatus";if(saving)return;
  if(!plans.length||plans.length>20||new Set(plans.map(p=>p.tanggal)).size!==plans.length||plans.some(p=>!valid(p.tanggal)||p.tanggal<today()||p.menu_items.length<1||p.menu_items.length>8||p.menu_items.some(v=>v.length>180))){msg(id,"Periksa tanggal unik dan 1–8 komponen (maks. 180 karakter per komponen).",true);return}
  if(!quick&&!window.confirm("Simpan "+plans.length+" rencana? Rencana pada tanggal yang sama akan diperbarui."))return;
  if(quick&&rows.some(r=>r.saved&&r.tanggal===date&&JSON.stringify(split(r.text))!==JSON.stringify(plans[0].menu_items))&&!window.confirm("Perbarui menu tersimpan untuk tanggal ini?"))return;
  saving=true;listRequest++;renderRows();buttons();onState();const form=root,selected=date,rev=revision;msg(id,"Menyimpan rencana…");
  try{const data=await api("menus/plans",{plans});if(root!==form||!active())return;if(data.success!==true)throw Error("Server belum mengonfirmasi penyimpanan.");
   for(const plan of plans){drafts.set(plan.tanggal,plan.menu_items.slice());rows=rows.filter(r=>r.tanggal!==plan.tanggal);rows.push({tanggal:plan.tanggal,text:plan.menu_items.join("; "),saved:true,dirty:false})}
   const current=plans.find(p=>p.tanggal===selected);if(current&&selected===date&&rev===revision)apply(current.menu_items);
   rows.sort((a,b)=>a.tanggal.localeCompare(b.tanggal));msg(id,quick?"Menu tersimpan.":plans.length+" rencana tersimpan.");if(!quick)mode(false);
  }catch(e){if(root===form&&active())msg(id,e.message,true)}
  finally{if(root===form){saving=false;renderRows();onState()}}
 }
 function bind(){
  const form=mq("#docsCreateForm");if(!form)return;
  if(root!==form){root=form;request++;listRequest++;date="";drafts=new Map();rows=[];editing=false;loading=false;saving=false;
   const main=mq("#docsDate"),menu=q("#docsMenuDate");
   main.addEventListener("input",()=>syncDate());main.addEventListener("change",()=>syncDate());
   menu.addEventListener("input",()=>choose(menu.value));menu.addEventListener("change",()=>{if(menu.value!==main.value)choose(menu.value)});
   q("#docsQuickMode").onclick=()=>mode(false);q("#docsPlannerMode").onclick=()=>mode(true);q("#docsAddPlanDate").onclick=addDate;
   q("#docsSaveDailyMenu").onclick=()=>save([{tanggal:date,menu_items:readMenu()}],true);
   q("#docsSavePlans").onclick=()=>save(rows.filter(r=>r.dirty).map(r=>({tanggal:r.tanggal,menu_items:split(r.text)})),false);
   renderRows();syncDate(true)
  }else if(active())syncDate(true);
  if(active())loadRows();
 }
 function reset(){request++;listRequest++;root=null;rows=[];drafts.clear();date="";loading=false;saving=false}
 return Object.freeze({bind,syncDate,menuChanged,reset,isApplying:()=>applying,isLoading:()=>loading,isSaving:()=>saving})
}
function openHistory({api}){
 const dialog=el("dialog","daily-history-dialog");const head=el("header","daily-history-header"),close=el("button","docs-btn","Tutup");close.type="button";close.onclick=()=>dialog.close();head.append(el("h3",null,"Riwayat rencana menu"),close);
 const host=el("div","daily-history-list"),controls=el("div","daily-history-controls"),prev=el("button","docs-btn","Lebih baru"),next=el("button","docs-btn","Lebih lama");prev.type=next.type="button";controls.append(prev,next);dialog.append(head,el("p","daily-history-note","Rencana menu hari sebelumnya. Dokumen terbit tetap tersedia pada Arsip Distribusi."),host,controls);document.body.append(dialog);dialog.addEventListener("close",()=>dialog.remove(),{once:true});dialog.showModal();
 let offset=0;async function load(){prev.disabled=next.disabled=true;host.replaceChildren(el("p",null,"Memuat…"));try{const data=await api("menus/plans?history=true&offset="+offset);if(!dialog.isConnected)return;host.replaceChildren();for(const row of data.plans||[]){const item=el("div","daily-history-row");item.append(el("strong",null,label(row.tanggal)),el("span",null,row.menu_items.join(", ")));host.append(item)}if(!host.children.length)host.append(el("p",null,"Belum ada riwayat rencana menu."));prev.disabled=offset===0;next.disabled=!data.has_more}catch(e){if(dialog.isConnected)host.replaceChildren(el("p",null,e.message))}}
 prev.onclick=()=>{offset=Math.max(0,offset-30);load()};next.onclick=()=>{offset+=30;load()};load()
}
window.AutoDocDailyPlanner=Object.freeze({create,openHistory});
})();
