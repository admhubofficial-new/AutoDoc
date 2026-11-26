(() => {
"use strict";
const { apiUrl: API, publishableKey: KEY } = window.AutoDocConfig;
const $=(selector,root=document)=>root.querySelector(selector);
const esc=value=>String(value??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const LETTERHEAD_LOGO_URL="https://cnbomblvtddkmtojzpyd.supabase.co/storage/v1/object/public/logo%20bgn/logo-bgn%20(1).png";
function nowInJakarta(){
 const parts=new Intl.DateTimeFormat("en-GB",{timeZone:"Asia/Jakarta",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date());
 const values=Object.fromEntries(parts.filter(part=>part.type!=="literal").map(part=>[part.type,part.value]));
 return values.year+"-"+values.month+"-"+values.day;
}
const today=()=>nowInJakarta();
let realizationMode=false, queueRequest=0, historyRequest=0, masterRequest=0, publishing=false, formDirty=false;
const DRAFT_KEY="autodoc:distribution-draft:v1";
const DRAFT_TTL=12*60*60*1000;
let renderingForm=false,restoringDraft=false,draftRestored=false;
const draftFields=["docsDate","docsMealTime","docsTime","docsStaff","docsDriver","docsVehicle","docsKindSj","docsKindBast","docsIncludeOrganoleptic"];
function draftMessage(message){const el=$("#docsDraftStatus",modal);if(el)el.textContent=message}
function clearStoredDraft(){try{sessionStorage.removeItem(DRAFT_KEY)}catch(_){}}
function readStoredDraft(){
 try{
  const raw=sessionStorage.getItem(DRAFT_KEY);if(!raw)return null;
  if(raw.length>200000){clearStoredDraft();return null}
  const saved=JSON.parse(raw);
  if(saved.version!==1||!Number.isFinite(saved.savedAt)||saved.savedAt>Date.now()||Date.now()-saved.savedAt>DRAFT_TTL||!Array.isArray(saved.fields)||!Array.isArray(saved.menu)||!Array.isArray(saved.recipients)){clearStoredDraft();return null}
  const validId=id=>typeof id==="string"&&/^[0-9a-f-]{36}$/i.test(id);
  const fields=saved.fields.filter(item=>Array.isArray(item)&&draftFields.includes(item[0])&&(typeof item[1]==="boolean"||typeof item[1]==="string"&&item[1].length<=180));
  const menu=saved.menu.filter(item=>typeof item==="string"&&item.length<=180).slice(0,8);
  const recipients=saved.recipients.filter(validId).slice(0,100);
  let plan=null;
  if(saved.plan&&typeof saved.plan.tanggal==="string"&&/^\d{4}-\d{2}-\d{2}$/.test(saved.plan.tanggal)&&Array.isArray(saved.plan.groups)&&saved.plan.groups.length<=100){
   const groups=saved.plan.groups.filter(g=>g&&typeof g.label==="string"&&Array.isArray(g.menu_items)&&g.menu_items.length>0&&g.menu_items.length<=8&&g.menu_items.every(m=>typeof m==="string"&&m.length<=180)&&Array.isArray(g.recipient_ids)&&g.recipient_ids.every(validId)).map(g=>({label:g.label.slice(0,180),menu_items:g.menu_items,recipient_ids:g.recipient_ids.slice(0,100)}));
   if(groups.length!==saved.plan.groups.length){clearStoredDraft();return null}
   plan={tanggal:saved.plan.tanggal,groups};
  }else if(saved.plan){clearStoredDraft();return null}
  return {fields,menu,recipients,plan};
 }catch(_){clearStoredDraft();return null}
}
function saveDraft(){
 if(renderingForm||restoringDraft||!draftRestored||!formDirty||publishing||!$("#docsCreateForm",modal))return;
 try{
  sessionStorage.setItem(DRAFT_KEY,JSON.stringify({version:1,savedAt:Date.now(),...captureDraft(),plan:activeAiMenuPlan}));
  draftMessage("Draf tersimpan di tab ini · berlaku 12 jam");
 }catch(_){draftMessage("Draf hanya tersimpan sementara di halaman ini. Penyimpanan browser tidak tersedia.")}
}
function isBusy(){return publishing||!!modal?.querySelector(".docs-realization[data-state='loading']")}
function notifyBusy(){status("Penyimpanan sedang berlangsung. Tunggu konfirmasi server sebelum berpindah halaman.",false,"loading")}
let modal=null, tab="create", master={}, currentDocs=[], currentDistribution=null, returnFocusEl=null, masterLoaded=false, pendingOrganolepticPrint=null, activeAiMenuPlan=null, archiveController=null, realizationController=null, previewController=null, menuController=null;

async function api(route,body){
 const headers={"apikey":KEY,"Accept":"application/json"};
 const options={credentials:"include",cache:"no-store",headers};
 if(body){headers["Content-Type"]="application/json";options.method="POST";options.body=JSON.stringify(body)}
 const response=await fetch(API+"/"+route,options);
 let payload={};try{payload=await response.json()}catch(_){}
 if(!response.ok&&response.status!==207)throw new Error(payload.message||"Permintaan tidak berhasil.");
 return payload;
}
function node(tag,cls,text){const el=document.createElement(tag);if(cls)el.className=cls;if(text!==undefined)el.textContent=text;return el}
function status(message,bad,state){
  if(!modal)return;
  let el=$(".docs-msg",modal);
  if(!el){
   el=node("p","docs-msg");
   el.setAttribute("role","status");
   el.setAttribute("aria-live","polite");
   const host=$(".docs-body",modal)||$(".docs-dialog",modal)||modal;
   host.append(el);
  }
  el.textContent=message||"";
  el.setAttribute("role",bad?"alert":"status");
  el.setAttribute("aria-live",bad?"assertive":"polite");
  el.dataset.state=state||(bad?"error":message?"success":"");
  el.classList.toggle("error",!!bad);
 }
function close(returnHome=true){
 if(!modal)return;
 if(returnHome&&isBusy()){notifyBusy();return}
 queueRequest++;historyRequest++;masterRequest++;
 modal.hidden=true;modal.style.display="none";modal.setAttribute("aria-hidden","true");
 if(returnHome){
  window.AutoDocSetHomeNav?.("home");
  if(returnFocusEl&&returnFocusEl.isConnected)returnFocusEl.focus();
 }
}
function show(loadFormData=true){
 if(!modal)build()
 returnFocusEl=document.activeElement;
 modal.hidden=false;
 modal.style.display="flex";
 modal.style.visibility="visible";
 modal.setAttribute("aria-hidden","false");
 $(".docs-close",modal)?.focus();
 if(loadFormData&&!masterLoaded)loadMaster().catch(e=>{if(!modal.hidden&&tab==="create")status(e.message,true)});
 else if(loadFormData)syncPreflightSummary();
}
function build(){
 if(modal)return;
 modal=node("div","docs-overlay workspace-page");modal.hidden=true;
 modal.id="docsModal";modal.setAttribute("aria-hidden","true");
 const dialog=node("section","docs-dialog");dialog.setAttribute("role","region");dialog.setAttribute("aria-labelledby","docsTitle");
 const head=node("header","docs-head");
 const title=node("div");title.innerHTML="<h2 id='docsTitle'>Surat Jalan &amp; BAST MBG</h2><p>Buat dokumen distribusi, cetak, dan catat realisasi penerimaan.</p>";
 const closeBtn=node("button","docs-close","×");closeBtn.type="button";closeBtn.setAttribute("aria-label","Kembali ke Beranda");closeBtn.onclick=()=>close();head.append(title,closeBtn);
 const body=node("div","docs-body");
 body.innerHTML="<div class='docs-view-create'></div><div class='docs-view-history' hidden></div><p class='docs-msg' role='status' aria-live='polite'></p>";
 dialog.append(head,body);modal.append(dialog);document.getElementById("workspacePages").append(modal);
 // Main workspace is not a dismissible backdrop.
 document.addEventListener("keydown",e=>{
  if(modal.hidden||modal.inert||!modal.contains(document.activeElement))return;
  if(e.key==="Escape"){close();return}
 });
 renderCreate();
}
function options(items,valueKey,labelKey,label){
 let html="<option value=''>"+esc(label)+"</option>";
 (items||[]).filter(x=>x.aktif!==false).forEach(x=>{html+="<option value='"+esc(x[valueKey])+"'>"+esc(x[labelKey])+"</option>"});
 return html;
}
function masterSuggestions(items,key){
 return (Array.isArray(items)?items:[]).filter(item=>item&&item.aktif!==false&&String(item[key]||"").trim())
  .map(item=>"<option value='"+esc(item[key])+"'></option>").join("");
}
async function rememberMasterValue(entity,field,value){
 const normalized=String(value||"").trim();
 if(!normalized)return false;
 const list=Array.isArray(master[entity])?master[entity]:[];
 if(list.some(item=>String(item[field]||"").trim().toLocaleLowerCase("id-ID")===normalized.toLocaleLowerCase("id-ID")))return false;
 const data={[field]:normalized,aktif:true,urutan:(list.length+1)*10};
 if(entity==="staff")data.jabatan="";
 const result=await api("master/save",{entity,data});
 const saved=result&&result.data?result.data:data;
 master[entity]=[...list,saved];
 return true;
}
async function rememberCreationInputs(body){
 const tasks=[
  ["staff","nama",body.nama_petugas],
  ["drivers","nama",body.nama_pengemudi],
  ["vehicles","no_kendaraan",body.no_kendaraan]
 ];
 for(const [entity,field,value] of tasks)await rememberMasterValue(entity,field,value);
 const allMenus=[...(body.menu_items||[]),...Object.values(body.recipient_menu_items||{}).flat()];
 for(const value of allMenus)await rememberMasterValue("menus","teks_menu",value);
}
async function loadMaster(){
 const request=++masterRequest;
 status("Memuat daftar penerima dan data pendukung...",false,"loading");
 const [masterResult,recipientResult]=await Promise.allSettled([
  api("master/list?include_recipients=false"),
  api("master/recipients")
 ]);
 if(request!==masterRequest||modal.hidden)return;
 if(recipientResult.status!=="fulfilled"){
  const reason=recipientResult.reason;
  throw new Error("Daftar penerima gagal dimuat: "+(reason&&reason.message?reason.message:"kesalahan jaringan")+". Periksa sesi login dan endpoint master/recipients.");
 }
 const recipients=recipientResult.value&&recipientResult.value.recipients;
 if(!Array.isArray(recipients)) throw new Error("Server tidak mengirim daftar penerima dalam format yang benar.");
 master=masterResult.status==="fulfilled"&&masterResult.value&&masterResult.value.data?masterResult.value.data:{};
 master.recipients=recipients;
 masterLoaded=true;
 const stored=!draftRestored&&!formDirty?readStoredDraft():null;
 const draft=formDirty?captureDraft():stored;
 draftRestored=true;
 if(stored)activeAiMenuPlan=stored.plan;
 renderCreate();
 if(draft){
  restoreDraft(draft);formDirty=true;saveDraft();
  const unavailable=draft.recipients.filter(id=>!recipients.some(r=>String(r.id)===String(id)));
  if(unavailable.length)draftMessage("Draf dipulihkan. "+unavailable.length+" penerima tidak lagi aktif; periksa pilihan sebelum terbit.");
  else if(stored)draftMessage("Draf dari tab ini berhasil dipulihkan. Periksa kembali sebelum menerbitkan.");
 }
 const activeCount=recipients.length;
 const warning=masterResult.status==="rejected"?" Data pendukung (menu/petugas/kendaraan/pengemudi) gagal dimuat; daftar penerima tetap tersedia.":"";
 status(activeCount+" penerima aktif berhasil dimuat dari "+recipients.length+" data."+warning,masterResult.status==="rejected",masterResult.status==="rejected"?"error":activeCount?"success":"empty");
}
function renderMenuComponents(){menuController?.render()}
function readMenuComponents(){return menuController?.read()||[]}
function getAiMenuPlan(date){
 const plan=activeAiMenuPlan;
 if(!plan||plan.tanggal!==date||!Array.isArray(plan.groups))return null;
 return plan;
}
function hasAiMenuPlanDateMismatch(date){
 return !!(activeAiMenuPlan&&Array.isArray(activeAiMenuPlan.groups)&&activeAiMenuPlan.tanggal!==date);
}
function menuItemsForRecipient(recipientId,date){
 const plan=getAiMenuPlan(date||$("#docsDate",modal)?.value||today());
 if(plan){
  const group=plan.groups.find(item=>(item.recipient_ids||[]).map(String).includes(String(recipientId)));
  if(group){
   const firstGroup=plan.groups[0];
   if(group===firstGroup)return readMenuComponents();
   return Array.isArray(group.menu_items)?group.menu_items.slice(0,8):[];
  }
 }
 return readMenuComponents();
}
function recipientMenuMap(selected,date,defaultItems){
 const plan=getAiMenuPlan(date);
 const map={};
 if(!plan)return map;
 const selectedSet=new Set(selected.map(String));
 for(const group of plan.groups){
  const ids=(group.recipient_ids||[]).map(String).filter(id=>selectedSet.has(id));
  if(!ids.length)continue;
  const items=group===plan.groups[0]?defaultItems:group.menu_items;
  if(Array.isArray(items)&&items.length>=1&&items.length<=8)ids.forEach(id=>{map[id]=items.slice()});
 }
 return map;
}
function renderAiMenuPlanNotice(){
 const target=$("#docsAiMenuPlanNotice",modal);
 if(!target)return;
 target.replaceChildren();
 const plan=activeAiMenuPlan;
 if(!plan||!Array.isArray(plan.groups)){target.hidden=true;return}
 target.hidden=false;
 const mismatch=hasAiMenuPlanDateMismatch($("#docsDate",modal)?.value||today());
 const heading=node("strong",null,mismatch?"Tanggal rencana menu tidak cocok":"Menu AI · "+plan.groups.length+" kelompok");
 const description=node("p",null,mismatch
  ?"Rencana ini dibuat untuk "+plan.tanggal+". Samakan tanggal distribusi atau lepaskan rencana sebelum menerbitkan."
  :"Menu per kelompok akan disimpan pada dokumen masing-masing.");
 target.append(heading,description);
 if(mismatch)target.dataset.state="warning";else delete target.dataset.state;
 const list=node("ul");
 const recipientNames=new Map((master.recipients||[]).map(item=>[String(item.id),item.nama]));
 plan.groups.forEach(group=>{
  const ids=(group.recipient_ids||[]).map(String);
  const names=ids.map(id=>recipientNames.get(id)).filter(Boolean);
  const detail=(group.menu_items||[]).join(", ");
  list.append(node("li",null,(group.label||"Kelompok menu")+" · "+ids.length+" penerima"+(names.length?" ("+names.join(", ")+")":"")+" · "+detail));
 });
 target.append(list);
 const remove=node("button","docs-btn","Lepas penerapan AI");
 remove.type="button";
 remove.onclick=()=>{activeAiMenuPlan=null;formDirty=true;renderAiMenuPlanNotice();syncPreflightSummary();saveDraft();status("Penerapan menu AI dilepas. Belum ada dokumen diterbitkan.");previewController?.updateLivePreview()};
 target.append(remove);
}
function applyAiMenuPlan(plan){
 if(!plan||!/^\d{4}-\d{2}-\d{2}$/.test(String(plan.tanggal||""))||!Array.isArray(plan.groups)||!plan.groups.length)throw new Error("Rencana menu AI tidak valid.");
 const normalized=plan.groups.map(group=>{
  const menuItems=Array.isArray(group.menu_items)?group.menu_items.map(item=>String(item||"").trim()).filter(Boolean):[];
  const recipientIds=Array.isArray(group.recipient_ids)?[...new Set(group.recipient_ids.map(String))]:[];
  if(menuItems.length<1||menuItems.length>8||menuItems.some(item=>item.length>180))throw new Error("Setiap kelompok AI harus memiliki 1 sampai 8 menu yang valid.");
  return {label:String(group.label||"Kelompok menu"),menu_items:menuItems,recipient_ids:recipientIds};
 });
 const used=new Set();
 normalized.forEach(group=>group.recipient_ids.forEach(id=>{if(used.has(id))throw new Error("Satu penerima tidak boleh berada pada dua kelompok menu.");used.add(id)}));
 if(!used.size)throw new Error("Pilih minimal satu penerima pada kelompok menu AI.");
 activeAiMenuPlan={tanggal:plan.tanggal,groups:normalized};formDirty=true;
 realizationMode=false;queueRequest++;
 window.AutoDocSetHomeNav?.("print");
 show(false);tab="create";
 $("#docsTitle",modal).textContent="Buat Dokumen";
 $(".docs-head p",modal).textContent="Menu sudah dikelompokkan oleh AI. Periksa penerima dan data sebelum menerbitkan.";
 $(".docs-view-create",modal).hidden=false;$(".docs-view-history",modal).hidden=true;
 const applyToForm=()=>{
  if(!$("#docsCreateForm",modal)){renderCreate()}
  const date=$("#docsDate",modal);
  if(date)date.value=activeAiMenuPlan.tanggal;
  const activeRecipients=new Set((master.recipients||[]).filter(item=>item&&item.aktif!==false).map(item=>String(item.id)));
  const unknownIds=[...used].filter(id=>!activeRecipients.has(id));
  if(unknownIds.length)throw new Error(unknownIds.length+" tujuan AI tidak lagi ada atau sudah nonaktif. Ulangi pemuatan Data Master dan periksa pemetaan.");
  const first=activeAiMenuPlan.groups[0]?.menu_items||[];
  menuController?.set(first);
  const plannedRecipients=new Set([...used].map(String));
  modal.querySelectorAll("input[name='recipient']").forEach(input=>{input.checked=plannedRecipients.has(String(input.value))});
  renderMenuComponents();renderAiMenuPlanNotice();updateSelectedCount();
  status("Menu AI diterapkan dan "+used.size+" penerima sudah dipilih otomatis. Periksa kembali setiap kelompok sebelum menerbitkan.");
 };
 if(masterLoaded)applyToForm();
 else loadMaster().then(applyToForm).catch(error=>status(error.message,true));
}
function selectedDocumentKinds(){
 const kinds=[];
 if($("#docsKindSj",modal)?.checked)kinds.push("SJ");
 if($("#docsKindBast",modal)?.checked)kinds.push("BAST");
 return kinds;
}
function addMenuComponent(value=""){menuController?.add(value)}
async function copyLastMenu(){
 const button=$("#docsCopyLastMenu",modal);
 if(!button)return;
 const oldText=button.textContent;button.disabled=true;button.textContent="Memuat menu terakhir...";
 try{
  const days=await api("docs/days?offset=0");
  const latest=Array.isArray(days.distributions)?days.distributions[0]:null;
  if(!latest){status("Belum ada distribusi sebelumnya untuk disalin.",true);return}
  const detail=await api("docs/list?tanggal="+encodeURIComponent(latest.tanggal));
  const distribution=detail.distribution||latest;
  const items=Array.isArray(distribution.menu_items)
   ? distribution.menu_items.map(item=>String(item.nama_komponen||"").trim()).filter(Boolean)
   : [];
  if(!items.length&&String(distribution.menu||"").trim())items.push(String(distribution.menu).trim());
  if(!items.length){status("Distribusi terakhir belum memiliki komponen menu.",true);return}
  formDirty=true;menuController?.set(items.slice(0,8));renderMenuComponents();saveDraft();
  status("Menu dari distribusi "+latest.tanggal+" berhasil disalin ("+(menuController?.count()||items.length)+" komponen).");previewController?.updateLivePreview();
 }catch(error){status(error.message,true)}
 finally{button.disabled=false;button.textContent=oldText}
}
function captureDraft(){
 const ids=draftFields;
 return {fields:ids.map(id=>{const input=$("#"+id,modal);return [id,input?.type==="checkbox"?input.checked:input?.value]}),menu:readMenuComponents(),recipients:Array.from(modal.querySelectorAll("input[name='recipient']:checked")).map(input=>input.value)};
}
function restoreDraft(draft){
 restoringDraft=true;
 for(const [id,value] of draft.fields){const input=$("#"+id,modal);if(!input||value===undefined)continue;if(input.type==="checkbox")input.checked=value;else input.value=value}
 menuController?.set(draft.menu);renderMenuComponents();
 const selected=new Set(draft.recipients);
 modal.querySelectorAll("input[name='recipient']").forEach(input=>{input.checked=selected.has(input.value)});
 updateSelectedCount();renderAiMenuPlanNotice();
 restoringDraft=false;
}
function renderCreate(){
 renderingForm=true;
 try{renderCreateForm()}finally{renderingForm=false}
}
function renderCreateForm(){
 const target=$(".docs-view-create",modal);
 if(!target)return;
 menuController?.reset();
 const recipients=Array.isArray(master.recipients)?master.recipients:[];
 const todayVal=today();
 const menuSuggestions=masterSuggestions(master.menus,"teks_menu");
 const recipientGroups=[...new Set(recipients.map(item=>String(item.kelompok||"").trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"id"));
 const groupOptions=recipientGroups.map(group=>"<option value='"+esc(group)+"'>"+esc(group)+"</option>").join("");
 target.innerHTML="<div class='docs-create-layout'>"+
  "<section class='docs-create-form-panel'>"+
   ""+
   "<form id='docsCreateForm' autocomplete='off'>"+
    "<div class='docs-draft-line'><span id='docsDraftStatus' role='status' aria-live='polite'>Draf otomatis di tab ini, tidak menerbitkan dokumen.</span><button type='button' class='docs-btn' id='docsDiscardDraft'>Kosongkan draf</button></div>"+
    "<div class='docs-work-summary' aria-label='Ringkasan persiapan'><div><small>Tujuan dipilih</small><strong id='docsSummaryRecipients'>0</strong></div><div><small>Total porsi</small><strong id='docsSummaryPortions'>0</strong></div><div><small>SJ / BAST</small><strong id='docsSummaryDocuments'>0</strong></div></div>"+
    "<section class='docs-form-section'><div class='docs-form-section-head'><div><h4>Distribusi</h4></div></div>"+

     "<div class='docs-grid docs-grid-compact'><div class='docs-field'><label for='docsDate'>Tanggal distribusi *</label><input id='docsDate' type='date' required value='"+todayVal+"'></div><div class='docs-field'><label for='docsMealTime'>Waktu makan</label><select id='docsMealTime'><option value='pagi'>Pagi</option><option value='siang' selected>Siang</option><option value='sore'>Sore</option></select></div></div>"+
     "<details class='docs-output-options'><summary><span>Jenis dokumen</span><strong id='docsOutputLabel'>Surat Jalan + BAST</strong></summary>"+
     "<fieldset class='docs-kind-group'><legend>Pilih jenis dokumen</legend><label class='docs-kind-choice'><input id='docsKindSj' type='checkbox' checked> Surat Jalan</label><label class='docs-kind-choice'><input id='docsKindBast' type='checkbox' checked> BAST</label></fieldset>"+
     "<label class='docs-organoleptic-option'><input id='docsIncludeOrganoleptic' type='checkbox'><span><strong>Tambahkan Formulir Uji Organoleptik</strong><small>Satu lembar A4 untuk setiap penerima.</small></span></label></details>"+
    "</section>"+
    "<section class='docs-form-section'><div class='docs-form-section-head'><div><h4>Menu &amp; penerima</h4></div></div>"+
     "<div class='docs-subsection-head'><div><strong>Menu distribusi</strong></div><button type='button' class='docs-btn' id='docsCopyLastMenu'>Salin menu terakhir</button></div>"+
     "<div id='docsAiMenuPlanNotice' class='docs-ai-menu-plan' hidden></div><div class='docs-menu-head'><strong id='docsMenuCount'>0 dari 8 komponen</strong></div><div class='docs-menu-list' id='docsMenuItems'></div><datalist id='docsMenuSuggestions'>"+menuSuggestions+"</datalist>"+
     "<div class='docs-menu-actions'><button type='button' class='docs-btn' id='docsAiMenuAssist'>Bantu isi dengan AI</button><button type='button' class='docs-btn primary' id='docsAddMenuItem'>+ Tambah komponen</button></div>"+
     "<div class='docs-recipient-subsection'><div class='docs-subsection-head'><div><strong>Penerima tujuan <span id='docsSelectedCount' class='docs-visually-hidden' aria-live='polite'>(0 dipilih)</span></strong></div><span id='docsRecipientResultCount' class='docs-recipient-result-count' aria-live='polite'>"+recipients.length+" tujuan</span></div>"+
      "<div class='docs-recipient-box docs-recipient-box-compact'><div class='docs-recipient-tools'><input id='docsRecipientSearch' type='search' placeholder='Cari nama penerima...' aria-label='Cari penerima' autocomplete='off'><select id='docsRecipientGroup' aria-label='Filter kelompok penerima'><option value=''>Semua kelompok</option>"+groupOptions+"</select><button type='button' class='docs-btn' id='docsSelectAll'>Pilih semua hasil</button><button type='button' class='docs-btn' id='docsClearAll'>Hapus pilihan</button></div><div class='docs-recipient-list' id='docsRecipientList'></div></div>"+
     "</div>"+
    "</section>"+
    "<section class='docs-form-section'><div class='docs-form-section-head'><div><h4>Pengiriman</h4></div></div>"+
     "<details class='docs-shipping-details' id='docsShippingDisclosure'><summary><span>Petugas, pengemudi, dan kendaraan</span></summary><div class='docs-shipping-fields'>"+
      "<div class='docs-grid docs-grid-compact'><div class='docs-field'><label for='docsTime'>Jam berangkat</label><input id='docsTime' type='time'></div><div class='docs-field'><label for='docsStaff'>Petugas</label><input id='docsStaff' type='text' list='docsStaffSuggestions' maxlength='180' placeholder='Pilih atau ketik nama petugas' autocomplete='off'><datalist id='docsStaffSuggestions'>"+masterSuggestions(master.staff,"nama")+"</datalist></div><div class='docs-field'><label for='docsDriver'>Pengemudi</label><input id='docsDriver' type='text' list='docsDriverSuggestions' maxlength='180' placeholder='Pilih atau ketik nama pengemudi' autocomplete='off'><datalist id='docsDriverSuggestions'>"+masterSuggestions(master.drivers,"nama")+"</datalist></div><div class='docs-field'><label for='docsVehicle'>Kendaraan</label><input id='docsVehicle' type='text' list='docsVehicleSuggestions' maxlength='80' placeholder='Pilih atau ketik nomor kendaraan' autocomplete='off'><datalist id='docsVehicleSuggestions'>"+masterSuggestions(master.vehicles,"no_kendaraan")+"</datalist></div></div>"+
      "<p class='docs-field-hint'>Data baru akan disimpan ke Data Master setelah dokumen berhasil diterbitkan.</p>"+
     "</div></details>"+
    "</section>"+
    "<div class='docs-submit-bar'><div class='docs-submit-meta'><strong id='docsSubmitCount' aria-live='polite'>0 penerima · 0 porsi</strong><p id='docsPreflightSummary' data-state='incomplete' role='status' aria-live='polite'>Pilih minimal satu penerima untuk melanjutkan.</p></div><div class='docs-submit-actions'><button type='button' class='docs-btn' id='docsPreviewToggle' aria-controls='docsPreviewDisclosure' aria-expanded='false'>Lihat pratinjau</button><button class='docs-btn primary' id='docsCreateButton' type='submit' disabled>Terbitkan dokumen</button></div></div>"+
   "</form><div id='docsCreateResult'></div>"+
  "</section>"+
  "<details class='docs-preview-panel' id='docsPreviewDisclosure'><summary class='docs-preview-summary'><strong>Pratinjau dokumen</strong><span class='docs-preview-toggle'>Buka</span></summary><div class='docs-preview-content'><div class='docs-preview-head'><div><strong>Data pratinjau</strong><small id='docsPreviewRecipient'>Pilih penerima untuk melihat dokumen</small></div><div class='docs-preview-selects'><select id='docsPreviewRecipientSelect' aria-label='Penerima pratinjau'><option value=''>Penerima</option></select><select id='docsPreviewKind' aria-label='Jenis dokumen pratinjau'><option value='SJ'>Surat Jalan</option><option value='BAST'>BAST</option><option value='ORGANOLEPTIC'>Uji Organoleptik</option></select></div></div><div class='docs-preview-paper'><iframe id='docsPreviewFrame' title='Pratinjau dokumen cetak' loading='lazy'></iframe></div></div></details>"+
 "</div>";
 renderMenuComponents();
 renderAiMenuPlanNotice();
 renderRecipients(recipients);
 const form=$("#docsCreateForm",target);
 $("#docsDiscardDraft",target).onclick=()=>{
  if(isBusy()){notifyBusy();return}
  if(!window.confirm("Kosongkan seluruh isian distribusi yang belum diterbitkan?"))return;
  clearStoredDraft();formDirty=false;activeAiMenuPlan=null;renderCreate();draftMessage("Draf dikosongkan.");
 };
 $("#docsRecipientSearch",target).addEventListener("input",filterRecipients);
 $("#docsRecipientGroup",target).addEventListener("change",filterRecipients);
 $("#docsSelectAll",target).onclick=()=>setAllRecipients(true);
 $("#docsClearAll",target).onclick=()=>setAllRecipients(false);
 $("#docsAddMenuItem",target).onclick=()=>addMenuComponent();
 $("#docsCopyLastMenu",target).onclick=copyLastMenu;
 $("#docsAiMenuAssist",target).addEventListener("click",()=>{
  if(window.AutoDocMaster?.open)window.AutoDocMaster.open("ai","",{mode:"menus"});
  else status("Asisten AI belum siap. Muat ulang halaman dan coba kembali.",true,"error");
 });
 $("#docsDate",target).addEventListener("change",()=>{renderAiMenuPlanNotice();previewController?.updateLivePreview()});
 $("#docsPreviewKind",target).addEventListener("change",()=>previewController?.updateLivePreview());
 $("#docsPreviewRecipientSelect",target).addEventListener("change",()=>previewController?.updateLivePreview());
 const previewDisclosure=$("#docsPreviewDisclosure",target);
 const previewToggle=$("#docsPreviewToggle",target);
 const previewSummaryToggle=$(".docs-preview-toggle",previewDisclosure);
 const desktopPreview=window.matchMedia("(min-width: 1120px)");
 previewDisclosure.open=desktopPreview.matches;
 const syncPreviewToggle=()=>{
  const expanded=previewDisclosure.open;
  previewToggle.setAttribute("aria-expanded",String(expanded));
  previewToggle.textContent=expanded?"Tutup pratinjau":"Lihat pratinjau";
  if(previewSummaryToggle)previewSummaryToggle.textContent=expanded?"Tutup":"Buka";
 };
 previewDisclosure.addEventListener("toggle",syncPreviewToggle);
 syncPreviewToggle();
 previewToggle.addEventListener("click",()=>{
  previewDisclosure.open=!previewDisclosure.open;
  syncPreviewToggle();
  if(previewDisclosure.open){
   previewController?.updateLivePreview();
   if(!desktopPreview.matches){
    previewDisclosure.scrollIntoView({behavior:window.matchMedia("(prefers-reduced-motion: reduce)").matches?"auto":"smooth",block:"start"});
   }
  }
 });
 form.addEventListener("input",()=>{formDirty=true;syncPreflightSummary();previewController?.updateLivePreview()});
 form.addEventListener("change",()=>{formDirty=true;syncPreflightSummary();previewController?.updateLivePreview()});
 form.addEventListener("input",saveDraft);
 form.addEventListener("change",saveDraft);
 form.addEventListener("submit",createDocs);
 syncPreflightSummary();
 previewController?.updateLivePreview();
}

function renderRecipients(recipients){
 const list=$("#docsRecipientList",modal);if(!list)return;
 list.replaceChildren();
 if(!recipients.length){
  const empty=node("div","docs-empty","Server berhasil dihubungi, tetapi belum ada penerima aktif. Periksa Status di Data Master.");
  empty.dataset.state="empty";empty.setAttribute("role","status");list.append(empty);
  updateRecipientResultCount();return;
 }
 recipients.forEach(r=>{
  const label=node("label","docs-recipient");
  label.dataset.group=String(r.kelompok||"");
  label.dataset.search=(String(r.nama||"")+" "+String(r.kelompok||"")+" "+String(r.jenjang||"")).toLocaleLowerCase("id-ID");
  const check=node("input");check.type="checkbox";check.name="recipient";check.value=r.id;check.checked=false;
  const content=node("span");
  const warning=r.perlu_verifikasi?" <span class='docs-verify'>Perlu verifikasi</span>":"";
  content.innerHTML="<strong>"+esc(r.nama)+warning+"</strong><small>"+esc(r.kelompok)+" · "+esc(r.jenjang)+" · "+Number(r.total_porsi||0).toLocaleString("id-ID")+" porsi</small>";
  check.addEventListener("change",updateSelectedCount);
  label.append(check,content);list.append(label);
 });
 updateRecipientResultCount();
 updateSelectedCount();
}
function updateRecipientResultCount(){
 const target=$("#docsRecipientResultCount",modal);
 const list=$("#docsRecipientList",modal);
 if(!target||!list)return;
 const visible=list.querySelectorAll(".docs-recipient:not([hidden])").length;
 const total=list.querySelectorAll(".docs-recipient").length;
 target.textContent=visible===total?total+" tujuan":visible+" dari "+total+" tujuan";
}
function filterRecipients(){
 const q=$("#docsRecipientSearch",modal)?.value.trim().toLocaleLowerCase("id-ID")||"";
 const group=$("#docsRecipientGroup",modal)?.value||"";
 modal.querySelectorAll(".docs-recipient").forEach(row=>{
  const matchesText=row.dataset.search.includes(q);
  const matchesGroup=!group||row.dataset.group===group;
  row.hidden=!(matchesText&&matchesGroup);
 });
 updateRecipientResultCount();
}
function setAllRecipients(value){
 modal.querySelectorAll("input[name='recipient']").forEach(input=>{
  if(!value||!input.closest(".docs-recipient").hidden)input.checked=!!value;
 });
 updateSelectedCount();
}

function syncPreflightSummary(){
 if(!modal)return;
 const target=$("#docsPreflightSummary",modal);
 if(!target)return;
 const selectedIds=new Set(Array.from(modal.querySelectorAll("input[name='recipient']:checked")).map(input=>String(input.value)));
 const selectedRecipients=(master.recipients||[]).filter(item=>selectedIds.has(String(item.id)));
 const totalPortions=selectedRecipients.reduce((sum,item)=>sum+Math.max(0,Number(item.total_porsi)||0),0);
 const dateValue=$("#docsDate",modal)?.value||"";
 const dateParts=dateValue.split("-").map(Number);
 const validDate=dateParts.length===3&&dateParts.every(Number.isInteger)&&dateParts[0]>=1&&dateParts[1]>=1&&dateParts[1]<=12&&dateParts[2]>=1&&dateParts[2]<=31&&new Date(Date.UTC(dateParts[0],dateParts[1]-1,dateParts[2])).toISOString().slice(0,10)===dateValue;
 const kinds=selectedDocumentKinds();
 const menuCount=typeof menuController?.count==="function"?menuController.count():modal.querySelectorAll("#docsMenuItems .docs-menu-input").length;
 const missing=[];
 if(!validDate)missing.push("tanggal distribusi");
 if(hasAiMenuPlanDateMismatch(dateValue))missing.push("samakan tanggal dengan rencana menu AI ("+activeAiMenuPlan.tanggal+") atau lepaskan rencana");
 if(!kinds.length)missing.push("jenis dokumen");
 if(!selectedIds.size)missing.push("minimal satu penerima");
 if(menuCount>8)missing.push("maksimal 8 komponen menu");
 const ready=missing.length===0;
 const needsVerification=selectedRecipients.filter(item=>item.perlu_verifikasi===true).length;
 target.dataset.state=ready?"ready":"incomplete";
 target.classList.toggle("is-ready",ready);
 target.textContent=ready
  ?"Siap diterbitkan."
  :"Lengkapi "+missing.join(", ")+".";
 if(needsVerification)target.textContent+=" Periksa kembali "+needsVerification+" penerima bertanda perlu verifikasi.";
 const countLabel=$("#docsSubmitCount",modal);
 if(countLabel)countLabel.textContent=selectedIds.size+" penerima · "+totalPortions.toLocaleString("id-ID")+" porsi";
 const counts={docsSummaryRecipients:selectedIds.size,docsSummaryPortions:totalPortions,docsSummaryDocuments:selectedIds.size*kinds.length};
 for(const [id,value] of Object.entries(counts)){const element=$("#"+id,modal);if(element)element.textContent=value.toLocaleString("id-ID")}
 const outputLabel=$("#docsOutputLabel",modal);
 if(outputLabel)outputLabel.textContent=(kinds.map(kind=>kind==="SJ"?"Surat Jalan":"BAST").join(" + ")||"Belum dipilih")+($("#docsIncludeOrganoleptic",modal)?.checked?" + Uji Organoleptik":"");
 const button=$("#docsCreateButton",modal);
 if(button)button.disabled=publishing||!ready;
}

function updateSelectedCount(){
 if(!renderingForm&&!restoringDraft)formDirty=true;
 const n=Array.from(modal.querySelectorAll("input[name='recipient']:checked")).length;
 const el=$("#docsSelectedCount",modal);if(el)el.textContent="("+n+" dipilih)";
 syncPreflightSummary();
 previewController?.updateLivePreview();
 saveDraft();
}
async function createDocs(event){
 event.preventDefault();if(publishing)return;status("");syncPreflightSummary();
 const dateValue=$("#docsDate",modal)?.value||"";
 if(hasAiMenuPlanDateMismatch(dateValue)){
  status("Penerbitan diblokir: rencana menu AI dibuat untuk "+activeAiMenuPlan.tanggal+". Samakan tanggal distribusi atau lepaskan rencana menu AI.",true);
  $("#docsDate",modal)?.focus();return;
 }
 const selected=Array.from(modal.querySelectorAll("input[name='recipient']:checked")).map(x=>x.value);
 if(!selected.length){status("Pilih minimal satu penerima.",true);$("#docsRecipientSearch",modal)?.focus();return}
 const kinds=selectedDocumentKinds();
 if(!kinds.length){status("Pilih minimal Surat Jalan atau BAST.",true);$("#docsKindSj",modal)?.focus();return}
 const includeOrganoleptic=$("#docsIncludeOrganoleptic",modal)?.checked===true;
 const menuItems=readMenuComponents();
 if(menuItems.length>8){status("Menu Hari Ini maksimal 8 komponen.",true);return}
 const aiPlan=getAiMenuPlan(dateValue);
 if(aiPlan){
  const assigned=new Set(aiPlan.groups.flatMap(group=>group.recipient_ids||[]).map(String));
  const unassigned=selected.filter(id=>!assigned.has(String(id)));
  if(unassigned.length){status(unassigned.length+" penerima belum dipetakan ke kelompok menu AI. Petakan atau hapus pilihan tersebut sebelum menerbitkan.",true);return}
 }
 const body={
  tanggal:$("#docsDate",modal).value,
  jam_berangkat:$("#docsTime",modal).value,
  menu_items:menuItems,
  recipient_menu_items:recipientMenuMap(selected,$("#docsDate",modal).value,menuItems),
  waktu_makan:$("#docsMealTime",modal).value||"siang",
  jenis_dokumen:kinds,
  nama_petugas:$("#docsStaff",modal).value.trim(),
  nama_pengemudi:$("#docsDriver",modal).value.trim(),
  no_kendaraan:$("#docsVehicle",modal).value.trim(),
  recipient_ids:selected
 };
 if(!body.tanggal){status("Tanggal distribusi wajib diisi.",true);$("#docsDate",modal)?.focus();return}
 publishing=true;
 const button=$("#docsCreateButton",modal);button.disabled=true;button.textContent="Menerbitkan dokumen...";
 status("Menerbitkan dokumen dan mengonfirmasi hasil dari server...",false,"loading");
 try{
  const result=await api("docs/create",body);
  let masterSaveWarning="";
  if(Number(result.berhasil)>0){
   try{await rememberCreationInputs(body)}
   catch(saveError){masterSaveWarning=" Dokumen berhasil dibuat, tetapi sebagian data baru belum tersimpan ke Data Master: "+saveError.message}
  }
  window.dispatchEvent(new Event("autodoc:data-changed"));
  pendingOrganolepticPrint=includeOrganoleptic?{tanggal:body.tanggal,recipientIds:selected.slice(),menuByRecipient:body.recipient_menu_items||{}}:null;
  const failed=(result.errors||[]).length;
  const summary=node("div","docs-result");
  summary.textContent=result.berhasil+" dari "+result.requested+" dokumen berhasil disiapkan. "+(failed?"Masih ada "+failed+" dokumen gagal; ulangi tanggal yang sama untuk melanjutkan.":"Nomor yang sudah terbit tidak akan dibuat ulang.");
  $("#docsCreateResult",modal).innerHTML="";$("#docsCreateResult",modal).append(summary);
  status((result.message||"Selesai.")+masterSaveWarning,failed>0||!!masterSaveWarning,failed>0||masterSaveWarning?"error":"success");
  await loadHistory(body.tanggal);
  if(!failed){clearStoredDraft();formDirty=false;activeAiMenuPlan=null;renderCreate()}
  window.AutoDocSetHomeNav?.("archive");
  $("#docsTitle",modal).textContent="Dokumen distribusi";
  $(".docs-head p",modal).textContent="Periksa hasil penerbitan dan gunakan aksi cetak."
  tab="history";
  $(".docs-view-create",modal).hidden=true;$(".docs-view-history",modal).hidden=false;
 }catch(e){status(e.message,true)}
 finally{publishing=false;button.textContent="Terbitkan dokumen";syncPreflightSummary()}
}
async function loadDistributions(initialOffset=0){
 historyRequest++;
 if(!archiveController)throw new Error("Modul arsip belum siap.");
 return archiveController.loadDistributions(initialOffset);
}
async function loadHistory(date){
 if(realizationMode)return loadRealizationQueue(date);
 const request=++historyRequest;
 const target=$(".docs-view-history",modal);if(!target)return;
 const chosen=date||($("#docsHistoryDate",modal)?.value)||today();
  target.innerHTML="<section class='docs-distribution-detail' aria-labelledby='docsDetailTitle'><header class='docs-detail-context'><div><p class='docs-detail-breadcrumb'>Arsip distribusi / Detail distribusi</p><h3 id='docsDetailTitle'>Detail Distribusi</h3><p class='docs-note'>Periksa dokumen pada tanggal ini. Aksi cetak tersedia terpisah dari pengelolaan arsip.</p></div><button type='button' class='docs-btn' id='docsBackToDays'>Kembali ke daftar distribusi</button></header><div class='docs-history-top'><div class='docs-field'><label for='docsHistoryDate'>Tanggal distribusi</label><input id='docsHistoryDate' type='date' value='"+esc(chosen)+"'></div><button type='button' class='docs-btn primary' id='docsLoadHistory'>Tampilkan</button></div><section class='docs-print-area' aria-labelledby='docsPrintAreaTitle'><div><h4 id='docsPrintAreaTitle'>Aksi cetak</h4><p class='docs-note'>Cetak ulang satu atau beberapa dokumen pada distribusi ini.</p></div><div class='docs-print-bulk' id='docsPrintBulk'><span class='docs-print-bulk-label'>Cetak massal</span><button type='button' class='docs-btn' id='docsPrintSj'>Semua Surat Jalan</button><button type='button' class='docs-btn' id='docsPrintBast'>Semua BAST</button><button type='button' class='docs-btn' id='docsPrintOrganoleptic'>Semua Uji Organoleptik</button></div><div class='docs-print-selection' id='docsPrintSelection'><label><input type='checkbox' id='docsPrintSelectAll'> Pilih semua dokumen</label><span id='docsPrintSelectionCount'>0 dipilih</span><button type='button' class='docs-btn primary' id='docsPrintSelected' disabled>Cetak dipilih</button></div><div id='docsPrintSelectedSlot'></div></section><div id='docsDistributionMeta' class='docs-note'></div><div class='docs-list' id='docsList'></div></section>";
 $("#docsBackToDays",target).onclick=()=>loadDistributions().catch(e=>status(e.message,true));
 $("#docsLoadHistory",target).onclick=()=>loadHistory($("#docsHistoryDate",target).value).catch(e=>status(e.message,true));
 $("#docsPrintSj",target).onclick=()=>printDocuments(currentDocs.filter(doc=>doc.jenis==="SJ"));
 $("#docsPrintBast",target).onclick=()=>printDocuments(currentDocs.filter(doc=>doc.jenis==="BAST"));
 $("#docsPrintOrganoleptic",target).onclick=()=>printOrganolepticForms(getArchiveRecipients(),getArchiveRecipientMenus());
 const printSelectAll=$("#docsPrintSelectAll",target),printSelectionCount=$("#docsPrintSelectionCount",target),printSelectedButton=$("#docsPrintSelected",target);
 const selectedPrintIds=new Set();
 function updatePrintSelection(){
  const selectedOnPage=currentDocs.filter(doc=>selectedPrintIds.has(String(doc.id))).length;
  printSelectionCount.textContent=selectedOnPage+" dari "+currentDocs.length+" dokumen dipilih";
  printSelectAll.checked=currentDocs.length>0&&selectedOnPage===currentDocs.length;
  printSelectAll.indeterminate=selectedOnPage>0&&selectedOnPage<currentDocs.length;
  printSelectAll.disabled=currentDocs.length===0;
  printSelectedButton.disabled=selectedOnPage===0;
  printSelectedButton.textContent=selectedOnPage?"Cetak dipilih ("+selectedOnPage+")":"Cetak dipilih";
  target.querySelectorAll("[data-print-doc-id]").forEach(input=>{input.checked=selectedPrintIds.has(input.dataset.printDocId)});
 }
 printSelectAll.addEventListener("change",()=>{
  selectedPrintIds.clear();
  if(printSelectAll.checked)currentDocs.forEach(doc=>selectedPrintIds.add(String(doc.id)));
  updatePrintSelection();
 });
 printSelectedButton.addEventListener("click",()=>printDocuments(currentDocs.filter(doc=>selectedPrintIds.has(String(doc.id)))));
 status("Memuat riwayat...",false,"loading");
 try{
  const result=await api("docs/list?tanggal="+encodeURIComponent(chosen));
  if(request!==historyRequest||realizationMode||modal.hidden)return;
  currentDistribution=result.distribution;currentDocs=result.documents||[];
  const list=$("#docsList",target);list.innerHTML="";
  const dist=currentDistribution||{};
  $("#docsDistributionMeta",target).textContent=(dist.menu||"Menu belum diisi")+" · Waktu makan: "+(dist.waktu_makan||"siang")+" · "+(dist.nama_petugas||"Petugas belum diisi")+" · "+(dist.nama_pengemudi||"Pengemudi belum diisi")+" · "+(dist.no_kendaraan||"Kendaraan belum diisi");
  const archiveRecipients=getArchiveRecipients();
  $("#docsPrintSj",target).disabled=!currentDocs.some(doc=>doc.jenis==="SJ");
  $("#docsPrintBast",target).disabled=!currentDocs.some(doc=>doc.jenis==="BAST");
  $("#docsPrintOrganoleptic",target).disabled=!dist.id||!archiveRecipients.length;
  if(pendingOrganolepticPrint&&pendingOrganolepticPrint.tanggal===chosen&&dist.id){
   const selectedRecipients=getRecipientsByIds(pendingOrganolepticPrint.recipientIds);
   if(selectedRecipients.length){
    const selectedButton=node("button","docs-btn primary","Cetak Uji Organoleptik · "+selectedRecipients.length+" penerima terpilih");
    selectedButton.type="button";selectedButton.onclick=()=>printOrganolepticForms(selectedRecipients,pendingOrganolepticPrint.menuByRecipient||{});
    $("#docsPrintSelectedSlot",target).append(selectedButton);
   }
  }
  if(!currentDocs.length){
   list.append(node("div","docs-empty","Belum ada dokumen bernomor untuk tanggal ini. Formulir Uji Organoleptik tetap dapat dicetak bila dipilih pada proses penerbitan."));
   status("");
   return;
  }
  const grouped=new Map();
  currentDocs.forEach(doc=>{
   const snap=doc.snapshot_json||{},recipient=snap.penerima||{};
   const key=String(doc.recipient_id||recipient.id||doc.id);
   if(!grouped.has(key))grouped.set(key,{recipient,docs:[]});
   else if(!grouped.get(key).recipient?.nama&&recipient.nama)grouped.get(key).recipient=recipient;
   grouped.get(key).docs.push(doc);
  });
  for(const group of grouped.values())list.append(renderDocumentGroup(group,selectedPrintIds,updatePrintSelection));
  updatePrintSelection();
  status(currentDocs.length+" dokumen · "+grouped.size+" penerima.");
 }catch(e){if(request===historyRequest&&!modal.hidden)status(e.message,true)}
}
async function loadAllPendingBast(){
 const target=$(".docs-view-history",modal);
 historyRequest++;
 const request=++queueRequest;
 target.replaceChildren();
 const toolbar=node("div","workspace-queue-toolbar");
 const heading=node("div","workspace-queue-intro");
 heading.append(node("h3",null,"BAST tertunda lintas tanggal"),node("p","docs-note","Riwayat diperiksa bertahap, delapan tanggal per pemuatan. Pencarian berlaku pada hasil yang sudah dimuat."));
 const single=node("button","docs-btn","Pilih tanggal tertentu");single.type="button";single.onclick=()=>loadRealizationQueue(today());
 const search=node("input","workspace-queue-search");search.type="search";search.placeholder="Cari penerima atau tanggal…";search.setAttribute("aria-label","Cari BAST lintas tanggal");
 toolbar.append(heading,single,search);
 const totals=node("p","workspace-queue-totals");totals.setAttribute("role","status");totals.setAttribute("aria-live","polite");
 const list=node("div","docs-list");list.id="docsRealizationQueue";
 const more=node("button","docs-btn primary","Muat tanggal berikutnya");more.type="button";
 target.append(toolbar,totals,list,more);
 let offset=0,hasMore=true,busy=false,checked=0,failed=false;
 const entries=new Map();
 function active(){return request===queueRequest&&realizationMode&&!modal.hidden}
 function render(){
  const q=search.value.trim().toLocaleLowerCase("id-ID");
  list.replaceChildren();
  let shown=0;
  for(const {date,doc} of entries.values()){
   const recipient=doc.snapshot_json?.penerima||{};
   if(![recipient.nama,date,doc.nomor_lengkap].join(" ").toLocaleLowerCase("id-ID").includes(q))continue;
   const card=node("article","docs-group-card workspace-queue-card");
   const head=node("div","docs-group-head");
   const info=node("div");info.append(node("h4",null,recipient.nama||"Penerima"),node("p",null,date+" · "+String(doc.nomor_lengkap||"")+" · "+Number(recipient.total_porsi||0).toLocaleString("id-ID")+" porsi"));
   const action=node("button","docs-btn primary","Input realisasi");action.type="button";action.onclick=()=>loadRealizationQueue(date,doc.id);
   head.append(info,action);card.append(head);list.append(card);shown++;
  }
  totals.textContent=entries.size+" BAST belum diisi · "+checked+" tanggal diperiksa"+(hasMore?" · riwayat belum selesai diperiksa":" · seluruh halaman riwayat diperiksa");
  if(!shown&&!busy&&!failed)list.append(node("div","docs-empty",q?"Tidak ada hasil pada tanggal yang telah dimuat.":hasMore?"Belum ada BAST tertunda pada tanggal yang diperiksa. Muat tanggal berikutnya.":"Tidak ada BAST tertunda dalam riwayat yang diperiksa."));
 }
 async function load(){
  if(busy||!hasMore||!active())return;
  busy=true;failed=false;more.disabled=true;more.textContent="Memeriksa riwayat…";status("Memuat tanggal dan BAST tertunda…",false,"loading");
  try{
   const page=await api("docs/days?offset="+offset);
   if(!active())return;
   if(!Array.isArray(page.distributions))throw Error("Respons riwayat tidak valid.");
   const dates=page.distributions.slice(0,8);
   if(!dates.length&&page.has_more)throw Error("Halaman riwayat tidak lengkap.");
   const batch=[];
   for(let i=0;i<dates.length;i+=3){
    const results=await Promise.all(dates.slice(i,i+3).map(async row=>({date:row.tanggal,result:await api("docs/list?tanggal="+encodeURIComponent(row.tanggal))})));
    if(!active())return;
    for(const {date,result} of results){
     if(!Array.isArray(result.documents))throw Error("Respons dokumen tidak valid.");
     for(const doc of result.documents)if(doc.jenis==="BAST"&&doc.status!=="batal"&&!doc.realisasi)batch.push({date,doc});
    }
   }
   if(!active())return;
   for(const entry of batch)entries.set(String(entry.doc.id),entry);
   offset+=dates.length;checked+=dates.length;
   hasMore=page.distributions.length>dates.length||Boolean(page.has_more);
   status("");
  }catch(error){
   if(!active())return;
   failed=true;status("Pemeriksaan belum selesai: "+error.message+". Coba lagi untuk tanggal yang sama.",true,"error");
  }finally{
   if(active()){busy=false;more.disabled=false;more.hidden=!hasMore;more.textContent=failed?"Coba lagi":"Muat tanggal berikutnya";render()}
  }
 }
 search.addEventListener("input",render);more.onclick=load;load();
}
async function loadRealizationQueue(date,focusDocId){
 if(date==="all")return loadAllPendingBast();
 const target=$(".docs-view-history",modal);
 const chosen=date||today();
 historyRequest++;
 const request=++queueRequest;
 target.replaceChildren();
 const toolbar=node("div","workspace-queue-toolbar");
 const field=node("div","docs-field");
 const label=node("label",null,"Tanggal distribusi");label.htmlFor="docsHistoryDate";
 const dateInput=node("input");dateInput.type="date";dateInput.id="docsHistoryDate";dateInput.value=chosen;
 field.append(label,dateInput);
 const load=node("button","docs-btn primary","Tampilkan");load.type="button";
 load.onclick=()=>{if(isBusy()){notifyBusy();return}if(target.querySelector(".docs-realization")&&!window.confirm("Tutup formulir realisasi yang belum disimpan?"))return;loadRealizationQueue(dateInput.value)};
 const search=node("input","workspace-queue-search");search.type="search";search.placeholder="Cari penerima…";search.setAttribute("aria-label","Cari penerima BAST");
 const filter=node("select","workspace-queue-filter");filter.setAttribute("aria-label","Status realisasi");
 for(const [value,label] of [["pending","Belum diisi"],["done","Selesai"],["all","Semua"]]){
  const option=node("option",null,label);option.value=value;filter.append(option);
 }
 const allDates=node("button","docs-btn","Semua tanggal");allDates.type="button";allDates.onclick=()=>{if(isBusy()){notifyBusy();return}if(target.querySelector(".docs-realization")&&!window.confirm("Tutup formulir realisasi yang belum disimpan?"))return;loadAllPendingBast()};
 toolbar.append(field,load,search,filter,allDates);
 const totals=node("p","workspace-queue-totals");totals.setAttribute("aria-live","polite");
 const list=node("div","docs-list");list.id="docsRealizationQueue";
 target.append(toolbar,totals,list);
 status("Memuat BAST…",false,"loading");
 try{
  const result=await api("docs/list?tanggal="+encodeURIComponent(chosen));
  if(request!==queueRequest||!realizationMode||modal.hidden)return;
  const docs=(result.documents||[]).filter(doc=>doc.jenis==="BAST"&&doc.status!=="batal");
  const pending=docs.filter(doc=>!doc.realisasi).length;
  totals.textContent=docs.length+" BAST · "+(docs.length-pending)+" selesai · "+pending+" belum diisi";
  function render(){
   list.replaceChildren();
   const query=search.value.trim().toLocaleLowerCase("id-ID");
   const rows=docs.filter(doc=>{
    const name=String(doc.snapshot_json?.penerima?.nama||"").toLocaleLowerCase("id-ID");
    return (filter.value==="all"||(filter.value==="done"?!!doc.realisasi:!doc.realisasi))&&name.includes(query);
   });
   if(!rows.length)list.append(node("div","docs-empty",docs.length?"Tidak ada BAST sesuai filter.":"Belum ada BAST pada tanggal ini. Pilih tanggal lain atau buat dokumen."));
   for(const doc of rows){
    const recipient=doc.snapshot_json?.penerima||{};
    const card=node("article","docs-group-card workspace-queue-card");
    const head=node("div","docs-group-head");
    const info=node("div");info.append(node("h4",null,recipient.nama||"Penerima"),node("p",null,String(doc.nomor_lengkap||"")+" · "+Number(recipient.total_porsi||0).toLocaleString("id-ID")+" porsi"));
    const action=node("button","docs-btn "+(doc.realisasi?"":"primary"),doc.realisasi?"Lihat/Ubah realisasi":"Input realisasi");action.type="button";action.onclick=()=>showRealization(card,doc);
    const state=node("span","docs-status "+(doc.realisasi?"selesai":""),doc.realisasi?"Selesai":"Belum diisi");
    head.append(info,state,action);card.append(head);list.append(card);
    if(focusDocId===doc.id){focusDocId=null;showRealization(card,doc)}
   }
  }
  let lastSearch="",lastFilter=filter.value;
  function changeFilter(){
   if(isBusy()||(list.querySelector(".docs-realization")&&!window.confirm("Tutup formulir realisasi yang belum disimpan?"))){search.value=lastSearch;filter.value=lastFilter;return}
   lastSearch=search.value;lastFilter=filter.value;render();
  }
  search.addEventListener("input",()=>{if(!list.querySelector(".docs-realization"))changeFilter()});search.addEventListener("change",changeFilter);filter.addEventListener("change",changeFilter);render();status("");
 }catch(error){
  if(request!==queueRequest||!realizationMode||modal.hidden)return;
  list.append(node("div","docs-empty","Daftar BAST gagal dimuat. Pilih Tampilkan untuk mencoba lagi."));
  status(error.message,true);
 }
}
function renderDocumentGroup(group,selectedPrintIds,updatePrintSelection){
 const recipient=group.recipient||{};
 const docs=group.docs||[];
 const card=node("article","docs-group-card");
 const head=node("div","docs-group-head");
 const info=node("div");
 const title=node("h4",null,recipient.nama||"Penerima");
 info.append(title,node("p",null,(recipient.kelompok||"")+" · "+(recipient.jenjang||"")+" · "+Number(recipient.total_porsi||0).toLocaleString("id-ID")+" porsi"));
 head.append(info);card.append(head);
 const actions=node("div","docs-group-actions");
 const organoleptic=node("button","docs-btn","Cetak Uji Organoleptik");organoleptic.type="button";organoleptic.onclick=()=>printOrganolepticForms([recipient],getArchiveRecipientMenus(docs));actions.append(organoleptic);
 docs.sort((a,b)=>a.jenis.localeCompare(b.jenis)).forEach(doc=>{
  const kind=doc.jenis==="SJ"?"Surat Jalan":"BAST";
  const pick=node("label","docs-print-doc-pick");const checkbox=node("input");checkbox.type="checkbox";checkbox.checked=selectedPrintIds.has(String(doc.id));checkbox.dataset.printDocId=String(doc.id);checkbox.setAttribute("aria-label","Pilih "+kind+" nomor "+doc.nomor_lengkap);checkbox.addEventListener("change",()=>{if(checkbox.checked)selectedPrintIds.add(String(doc.id));else selectedPrintIds.delete(String(doc.id));updatePrintSelection()});pick.append(checkbox,node("span",null,"Pilih untuk cetak"));actions.append(pick);
  const print=node("button","docs-btn", "Cetak "+kind);print.type="button";print.onclick=()=>printDocuments([doc]);actions.append(print);
  const stat=node("span","docs-status "+(doc.status||""),doc.status||"dibuat");actions.append(stat);
  if(doc.jenis==="BAST"){
   if(doc.status!=="batal"){
    const real=node("button","docs-btn primary",doc.realisasi?"Lihat/Ubah realisasi":"Input realisasi");
    real.type="button";real.onclick=()=>showRealization(card,doc);actions.append(real);
   }
  }
 });
 card.append(actions);return card;
}
const { buildPrintHtml } = window.AutoDocPrintRenderer;

function printDocuments(documents){
 const docs=Array.isArray(documents)?documents:[];
 if(!docs.length){status("Tidak ada dokumen untuk dicetak.",true);return}
 const htmls=docs.map(doc=>buildPrintHtml(doc,esc,LETTERHEAD_LOGO_URL));
 const first=htmls[0];
 const style=(first.match(/<style>([\s\S]*?)<\/style>/i)||[])[1]||"";
 const bodyParts=htmls.map(item=>{
  const match=item.match(/<body>([\s\S]*?)<\/body>/i);
  return match?match[1]:"";
 });
 const content=bodyParts.join("<div class='batch-page-break'></div>");
 const batchHtml="<!doctype html><html lang='id'><head><meta charset='utf-8'><title>Cetak "+docs.length+" dokumen AutoDoc</title><style>"+style+".batch-page-break{break-before:page;page-break-before:always}</style></head><body>"+content+"</body></html>";
 const win=window.open("","_blank");
 if(!win){status("Popup cetak diblokir. Izinkan popup untuk situs AutoDoc.",true);return}
 win.document.open();win.document.write(batchHtml);win.document.close();
 const toolbar=win.document.createElement("div");
 toolbar.className="autodoc-print-toolbar";
 toolbar.style.cssText="position:sticky;top:0;z-index:10;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 18px;background:#173d2c;color:#fff;font:13px system-ui,sans-serif";
 const note=win.document.createElement("span");
 note.textContent="Setelah dialog cetak ditutup, konfirmasikan jika dokumen benar-benar sudah dicetak.";
 const markButton=win.document.createElement("button");
 markButton.type="button";markButton.textContent="Konfirmasi sudah dicetak";
 markButton.style.cssText="padding:9px 13px;border:0;border-radius:8px;background:#fff;color:#173d2c;font:600 12px system-ui,sans-serif;cursor:pointer";
 toolbar.append(note,markButton);win.document.body.prepend(toolbar);
 const printStyle=win.document.createElement("style");
 printStyle.textContent="@media print{.autodoc-print-toolbar{display:none!important}}";
 win.document.head.append(printStyle);
 markButton.addEventListener("click",async()=>{
  markButton.disabled=true;markButton.textContent="Menyimpan…";
  try{
   const results=await Promise.all(docs.map(doc=>api("docs/mark-printed",{document_id:doc.id})));
   if(results.every(result=>result.updated)){
    markButton.textContent="Status cetak dicatat";
    note.textContent="Konfirmasi cetak berhasil disimpan.";
    window.dispatchEvent(new Event("autodoc:data-changed"));
    if(!modal.hidden){
     const dateField=$("#docsHistoryDate",modal);
     if(dateField)loadHistory(dateField.value).catch(()=>{});
    }
   }else{
    markButton.disabled=false;markButton.textContent="Ulangi konfirmasi";
    note.textContent="Sebagian dokumen tidak dapat diperbarui. Periksa status arsip.";
   }
  }catch(error){
   markButton.disabled=false;markButton.textContent="Ulangi konfirmasi";
   note.textContent=error.message||"Gagal menyimpan konfirmasi cetak.";
  }
 });
 let printStarted=false;
 const invokePrint=()=>{
  if(printStarted)return;
  printStarted=true;
  if(win.closed||typeof win.print!=="function")return;
  try{win.focus();win.print()}catch(_){note.textContent="Dialog cetak gagal dibuka. Gunakan tombol cetak browser."}
 };
 const logos=Array.from(win.document.querySelectorAll(".top-logo"));
 const imageReady=logo=>{
  if(logo.complete)return Promise.resolve();
  return new Promise(resolve=>{
   logo.addEventListener("load",resolve,{once:true});
   logo.addEventListener("error",resolve,{once:true});
  });
 };
 Promise.all(logos.map(imageReady)).then(()=>setTimeout(invokePrint,100));
 setTimeout(invokePrint,3000);
}
const { organolepticElement, organolepticInfoRow, organolepticMealNode, organolepticTable, organolepticSheet } = window.AutoDocOrganolepticPrint;

function getArchiveRecipientMenus(documents=currentDocs){
 const menus={};
 (Array.isArray(documents)?documents:[]).forEach(doc=>{
  const snapshot=doc.snapshot_json||{},recipient=snapshot.penerima||{};
  const id=String(doc.recipient_id||recipient.id||"");
  const stored=snapshot.distribusi?.menu_items;
  if(!id||!Array.isArray(stored)||!stored.length||menus[id])return;
  const items=stored.map(item=>typeof item==="string"?item:String(item?.nama_komponen||"").trim()).filter(Boolean).slice(0,8);
  if(items.length)menus[id]=items;
 });
 return menus;
}
function getArchiveRecipients(){
 const recipients=new Map();
 currentDocs.forEach(doc=>{
  const snapshot=doc.snapshot_json||{},recipient=snapshot.penerima||{};
  const id=String(doc.recipient_id||recipient.id||doc.id);
  if(!recipients.has(id))recipients.set(id,recipient);
  else if(!recipients.get(id)?.nama&&recipient.nama)recipients.set(id,recipient);
 });
 return Array.from(recipients.values()).filter(recipient=>recipient&&recipient.nama);
}
function getRecipientsByIds(ids){
 const requested=new Set((ids||[]).map(String)),byId=new Map();
 currentDocs.forEach(doc=>{
  const recipient=(doc.snapshot_json||{}).penerima||{};
  const id=String(doc.recipient_id||recipient.id||doc.id);
  if(requested.has(id)&&recipient.nama)byId.set(id,recipient);
 });
 (master.recipients||[]).forEach(recipient=>{
  const id=String(recipient.id||"");
  if(requested.has(id)&&recipient.nama&&!byId.has(id))byId.set(id,recipient);
 });
 return Array.from(requested).map(id=>byId.get(id)).filter(Boolean);
}
function printOrganolepticForms(recipients,menuByRecipient={}){
 const selected=Array.isArray(recipients)?recipients.filter(recipient=>recipient&&recipient.nama):[];
 if(!selected.length){status("Tidak ada penerima untuk formulir uji organoleptik.",true);return}
 if(!currentDistribution){status("Data distribusi tidak tersedia. Muat ulang arsip tanggal tersebut.",true);return}
 const win=window.open("","_blank");
 if(!win){status("Popup cetak diblokir. Izinkan popup untuk situs AutoDoc.",true);return}
 const printDoc=win.document;
 printDoc.open();
 printDoc.write("<!doctype html><html lang='id'><head><meta charset='utf-8'><meta name='viewport' content='width=device-width, initial-scale=1'><title>Formulir Uji Organoleptik</title></head><body></body></html>");
 printDoc.close();
 const style=printDoc.createElement("style");style.textContent="\n:root{--ink:#000;--paper:#fff}\n*{box-sizing:border-box}\nhtml{-webkit-print-color-adjust:exact;print-color-adjust:exact}\nbody{margin:0;background:#e8ebe9;color:var(--ink);font-family:\"Times New Roman\",\"Liberation Serif\",Times,serif;font-size:12pt;line-height:1.35}\n.toolbar{position:sticky;top:0;z-index:5;display:flex;align-items:center;justify-content:space-between;gap:16px;padding:10px 20px;background:#14201a;color:#fff;font-family:system-ui,-apple-system,\"Segoe UI\",Roboto,sans-serif;font-size:14px}\n.toolbar button{height:36px;padding:0 18px;border:0;border-radius:8px;background:#fff;color:#14201a;font:inherit;font-weight:600;cursor:pointer}\n.toolbar button:focus-visible{outline:3px solid #9fd3b8;outline-offset:2px}\n.sheet{width:210mm;height:297mm;margin:18px auto;padding:15mm;background:var(--paper);box-shadow:0 1px 6px rgba(0,0,0,.18);display:flex;flex-direction:column;break-after:page;page-break-after:always}\n.sheet:last-of-type{break-after:auto;page-break-after:auto}\n.title{margin:4mm 0 8mm;text-align:center;font-size:13pt;font-weight:700}\n.info{display:grid;grid-template-columns:34mm 4mm 1fr;row-gap:1mm;margin-bottom:6mm}\n.info .val{font-weight:400}\n.caption{margin:0 0 1.5mm;text-align:center;font-weight:700;font-size:11.5pt}\ntable.grid{width:100%;border-collapse:collapse;table-layout:fixed}\ntable.grid th,table.grid td{border:1px solid var(--ink);padding:1.5mm;text-align:center}\ntable.grid thead th{font-weight:700;font-size:11.5pt}\ntable.grid col.menu{width:28%}\ntable.grid thead tr+tr th{font-size:10.5pt;padding:1.5mm .5mm}\ntable.grid tbody td{height:10mm}\ntable.grid tbody th{font-weight:700;font-size:11.5pt;padding:1.5mm 2mm}\n.note{margin:5mm 0 4mm;font-size:11.5pt}\n.note p{margin:0}\n.note .row{display:grid;grid-template-columns:14mm 1fr}\n.followup{flex:1 1 auto;min-height:50mm;border:1px solid var(--ink);padding:3mm 4mm;font-weight:700}\n.signs{display:flex;justify-content:space-between;gap:18mm;margin-top:8mm;font-size:11.5pt}\n.sign{width:72mm;text-align:center;display:flex;flex-direction:column}\n.sign .sign-heading{height:10mm;display:flex;flex-direction:column;justify-content:flex-start}\n.sign .space{height:22mm;flex:none}\n.sign .sign-person{height:5mm;flex:none;padding-top:0;font-size:10.5pt}\n.sign .sign-line{width:82%;height:1px;flex:none;margin:0 auto;border-bottom:1px solid var(--ink)}\n@page{size:A4 portrait;margin:0}\n@media print{body{background:none}.toolbar{display:none}.sheet{margin:0;box-shadow:none}}\n@media(max-width:800px){.sheet{transform-origin:top left}}\n";printDoc.head.append(style);
 const toolbar=organolepticElement(printDoc,"div","toolbar");
 toolbar.append(organolepticElement(printDoc,"span","","Pratinjau formulir uji organoleptik · "+selected.length+" penerima · satu halaman A4 per penerima"));
 const printButton=organolepticElement(printDoc,"button","","Cetak");
 printButton.type="button";printButton.addEventListener("click",()=>{win.focus();win.print()});
 toolbar.append(printButton);
 const root=organolepticElement(printDoc,"main","");root.id="root";root.setAttribute("aria-label","Formulir uji organoleptik");
 printDoc.body.append(toolbar,root);
 const date=String(currentDistribution.tanggal||"");
 let dateLabel=date;
 if(/^\d{4}-\d{2}-\d{2}$/.test(date)){
  const parsed=new Date(date+"T00:00:00");
  if(!Number.isNaN(parsed.getTime()))dateLabel=new Intl.DateTimeFormat("id-ID",{weekday:"long",day:"2-digit",month:"long",year:"numeric"}).format(parsed);
 }
 const allowedMeals=["pagi","siang","sore"];
 const meal=allowedMeals.includes(String(currentDistribution.waktu_makan||"").toLowerCase())?String(currentDistribution.waktu_makan).toLowerCase():"siang";
 const storedItems=Array.isArray(currentDistribution.menu_items)?currentDistribution.menu_items.slice().sort((a,b)=>Number(a.urutan||0)-Number(b.urutan||0)):[];
 const menu=storedItems.map(item=>String(item.nama_komponen||"").trim()).filter(Boolean).slice(0,8);
 if(!menu.length&&String(currentDistribution.menu||"").trim())menu.push(String(currentDistribution.menu).trim());
 const data={tanggalLabel:dateLabel,waktuMakan:meal,ahliGizi:String(currentDistribution.nama_ahli_gizi||""),menu};
 root.replaceChildren(...selected.map(recipient=>{
  const recipientId=String(recipient.id||"");
  const ownMenu=Array.isArray(menuByRecipient?.[recipientId])?menuByRecipient[recipientId].map(item=>typeof item==="string"?item:String(item?.nama_komponen||"").trim()).filter(Boolean).slice(0,8):[];
  return organolepticSheet(printDoc,{...data,menu:ownMenu.length?ownMenu:menu},recipient);
 }));
 setTimeout(()=>{if(!win.closed){win.focus();win.print()}},250);
}
function showRealization(card,doc){
 if(isBusy()){notifyBusy();return}
 if(modal.querySelector(".docs-realization")&&!window.confirm("Tutup formulir realisasi yang belum disimpan?"))return;
 if(!realizationController)throw new Error("Modul realisasi BAST belum siap.");
 return realizationController.showRealization(card,doc);
}

function init(){
 build();
 window.addEventListener("autodoc:data-changed",()=>{masterLoaded=false});
 menuController=window.AutoDocMenuEditor.create({getModal:()=>modal,$,node,status,getPreviewController:()=>previewController,onChange:()=>{syncPreflightSummary();if(!renderingForm&&!restoringDraft&&draftRestored){formDirty=true;saveDraft()}}});
 archiveController=window.AutoDocArchive.create({getModal:()=>modal,$,node,status,api,loadHistory});
 realizationController=window.AutoDocBastRealization.create({getModal:()=>modal,$,node,esc,api,status,loadHistory});
 previewController=window.AutoDocDocumentPreview.create({$,esc,getModal:()=>modal,getMaster:()=>master,readMenuComponents,readMenuComponentsForRecipient:menuItemsForRecipient,selectedDocumentKinds,today,logoUrl:()=>LETTERHEAD_LOGO_URL});
 window.AutoDocDocuments=Object.freeze({
  open(){
   realizationMode=false;queueRequest++;historyRequest++;
   show();
   tab="create";
   $("#docsTitle",modal).textContent="Distribusi harian";
   $(".docs-head p",modal).textContent="Lengkapi menu dan penerima, periksa ringkasan, lalu terbitkan dokumen.";
   $(".docs-view-create",modal).hidden=false;
   $(".docs-view-history",modal).hidden=true;
  },
  close,
  isBusy,notifyBusy,
  resetSession(){close(false);clearStoredDraft();draftRestored=false;masterLoaded=false;master={};formDirty=false;activeAiMenuPlan=null;pendingOrganolepticPrint=null;currentDocs=[];currentDistribution=null;renderCreate();$(".docs-view-history",modal).replaceChildren()},
  applyAiMenuPlan,
  openRealization(date){
   realizationMode=true;masterRequest++;
   show(false);tab="history";
   $("#docsTitle",modal).textContent="Realisasi BAST";
   $(".docs-head p",modal).textContent="Pilih tanggal dan selesaikan pencatatan penerimaan makanan.";
   $(".docs-view-create",modal).hidden=true;
   $(".docs-view-history",modal).hidden=false;
   loadRealizationQueue(date);
  },
  openArchive(date){
   realizationMode=false;queueRequest++;masterRequest++;
   show(false);
   tab="history";
   $("#docsTitle",modal).textContent="Arsip Dokumen";
   $(".docs-head p",modal).textContent="Cari distribusi, lihat dokumen terbit, cetak ulang, dan catat realisasi BAST.";
   $(".docs-view-create",modal).hidden=true;
   $(".docs-view-history",modal).hidden=false;
   if(date)loadHistory(date);
   else loadDistributions();
  }
 });
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init,{once:true});else init();
})();