(() => {
"use strict";
const el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n};
const valid=d=>/^\d{4}-\d{2}-\d{2}$/.test(d)&&Number.isFinite(Date.parse(d+"T00:00:00Z"));
const label=d=>valid(d)?new Intl.DateTimeFormat("id-ID",{weekday:"short",day:"2-digit",month:"2-digit",year:"numeric",timeZone:"UTC"}).format(new Date(d+"T00:00:00Z")):"Belum dipilih";
const split=s=>s.split(/[;\n]/).map(x=>x.trim()).filter(Boolean);
function create({getModal,api,today,readMenu,setMenu,setEditorLocked,onDistribution,onState,onDateChange,onPersist}){
 let root=null,date="",request=0,listRequest=0,loading=false,saving=false,applying=false,editing=false,rows=[],drafts=new Map(),saved=null,locked=false,ready=false,failed=false,conflict=null;
 const q=s=>root?.querySelector(s), mq=s=>getModal()?.querySelector(s);
 const active=()=>root?.isConnected&&!getModal().hidden&&!root.closest(".docs-view-create")?.hidden;
 function msg(id,text,bad=false){const n=q(id);if(n){n.textContent=text;n.dataset.error=String(bad)}}
 const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
 const version=()=>saved?.updated_at??null;
 const requiresSave=()=>ready&&!locked&&!!saved&&!same(readMenu(),saved.menu_items);
 function buttons(){setEditorLocked?.(!ready||locked||saving||(date<today()&&!!saved));const retry=q("#docsMenuRetry"),recover=q("#docsRestoreMenuDraft");if(retry)retry.hidden=!failed;if(recover)recover.hidden=!conflict||locked||!ready||date<today();const main=mq("#docsDate"),menu=q("#docsMenuDate");if(main)main.disabled=saving;if(menu)menu.disabled=saving;const quick=q("#docsSaveDailyMenu"),save=q("#docsSavePlans"),add=q("#docsAddPlanDate");if(quick)quick.disabled=saving||!ready||locked||!valid(date)||date<today()||!readMenu().length;if(save){save.hidden=!editing;save.disabled=saving||!rows.some(r=>r.dirty&&!r.locked)}if(add)add.disabled=saving||rows.filter(r=>r.dirty).length>=20}
 function syncMenuLabel(){const title=q("#docsMenuForDate");if(title)title.textContent="Komponen menu";buttons()}
 function apply(items){applying=true;try{setMenu(items)}finally{applying=false}syncMenuLabel()}
 function menuChanged(){if(!root?.isConnected)return;if(!applying&&ready&&!locked){drafts.set(date,{items:readMenu().slice(),base:version()});conflict=null;msg("#docsDailyStatus",requiresSave()?"Simpan perubahan menu sebelum terbit.":"")}syncMenuLabel()}
 function capture(){return {menuBase:version(),menuConflict:conflict?.items||null,planDraft:rows.filter(r=>r.dirty&&!r.locked).map(r=>({tanggal:r.tanggal,text:r.text,base:r.base??null,saved:!!r.saved}))}}
 function syncDate(force=false,restored=null){
  if(!root?.isConnected)return;const next=mq("#docsDate").value;if(next===date&&!force)return;
  if(next!==date){onDistribution?.(null);conflict=null}
  date=next;q("#docsMenuDate").value=date;const seq=++request;loading=false;ready=false;failed=false;saved=null;locked=false;
  if(restored){drafts.set(date,{items:restored.items.slice(),base:restored.base});conflict=restored.conflict?{items:restored.conflict.slice()}:null}
  apply(drafts.get(date)?.items||[]);renderRows();
  if(!valid(date)){msg("#docsDailyStatus","Pilih tanggal.");onState();return}
  if(!active()){onState();return}
  const form=root,selected=date;loading=true;msg("#docsDailyStatus","Memuat menu…");buttons();onState();
  api("menus/plans?tanggal="+encodeURIComponent(selected)).then(data=>{
   if(seq!==request||root!==form||!active())return;
   if(!Array.isArray(data.plans))throw Error("Respons menu tidak valid.");
   saved=data.plans.find(p=>p.tanggal===selected)||null;
   const dist=data.distribution||null,local=drafts.get(selected);locked=!!dist?.id;
   if(locked){if(!Array.isArray(dist.menu_items))throw Error("Distribusi tidak lengkap.");onDistribution?.(dist);drafts.delete(selected);conflict=null;apply(dist.menu_items);msg("#docsDailyStatus","Data distribusi terkunci · Arsip")}
   else{
    onDistribution?.(null);
    if(saved&&!Array.isArray(saved.menu_items))throw Error("Rencana menu tidak valid.");
    if(saved&&local&&!same(local.items,saved.menu_items)&&local.base!==version()){
     conflict={items:local.items.slice()};drafts.delete(selected);apply(saved.menu_items);msg("#docsDailyStatus","Menu tersimpan lebih baru. Draf menu tersedia.",true)
    }else if(saved&&selected<today()){drafts.delete(selected);apply(saved.menu_items);msg("#docsDailyStatus","Rencana tanggal lampau · hanya baca.")}
    else if(local){apply(local.items);msg("#docsDailyStatus",saved&&!same(local.items,saved.menu_items)?"Simpan perubahan menu sebelum terbit.":"")}
    else{apply(saved?.menu_items||[]);msg("#docsDailyStatus",conflict?"Menu tersimpan lebih baru. Draf menu tersedia.":"")}
   }
   ready=true;
  }).catch(e=>{if(seq===request&&root===form&&active()){failed=true;ready=false;msg("#docsDailyStatus","Gagal memuat menu: "+e.message,true)}})
  .finally(()=>{if(seq===request&&root===form){loading=false;buttons();onState();if(ready)onPersist?.(false)}});
 }
 function restoreMenu(items,base,planDraft,menuConflict){
  if(!root?.isConnected)return;
  if(Array.isArray(planDraft)){rows=planDraft.map(r=>({...r,dirty:true,locked:false}));if(rows.length)mode(true)}
  syncDate(true,{items:Array.isArray(items)?items:[],base,conflict:menuConflict});loadRows();
 }
 function choose(value){if(saving)return;mq("#docsDate").value=value;syncDate();onDateChange?.()}
 function mode(value){editing=value;const help=q("#docsPlanHelp");if(help)help.hidden=!value;q("#docsQuickMode").setAttribute("aria-pressed",String(!value));q("#docsPlannerMode").setAttribute("aria-pressed",String(value));renderRows()}
 function renderRows(){
  const host=q("#docsPlanRows");if(!host)return;host.replaceChildren();
  if(!rows.length)host.append(el("p","daily-plan-empty","Belum ada rencana."));
  for(const row of rows){
   const wrap=el("div","daily-plan-row"+(row.tanggal===date?" is-current":""));
   if(editing&&!row.locked){
    const day=el("input","daily-plan-date");day.type="date";day.min=today();day.value=row.tanggal;day.disabled=row.saved||saving;day.setAttribute("aria-label","Tanggal rencana");
    const menu=el("input","daily-plan-menu");menu.type="text";menu.placeholder="Nasi; Ayam; Sayur";menu.maxLength=1450;menu.value=row.text;menu.disabled=saving;menu.setAttribute("aria-label","Komponen menu dipisah titik koma");
    const edit=()=>{row.tanggal=day.value;row.text=menu.value;row.dirty=true;buttons();onPersist?.(true)};
    day.addEventListener("input",edit);menu.addEventListener("input",edit);wrap.append(day,menu);
    if(!row.saved){const remove=el("button","daily-plan-remove","×");remove.type="button";remove.disabled=saving;remove.setAttribute("aria-label","Batalkan tanggal baru");remove.onclick=()=>{rows=rows.filter(r=>r!==row);renderRows();onPersist?.(true)};wrap.append(remove)}
   }else{
    const b=el("button","daily-plan-select");b.type="button";b.disabled=saving||!row.saved;b.append(el("span","daily-plan-date-label",label(row.tanggal)),el("span","daily-plan-menu-label",row.text.replaceAll("; ",", ")),el("span","daily-plan-chevron",row.locked?"🔒":"›"));b.title=row.text;b.onclick=()=>choose(row.tanggal);wrap.append(b);
   }
   host.append(wrap)
  }buttons();
 }
 async function loadRows(){
  if(!active())return;const seq=++listRequest,form=root;
  try{const data=await api("menus/plans");if(seq!==listRequest||form!==root||!active())return;const fresh=(data.plans||[]).filter(r=>r.tanggal>=today()).map(r=>({tanggal:r.tanggal,text:r.menu_items.join("; "),base:r.updated_at??null,saved:true,locked:!!r.locked,dirty:false}));const dirty=rows.filter(r=>r.dirty&&!fresh.some(f=>f.tanggal===r.tanggal&&f.locked)),changed=new Set(dirty.map(r=>r.tanggal));rows=[...fresh.filter(r=>!changed.has(r.tanggal)),...dirty].sort((a,b)=>a.tanggal.localeCompare(b.tanggal));renderRows();if(data.has_more)msg("#docsPlannerStatus","30 rencana terdekat.")}
  catch(e){if(seq===listRequest&&form===root&&active())msg("#docsPlannerStatus","Daftar gagal dimuat: "+e.message,true)}
 }
 function addDate(){if(saving)return;mode(true);let next=new Date((valid(date)&&date>=today()?date:today())+"T00:00:00Z");const existing=new Set(rows.map(r=>r.tanggal));while(existing.has(next.toISOString().slice(0,10)))next.setUTCDate(next.getUTCDate()+1);rows.push({tanggal:next.toISOString().slice(0,10),text:"",base:null,saved:false,dirty:true});renderRows();onPersist?.(true);q(".daily-plan-row:last-child .daily-plan-menu")?.focus()}
 async function save(plans,quick){
  const id=quick?"#docsDailyStatus":"#docsPlannerStatus";if(saving||quick&&(!ready||locked))return;
  if(!plans.length||plans.length>20||new Set(plans.map(p=>p.tanggal)).size!==plans.length||plans.some(p=>!valid(p.tanggal)||p.tanggal<today()||p.menu_items.length<1||p.menu_items.length>8||p.menu_items.some(v=>v.length>180))){msg(id,"Periksa tanggal unik dan 1–8 komponen (maks. 180 karakter per komponen).",true);return}
  if(!quick&&!window.confirm("Simpan "+plans.length+" rencana? Rencana pada tanggal yang sama akan diperbarui."))return;
  if(quick&&saved&&!same(saved.menu_items,plans[0].menu_items)&&!window.confirm("Perbarui menu tersimpan untuk tanggal ini?"))return;
  saving=true;listRequest++;renderRows();buttons();onState();const form=root,selected=date;msg(id,"Menyimpan rencana…");
  try{const data=await api("menus/plans",{plans});if(root!==form||!active())return;if(data.success!==true||!Array.isArray(data.plans)||data.plans.length!==plans.length)throw Error("Server belum mengonfirmasi penyimpanan.");
   for(const plan of data.plans){drafts.delete(plan.tanggal);rows=rows.filter(r=>r.tanggal!==plan.tanggal);rows.push({tanggal:plan.tanggal,text:plan.menu_items.join("; "),base:plan.updated_at??null,saved:true,locked:false,dirty:false})}
   const current=data.plans.find(p=>p.tanggal===selected);if(current&&selected===date){saved=current;conflict=null;apply(current.menu_items)}
   rows.sort((a,b)=>a.tanggal.localeCompare(b.tanggal));msg(id,quick?"Menu tersimpan.":plans.length+" rencana tersimpan.");if(!quick)mode(false);onPersist?.(true);
  }catch(e){if(root===form&&active()){msg(id,e.message,true);if(quick){failed=true;ready=false}else{const reload=q("#docsPlannerReload");if(reload)reload.hidden=false}}}
  finally{if(root===form){saving=false;renderRows();onState();if(ready)onPersist?.(false)}}
 }
 function bind(){
  const form=mq("#docsCreateForm");if(!form)return;
  if(root!==form){root=form;request++;listRequest++;date="";drafts=new Map();rows=[];editing=false;loading=false;saving=false;failed=false;ready=false;locked=false;saved=null;conflict=null;
   const main=mq("#docsDate"),menu=q("#docsMenuDate");
   main.addEventListener("input",()=>syncDate());main.addEventListener("change",()=>syncDate());
   menu.addEventListener("input",()=>choose(menu.value));menu.addEventListener("change",()=>{if(menu.value!==main.value)choose(menu.value)});
   q("#docsQuickMode").onclick=()=>mode(false);q("#docsPlannerMode").onclick=()=>mode(true);q("#docsAddPlanDate").onclick=addDate;
   q("#docsSaveDailyMenu").onclick=()=>save([{tanggal:date,menu_items:readMenu(),expected_updated_at:version()}],true);
   q("#docsSavePlans").onclick=()=>save(rows.filter(r=>r.dirty&&!r.locked).map(r=>({tanggal:r.tanggal,menu_items:split(r.text),expected_updated_at:r.base??null})),false);
   q("#docsMenuRetry").onclick=()=>syncDate(true);
   q("#docsRestoreMenuDraft").onclick=()=>{if(!conflict||locked||!ready)return;const items=conflict.items;conflict=null;drafts.set(date,{items,base:version()});apply(items);msg("#docsDailyStatus",requiresSave()?"Simpan perubahan menu sebelum terbit.":"");onState();onPersist?.(true)};
   q("#docsPlannerReload").onclick=()=>{if(window.confirm("Muat ulang daftar? Perubahan perencana yang belum disimpan dibatalkan.")){rows=rows.filter(r=>!r.dirty);q("#docsPlannerReload").hidden=true;renderRows();loadRows();onPersist?.(true)}};
   renderRows();syncDate(true)
  }else if(active()&&!loading&&!saving)syncDate(true);
  if(active())loadRows();
 }
 function reset(){request++;listRequest++;root=null;rows=[];drafts.clear();date="";loading=false;saving=false;failed=false;ready=false;locked=false;saved=null;conflict=null}
 return Object.freeze({bind,syncDate,restoreMenu,capture,menuChanged,reset,isApplying:()=>applying,isLoading:()=>loading,isSaving:()=>saving,isReady:()=>ready,hasFailed:()=>failed,isLocked:()=>locked,requiresSave})
}
function openHistory({api}){
 const dialog=el("dialog","daily-history-dialog");const head=el("header","daily-history-header"),close=el("button","docs-btn","Tutup");close.type="button";close.onclick=()=>dialog.close();head.append(el("h3",null,"Riwayat rencana menu"),close);
 const host=el("div","daily-history-list"),controls=el("div","daily-history-controls"),prev=el("button","docs-btn","Lebih baru"),next=el("button","docs-btn","Lebih lama");prev.type=next.type="button";controls.append(prev,next);dialog.append(head,el("p","daily-history-note","Rencana menu hari sebelumnya. Dokumen terbit tetap tersedia pada Arsip Distribusi."),host,controls);document.body.append(dialog);dialog.addEventListener("close",()=>dialog.remove(),{once:true});dialog.showModal();
 let offset=0;async function load(){prev.disabled=next.disabled=true;host.replaceChildren(el("p",null,"Memuat…"));try{const data=await api("menus/plans?history=true&offset="+offset);if(!dialog.isConnected)return;host.replaceChildren();for(const row of data.plans||[]){const item=el("div","daily-history-row");item.append(el("strong",null,label(row.tanggal)),el("span",null,row.menu_items.join(", ")));host.append(item)}if(!host.children.length)host.append(el("p",null,"Belum ada riwayat rencana menu."));prev.disabled=offset===0;next.disabled=!data.has_more}catch(e){if(dialog.isConnected)host.replaceChildren(el("p",null,e.message))}}
 prev.onclick=()=>{offset=Math.max(0,offset-30);load()};next.onclick=()=>{offset+=30;load()};load()
}
window.AutoDocDailyPlanner=Object.freeze({create,openHistory});
})();
