(() => {
"use strict";
const { apiUrl: API, publishableKey: KEY } = window.AutoDocConfig;
const $=(selector,root=document)=>root.querySelector(selector);
const esc=value=>String(value??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const LETTERHEAD_LOGO_URL="https://cnbomblvtddkmtojzpyd.supabase.co/storage/v1/object/public/logo%20bgn/logo-bgn%20(1).png";
const today=()=>{const d=new Date();return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0")};
let modal=null, tab="create", master={}, currentDocs=[], currentDistribution=null, returnFocusEl=null, masterLoaded=false;

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
 css.textContent=".docs-launch{display:flex;align-items:center;gap:14px;width:100%;margin-top:14px;padding:18px 20px;border:1px solid #dce8dc;border-radius:15px;background:#fff;color:#244434;text-align:left;box-shadow:0 5px 18px rgba(32,60,40,.035)}.docs-launch:hover{border-color:#9dbba2;background:#fbfdf9}.docs-launch-icon{width:42px;height:42px;display:grid;place-items:center;border-radius:12px;background:#edf5ed;font-size:21px}.docs-launch strong{display:block;font-size:14px}.docs-launch small{display:block;margin-top:4px;color:#7b887f;font-size:11px}.docs-overlay[hidden]{display:none}.docs-overlay{position:fixed;inset:0;z-index:10000;display:flex;align-items:center;justify-content:center;padding:16px;background:rgba(12,31,22,.6)}.docs-dialog{width:min(1120px,100%);max-height:94vh;overflow:auto;border-radius:18px;background:#fbfcfa;box-shadow:0 28px 90px rgba(0,0,0,.26)}.docs-head{position:sticky;top:0;z-index:3;display:flex;align-items:center;justify-content:space-between;gap:15px;padding:19px 23px;border-bottom:1px solid #e4eae3;background:#fff}.docs-head h2{margin:0;color:#1b3f2e;font-size:20px}.docs-head p{margin:5px 0 0;color:#7a887e;font-size:12px}.docs-close{width:38px;height:38px;border:1px solid #e1e8e0;border-radius:10px;background:#fff;color:#526258;font-size:21px}.docs-tabs{display:flex;gap:8px;padding:13px 20px;border-bottom:1px solid #e5ebe4;background:#fff}.docs-tab{padding:9px 14px;border:1px solid #dce6dc;border-radius:9px;background:#fff;color:#526258;font-size:12px;font-weight:750}.docs-tab[aria-selected=true]{border-color:#1e5b43;background:#eaf3ea;color:#174b39}.docs-body{padding:22px}.docs-section-title{margin:0 0 6px;color:#284234;font-size:16px}.docs-note{margin:0 0 16px;color:#77847b;font-size:11px;line-height:1.65}.docs-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}.docs-field{display:flex;flex-direction:column;gap:6px;min-width:0}.docs-field.wide{grid-column:span 2}.docs-field label{color:#536258;font-size:11px;font-weight:750}.docs-field input,.docs-field select,.docs-field textarea{width:100%;min-height:40px;padding:9px 10px;border:1px solid #dce5dc;border-radius:8px;background:#fff;color:#24392d;font:inherit;font-size:12px}.docs-field textarea{min-height:66px;resize:vertical}.docs-recipient-box{margin-top:18px;padding:16px;border:1px solid #e0e8df;border-radius:13px;background:#fff}.docs-recipient-head{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}.docs-recipient-head strong{color:#294536;font-size:13px}.docs-recipient-tools{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.docs-recipient-tools input{min-height:35px;padding:7px 9px;border:1px solid #dce5dc;border-radius:8px;font-size:11px}.docs-btn{padding:9px 12px;border:1px solid #dce6dc;border-radius:9px;background:#fff;color:#31513d;font-size:11px;font-weight:750}.docs-btn.primary{border-color:#174b39;background:#174b39;color:#fff}.docs-btn:disabled{opacity:.55;cursor:wait}.docs-recipient-list{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px;margin-top:13px;max-height:310px;overflow:auto}.docs-recipient{display:flex;align-items:flex-start;gap:9px;padding:10px;border:1px solid #edf0ec;border-radius:9px;background:#fcfdfb}.docs-recipient input{margin-top:3px}.docs-recipient strong{display:block;color:#33483b;font-size:11px}.docs-recipient small{display:block;margin-top:3px;color:#7d897f;font-size:10px;line-height:1.5}.docs-verify{display:inline-block;margin-left:5px;padding:2px 5px;border-radius:5px;background:#fff4dc;color:#92651e;font-size:9px;font-weight:700}.docs-pin-row{display:grid;grid-template-columns:1fr auto;align-items:end;gap:12px;margin-top:17px;padding:15px;border:1px solid #e8e3d6;border-radius:12px;background:#fffdf6}.docs-result{margin-top:15px;padding:13px;border:1px solid #dce8dc;border-radius:10px;background:#f4f9f3;color:#31513d;font-size:11px;line-height:1.6}.docs-msg{min-height:18px;margin:12px 0 0;color:#66756d;font-size:11px}.docs-msg.error{color:#a43c32}.docs-history-toolbar{display:flex;align-items:end;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:15px}.docs-list{display:grid;grid-template-columns:1fr;gap:10px}.docs-card{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:14px;padding:15px;border:1px solid #e1e9e0;border-radius:12px;background:#fff}.docs-card h4{margin:0;color:#294536;font-size:13px}.docs-card p{margin:5px 0 0;color:#7a887e;font-size:10px;line-height:1.6}.docs-card-actions{display:flex;align-items:center;justify-content:flex-end;gap:7px;flex-wrap:wrap}.docs-kind{display:inline-block;margin-right:6px;padding:4px 7px;border-radius:6px;background:#edf4ed;color:#24563a;font-size:9px;font-weight:800}.docs-kind.bast{background:#f6f0e2;color:#806327}.docs-status{display:inline-block;margin-left:6px;padding:4px 7px;border-radius:6px;background:#f1f3f0;color:#647066;font-size:9px;font-weight:750}.docs-status.selesai{background:#e8f4e9;color:#2b6844}.docs-status.batal{background:#f8e9e7;color:#a43c32}.docs-realization{grid-column:1/-1;padding:14px;border:1px solid #e7e9df;border-radius:10px;background:#fbfcf8}.docs-realization h5{margin:0 0 12px;color:#31513d;font-size:12px}.docs-form-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:15px}.docs-empty{padding:25px;text-align:center;color:#879289;font-size:11px;border:1px dashed #dce5dc;border-radius:10px;background:#fff}.docs-warning{color:#946b21}.docs-checkline{display:flex;align-items:center;gap:8px;min-height:40px;color:#526258;font-size:11px}.docs-print-table{width:100%;border-collapse:collapse;font-size:12px}.docs-print-table th,.docs-print-table td{padding:8px;border:1px solid #333;text-align:left}.docs-print-table th{background:#f3f4f1}.docs-signatures{display:grid;grid-template-columns:1fr 1fr;gap:60px;margin-top:45px;text-align:center;font-size:12px}.docs-sign-space{height:75px}.docs-print-head{text-align:center;margin-bottom:20px}.docs-print-head h1{margin:0 0 7px;font-size:18px;letter-spacing:.7px}.docs-print-head h2{margin:0;font-size:14px;text-decoration:underline}.docs-print-meta{display:flex;justify-content:space-between;gap:15px;margin:13px 0;font-size:12px}.docs-print-table{margin-top:14px}.docs-print-footer{margin-top:28px;font-size:10px;color:#555}.docs-wizard-steps{display:grid;grid-template-columns:repeat(3,1fr);gap:7px;margin:0 0 20px}.docs-wizard-step{padding:9px 8px;border:1px solid #e1e8e0;border-radius:9px;background:#fff;color:#78857c;text-align:center;font-size:11px;font-weight:700}.docs-wizard-step[aria-current=step]{border-color:#1e5a43;background:#eaf3ea;color:#174b39}.docs-step-pane{padding:17px;border:1px solid #e1e8e0;border-radius:12px;background:#fff}.docs-step-actions{display:flex;justify-content:space-between;gap:9px;margin-top:16px}.docs-step-actions .docs-btn{min-height:42px}.docs-review{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px;margin-top:14px}.docs-review-item{padding:12px;border:1px solid #edf0ec;border-radius:9px;background:#fafcf9}.docs-review-item small{display:block;color:#78857c;font-size:10px}.docs-review-item strong{display:block;margin-top:5px;color:#294536;font-size:13px;overflow-wrap:anywhere}.docs-days-toolbar{display:flex;gap:10px;align-items:center;justify-content:space-between;flex-wrap:wrap;margin-bottom:13px}.docs-days-toolbar input{flex:1 1 220px;min-height:40px;padding:9px 11px;border:1px solid #dce5dc;border-radius:9px;font:inherit;font-size:12px}.docs-days-list{display:grid;gap:9px}.docs-day-card{display:flex;align-items:center;justify-content:space-between;gap:14px;padding:14px;border:1px solid #e1e9e0;border-radius:12px;background:#fff}.docs-day-card strong{display:block;color:#294536;font-size:13px}.docs-day-card small{display:block;margin-top:4px;color:#7a887e;font-size:11px;line-height:1.5}.docs-day-actions{display:flex;gap:7px;align-items:center}.docs-group-card{padding:14px;border:1px solid #e1e9e0;border-radius:12px;background:#fff}.docs-group-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}.docs-group-head h4{margin:0;color:#294536;font-size:13px}.docs-group-head p{margin:4px 0 0;color:#7a887e;font-size:10px}.docs-group-actions{display:flex;gap:7px;flex-wrap:wrap;margin-top:12px}.docs-history-top{display:flex;align-items:end;gap:9px;flex-wrap:wrap;margin-bottom:14px}.docs-history-top .docs-field{flex:1 1 170px}.docs-history-top .docs-btn{min-height:40px}.docs-print-bulk{display:flex;gap:8px;flex-wrap:wrap;margin:0 0 14px;padding:12px;border:1px solid #e1e9e0;border-radius:10px;background:#f8faf7}.docs-recipient-tools input{min-height:40px;font-size:12px}.docs-field input,.docs-field select,.docs-field textarea{min-height:44px;font-size:13px}.docs-btn{min-height:40px;font-size:12px}.docs-btn:focus-visible,.docs-tab:focus-visible,.docs-close:focus-visible{outline:3px solid #a9c9b7;outline-offset:2px}.docs-recipient{min-height:48px}.docs-dialog{font-family:Inter,ui-sans-serif,system-ui,sans-serif}@media(max-width:760px){.docs-overlay{padding:0;align-items:stretch}.docs-dialog{max-height:100vh;border-radius:0}.docs-head{padding:15px}.docs-body{padding:15px}.docs-grid{grid-template-columns:1fr 1fr}.docs-field.wide{grid-column:span 2}.docs-recipient-list{grid-template-columns:1fr}.docs-card{grid-template-columns:1fr}.docs-card-actions{justify-content:flex-start}.docs-pin-row{grid-template-columns:1fr}}@media(max-width:420px){.docs-grid{grid-template-columns:1fr}.docs-field.wide{grid-column:span 1}}";
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
  api("master/list"),
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
 const activeCount=recipients.filter(isActiveRecipient).length;
 const warning=masterResult.status==="rejected"?" Data pendukung (menu/petugas/kendaraan/pengemudi) gagal dimuat; daftar penerima tetap tersedia.":"";
 status(activeCount+" penerima aktif berhasil dimuat dari "+recipients.length+" data."+warning,masterResult.status==="rejected");
}
function isActiveRecipient(recipient){
 if(!recipient||typeof recipient!=="object")return false;
 const value=recipient.aktif;
 return value===true||value===1||value==="1"||(typeof value==="string"&&value.trim().toLowerCase()==="true");
}
function renderCreate(){
 const target=$(".docs-view-create",modal);
 if(!target)return;
 const recipients=(Array.isArray(master.recipients)?master.recipients:[]).filter(isActiveRecipient);
 const todayVal=today();
 target.innerHTML="<h3 class='docs-section-title'>Buat Surat Jalan &amp; BAST</h3>"+
 "<p class='docs-note'>Ikuti tiga langkah singkat. Nomor dokumen baru diterbitkan setelah pemeriksaan akhir.</p>"+
 "<form id='docsCreateForm' autocomplete='off'>"+
 "<nav class='docs-wizard-steps' aria-label='Tahapan penerbitan'>"+
 "<span class='docs-wizard-step' data-wizard-step='1' aria-current='step'>1. Distribusi</span>"+
 "<span class='docs-wizard-step' data-wizard-step='2'>2. Penerima</span>"+
 "<span class='docs-wizard-step' data-wizard-step='3'>3. Periksa</span></nav>"+
 "<section class='docs-step-pane' data-step-pane='1'>"+
 "<h4 class='docs-section-title'>Informasi distribusi</h4>"+
 "<div class='docs-grid'>"+
 "<div class='docs-field'><label for='docsDate'>Tanggal distribusi *</label><input id='docsDate' type='date' required value='"+todayVal+"'></div>"+
 "<div class='docs-field'><label for='docsTime'>Jam berangkat</label><input id='docsTime' type='time'></div>"+
 "<div class='docs-field'><label for='docsMenu'>Menu makanan</label><select id='docsMenu'>"+options(master.menus,"teks_menu","teks_menu","Pilih menu")+"</select></div>"+
 "<div class='docs-field'><label for='docsStaff'>Petugas</label><select id='docsStaff'>"+options(master.staff,"nama","nama","Pilih petugas")+"</select></div>"+
 "<div class='docs-field'><label for='docsDriver'>Pengemudi</label><select id='docsDriver'>"+options(master.drivers,"nama","nama","Pilih pengemudi")+"</select></div>"+
 "<div class='docs-field'><label for='docsVehicle'>Kendaraan</label><select id='docsVehicle'>"+options(master.vehicles,"no_kendaraan","no_kendaraan","Pilih kendaraan")+"</select></div>"+
 "</div><p class='docs-note'>Kolom yang belum tersedia di Data Master tetap dapat dibiarkan kosong sesuai aturan data saat ini.</p>"+
 "<div class='docs-step-actions'><span></span><button type='button' class='docs-btn primary' id='docsNextRecipients'>Lanjut: Pilih penerima</button></div></section>"+
 "<section class='docs-step-pane' data-step-pane='2' hidden>"+
 "<h4 class='docs-section-title'>Pilih penerima manfaat</h4>"+
 "<p class='docs-note'>Penerima tidak dipilih otomatis. Pilih secara sengaja agar dokumen hanya diterbitkan untuk penerima yang dimaksud.</p>"+
 "<div class='docs-recipient-box'><div class='docs-recipient-head'><strong>Penerima aktif <span id='docsSelectedCount'>(0 dipilih)</span></strong><div class='docs-recipient-tools'><input id='docsRecipientSearch' type='search' placeholder='Cari nama penerima...' aria-label='Cari penerima'><button type='button' class='docs-btn' id='docsSelectAll'>Pilih semua terlihat</button><button type='button' class='docs-btn' id='docsClearAll'>Kosongkan terlihat</button></div></div>"+
 "<div class='docs-recipient-list' id='docsRecipientList'></div></div>"+
 "<div class='docs-step-actions'><button type='button' class='docs-btn' id='docsBackDistribution'>Kembali</button><button type='button' class='docs-btn primary' id='docsNextReview'>Lanjut: Periksa</button></div></section>"+
 "<section class='docs-step-pane' data-step-pane='3' hidden>"+
 "<h4 class='docs-section-title'>Periksa sebelum menerbitkan</h4>"+
 "<p class='docs-note'>Pastikan tanggal, informasi perjalanan, dan daftar penerima sudah benar. Setelah dokumen pertama diterbitkan, detail distribusi pada tanggal ini akan terkunci untuk menjaga snapshot dokumen.</p>"+
 "<div class='docs-review' id='docsReviewSummary'></div>"+
 "<div class='docs-recipient-box'><strong>Penerima yang akan mendapatkan dokumen</strong><div id='docsReviewRecipients' class='docs-note' style='margin:8px 0 0'></div></div>"+
 "<div class='docs-step-actions'><button type='button' class='docs-btn' id='docsBackRecipients'>Kembali</button><button class='docs-btn primary' id='docsCreateButton' type='submit'>Terbitkan SJ &amp; BAST</button></div></section>"+
 "</form><div id='docsCreateResult'></div>";
 renderRecipients(recipients);
 $("#docsRecipientSearch",target).addEventListener("input",filterRecipients);
 $("#docsSelectAll",target).onclick=()=>setAllRecipients(true);
 $("#docsClearAll",target).onclick=()=>setAllRecipients(false);
 $("#docsNextRecipients",target).onclick=()=>goWizardStep(2);
 $("#docsBackDistribution",target).onclick=()=>goWizardStep(1);
 $("#docsNextReview",target).onclick=()=>goWizardStep(3);
 $("#docsBackRecipients",target).onclick=()=>goWizardStep(2);
 $("#docsCreateForm",target).addEventListener("submit",createDocs);
}
function goWizardStep(step){
 const form=$("#docsCreateForm",modal);
 if(!form)return;
 if(step===2){
  const date=$("#docsDate",form);
  if(!date.value){date.reportValidity();return}
 }
 if(step===3){
  const selected=Array.from(form.querySelectorAll("input[name='recipient']:checked"));
  if(!selected.length){status("Pilih minimal satu penerima sebelum melanjutkan.",true);return}
  const values={
   "Tanggal":$("#docsDate",form).value,
   "Menu":($("#docsMenu",form).value?$("#docsMenu",form).selectedOptions[0]?.textContent:"Belum diisi")||"Belum diisi",
   "Petugas":($("#docsStaff",form).value?$("#docsStaff",form).selectedOptions[0]?.textContent:"Belum diisi")||"Belum diisi",
   "Pengemudi":($("#docsDriver",form).value?$("#docsDriver",form).selectedOptions[0]?.textContent:"Belum diisi")||"Belum diisi",
   "Kendaraan":($("#docsVehicle",form).value?$("#docsVehicle",form).selectedOptions[0]?.textContent:"Belum diisi")||"Belum diisi",
   "Jumlah penerima":selected.length,
   "Jumlah dokumen":selected.length*2
  };
  const summary=$("#docsReviewSummary",form);summary.innerHTML="";
  Object.entries(values).forEach(([label,value])=>{
   const item=node("div","docs-review-item");item.append(node("small",null,label),node("strong",null,value));summary.append(item);
  });
  const names=selected.map(input=>input.closest(".docs-recipient")?.dataset.name||"Penerima");
  $("#docsReviewRecipients",form).textContent=names.join(", ");
 }
 form.querySelectorAll("[data-step-pane]").forEach(pane=>pane.hidden=Number(pane.dataset.stepPane)!==step);
 form.querySelectorAll("[data-wizard-step]").forEach(button=>{
  if(Number(button.dataset.wizardStep)===step)button.setAttribute("aria-current","step");
  else button.removeAttribute("aria-current");
 });
 status("");
 const heading=form.querySelector("[data-step-pane='"+step+"'] h4");
 if(heading)heading.focus?.();
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
}
async function createDocs(event){
 event.preventDefault();status("");
 const selected=Array.from(modal.querySelectorAll("input[name='recipient']:checked")).map(x=>x.value);
 if(!selected.length){status("Pilih minimal satu penerima.",true);return}
 const body={
  tanggal:$("#docsDate",modal).value,
  jam_berangkat:$("#docsTime",modal).value,
  menu:$("#docsMenu",modal).value,
  nama_petugas:$("#docsStaff",modal).value,
  nama_pengemudi:$("#docsDriver",modal).value,
  no_kendaraan:$("#docsVehicle",modal).value,
  recipient_ids:selected,

 };
 if(!body.tanggal){status("Tanggal distribusi wajib diisi.",true);return}
 const button=$("#docsCreateButton",modal);button.disabled=true;button.textContent="Menerbitkan dokumen...";
 try{
  const result=await api("docs/create",body);window.dispatchEvent(new Event("autodoc:data-changed"));
  const failed=(result.errors||[]).length;
  const summary=node("div","docs-result");
  summary.textContent=result.berhasil+" dari "+result.requested+" dokumen berhasil disiapkan ("+Math.floor(result.berhasil/2)+" pasangan SJ/BAST). "+(failed?"Masih ada "+failed+" dokumen gagal; ulangi tanggal yang sama untuk melanjutkan.":"Nomor yang sudah terbit tidak akan dibuat ulang.");
  $("#docsCreateResult",modal).innerHTML="";$("#docsCreateResult",modal).append(summary);
  status(result.message||"Selesai.",failed>0);
  await loadHistory(body.tanggal);
  tab="history";drawTabs();
  $(".docs-view-create",modal).hidden=true;$(".docs-view-history",modal).hidden=false;
 }catch(e){status(e.message,true)}
 finally{button.disabled=false;button.textContent="Buat Surat Jalan & BAST"}
}
async function loadDistributions(initialOffset=0){
 const target=$(".docs-view-history",modal);if(!target)return;
 target.innerHTML="<div class='docs-days-toolbar'><div><h3 class='docs-section-title'>Arsip distribusi</h3><p class='docs-note' style='margin:4px 0 0'>Telusuri distribusi terbaru, lalu gunakan halaman berikutnya untuk arsip yang lebih lama.</p></div><input id='docsDaysSearch' type='search' placeholder='Cari tanggal, menu, petugas, atau pengemudi...' aria-label='Cari arsip distribusi'></div><div id='docsDaysList' class='docs-days-list'><div class='docs-empty'>Memuat arsip…</div></div><div class='docs-days-pagination'><button type='button' class='docs-btn' id='docsDaysPrevious'>Lebih baru</button><span id='docsDaysPage' class='docs-note'>Memuat halaman…</span><button type='button' class='docs-btn primary' id='docsDaysNext'>Lebih lama</button></div>";
 const list=$("#docsDaysList",target),input=$("#docsDaysSearch",target);
 const previous=$("#docsDaysPrevious",target),next=$("#docsDaysNext",target),pageLabel=$("#docsDaysPage",target);
 let offset=0,hasMore=false,rows=[];
 function renderDays(){
  const query=input.value.trim().toLocaleLowerCase("id-ID");
  const filtered=rows.filter(row=>[
   row.tanggal,row.menu,row.nama_petugas,row.nama_pengemudi,row.no_kendaraan
  ].some(value=>String(value||"").toLocaleLowerCase("id-ID").includes(query)));
  list.innerHTML="";
  if(!filtered.length){
   list.append(node("div","docs-empty",rows.length?"Tidak ada distribusi yang cocok pada halaman ini.":"Belum ada distribusi pada halaman ini."));
  }else{
   filtered.forEach(row=>{
    const card=node("article","docs-day-card");
    const detail=node("div");
    const date=new Date(String(row.tanggal)+"T00:00:00");
    const dateText=Number.isNaN(date.getTime())?row.tanggal:new Intl.DateTimeFormat("id-ID",{weekday:"long",day:"2-digit",month:"long",year:"numeric"}).format(date);
    detail.append(node("strong",null,dateText));
    detail.append(node("small",null,(row.menu||"Menu belum diisi")+" · "+(row.nama_petugas||"Petugas belum diisi")+" · "+(row.nama_pengemudi||"Pengemudi belum diisi")+" · "+(row.no_kendaraan||"Kendaraan belum diisi")));
    const actions=node("div","docs-day-actions");
    const open=node("button","docs-btn primary","Buka");open.type="button";open.onclick=()=>loadHistory(row.tanggal);
    actions.append(open);card.append(detail,actions);list.append(card);
   });
  }
  const first=rows.length?offset+1:0,last=offset+rows.length;
  pageLabel.textContent=rows.length?"Distribusi "+first+"–"+last+" · Cari pada halaman ini":"Tidak ada distribusi";
  previous.disabled=offset===0;
  next.disabled=!hasMore;
 }
 async function loadPage(nextOffset){
  status("Memuat arsip distribusi…");
  previous.disabled=true;next.disabled=true;
  try{
   const result=await api("docs/days?offset="+encodeURIComponent(nextOffset));
   rows=Array.isArray(result.distributions)?result.distributions:[];
   offset=Number(result.offset||0);
   hasMore=Boolean(result.has_more);
   renderDays();
   status(rows.length+" distribusi dimuat pada halaman ini.");
  }catch(error){
   status(error.message,true);
   list.replaceChildren(node("div","docs-empty","Arsip gagal dimuat. Periksa sesi dan koneksi, lalu coba lagi."));
   previous.disabled=offset===0;
   next.disabled=true;
  }
 }
 input.addEventListener("input",renderDays);
 previous.onclick=()=>loadPage(Math.max(0,offset-60));
 next.onclick=()=>loadPage(offset+60);
 await loadPage(Math.max(0,Number(initialOffset)||0));
}
async function loadHistory(date){
 const target=$(".docs-view-history",modal);if(!target)return;
 const chosen=date||($("#docsHistoryDate",modal)?.value)||today();
 target.innerHTML="<div class='docs-history-top'><button type='button' class='docs-btn' id='docsBackToDays'>← Semua distribusi</button><div class='docs-field'><label for='docsHistoryDate'>Tanggal distribusi</label><input id='docsHistoryDate' type='date' value='"+esc(chosen)+"'></div><button type='button' class='docs-btn primary' id='docsLoadHistory'>Tampilkan</button></div><div class='docs-print-bulk' id='docsPrintBulk'><span style='align-self:center;font-size:11px;color:#526258;font-weight:700'>Cetak massal:</span><button type='button' class='docs-btn' id='docsPrintSj'>Semua Surat Jalan</button><button type='button' class='docs-btn' id='docsPrintBast'>Semua BAST</button></div><div id='docsDistributionMeta' class='docs-note'></div><div class='docs-list' id='docsList'></div>";
 $("#docsBackToDays",target).onclick=()=>loadDistributions().catch(e=>status(e.message,true));
 $("#docsLoadHistory",target).onclick=()=>loadHistory($("#docsHistoryDate",target).value).catch(e=>status(e.message,true));
 $("#docsPrintSj",target).onclick=()=>printDocuments(currentDocs.filter(doc=>doc.jenis==="SJ"));
 $("#docsPrintBast",target).onclick=()=>printDocuments(currentDocs.filter(doc=>doc.jenis==="BAST"));
 status("Memuat riwayat...");
 try{
  const result=await api("docs/list?tanggal="+encodeURIComponent(chosen));
  currentDistribution=result.distribution;currentDocs=result.documents||[];
  const list=$("#docsList",target);list.innerHTML="";
  const dist=currentDistribution||{};
  $("#docsDistributionMeta",target).textContent=(dist.menu||"Menu belum diisi")+" · "+(dist.nama_petugas||"Petugas belum diisi")+" · "+(dist.nama_pengemudi||"Pengemudi belum diisi")+" · "+(dist.no_kendaraan||"Kendaraan belum diisi");
  if(!currentDocs.length){$("#docsPrintSj",target).disabled=true;$("#docsPrintBast",target).disabled=true;list.append(node("div","docs-empty","Belum ada dokumen untuk tanggal ini."));status("");return}
  const grouped=new Map();
  currentDocs.forEach(doc=>{
   const snap=doc.snapshot_json||{},recipient=snap.penerima||{};
   const key=String(doc.recipient_id||recipient.id||doc.id);
   if(!grouped.has(key))grouped.set(key,{recipient,docs:[]});
   grouped.get(key).docs.push(doc);
  });
  for(const group of grouped.values())list.append(renderDocumentGroup(group));
  $("#docsPrintSj",target).disabled=!currentDocs.some(doc=>doc.jenis==="SJ");
  $("#docsPrintBast",target).disabled=!currentDocs.some(doc=>doc.jenis==="BAST");
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
function buildPrintHtml(doc){
 const snap=doc.snapshot_json||{},sppg=snap.sppg||{},dist=snap.distribusi||{},rec=snap.penerima||{},items=snap.rincian_porsi||[];
 const isBast=doc.jenis==="BAST",real=doc.realisasi||{};
 const rows=items.length?items.map((x,i)=>"<tr><td>"+(i+1)+"</td><td>"+esc(x.kelompok_sasaran)+"</td><td>"+esc(x.jenis_porsi)+"</td><td style='text-align:right'>"+Number(x.jumlah||0).toLocaleString("id-ID")+"</td></tr>").join(""):"<tr><td colspan='4'>Tidak ada rincian porsi.</td></tr>";
 const realRows=real.items||[];
 const realization=isBast&&real.document_id?"<h3>Realisasi Penerimaan</h3><p>Kondisi: "+esc(real.kondisi||"—")+" · Jam diterima: "+esc(real.jam_diterima||"—")+" · Suhu: "+esc(real.suhu_c??"—")+" °C</p><p>Ompreng kembali: "+esc(real.ompreng_kembali??"—")+" · Penerima: "+esc(real.nama_penerima||"—")+" ("+esc(real.jabatan_penerima||"—")+")</p><table class='data'><thead><tr><th>Jenis</th><th>Diserahkan</th><th>Diterima</th></tr></thead><tbody>"+realRows.map(x=>"<tr><td>"+esc(x.jenis_porsi)+"</td><td>"+Number(x.jumlah_diserahkan).toLocaleString("id-ID")+"</td><td>"+Number(x.jumlah_diterima).toLocaleString("id-ID")+"</td></tr>").join("")+"</tbody></table><p>Catatan: "+esc(real.catatan||"—")+"</p>":"";
 const title=isBast?"BERITA ACARA SERAH TERIMA":"SURAT JALAN";
 const html="<!doctype html><html lang='id'><head><meta charset='utf-8'><title>"+esc(doc.nomor_lengkap)+"</title><style>@page{size:A4;margin:16mm}*{box-sizing:border-box}body{font-family:Arial,sans-serif;color:#111;font-size:12px;line-height:1.5}.top{display:grid;grid-template-columns:70px minmax(0,1fr) 105px;align-items:center;gap:12px;border-bottom:3px double #222;padding-bottom:10px;min-height:82px}.top-logo{display:block;width:68px;height:68px;object-fit:contain}.top-copy{text-align:center}.brand{font-size:15px;font-weight:700}.top-address{font-size:10px;line-height:1.5}.top-meta{text-align:right;font-size:10px;line-height:1.5}.muted{color:#444}.center{text-align:center;margin:22px 0 14px}.center h1{font-size:18px;margin:0;letter-spacing:.6px}.center h2{font-size:13px;margin:3px 0;text-decoration:underline}.number{text-align:center;font-size:12px;margin:4px}.meta{display:grid;grid-template-columns:1fr 1fr;gap:7px 22px;margin:17px 0}.meta div{padding:4px 0;border-bottom:1px dotted #bbb}.meta b{display:inline-block;min-width:115px}.data{width:100%;border-collapse:collapse;margin-top:10px}.data th,.data td{padding:7px;border:1px solid #333;text-align:left}.data th{background:#f1f1ed}.sign{display:grid;grid-template-columns:1fr 1fr;gap:65px;margin-top:48px;text-align:center}.space{height:68px}.footer{margin-top:25px;color:#444;font-size:10px}h3{font-size:13px;margin:20px 0 5px}@media print{body{print-color-adjust:exact;-webkit-print-color-adjust:exact}}</style></head><body>"+
 "<div class='top'><img class='top-logo' src='"+LETTERHEAD_LOGO_URL+"' alt='Logo BGN'><div class='top-copy'><div class='brand'>"+esc(sppg.nama_sppg||"SPPG")+"</div><div class='top-address'>"+esc(sppg.alamat||"")+"</div><div class='top-address'>"+esc(sppg.kecamatan||"")+" · "+esc(sppg.kabupaten||"")+"</div></div><div class='top-meta'><b>"+esc(sppg.kode_sppg||"")+"</b><br><span class='muted'>Dokumen operasional MBG</span></div></div>"+
 "<div class='center'><h1>"+title+"</h1><h2>"+(isBast?"SERAH TERIMA HASIL DISTRIBUSI MBG":"PENGIRIMAN / DISTRIBUSI MBG")+"</h2><div class='number'>Nomor: <b>"+esc(doc.nomor_lengkap)+"</b></div></div>"+
 "<div class='meta'><div><b>Tanggal</b>: "+esc(dist.tanggal||"—")+"</div><div><b>Jam berangkat</b>: "+esc(dist.jam_berangkat||"—")+"</div><div><b>Penerima</b>: "+esc(rec.nama||"—")+"</div><div><b>Kelompok</b>: "+esc(rec.kelompok||"—")+" / "+esc(rec.jenjang||"")+"</div><div><b>Alamat</b>: "+esc(rec.alamat||"—")+"</div><div><b>Menu</b>: "+esc(dist.menu||"—")+"</div><div><b>Pengemudi</b>: "+esc(dist.nama_pengemudi||"—")+"</div><div><b>Kendaraan</b>: "+esc(dist.no_kendaraan||"—")+"</div><div><b>Petugas</b>: "+esc(dist.nama_petugas||"—")+"</div><div><b>Total porsi</b>: "+Number((snap.ringkasan||{}).total_porsi||0).toLocaleString("id-ID")+"</div></div>"+
 "<h3>Rincian Porsi</h3><table class='data'><thead><tr><th style='width:35px'>No.</th><th>Kelompok sasaran</th><th>Jenis porsi</th><th style='width:100px;text-align:right'>Jumlah</th></tr></thead><tbody>"+rows+"</tbody><tfoot><tr><th colspan='3' style='text-align:right'>Total</th><th style='text-align:right'>"+Number((snap.ringkasan||{}).total_porsi||0).toLocaleString("id-ID")+"</th></tr></tfoot></table>"+
 (isBast?realization:"")+
 "<div class='sign'><div>Petugas / Pengemudi<div class='space'></div><b><u>"+esc(dist.nama_petugas||dist.nama_pengemudi||"")+"</u></b></div><div>"+(isBast?"Penerima":"Penerima / Tujuan")+"<div class='space'></div><b><u>"+esc(real.nama_penerima||"")+"</u></b></div></div>"+
 "<div class='footer'>Dokumen dibuat oleh AutoDoc · SPPG Darmaraja 01. Snapshot dokumen: "+esc(doc.created_at||"")+".</div></body></html>";
 return html;
}
function printDocuments(documents){
 const docs=Array.isArray(documents)?documents:[];
 if(!docs.length){status("Tidak ada dokumen untuk dicetak.",true);return}
 const htmls=docs.map(buildPrintHtml);
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
 let printStarted=false;
 const invokePrint=()=>{
  if(printStarted)return;
  printStarted=true;
  if(win.closed||typeof win.print!=="function")return;
  try{win.focus();win.print()}catch(_){return}
  Promise.allSettled(docs.map(doc=>api("docs/mark-printed",{document_id:doc.id}))).then(()=>{
   window.dispatchEvent(new Event("autodoc:data-changed"));
   if(!modal.hidden){
    const dateField=$("#docsHistoryDate",modal);
    if(dateField)loadHistory(dateField.value).catch(()=>{});
   }
  });
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
function showRealization(card,doc){
 modal.querySelectorAll(".docs-realization").forEach(x=>x.remove());
 const snap=doc.snapshot_json||{},recipient=snap.penerima||{},old=doc.realisasi||{};
 const deliveredSmall=Number(recipient.porsi_kecil||0),deliveredLarge=Number(recipient.porsi_besar||0);
 const panel=node("section","docs-realization");
 panel.innerHTML="<h5>Realisasi BAST · "+esc(doc.nomor_lengkap)+"</h5>"+
 "<p class='docs-note'>Jumlah diserahkan: porsi kecil "+deliveredSmall+" dan porsi besar "+deliveredLarge+". Jumlah diterima tidak boleh melebihi jumlah diserahkan.</p>"+
 "<form class='docs-grid' id='docsRealizationForm'>"+
 "<div class='docs-field'><label>Kondisi makanan *</label><select name='kondisi' required><option value=''>Pilih kondisi</option><option value='baik'>Baik</option><option value='kurang baik'>Kurang baik</option><option value='tidak layak'>Tidak layak</option></select></div>"+
 "<div class='docs-field'><label>Jam diterima *</label><input name='jam_diterima' type='time' required value='"+esc(old.jam_diterima||"")+"'></div>"+
 "<div class='docs-field'><label>Suhu makanan (°C)</label><input name='suhu_c' type='number' step='0.01' min='-50' max='100' value='"+esc(old.suhu_c??"")+"'></div>"+
 "<div class='docs-field'><label>Ompreng kembali</label><input name='ompreng_kembali' type='number' min='0' step='1' value='"+esc(old.ompreng_kembali??"")+"'></div>"+
 "<div class='docs-field'><label>Porsi kecil diterima *</label><input name='diterima_kecil' type='number' min='0' max='"+deliveredSmall+"' required value='"+esc(old.items?.find(x=>x.jenis_porsi==="Porsi Kecil")?.jumlah_diterima??deliveredSmall)+"'></div>"+
 "<div class='docs-field'><label>Porsi besar diterima *</label><input name='diterima_besar' type='number' min='0' max='"+deliveredLarge+"' required value='"+esc(old.items?.find(x=>x.jenis_porsi==="Porsi Besar")?.jumlah_diterima??deliveredLarge)+"'></div>"+
 "<div class='docs-field'><label>Nama penerima *</label><input name='nama_penerima' required maxlength='180' value='"+esc(old.nama_penerima||"")+"'></div>"+
 "<div class='docs-field'><label>Jabatan penerima</label><input name='jabatan_penerima' maxlength='120' value='"+esc(old.jabatan_penerima||"")+"'></div>"+
 "<div class='docs-field wide'><label>Catatan</label><textarea name='catatan' maxlength='1000'>"+esc(old.catatan||"")+"</textarea></div>"+
 "<div class='docs-field wide'><label>PIN akses untuk konfirmasi *</label><input name='token' type='password' required minlength='6' maxlength='128' autocomplete='current-password'></div>"+
 "<div class='docs-form-actions'><button type='button' class='docs-btn cancel-realization'>Tutup</button><button type='submit' class='docs-btn primary save-realization'>Simpan realisasi</button></div></form>";
 card.append(panel);
 $(".cancel-realization",panel).onclick=()=>panel.remove();
 $("#docsRealizationForm",panel).onsubmit=async e=>{
  e.preventDefault();const data=Object.fromEntries(new FormData(e.currentTarget).entries());data.document_id=doc.id;
  const button=$(".save-realization",panel);button.disabled=true;button.textContent="Menyimpan…";
  try{await api("docs/realization",data);window.dispatchEvent(new Event("autodoc:data-changed"));status("Realisasi BAST berhasil disimpan.");await loadHistory($("#docsHistoryDate",modal).value)}
  catch(err){status(err.message,true);button.disabled=false;button.textContent="Simpan realisasi"}
 };
 panel.scrollIntoView({behavior:"smooth",block:"nearest"});
}
function init(){
 style();build();
 window.AutoDocDocuments=Object.freeze({
  open(){
   show();
   tab="create";drawTabs();
   $(".docs-view-create",modal).hidden=false;
   $(".docs-view-history",modal).hidden=true;
  },
  close,
  openArchive(date){
   show(false);
   tab="history";drawTabs();
   $(".docs-view-create",modal).hidden=true;
   $(".docs-view-history",modal).hidden=false;
   if(date)loadHistory(date);
   else loadDistributions();
  }
 });
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init,{once:true});else init();
})();