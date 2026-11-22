(() => {
"use strict";
const { apiUrl: API, publishableKey: KEY } = window.AutoDocConfig;
const $=(selector,root=document)=>root.querySelector(selector);
const esc=value=>String(value??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const LETTERHEAD_LOGO_URL="https://cnbomblvtddkmtojzpyd.supabase.co/storage/v1/object/public/logo%20bgn/logo-bgn%20(1).png";
function nowInJakarta(){
 const parts=new Intl.DateTimeFormat("en-GB",{timeZone:"Asia/Jakarta",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).formatToParts(new Date());
 const values=Object.fromEntries(parts.filter(part=>part.type!=="literal").map(part=>[part.type,part.value]));
 return {date:values.year+"-"+values.month+"-"+values.day,time:values.hour+":"+values.minute};
}
const today=()=>nowInJakarta().date;
let previewResizeBound=false, modal=null, tab="create", master={}, currentDocs=[], currentDistribution=null, returnFocusEl=null, masterLoaded=false, menuComponents=[], pendingOrganolepticPrint=null, archiveController=null, realizationController=null;

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
function status(message,bad){
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
  el.classList.toggle("error",!!bad);
 }
function close(){
 if(!modal)return;
 modal.hidden=true;modal.style.display="none";modal.setAttribute("aria-hidden","true");
 document.body.style.overflow="";
 if(returnFocusEl&&returnFocusEl.isConnected)returnFocusEl.focus();
}
function show(loadFormData=true){
 if(!modal){style();build()}
 returnFocusEl=document.activeElement;
 modal.hidden=false;
 modal.style.display="flex";
 modal.style.visibility="visible";
 modal.style.zIndex="2147483647";
 modal.setAttribute("aria-hidden","false");
 document.body.style.overflow="hidden";
 $(".docs-close",modal)?.focus();
 if(loadFormData)loadMaster().catch(e=>status(e.message,true));
}
function style(){
 if($("#docsStyles"))return;
 const css=node("style");css.id="docsStyles";
 css.textContent=".docs-launch{display:flex;align-items:center;gap:14px;width:100%;margin-top:14px;padding:18px 20px;border:1px solid #dce8dc;border-radius:15px;background:#fff;color:#244434;text-align:left;box-shadow:0 5px 18px rgba(32,60,40,.035)}.docs-launch:hover{border-color:#9dbba2;background:#fbfdf9}.docs-launch-icon{width:42px;height:42px;display:grid;place-items:center;border-radius:12px;background:#edf5ed;font-size:21px}.docs-launch strong{display:block;font-size:14px}.docs-launch small{display:block;margin-top:4px;color:#7b887f;font-size:11px}.docs-overlay[hidden]{display:none}.docs-overlay{position:fixed;inset:0;z-index:10000;display:flex;align-items:center;justify-content:center;padding:16px;background:rgba(12,31,22,.6)}.docs-dialog{width:min(1120px,100%);max-height:94vh;overflow:auto;border-radius:18px;background:#fbfcfa;box-shadow:0 28px 90px rgba(0,0,0,.26)}.docs-head{position:sticky;top:0;z-index:3;display:flex;align-items:center;justify-content:space-between;gap:15px;padding:19px 23px;border-bottom:1px solid #e4eae3;background:#fff}.docs-head h2{margin:0;color:#1b3f2e;font-size:20px}.docs-head p{margin:5px 0 0;color:#7a887e;font-size:12px}.docs-close{width:38px;height:38px;border:1px solid #e1e8e0;border-radius:10px;background:#fff;color:#526258;font-size:21px}.docs-tabs{display:flex;gap:8px;padding:13px 20px;border-bottom:1px solid #e5ebe4;background:#fff}.docs-tab{padding:9px 14px;border:1px solid #dce6dc;border-radius:9px;background:#fff;color:#526258;font-size:12px;font-weight:750}.docs-tab[aria-selected=true]{border-color:#1e5b43;background:#eaf3ea;color:#174b39}.docs-body{padding:22px}.docs-section-title{margin:0 0 6px;color:#284234;font-size:16px}.docs-note{margin:0 0 16px;color:#77847b;font-size:11px;line-height:1.65}.docs-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}.docs-field{display:flex;flex-direction:column;gap:6px;min-width:0}.docs-field.wide{grid-column:span 2}.docs-field label{color:#536258;font-size:11px;font-weight:750}.docs-field input,.docs-field select,.docs-field textarea{width:100%;min-height:40px;padding:9px 10px;border:1px solid #dce5dc;border-radius:8px;background:#fff;color:#24392d;font:inherit;font-size:12px}.docs-field textarea{min-height:66px;resize:vertical}.docs-recipient-box{margin-top:18px;padding:16px;border:1px solid #e0e8df;border-radius:13px;background:#fff}.docs-recipient-head{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}.docs-recipient-head strong{color:#294536;font-size:13px}.docs-recipient-tools{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.docs-recipient-tools input{min-height:35px;padding:7px 9px;border:1px solid #dce5dc;border-radius:8px;font-size:11px}.docs-btn{padding:9px 12px;border:1px solid #dce6dc;border-radius:9px;background:#fff;color:#31513d;font-size:11px;font-weight:750}.docs-btn.primary{border-color:#174b39;background:#174b39;color:#fff}.docs-btn:disabled{opacity:.55;cursor:wait}.docs-recipient-list{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px;margin-top:13px;max-height:310px;overflow:auto}.docs-recipient{display:flex;align-items:flex-start;gap:9px;padding:10px;border:1px solid #edf0ec;border-radius:9px;background:#fcfdfb}.docs-recipient input{margin-top:3px}.docs-recipient strong{display:block;color:#33483b;font-size:11px}.docs-recipient small{display:block;margin-top:3px;color:#7d897f;font-size:10px;line-height:1.5}.docs-verify{display:inline-block;margin-left:5px;padding:2px 5px;border-radius:5px;background:#fff4dc;color:#92651e;font-size:9px;font-weight:700}.docs-pin-row{display:grid;grid-template-columns:1fr auto;align-items:end;gap:12px;margin-top:17px;padding:15px;border:1px solid #e8e3d6;border-radius:12px;background:#fffdf6}.docs-result{margin-top:15px;padding:13px;border:1px solid #dce8dc;border-radius:10px;background:#f4f9f3;color:#31513d;font-size:11px;line-height:1.6}.docs-msg{min-height:18px;margin:12px 0 0;color:#66756d;font-size:11px}.docs-msg.error{color:#a43c32}.docs-history-toolbar{display:flex;align-items:end;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:15px}.docs-list{display:grid;grid-template-columns:1fr;gap:10px}.docs-card{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:14px;padding:15px;border:1px solid #e1e9e0;border-radius:12px;background:#fff}.docs-card h4{margin:0;color:#294536;font-size:13px}.docs-card p{margin:5px 0 0;color:#7a887e;font-size:10px;line-height:1.6}.docs-card-actions{display:flex;align-items:center;justify-content:flex-end;gap:7px;flex-wrap:wrap}.docs-kind{display:inline-block;margin-right:6px;padding:4px 7px;border-radius:6px;background:#edf4ed;color:#24563a;font-size:9px;font-weight:800}.docs-kind.bast{background:#f6f0e2;color:#806327}.docs-status{display:inline-block;margin-left:6px;padding:4px 7px;border-radius:6px;background:#f1f3f0;color:#647066;font-size:9px;font-weight:750}.docs-status.selesai{background:#e8f4e9;color:#2b6844}.docs-status.batal{background:#f8e9e7;color:#a43c32}.docs-realization{grid-column:1/-1;padding:14px;border:1px solid #e7e9df;border-radius:10px;background:#fbfcf8}.docs-realization h5{margin:0 0 12px;color:#31513d;font-size:12px}.docs-form-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:15px}.docs-empty{padding:25px;text-align:center;color:#879289;font-size:11px;border:1px dashed #dce5dc;border-radius:10px;background:#fff}.docs-warning{color:#946b21}.docs-checkline{display:flex;align-items:center;gap:8px;min-height:40px;color:#526258;font-size:11px}.docs-print-table{width:100%;border-collapse:collapse;font-size:12px}.docs-print-table th,.docs-print-table td{padding:8px;border:1px solid #333;text-align:left}.docs-print-table th{background:#f3f4f1}.docs-signatures{display:grid;grid-template-columns:1fr 1fr;gap:60px;margin-top:45px;text-align:center;font-size:12px}.docs-sign-space{height:75px}.docs-print-head{text-align:center;margin-bottom:20px}.docs-print-head h1{margin:0 0 7px;font-size:18px;letter-spacing:.7px}.docs-print-head h2{margin:0;font-size:14px;text-decoration:underline}.docs-print-meta{display:flex;justify-content:space-between;gap:15px;margin:13px 0;font-size:12px}.docs-print-table{margin-top:14px}.docs-print-footer{margin-top:28px;font-size:10px;color:#555}.docs-days-toolbar{display:flex;gap:10px;align-items:center;justify-content:space-between;flex-wrap:wrap;margin-bottom:13px}.docs-days-toolbar input{flex:1 1 220px;min-height:40px;padding:9px 11px;border:1px solid #dce5dc;border-radius:9px;font:inherit;font-size:12px}.docs-days-list{display:grid;gap:9px}.docs-days-pagination{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:14px;padding-top:12px;border-top:1px solid #e8ede8}.docs-days-pagination .docs-note{margin:0;text-align:center}.docs-days-pagination .docs-btn:disabled{opacity:.45;cursor:not-allowed}.docs-day-card{display:flex;align-items:center;justify-content:space-between;gap:14px;padding:14px;border:1px solid #e1e9e0;border-radius:12px;background:#fff}.docs-day-card strong{display:block;color:#294536;font-size:13px}.docs-day-card small{display:block;margin-top:4px;color:#7a887e;font-size:11px;line-height:1.5}.docs-day-actions{display:flex;gap:7px;align-items:center}.docs-group-card{padding:14px;border:1px solid #e1e9e0;border-radius:12px;background:#fff}.docs-group-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}.docs-group-head h4{margin:0;color:#294536;font-size:13px}.docs-group-head p{margin:4px 0 0;color:#7a887e;font-size:10px}.docs-group-actions{display:flex;gap:7px;flex-wrap:wrap;margin-top:12px}.docs-history-top{display:flex;align-items:end;gap:9px;flex-wrap:wrap;margin-bottom:14px}.docs-history-top .docs-field{flex:1 1 170px}.docs-history-top .docs-btn{min-height:40px}.docs-print-bulk{display:flex;gap:8px;flex-wrap:wrap;margin:0 0 14px;padding:12px;border:1px solid #e1e9e0;border-radius:10px;background:#f8faf7}.docs-recipient-tools input{min-height:40px;font-size:12px}.docs-field input,.docs-field select,.docs-field textarea{min-height:44px;font-size:13px}.docs-btn{min-height:40px;font-size:12px}.docs-btn:focus-visible,.docs-tab:focus-visible,.docs-close:focus-visible{outline:3px solid #a9c9b7;outline-offset:2px}.docs-recipient{min-height:48px}.docs-dialog{font-family:Inter,ui-sans-serif,system-ui,sans-serif}@media(max-width:760px){.docs-overlay{padding:0;align-items:stretch}.docs-dialog{max-height:100vh;border-radius:0}.docs-head{padding:15px}.docs-body{padding:15px}.docs-grid{grid-template-columns:1fr 1fr}.docs-field.wide{grid-column:span 2}.docs-recipient-list{grid-template-columns:1fr}.docs-card{grid-template-columns:1fr}.docs-card-actions{justify-content:flex-start}.docs-pin-row{grid-template-columns:1fr}}@media(max-width:420px){.docs-review{grid-template-columns:1fr}.docs-days-pagination .docs-note{font-size:10px}.docs-grid{grid-template-columns:1fr}.docs-field.wide{grid-column:span 1}}";
 css.textContent += ".docs-kind-group{display:flex;gap:14px;flex-wrap:wrap;margin:10px 0 16px;padding:13px 15px;border:1px solid #e1e8e0;border-radius:10px;background:#fbfdfb}.docs-kind-group legend{padding:0 5px;color:#536258;font-size:11px;font-weight:800}.docs-kind-choice{display:flex;align-items:center;gap:8px;color:#294536;font-size:12px;font-weight:700}.docs-kind-choice input{width:16px;height:16px;accent-color:#174b39}.docs-menu-box{margin:4px 0 16px;padding:14px;border:1px solid #e1e8e0;border-radius:12px;background:#fbfdfb}.docs-menu-head{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap}.docs-menu-head strong{color:#294536;font-size:12px}.docs-menu-tools{display:flex;gap:7px;flex-wrap:wrap}.docs-menu-count{margin:5px 0 10px;color:#7a887e;font-size:10px}.docs-menu-list{display:grid;gap:8px}.docs-menu-row{display:grid;grid-template-columns:25px minmax(0,1fr) auto;gap:8px;align-items:center}.docs-menu-order{color:#7a887e;font-size:11px;font-weight:800;text-align:center}.docs-menu-input{width:100%;min-height:40px;padding:8px 10px;border:1px solid #dce5dc;border-radius:8px;background:#fff;color:#24392d;font:inherit;font-size:12px}.docs-menu-row-actions{display:flex;gap:4px}.docs-menu-row-actions button{width:31px;height:34px;border:1px solid #dce5dc;border-radius:7px;background:#fff;color:#526258;font-size:13px;font-weight:800}.docs-menu-row-actions button:disabled{opacity:.35;cursor:not-allowed}.docs-menu-empty{padding:12px;border:1px dashed #dce5dc;border-radius:8px;color:#879289;background:#fff;font-size:11px}.docs-menu-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}.docs-menu-actions .docs-btn{min-height:36px}.docs-meal-field{max-width:240px;margin:0 0 12px}.docs-kind-choice:focus-within,.docs-menu-input:focus-visible,.docs-menu-row-actions button:focus-visible{outline:3px solid #a9c9b7;outline-offset:2px}@media(max-width:420px){.docs-menu-row{grid-template-columns:21px minmax(0,1fr) auto}.docs-menu-row-actions button{width:28px}}";
 css.textContent += ".docs-organoleptic-option{display:flex;align-items:flex-start;gap:9px;margin:0 0 14px;padding:12px 14px;border:1px solid #e1e8e0;border-radius:10px;background:#fbfdfb;color:#294536;font-size:12px}.docs-organoleptic-option input{width:16px;height:16px;margin:1px 0 0;accent-color:#174b39}.docs-organoleptic-option strong{display:block}.docs-organoleptic-option small{display:block;margin-top:4px;color:#7a887e;font-size:10px;line-height:1.5}";
 css.textContent += ".docs-days-selection{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin:0 0 13px;padding:11px 13px;border:1px solid #e1e9e0;border-radius:10px;background:#f8faf7}.docs-days-selection label{display:flex;align-items:center;gap:8px;color:#405548;font-size:11px;font-weight:700}.docs-days-selection input{width:16px;height:16px;accent-color:#174b39}.docs-days-selection span{margin-right:auto;color:#718076;font-size:11px}.docs-btn.danger{border-color:#a43c32;background:#a43c32;color:#fff}.docs-btn.danger:disabled{opacity:.4}.docs-day-card{display:grid;grid-template-columns:26px minmax(0,1fr) auto}.docs-day-pick{display:flex;align-items:center;justify-content:center}.docs-day-pick input{width:17px;height:17px;accent-color:#174b39}.docs-day-detail{min-width:0}.docs-day-detail small{overflow-wrap:anywhere}.docs-delete-panel{margin:0 0 14px;padding:16px;border:1px solid #e9c8c4;border-radius:12px;background:#fffaf9}.docs-delete-panel h3{margin:0 0 7px;color:#87352e;font-size:14px}.docs-delete-warning{margin:0 0 11px;color:#7f3933;font-size:11px;line-height:1.65}.docs-delete-summary{max-height:120px;overflow:auto;margin:0 0 13px;padding:10px;border-radius:8px;background:#fff;color:#59675d;font-size:10px;line-height:1.7}.docs-delete-form{display:grid;gap:9px}.docs-delete-form>label:first-child{color:#435449;font-size:11px;font-weight:750}.docs-delete-form>input{width:100%;min-height:42px;padding:9px 11px;border:1px solid #dce5dc;border-radius:8px;background:#fff;font:inherit;font-size:13px}.docs-delete-ack{display:flex;align-items:center;gap:8px;color:#59675d;font-size:11px}.docs-delete-ack input{width:16px;height:16px;accent-color:#a43c32}.docs-delete-actions{display:flex;justify-content:flex-end;gap:8px;flex-wrap:wrap}.docs-days-selection input:focus-visible,.docs-day-pick input:focus-visible,.docs-delete-form input:focus-visible{outline:3px solid #a9c9b7;outline-offset:2px}@media(max-width:600px){.docs-days-selection{align-items:flex-start}.docs-days-selection span{width:100%;order:3}.docs-day-card{grid-template-columns:25px minmax(0,1fr)}.docs-day-actions{grid-column:2;justify-content:flex-start}.docs-delete-actions button{flex:1}}";
 document.head.append(css);
}
function build(){
 if(modal)return;
 modal=node("div","docs-overlay");modal.hidden=true;
 modal.id="docsModal";modal.setAttribute("aria-hidden","true");
 const dialog=node("section","docs-dialog");dialog.setAttribute("role","dialog");dialog.setAttribute("aria-modal","true");dialog.setAttribute("aria-labelledby","docsTitle");
 const head=node("header","docs-head");
 const title=node("div");title.innerHTML="<h2 id='docsTitle'>Surat Jalan &amp; BAST MBG</h2><p>Buat dokumen distribusi, cetak, dan catat realisasi penerimaan.</p>";
 const closeBtn=node("button","docs-close","×");closeBtn.type="button";closeBtn.setAttribute("aria-label","Tutup");closeBtn.onclick=close;head.append(title,closeBtn);
 const tabs=node("nav","docs-tabs");
 tabs.hidden=true;
 const body=node("div","docs-body");
 body.innerHTML="<div class='docs-view-create'></div><div class='docs-view-history' hidden></div><p class='docs-msg' role='status' aria-live='polite'></p>";
 dialog.append(head,tabs,body);modal.append(dialog);document.body.append(modal);
 modal.addEventListener("click",e=>{if(e.target===modal)close()});
 document.addEventListener("keydown",e=>{
  if(modal.hidden)return;
  if(e.key==="Escape"){close();return}
  if(e.key==="Tab"){
   const focusable=Array.from(modal.querySelectorAll("button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex]:not([tabindex='-1'])")).filter(el=>!el.closest("[hidden]")&&el.getClientRects().length>0);
   if(!focusable.length)return;
   const first=focusable[0],last=focusable[focusable.length-1];
   if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus()}
   else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus()}
  }
 });
 drawTabs();renderCreate();
}
function drawTabs(){
 const tabs=$(".docs-tabs",modal);tabs.innerHTML="";
 [["create","Buat dokumen"],["history","Arsip distribusi"]].forEach(pair=>{
  const b=node("button","docs-tab",pair[1]);b.type="button";b.setAttribute("aria-selected",String(tab===pair[0]));b.onclick=()=>switchTab(pair[0]);tabs.append(b);
 });
}
function switchTab(next){
 tab=next;drawTabs();
 $(".docs-view-create",modal).hidden=tab!=="create";
 $(".docs-view-history",modal).hidden=tab!=="history";
 status("");
 if(tab==="history")loadDistributions().catch(e=>status(e.message,true));
 else if(!masterLoaded)loadMaster().catch(e=>status(e.message,true));
}
function options(items,valueKey,labelKey,label){
 let html="<option value=''>"+esc(label)+"</option>";
 (items||[]).filter(x=>x.aktif!==false).forEach(x=>{html+="<option value='"+esc(x[valueKey])+"'>"+esc(x[labelKey])+"</option>"});
 return html;
}
async function loadMaster(){
 status("Memuat daftar penerima dan data pendukung...");
 const [masterResult,recipientResult]=await Promise.allSettled([
  api("master/list?include_recipients=false"),
  api("master/recipients")
 ]);
 if(recipientResult.status!=="fulfilled"){
  const reason=recipientResult.reason;
  throw new Error("Daftar penerima gagal dimuat: "+(reason&&reason.message?reason.message:"kesalahan jaringan")+". Periksa sesi login dan endpoint master/recipients.");
 }
 const recipients=recipientResult.value&&recipientResult.value.recipients;
 if(!Array.isArray(recipients)) throw new Error("Server tidak mengirim daftar penerima dalam format yang benar.");
 master=masterResult.status==="fulfilled"&&masterResult.value&&masterResult.value.data?masterResult.value.data:{};
 master.recipients=recipients;
 masterLoaded=true;
 renderCreate();
 const activeCount=recipients.length;
 const warning=masterResult.status==="rejected"?" Data pendukung (menu/petugas/kendaraan/pengemudi) gagal dimuat; daftar penerima tetap tersedia.":"";
 status(activeCount+" penerima aktif berhasil dimuat dari "+recipients.length+" data."+warning,masterResult.status==="rejected");
}
function isActiveRecipient(recipient){
 if(!recipient||typeof recipient!=="object")return false;
 const value=recipient.aktif;
 return value===true||value===1||value==="1"||(typeof value==="string"&&value.trim().toLowerCase()==="true");
}
function renderMenuComponents(){
 const list=$("#docsMenuItems",modal);
 if(!list)return;
 list.innerHTML="";
 if(!menuComponents.length){
  list.append(node("div","docs-menu-empty","Belum ada komponen menu. Menu boleh dikosongkan untuk penerbitan SJ/BAST."));
 }
 menuComponents.forEach((value,index)=>{
  const row=node("div","docs-menu-row");
  row.append(node("span","docs-menu-order",String(index+1)+"."));
  const input=node("input","docs-menu-input");
  input.type="text";input.maxLength=180;input.placeholder="Contoh: Nasi Putih";input.value=value;
  input.setAttribute("list","docsMenuSuggestions");
  input.setAttribute("aria-label","Komponen menu "+(index+1));
  input.addEventListener("input",()=>{menuComponents[index]=input.value});
  const actions=node("div","docs-menu-row-actions");
  const up=node("button",null,"↑");up.type="button";up.disabled=index===0;up.setAttribute("aria-label","Geser "+(index+1)+" ke atas");
  up.onclick=()=>{if(index>0){[menuComponents[index-1],menuComponents[index]]=[menuComponents[index],menuComponents[index-1]];renderMenuComponents()}};
  const down=node("button",null,"↓");down.type="button";down.disabled=index===menuComponents.length-1;down.setAttribute("aria-label","Geser "+(index+1)+" ke bawah");
  down.onclick=()=>{if(index<menuComponents.length-1){[menuComponents[index+1],menuComponents[index]]=[menuComponents[index],menuComponents[index+1]];renderMenuComponents()}};
  const remove=node("button",null,"×");remove.type="button";remove.setAttribute("aria-label","Hapus komponen "+(index+1));
  remove.onclick=()=>{menuComponents.splice(index,1);renderMenuComponents()};
  actions.append(up,down,remove);row.append(input,actions);list.append(row);
 });
 const count=$("#docsMenuCount",modal);
 if(count)count.textContent=menuComponents.length+" dari 8 komponen";
 const add=$("#docsAddMenuItem",modal);
 if(add)add.disabled=menuComponents.length>=8;
 updateLivePreview();
}
function readMenuComponents(){
 return menuComponents.map(value=>String(value||"").trim()).filter(Boolean);
}
function selectedDocumentKinds(){
 const kinds=[];
 if($("#docsKindSj",modal)?.checked)kinds.push("SJ");
 if($("#docsKindBast",modal)?.checked)kinds.push("BAST");
 return kinds;
}
function addMenuComponent(value=""){
 if(menuComponents.length>=8){status("Menu Hari Ini maksimal 8 komponen.",true);return}
 menuComponents.push(value);renderMenuComponents();
 const inputs=modal.querySelectorAll(".docs-menu-input");
 inputs[inputs.length-1]?.focus();
}
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
  menuComponents=items.slice(0,8);renderMenuComponents();
  status("Menu dari distribusi "+latest.tanggal+" berhasil disalin ("+menuComponents.length+" komponen).");updateLivePreview();
 }catch(error){status(error.message,true)}
 finally{button.disabled=false;button.textContent=oldText}
}
function renderCreate(){
 const target=$(".docs-view-create",modal);
 if(!target)return;
 menuComponents=[];
 const recipients=Array.isArray(master.recipients)?master.recipients:[];
 const currentTime=nowInJakarta();\n const todayVal=currentTime.date;
 const menuSuggestions=(Array.isArray(master.menus)?master.menus:[])
  .filter(item=>item&&item.aktif!==false&&String(item.teks_menu||"").trim())
  .map(item=>"<option value='"+esc(item.teks_menu)+"'></option>").join("");
 target.innerHTML="<div class='docs-create-layout'>"+
  "<section class='docs-create-form-panel'>"+
   "<div class='docs-create-intro'><h3 class='docs-section-title'>Buat dokumen distribusi</h3><p class='docs-note'>Lengkapi rincian distribusi, pilih penerima, lalu periksa dokumen sebelum diterbitkan.</p></div>"+
   "<form id='docsCreateForm' autocomplete='off'>"+
    "<section class='docs-form-section'><div class='docs-form-section-head'><div><h4>Dokumen</h4><p>Pilih jenis dokumen yang akan diterbitkan.</p></div></div>"+
     "<fieldset class='docs-kind-group'><legend>Terbitkan</legend><label class='docs-kind-choice'><input id='docsKindSj' type='checkbox' checked> Surat Jalan</label><label class='docs-kind-choice'><input id='docsKindBast' type='checkbox' checked> BAST</label></fieldset>"+
     "<div class='docs-grid docs-grid-compact'><div class='docs-field'><label for='docsDate'>Tanggal distribusi *</label><input id='docsDate' type='date' required value='"+todayVal+"'></div><div class='docs-field'><label for='docsMealTime'>Waktu makan</label><select id='docsMealTime'><option value='pagi'>Pagi</option><option value='siang' selected>Siang</option><option value='sore'>Sore</option></select></div></div>"+
     "<label class='docs-organoleptic-option'><input id='docsIncludeOrganoleptic' type='checkbox'><span><strong>Tambahkan Formulir Uji Organoleptik</strong><small>Satu lembar A4 untuk setiap penerima.</small></span></label>"+
    "</section>"+
    "<section class='docs-form-section'><div class='docs-form-section-head'><div><h4>Rincian distribusi</h4><p>Lengkapi informasi perjalanan. Kolom lain dapat disesuaikan.</p></div></div>"+
     "<div class='docs-grid docs-grid-compact'><div class='docs-field'><label for='docsTime'>Jam berangkat</label><input id='docsTime' type='time' value='"+currentTime.time+"'><small class='docs-field-hint'>Terisi otomatis mengikuti waktu WIB saat formulir dibuka.</small></div><div class='docs-field'><label for='docsStaff'>Petugas (opsional)</label><select id='docsStaff'>"+options(master.staff,"nama","nama","Pilih petugas")+"</select></div><div class='docs-field'><label for='docsDriver'>Pengemudi (opsional)</label><select id='docsDriver'>"+options(master.drivers,"nama","nama","Pilih pengemudi")+"</select></div><div class='docs-field'><label for='docsVehicle'>Kendaraan (opsional)</label><select id='docsVehicle'>"+options(master.vehicles,"no_kendaraan","no_kendaraan","Pilih kendaraan")+"</select></div></div>"+
    "</section>"+
    "<section class='docs-form-section'><div class='docs-form-section-head'><div><h4>Menu distribusi</h4><p>Tambahkan hingga 8 komponen menu.</p></div></div>"+
     "<div class='docs-menu-head'><strong id='docsMenuCount'>0 dari 8 komponen</strong><button type='button' class='docs-btn' id='docsCopyLastMenu'>Salin menu terakhir</button></div><div class='docs-menu-list' id='docsMenuItems'></div><datalist id='docsMenuSuggestions'>"+menuSuggestions+"</datalist><div class='docs-menu-actions'><button type='button' class='docs-btn' id='docsAddMenuItem'>+ Tambah menu</button></div>"+
    "</section>"+
    "<section class='docs-form-section'><div class='docs-form-section-head'><div><h4>Penerima</h4><p>Pilih tujuan distribusi.</p></div></div>"+
     "<div class='docs-recipient-box docs-recipient-box-compact'><div class='docs-recipient-head'><strong>Penerima <span id='docsSelectedCount'>(0 dipilih)</span></strong><div class='docs-recipient-tools'><input id='docsRecipientSearch' type='search' placeholder='Cari penerima...' aria-label='Cari penerima'><button type='button' class='docs-btn' id='docsSelectAll'>Pilih terlihat</button><button type='button' class='docs-btn' id='docsClearAll'>Kosongkan</button></div></div><div class='docs-recipient-list' id='docsRecipientList'></div></div>"+
    "</section>"+
    "<div class='docs-submit-bar'><div><strong id='docsSubmitCount'>0 penerima dipilih</strong><small>Nomor dokumen dibuat saat diterbitkan.</small></div><button class='docs-btn primary' id='docsCreateButton' type='submit'>Terbitkan dokumen</button></div>"+
   "</form><div id='docsCreateResult'></div>"+
  "</section>"+
  "<aside class='docs-preview-panel'><div class='docs-preview-head'><div><strong>Pratinjau dokumen</strong><small id='docsPreviewRecipient'>Pilih penerima untuk melihat dokumen</small></div><div class='docs-preview-selects'><select id='docsPreviewRecipientSelect' aria-label='Penerima pratinjau'><option value=''>Penerima</option></select><select id='docsPreviewKind' aria-label='Jenis dokumen pratinjau'><option value='SJ'>Surat Jalan</option><option value='BAST'>BAST</option><option value='ORGANOLEPTIC'>Uji Organoleptik</option></select></div></div><div class='docs-preview-caption'>Tampilan mengikuti data yang sedang Anda isi. Nomor resmi muncul setelah diterbitkan.</div><div class='docs-preview-paper'><iframe id='docsPreviewFrame' title='Pratinjau dokumen cetak' loading='eager'></iframe></div></aside>"+
 "</div>";
 renderMenuComponents();
 renderRecipients(recipients);
 const form=$("#docsCreateForm",target);
 $("#docsRecipientSearch",target).addEventListener("input",filterRecipients);
 $("#docsSelectAll",target).onclick=()=>setAllRecipients(true);
 $("#docsClearAll",target).onclick=()=>setAllRecipients(false);
 $("#docsAddMenuItem",target).onclick=()=>addMenuComponent();
 $("#docsCopyLastMenu",target).onclick=copyLastMenu;
 $("#docsPreviewKind",target).addEventListener("change",updateLivePreview);
 $("#docsPreviewRecipientSelect",target).addEventListener("change",updateLivePreview);
 form.addEventListener("input",updateLivePreview);
 form.addEventListener("change",updateLivePreview);
 form.addEventListener("submit",createDocs);
 if(!previewResizeBound){window.addEventListener("resize",fitPreviewFrame);previewResizeBound=true;}
 updateLivePreview();
}
function previewPortionRows(recipient){
 const definitions=[["siswa_kecil","Siswa kecil","Porsi Kecil"],["balita","Balita","Porsi Kecil"],["siswa_besar","Siswa besar","Porsi Besar"],["tendik","Tenaga pendidik","Porsi Besar"],["ibu_hamil","Ibu hamil","Porsi Besar"],["ibu_menyusui","Ibu menyusui","Porsi Besar"],["putus_sekolah","Anak putus sekolah","Porsi Besar"],["kader","Kader","Porsi Besar"]];
 return definitions.flatMap(([key,label,jenis])=>{const jumlah=Number(recipient?.[key]||0);return jumlah>0?[{kelompok_sasaran:label,jenis_porsi:jenis,jumlah}]:[]});
}
function fitPreviewFrame(){
 const frame=$("#docsPreviewFrame",modal),host=frame?.parentElement;
 if(!frame||!host||!frame.contentDocument?.body)return;
 const scale=Math.min(1,Math.max(.25,host.clientWidth/794));
 const body=frame.contentDocument.body;
 body.style.width="794px";body.style.minHeight="1123px";body.style.margin="0";body.style.padding=body.dataset.previewType==="organoleptic"?"0":"60px";body.style.boxSizing="border-box";
 body.style.transformOrigin="top left";body.style.transform="scale("+scale+")";
 frame.style.height=Math.ceil(1123*scale)+"px";
}
function renderOrganolepticPreview(frame,recipient,date,menu,settings){
 const renderer=window.AutoDocOrganolepticPrint;
 if(!renderer?.organolepticSheet)return;
 const css="*{box-sizing:border-box}body{margin:0;background:#fff;color:#000;font-family:'Times New Roman',Times,serif;font-size:12pt;line-height:1.35}.sheet{width:210mm;height:297mm;margin:0;padding:15mm;background:#fff;display:flex;flex-direction:column}.title{margin:4mm 0 8mm;text-align:center;font-size:13pt;font-weight:700}.info{display:grid;grid-template-columns:34mm 4mm 1fr;row-gap:1mm;margin-bottom:6mm}.info .val{font-weight:400}.caption{margin:0 0 1.5mm;text-align:center;font-weight:700;font-size:11.5pt}table.grid{width:100%;border-collapse:collapse;table-layout:fixed}table.grid th,table.grid td{border:1px solid #000;padding:1.5mm;text-align:center}table.grid thead th{font-weight:700;font-size:11.5pt}table.grid col.menu{width:28%}table.grid thead tr+tr th{font-size:10.5pt;padding:1.5mm .5mm}table.grid tbody td{height:10mm}table.grid tbody th{font-weight:700;font-size:11.5pt;padding:1.5mm 2mm}.note{margin:5mm 0 4mm;font-size:11.5pt}.note p{margin:0}.note .row{display:grid;grid-template-columns:14mm 1fr}.followup{flex:1 1 auto;min-height:50mm;border:1px solid #000;padding:3mm 4mm;font-weight:700}.signs{display:flex;justify-content:space-between;margin-top:8mm;font-size:11.5pt}.sign{width:72mm}.sign .space{height:24mm}.sign .dots{border-bottom:1px dotted #000;height:1.2em}";
 const dateLabel=/^\d{4}-\d{2}-\d{2}$/.test(date)?new Intl.DateTimeFormat("id-ID",{weekday:"long",day:"2-digit",month:"long",year:"numeric"}).format(new Date(date+"T00:00:00")):date;
 frame.onload=()=>{
  const doc=frame.contentDocument;if(!doc)return;
  doc.body.dataset.previewType="organoleptic";
  doc.body.style.width="794px";doc.body.style.margin="0";doc.body.style.padding="0";
  const root=doc.getElementById("previewRoot");
  root.append(renderer.organolepticSheet(doc,{tanggalLabel:dateLabel,waktuMakan:$("#docsMealTime",modal)?.value||"siang",ahliGizi:String(settings.nama_ahli_gizi||""),menu},recipient));
  fitPreviewFrame();
 };
 frame.srcdoc="<!doctype html><html lang='id'><head><meta charset='utf-8'><style>"+css+"</style></head><body data-preview-type='organoleptic'><main id='previewRoot'></main></body></html>";
}
function updateLivePreview(){
 if(!modal||!$("#docsPreviewFrame",modal))return;
 const form=$("#docsCreateForm",modal);if(!form)return;
 const selected=Array.from(form.querySelectorAll("input[name='recipient']:checked"));
 const recipients=Array.isArray(master.recipients)?master.recipients:[];
 const recipientSelect=$("#docsPreviewRecipientSelect",modal),previousRecipient=recipientSelect?.value||"";
 if(recipientSelect){
  const selectedRecipients=selected.map(input=>recipients.find(item=>String(item.id)===input.value)).filter(Boolean);
  recipientSelect.innerHTML=selectedRecipients.length?selectedRecipients.map(item=>"<option value='"+esc(item.id)+"'>"+esc(item.nama)+"</option>").join(""):"<option value=''>Pilih penerima</option>";
  if(selectedRecipients.some(item=>String(item.id)===previousRecipient))recipientSelect.value=previousRecipient;
 }
 const recipient=selected.length?recipients.find(item=>String(item.id)===(recipientSelect?.value||selected[0].value)):null;
 const fallback=recipient||recipients[0]||{};
 const settings=Array.isArray(master.settings)?(master.settings[0]||{}):(master.settings||{});
 const menu=readMenuComponents(),kinds=selectedDocumentKinds();
 const includeOrganoleptic=$("#docsIncludeOrganoleptic",form)?.checked===true;
 const available=[...kinds,...(includeOrganoleptic?["ORGANOLEPTIC"]:[])];
 const kindSelect=$("#docsPreviewKind",modal),currentKind=kindSelect?.value||"SJ";
 const kind=available.includes(currentKind)?currentKind:(available[0]||"SJ");
 if(kindSelect){kindSelect.value=kind;Array.from(kindSelect.options).forEach(option=>{option.disabled=!available.includes(option.value)});}
 const date=$("#docsDate",form)?.value||today(),frame=$("#docsPreviewFrame",modal);
 const label=$("#docsPreviewRecipient",modal);
 if(label)label.textContent=selected.length?(recipient?.nama||"Penerima terpilih"):"Contoh tampilan · pilih penerima untuk data sebenarnya";
 const count=$("#docsSubmitCount",modal);if(count)count.textContent=selected.length+" penerima dipilih";
 const button=$("#docsCreateButton",modal);if(button)button.disabled=!selected.length||!kinds.length;
 if(kind==="ORGANOLEPTIC"){
  renderOrganolepticPreview(frame,fallback,date,menu,settings);
  return;
 }
 const snapshot={
  sppg:settings,
  distribusi:{tanggal:date,jam_berangkat:$("#docsTime",form)?.value||"",menu:menu.join(", "),nama_petugas:$("#docsStaff",form)?.value||"",nama_pengemudi:$("#docsDriver",form)?.value||"",no_kendaraan:$("#docsVehicle",form)?.value||""},
  penerima:fallback,rincian_porsi:previewPortionRows(fallback),
  ringkasan:{porsi_kecil:Number(fallback.porsi_kecil||0),porsi_besar:Number(fallback.porsi_besar||0),total_porsi:Number(fallback.total_porsi||0)}
 };
 const doc={jenis:kind,nomor_lengkap:"PRATINJAU",snapshot_json:snapshot,created_at:"Pratinjau langsung"};
 const renderer=window.AutoDocPrintRenderer;if(!renderer?.buildPrintHtml)return;
 let html=renderer.buildPrintHtml(doc,esc,LETTERHEAD_LOGO_URL);
 html=html.replace("</style>","@page{margin:0}html,body{margin:0!important;background:#fff!important}.preview-ribbon{position:absolute;top:12px;right:16px;padding:4px 8px;border:1px solid #d6dfd6;border-radius:4px;color:#56705e;background:#f4f8f3;font:700 9px Arial;letter-spacing:.7px}</style>");
 html=html.replace("<body>","<body><div class='preview-ribbon'>PRATINJAU · BELUM DITERBITKAN</div>");
 frame.onload=()=>fitPreviewFrame();frame.srcdoc=html;
}
function renderRecipients(recipients){
 const list=$("#docsRecipientList",modal);if(!list)return;
 list.innerHTML="";
 if(!recipients.length){list.append(node("div","docs-empty","Server berhasil dihubungi, tetapi tidak ada penerima dengan status aktif. Periksa kolom Status di Data Master."));return}
 recipients.forEach(r=>{
  const label=node("label","docs-recipient");label.dataset.search=(r.nama+" "+r.kelompok+" "+r.jenjang).toLowerCase();label.dataset.name=r.nama;
  const check=node("input");check.type="checkbox";check.name="recipient";check.value=r.id;check.checked=false;
  const content=node("span");const warning=r.perlu_verifikasi?" <span class='docs-verify'>Perlu verifikasi</span>":"";
  content.innerHTML="<strong>"+esc(r.nama)+warning+"</strong><small>"+esc(r.kelompok)+" · "+esc(r.jenjang)+" · "+Number(r.total_porsi||0).toLocaleString("id-ID")+" porsi</small>";
  check.addEventListener("change",updateSelectedCount);label.append(check,content);list.append(label);
 });
 updateSelectedCount();
}
function filterRecipients(){
 const q=$("#docsRecipientSearch",modal).value.trim().toLowerCase();
 modal.querySelectorAll(".docs-recipient").forEach(row=>{row.hidden=!row.dataset.search.includes(q)});
}
function setAllRecipients(value){
 modal.querySelectorAll("input[name='recipient']").forEach(input=>{if(!input.closest(".docs-recipient").hidden)input.checked=value});
 updateSelectedCount();
}
function updateSelectedCount(){
 const n=Array.from(modal.querySelectorAll("input[name='recipient']:checked")).length;
 const el=$("#docsSelectedCount",modal);if(el)el.textContent="("+n+" dipilih)";
 updateLivePreview();
}
async function createDocs(event){
 event.preventDefault();status("");
 const selected=Array.from(modal.querySelectorAll("input[name='recipient']:checked")).map(x=>x.value);
 if(!selected.length){status("Pilih minimal satu penerima.",true);$("#docsRecipientSearch",modal)?.focus();return}
 const kinds=selectedDocumentKinds();
 if(!kinds.length){status("Pilih minimal Surat Jalan atau BAST.",true);$("#docsKindSj",modal)?.focus();return}
 const includeOrganoleptic=$("#docsIncludeOrganoleptic",modal)?.checked===true;
 const menuItems=readMenuComponents();
 if(menuItems.length>8){status("Menu Hari Ini maksimal 8 komponen.",true);return}
 const body={
  tanggal:$("#docsDate",modal).value,
  jam_berangkat:$("#docsTime",modal).value,
  menu_items:menuItems,
  waktu_makan:$("#docsMealTime",modal).value||"siang",
  jenis_dokumen:kinds,
  nama_petugas:$("#docsStaff",modal).value,
  nama_pengemudi:$("#docsDriver",modal).value,
  no_kendaraan:$("#docsVehicle",modal).value,
  recipient_ids:selected
 };
 if(!body.tanggal){status("Tanggal distribusi wajib diisi.",true);$("#docsDate",modal)?.focus();return}
 const button=$("#docsCreateButton",modal);button.disabled=true;button.textContent="Menerbitkan dokumen...";
 try{
  const result=await api("docs/create",body);window.dispatchEvent(new Event("autodoc:data-changed"));
  pendingOrganolepticPrint=includeOrganoleptic?{tanggal:body.tanggal,recipientIds:selected.slice()}:null;
  const failed=(result.errors||[]).length;
  const summary=node("div","docs-result");
  summary.textContent=result.berhasil+" dari "+result.requested+" dokumen berhasil disiapkan. "+(failed?"Masih ada "+failed+" dokumen gagal; ulangi tanggal yang sama untuk melanjutkan.":"Nomor yang sudah terbit tidak akan dibuat ulang.");
  $("#docsCreateResult",modal).innerHTML="";$("#docsCreateResult",modal).append(summary);
  status(result.message||"Selesai.",failed>0);
  await loadHistory(body.tanggal);
  tab="history";drawTabs();
  $(".docs-view-create",modal).hidden=true;$(".docs-view-history",modal).hidden=false;
 }catch(e){status(e.message,true)}
 finally{button.disabled=false;button.textContent="Terbitkan dokumen"}
}
async function loadDistributions(initialOffset=0){
 if(!archiveController)throw new Error("Modul arsip belum siap.");
 return archiveController.loadDistributions(initialOffset);
}
async function loadHistory(date){
 const target=$(".docs-view-history",modal);if(!target)return;
 const chosen=date||($("#docsHistoryDate",modal)?.value)||today();
 target.innerHTML="<div class='docs-history-top'><button type='button' class='docs-btn' id='docsBackToDays'>← Semua distribusi</button><div class='docs-field'><label for='docsHistoryDate'>Tanggal distribusi</label><input id='docsHistoryDate' type='date' value='"+esc(chosen)+"'></div><button type='button' class='docs-btn primary' id='docsLoadHistory'>Tampilkan</button></div><div class='docs-print-bulk' id='docsPrintBulk'><span style='align-self:center;font-size:11px;color:#526258;font-weight:700'>Cetak massal:</span><button type='button' class='docs-btn' id='docsPrintSj'>Semua Surat Jalan</button><button type='button' class='docs-btn' id='docsPrintBast'>Semua BAST</button><button type='button' class='docs-btn' id='docsPrintOrganoleptic'>Semua Uji Organoleptik</button></div><div id='docsPrintSelectedSlot'></div><div id='docsDistributionMeta' class='docs-note'></div><div class='docs-list' id='docsList'></div>";
 $("#docsBackToDays",target).onclick=()=>loadDistributions().catch(e=>status(e.message,true));
 $("#docsLoadHistory",target).onclick=()=>loadHistory($("#docsHistoryDate",target).value).catch(e=>status(e.message,true));
 $("#docsPrintSj",target).onclick=()=>printDocuments(currentDocs.filter(doc=>doc.jenis==="SJ"));
 $("#docsPrintBast",target).onclick=()=>printDocuments(currentDocs.filter(doc=>doc.jenis==="BAST"));
 $("#docsPrintOrganoleptic",target).onclick=()=>printOrganolepticForms(getArchiveRecipients());
 status("Memuat riwayat...");
 try{
  const result=await api("docs/list?tanggal="+encodeURIComponent(chosen));
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
    selectedButton.type="button";selectedButton.onclick=()=>printOrganolepticForms(selectedRecipients);
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
  for(const group of grouped.values())list.append(renderDocumentGroup(group));
  status(currentDocs.length+" dokumen · "+grouped.size+" penerima.");
 }catch(e){status(e.message,true)}
}
function renderDocumentGroup(group){
 const recipient=group.recipient||{};
 const docs=group.docs||[];
 const card=node("article","docs-group-card");
 const head=node("div","docs-group-head");
 const info=node("div");
 const title=node("h4",null,recipient.nama||"Penerima");
 info.append(title,node("p",null,(recipient.kelompok||"")+" · "+(recipient.jenjang||"")+" · "+Number(recipient.total_porsi||0).toLocaleString("id-ID")+" porsi"));
 head.append(info);card.append(head);
 const actions=node("div","docs-group-actions");
 const organoleptic=node("button","docs-btn","Cetak Uji Organoleptik");organoleptic.type="button";organoleptic.onclick=()=>printOrganolepticForms([recipient]);actions.append(organoleptic);
 docs.sort((a,b)=>a.jenis.localeCompare(b.jenis)).forEach(doc=>{
  const kind=doc.jenis==="SJ"?"Surat Jalan":"BAST";
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
function printDocument(doc){printDocuments([doc])}
const { organolepticElement, organolepticInfoRow, organolepticMealNode, organolepticTable, organolepticSheet } = window.AutoDocOrganolepticPrint;

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
function printOrganolepticForms(recipients){
 const selected=Array.isArray(recipients)?recipients.filter(recipient=>recipient&&recipient.nama):[];
 if(!selected.length){status("Tidak ada penerima untuk formulir uji organoleptik.",true);return}
 if(!currentDistribution){status("Data distribusi tidak tersedia. Muat ulang arsip tanggal tersebut.",true);return}
 const win=window.open("","_blank");
 if(!win){status("Popup cetak diblokir. Izinkan popup untuk situs AutoDoc.",true);return}
 const printDoc=win.document;
 printDoc.open();
 printDoc.write("<!doctype html><html lang='id'><head><meta charset='utf-8'><meta name='viewport' content='width=device-width, initial-scale=1'><title>Formulir Uji Organoleptik</title></head><body></body></html>");
 printDoc.close();
 const style=printDoc.createElement("style");style.textContent="\n:root{--ink:#000;--paper:#fff}\n*{box-sizing:border-box}\nhtml{-webkit-print-color-adjust:exact;print-color-adjust:exact}\nbody{margin:0;background:#e8ebe9;color:var(--ink);font-family:\"Times New Roman\",\"Liberation Serif\",Times,serif;font-size:12pt;line-height:1.35}\n.toolbar{position:sticky;top:0;z-index:5;display:flex;align-items:center;justify-content:space-between;gap:16px;padding:10px 20px;background:#14201a;color:#fff;font-family:system-ui,-apple-system,\"Segoe UI\",Roboto,sans-serif;font-size:14px}\n.toolbar button{height:36px;padding:0 18px;border:0;border-radius:8px;background:#fff;color:#14201a;font:inherit;font-weight:600;cursor:pointer}\n.toolbar button:focus-visible{outline:3px solid #9fd3b8;outline-offset:2px}\n.sheet{width:210mm;height:297mm;margin:18px auto;padding:15mm;background:var(--paper);box-shadow:0 1px 6px rgba(0,0,0,.18);display:flex;flex-direction:column;break-after:page;page-break-after:always}\n.sheet:last-of-type{break-after:auto;page-break-after:auto}\n.title{margin:4mm 0 8mm;text-align:center;font-size:13pt;font-weight:700}\n.info{display:grid;grid-template-columns:34mm 4mm 1fr;row-gap:1mm;margin-bottom:6mm}\n.info .val{font-weight:400}\n.caption{margin:0 0 1.5mm;text-align:center;font-weight:700;font-size:11.5pt}\ntable.grid{width:100%;border-collapse:collapse;table-layout:fixed}\ntable.grid th,table.grid td{border:1px solid var(--ink);padding:1.5mm;text-align:center}\ntable.grid thead th{font-weight:700;font-size:11.5pt}\ntable.grid col.menu{width:28%}\ntable.grid thead tr+tr th{font-size:10.5pt;padding:1.5mm .5mm}\ntable.grid tbody td{height:10mm}\ntable.grid tbody th{font-weight:700;font-size:11.5pt;padding:1.5mm 2mm}\n.note{margin:5mm 0 4mm;font-size:11.5pt}\n.note p{margin:0}\n.note .row{display:grid;grid-template-columns:14mm 1fr}\n.followup{flex:1 1 auto;min-height:50mm;border:1px solid var(--ink);padding:3mm 4mm;font-weight:700}\n.signs{display:flex;justify-content:space-between;margin-top:8mm;font-size:11.5pt}\n.sign{width:72mm}\n.sign .space{height:24mm}\n.sign .dots{border-bottom:1px dotted var(--ink);height:1.2em}\n@page{size:A4 portrait;margin:0}\n@media print{body{background:none}.toolbar{display:none}.sheet{margin:0;box-shadow:none}}\n@media(max-width:800px){.sheet{transform-origin:top left}}\n";printDoc.head.append(style);
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
 root.replaceChildren(...selected.map(recipient=>organolepticSheet(printDoc,data,recipient)));
 setTimeout(()=>{if(!win.closed){win.focus();win.print()}},250);
}
function showRealization(card,doc){
 if(!realizationController)throw new Error("Modul realisasi BAST belum siap.");
 return realizationController.showRealization(card,doc);
}

function init(){
 style();build();
 archiveController=window.AutoDocArchive.create({getModal:()=>modal,$,node,status,api,loadHistory});
 realizationController=window.AutoDocBastRealization.create({getModal:()=>modal,$,node,esc,api,status,loadHistory});
 window.AutoDocDocuments=Object.freeze({
  open(){
   show();
   tab="create";drawTabs();
   $("#docsTitle",modal).textContent="Buat Dokumen";
   $(".docs-head p",modal).textContent="Terbitkan Surat Jalan dan/atau BAST serta siapkan formulir uji organoleptik.";
   $(".docs-view-create",modal).hidden=false;
   $(".docs-view-history",modal).hidden=true;
  },
  close,
  openArchive(date){
   show(false);
   tab="history";drawTabs();
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