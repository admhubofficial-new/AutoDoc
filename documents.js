(() => {
"use strict";
const API="https://cnbomblvtddkmtojzpyd.supabase.co/functions/v1/autodoc-auth";
const KEY="sb_publishable_xSbC7RqRGFkZVaqkFYJ7OA_DJ9qSuyv";
const $=(root,selector)=>selector?root.querySelector(selector):document.querySelector(root);
const esc=value=>String(value??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const today=()=>{const d=new Date();return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0")};
let modal=null, tab="create", master={}, currentDocs=[], currentDistribution=null;

async function api(route,body){
 const headers={"apikey":KEY,"Accept":"application/json"};
 const options={credentials:"include",cache:"no-store",headers};
 if(body){headers["Content-Type"]="application/json";options.method="POST";options.body=JSON.stringify(body)}
 const response=await fetch(API+"/"+route,options);
 let payload={};try{payload=await response.json()}catch(_){}
 if(!response.ok)throw new Error(payload.message||"Permintaan tidak berhasil.");
 return payload;
}
function node(tag,cls,text){const el=document.createElement(tag);if(cls)el.className=cls;if(text!==undefined)el.textContent=text;return el}
function status(message,bad){const el=$(".doc-msg",modal);el.textContent=message||"";el.classList.toggle("error",!!bad)}
function close(){
 if(!modal)return;
 modal.hidden=true;modal.style.display="none";modal.setAttribute("aria-hidden","true");
 document.body.style.overflow="";
 const launch=document.querySelector("#docsLauncher");if(launch)launch.setAttribute("aria-expanded","false");
}
function show(){
 if(!modal){style();build()}
 modal.hidden=false;
 modal.style.display="flex";
 modal.style.visibility="visible";
 modal.style.zIndex="2147483647";
 modal.setAttribute("aria-hidden","false");
 document.body.style.overflow="hidden";
 const launch=document.querySelector("#docsLauncher");if(launch)launch.setAttribute("aria-expanded","true");
 loadMaster().catch(e=>status(e.message,true));
}
function style(){
 if($("#docsStyles"))return;
 const css=node("style");css.id="docsStyles";
 css.textContent=".docs-launch{display:flex;align-items:center;gap:14px;width:100%;margin-top:14px;padding:18px 20px;border:1px solid #dce8dc;border-radius:15px;background:#fff;color:#244434;text-align:left;box-shadow:0 5px 18px rgba(32,60,40,.035)}.docs-launch:hover{border-color:#9dbba2;background:#fbfdf9}.docs-launch-icon{width:42px;height:42px;display:grid;place-items:center;border-radius:12px;background:#edf5ed;font-size:21px}.docs-launch strong{display:block;font-size:14px}.docs-launch small{display:block;margin-top:4px;color:#7b887f;font-size:11px}.docs-overlay[hidden]{display:none}.docs-overlay{position:fixed;inset:0;z-index:10000;display:flex;align-items:center;justify-content:center;padding:16px;background:rgba(12,31,22,.6)}.docs-dialog{width:min(1120px,100%);max-height:94vh;overflow:auto;border-radius:18px;background:#fbfcfa;box-shadow:0 28px 90px rgba(0,0,0,.26)}.docs-head{position:sticky;top:0;z-index:3;display:flex;align-items:center;justify-content:space-between;gap:15px;padding:19px 23px;border-bottom:1px solid #e4eae3;background:#fff}.docs-head h2{margin:0;color:#1b3f2e;font-size:20px}.docs-head p{margin:5px 0 0;color:#7a887e;font-size:12px}.docs-close{width:38px;height:38px;border:1px solid #e1e8e0;border-radius:10px;background:#fff;color:#526258;font-size:21px}.docs-tabs{display:flex;gap:8px;padding:13px 20px;border-bottom:1px solid #e5ebe4;background:#fff}.docs-tab{padding:9px 14px;border:1px solid #dce6dc;border-radius:9px;background:#fff;color:#526258;font-size:12px;font-weight:750}.docs-tab[aria-selected=true]{border-color:#1e5b43;background:#eaf3ea;color:#174b39}.docs-body{padding:22px}.docs-section-title{margin:0 0 6px;color:#284234;font-size:16px}.docs-note{margin:0 0 16px;color:#77847b;font-size:11px;line-height:1.65}.docs-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}.docs-field{display:flex;flex-direction:column;gap:6px;min-width:0}.docs-field.wide{grid-column:span 2}.docs-field label{color:#536258;font-size:11px;font-weight:750}.docs-field input,.docs-field select,.docs-field textarea{width:100%;min-height:40px;padding:9px 10px;border:1px solid #dce5dc;border-radius:8px;background:#fff;color:#24392d;font:inherit;font-size:12px}.docs-field textarea{min-height:66px;resize:vertical}.docs-recipient-box{margin-top:18px;padding:16px;border:1px solid #e0e8df;border-radius:13px;background:#fff}.docs-recipient-head{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}.docs-recipient-head strong{color:#294536;font-size:13px}.docs-recipient-tools{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.docs-recipient-tools input{min-height:35px;padding:7px 9px;border:1px solid #dce5dc;border-radius:8px;font-size:11px}.docs-btn{padding:9px 12px;border:1px solid #dce6dc;border-radius:9px;background:#fff;color:#31513d;font-size:11px;font-weight:750}.docs-btn.primary{border-color:#174b39;background:#174b39;color:#fff}.docs-btn:disabled{opacity:.55;cursor:wait}.docs-recipient-list{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px;margin-top:13px;max-height:310px;overflow:auto}.docs-recipient{display:flex;align-items:flex-start;gap:9px;padding:10px;border:1px solid #edf0ec;border-radius:9px;background:#fcfdfb}.docs-recipient input{margin-top:3px}.docs-recipient strong{display:block;color:#33483b;font-size:11px}.docs-recipient small{display:block;margin-top:3px;color:#7d897f;font-size:10px;line-height:1.5}.docs-verify{display:inline-block;margin-left:5px;padding:2px 5px;border-radius:5px;background:#fff4dc;color:#92651e;font-size:9px;font-weight:700}.docs-pin-row{display:grid;grid-template-columns:1fr auto;align-items:end;gap:12px;margin-top:17px;padding:15px;border:1px solid #e8e3d6;border-radius:12px;background:#fffdf6}.docs-result{margin-top:15px;padding:13px;border:1px solid #dce8dc;border-radius:10px;background:#f4f9f3;color:#31513d;font-size:11px;line-height:1.6}.docs-msg{min-height:18px;margin:12px 0 0;color:#66756d;font-size:11px}.docs-msg.error{color:#a43c32}.docs-history-toolbar{display:flex;align-items:end;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:15px}.docs-list{display:grid;grid-template-columns:1fr;gap:10px}.docs-card{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:14px;padding:15px;border:1px solid #e1e9e0;border-radius:12px;background:#fff}.docs-card h4{margin:0;color:#294536;font-size:13px}.docs-card p{margin:5px 0 0;color:#7a887e;font-size:10px;line-height:1.6}.docs-card-actions{display:flex;align-items:center;justify-content:flex-end;gap:7px;flex-wrap:wrap}.docs-kind{display:inline-block;margin-right:6px;padding:4px 7px;border-radius:6px;background:#edf4ed;color:#24563a;font-size:9px;font-weight:800}.docs-kind.bast{background:#f6f0e2;color:#806327}.docs-status{display:inline-block;margin-left:6px;padding:4px 7px;border-radius:6px;background:#f1f3f0;color:#647066;font-size:9px;font-weight:750}.docs-status.selesai{background:#e8f4e9;color:#2b6844}.docs-status.batal{background:#f8e9e7;color:#a43c32}.docs-realization{grid-column:1/-1;padding:14px;border:1px solid #e7e9df;border-radius:10px;background:#fbfcf8}.docs-realization h5{margin:0 0 12px;color:#31513d;font-size:12px}.docs-form-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:15px}.docs-empty{padding:25px;text-align:center;color:#879289;font-size:11px;border:1px dashed #dce5dc;border-radius:10px;background:#fff}.docs-warning{color:#946b21}.docs-checkline{display:flex;align-items:center;gap:8px;min-height:40px;color:#526258;font-size:11px}.docs-print-table{width:100%;border-collapse:collapse;font-size:12px}.docs-print-table th,.docs-print-table td{padding:8px;border:1px solid #333;text-align:left}.docs-print-table th{background:#f3f4f1}.docs-signatures{display:grid;grid-template-columns:1fr 1fr;gap:60px;margin-top:45px;text-align:center;font-size:12px}.docs-sign-space{height:75px}.docs-print-head{text-align:center;margin-bottom:20px}.docs-print-head h1{margin:0 0 7px;font-size:18px;letter-spacing:.7px}.docs-print-head h2{margin:0;font-size:14px;text-decoration:underline}.docs-print-meta{display:flex;justify-content:space-between;gap:15px;margin:13px 0;font-size:12px}.docs-print-table{margin-top:14px}.docs-print-footer{margin-top:28px;font-size:10px;color:#555}@media(max-width:760px){.docs-overlay{padding:0;align-items:stretch}.docs-dialog{max-height:100vh;border-radius:0}.docs-head{padding:15px}.docs-body{padding:15px}.docs-grid{grid-template-columns:1fr 1fr}.docs-field.wide{grid-column:span 2}.docs-recipient-list{grid-template-columns:1fr}.docs-card{grid-template-columns:1fr}.docs-card-actions{justify-content:flex-start}.docs-pin-row{grid-template-columns:1fr}}@media(max-width:420px){.docs-grid{grid-template-columns:1fr}.docs-field.wide{grid-column:span 1}}";
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
 document.addEventListener("keydown",e=>{if(e.key==="Escape"&&!modal.hidden)close()});
 drawTabs();renderCreate();
}
function drawTabs(){
 const tabs=$(".docs-tabs",modal);tabs.innerHTML="";
 [["create","Buat dokumen"],["history","Riwayat dokumen"]].forEach(pair=>{
  const b=node("button","docs-tab",pair[1]);b.type="button";b.setAttribute("aria-selected",String(tab===pair[0]));b.onclick=()=>switchTab(pair[0]);tabs.append(b);
 });
}
function switchTab(next){
 tab=next;drawTabs();
 $(".docs-view-create",modal).hidden=tab!=="create";
 $(".docs-view-history",modal).hidden=tab!=="history";
 status("");
 if(tab==="history")loadHistory().catch(e=>status(e.message,true));
}
function options(items,valueKey,labelKey,label){
 let html="<option value=''>"+esc(label)+"</option>";
 (items||[]).filter(x=>x.aktif!==false).forEach(x=>{html+="<option value='"+esc(x[valueKey])+"'>"+esc(x[labelKey])+"</option>"});
 return html;
}
async function loadMaster(){
 status("Memuat data master...");
 const result=await api("master/list");
 master=result.data||{};
 renderCreate();
 status("");
}
function renderCreate(){
 const target=$(".docs-view-create",modal);
 if(!target)return;
 const recipients=(master.recipients||[]).filter(r=>r.aktif);
 const todayVal=today();
 target.innerHTML="<h3 class='docs-section-title'>Penerbitan dokumen distribusi</h3>"+
 "<p class='docs-note'>Pilih tanggal, informasi perjalanan, dan penerima. Sistem akan membuat satu Surat Jalan dan satu BAST per penerima terpilih. Penerbitan akan meminta verifikasi PIN ulang.</p>"+
 "<form id='docsCreateForm' autocomplete='off'>"+
 "<div class='docs-grid'>"+
 "<div class='docs-field'><label for='docsDate'>Tanggal distribusi *</label><input id='docsDate' type='date' required value='"+todayVal+"'></div>"+
 "<div class='docs-field'><label for='docsTime'>Jam berangkat</label><input id='docsTime' type='time'></div>"+
 "<div class='docs-field'><label for='docsMenu'>Menu</label><select id='docsMenu'>"+options(master.menus,"teks_menu","teks_menu","Pilih menu")+"</select></div>"+
 "<div class='docs-field'><label for='docsStaff'>Petugas</label><select id='docsStaff'>"+options(master.staff,"nama","nama","Pilih petugas")+"</select></div>"+
 "<div class='docs-field'><label for='docsDriver'>Pengemudi</label><select id='docsDriver'>"+options(master.drivers,"nama","nama","Pilih pengemudi")+"</select></div>"+
 "<div class='docs-field'><label for='docsVehicle'>Kendaraan</label><select id='docsVehicle'>"+options(master.vehicles,"no_kendaraan","no_kendaraan","Pilih kendaraan")+"</select></div>"+
 "</div>"+
 "<section class='docs-recipient-box'><div class='docs-recipient-head'><strong>Penerima manfaat <span id='docsSelectedCount'></span></strong><div class='docs-recipient-tools'><input id='docsRecipientSearch' type='search' placeholder='Cari penerima...'><button type='button' class='docs-btn' id='docsSelectAll'>Pilih semua</button><button type='button' class='docs-btn' id='docsClearAll'>Kosongkan</button></div></div>"+
 "<div class='docs-recipient-list' id='docsRecipientList'></div></section>"+
 "<div class='docs-pin-row'><div class='docs-field'><label for='docsPin'>Konfirmasi PIN akses *</label><input id='docsPin' type='password' minlength='6' maxlength='128' autocomplete='current-password' placeholder='Masukkan PIN untuk menerbitkan' required></div><button class='docs-btn primary' id='docsCreateButton' type='submit'>Buat Surat Jalan &amp; BAST</button></div>"+
 "</form><div id='docsCreateResult'></div>";
 renderRecipients(recipients);
 $("#docsRecipientSearch",target).addEventListener("input",filterRecipients);
 $("#docsSelectAll",target).onclick=()=>setAllRecipients(true);
 $("#docsClearAll",target).onclick=()=>setAllRecipients(false);
 $("#docsCreateForm",target).addEventListener("submit",createDocs);
}
function renderRecipients(recipients){
 const list=$("#docsRecipientList",modal);if(!list)return;
 list.innerHTML="";
 if(!recipients.length){list.append(node("div","docs-empty","Belum ada penerima aktif. Lengkapi Data Master terlebih dahulu."));return}
 recipients.forEach(r=>{
  const label=node("label","docs-recipient");label.dataset.search=(r.nama+" "+r.kelompok+" "+r.jenjang).toLowerCase();
  const check=node("input");check.type="checkbox";check.name="recipient";check.value=r.id;check.checked=true;
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
 const token=$("#docsPin",modal).value.trim();
 if(token.length<6){status("PIN minimal 6 karakter.",true);$("#docsPin",modal).focus();return}
 const body={
  tanggal:$("#docsDate",modal).value,
  jam_berangkat:$("#docsTime",modal).value,
  menu:$("#docsMenu",modal).value,
  nama_petugas:$("#docsStaff",modal).value,
  nama_pengemudi:$("#docsDriver",modal).value,
  no_kendaraan:$("#docsVehicle",modal).value,
  recipient_ids:selected,
  token
 };
 if(!body.tanggal){status("Tanggal distribusi wajib diisi.",true);return}
 const button=$("#docsCreateButton",modal);button.disabled=true;button.textContent="Menerbitkan dokumen...";
 try{
  const result=await api("docs/create",body);
  $("#docsPin",modal).value="";
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
async function loadHistory(date){
 const target=$(".docs-view-history",modal);if(!target)return;
 const chosen=date||($("#docsHistoryDate",modal)?.value)||today();
 target.innerHTML="<div class='docs-history-toolbar'><div class='docs-field'><label for='docsHistoryDate'>Tanggal distribusi</label><input id='docsHistoryDate' type='date' value='"+esc(chosen)+"'></div><button type='button' class='docs-btn primary' id='docsLoadHistory'>Tampilkan riwayat</button></div><div class='docs-list' id='docsList'></div>";
 $("#docsLoadHistory",target).onclick=()=>loadHistory($("#docsHistoryDate",target).value).catch(e=>status(e.message,true));
 status("Memuat riwayat...");
 try{
  const result=await api("docs/list?tanggal="+encodeURIComponent(chosen));
  currentDistribution=result.distribution;currentDocs=result.documents||[];
  const list=$("#docsList",target);list.innerHTML="";
  if(!currentDocs.length){list.append(node("div","docs-empty","Belum ada dokumen untuk tanggal ini."));status("");return}
  currentDocs.forEach(doc=>list.append(renderDocumentCard(doc)));
  status(currentDocs.length+" dokumen ditemukan.");
 }catch(e){status(e.message,true)}
}
function renderDocumentCard(doc){
 const snap=doc.snapshot_json||{},recipient=snap.penerima||{},kind=doc.jenis;
 const card=node("article","docs-card");
 const info=node("div");
 const title=node("h4");
 const type=node("span","docs-kind"+(kind==="BAST"?" bast":""),kind==="SJ"?"SURAT JALAN":"BAST");
 const stat=node("span","docs-status "+(doc.status||""),doc.status||"dibuat");
 title.append(type,document.createTextNode(doc.nomor_lengkap||"Nomor belum tersedia"),stat);
 const p=node("p",null,(recipient.nama||"Penerima") +" · "+(recipient.kelompok||"") +" · "+Number(recipient.total_porsi||0).toLocaleString("id-ID")+" porsi");
 const meta=node("p",null,"Tanggal: "+(snap.distribusi?.tanggal||"—")+" · Menu: "+(snap.distribusi?.menu||"Belum diisi"));
 info.append(title,p,meta);
 const actions=node("div","docs-card-actions");
 const print=node("button","docs-btn primary","Cetak");print.type="button";print.onclick=()=>printDocument(doc);actions.append(print);
 if(kind==="BAST"){const real=node("button","docs-btn",doc.realisasi?"Ubah realisasi":"Input realisasi");real.type="button";real.onclick=()=>showRealization(card,doc);actions.append(real)}
 card.append(info,actions);return card;
}
function printDocument(doc){
 const snap=doc.snapshot_json||{},sppg=snap.sppg||{},dist=snap.distribusi||{},rec=snap.penerima||{},items=snap.rincian_porsi||[];
 const isBast=doc.jenis==="BAST",real=doc.realisasi||{};
 const rows=items.length?items.map((x,i)=>"<tr><td>"+(i+1)+"</td><td>"+esc(x.kelompok_sasaran)+"</td><td>"+esc(x.jenis_porsi)+"</td><td style='text-align:right'>"+Number(x.jumlah||0).toLocaleString("id-ID")+"</td></tr>").join(""):"<tr><td colspan='4'>Tidak ada rincian porsi.</td></tr>";
 const realRows=real.items||[];
 const realization=isBast&&real.document_id?"<h3>Realisasi Penerimaan</h3><p>Kondisi: "+esc(real.kondisi||"—")+" · Jam diterima: "+esc(real.jam_diterima||"—")+" · Suhu: "+esc(real.suhu_c??"—")+" °C</p><p>Ompreng kembali: "+esc(real.ompreng_kembali??"—")+" · Penerima: "+esc(real.nama_penerima||"—")+" ("+esc(real.jabatan_penerima||"—")+")</p><table class='data'><thead><tr><th>Jenis</th><th>Diserahkan</th><th>Diterima</th></tr></thead><tbody>"+realRows.map(x=>"<tr><td>"+esc(x.jenis_porsi)+"</td><td>"+Number(x.jumlah_diserahkan).toLocaleString("id-ID")+"</td><td>"+Number(x.jumlah_diterima).toLocaleString("id-ID")+"</td></tr>").join("")+"</tbody></table><p>Catatan: "+esc(real.catatan||"—")+"</p>":"";
 const title=isBast?"BERITA ACARA SERAH TERIMA":"SURAT JALAN";
 const html="<!doctype html><html lang='id'><head><meta charset='utf-8'><title>"+esc(doc.nomor_lengkap)+"</title><style>@page{size:A4;margin:16mm}*{box-sizing:border-box}body{font-family:Arial,sans-serif;color:#111;font-size:12px;line-height:1.5}.top{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #222;padding-bottom:10px}.brand{font-size:15px;font-weight:700}.muted{color:#444}.center{text-align:center;margin:22px 0 14px}.center h1{font-size:18px;margin:0;letter-spacing:.6px}.center h2{font-size:13px;margin:3px 0;text-decoration:underline}.number{text-align:center;font-size:12px;margin:4px}.meta{display:grid;grid-template-columns:1fr 1fr;gap:7px 22px;margin:17px 0}.meta div{padding:4px 0;border-bottom:1px dotted #bbb}.meta b{display:inline-block;min-width:115px}.data{width:100%;border-collapse:collapse;margin-top:10px}.data th,.data td{padding:7px;border:1px solid #333;text-align:left}.data th{background:#f1f1ed}.sign{display:grid;grid-template-columns:1fr 1fr;gap:65px;margin-top:48px;text-align:center}.space{height:68px}.footer{margin-top:25px;color:#444;font-size:10px}h3{font-size:13px;margin:20px 0 5px}@media print{body{print-color-adjust:exact;-webkit-print-color-adjust:exact}}</style></head><body>"+
 "<div class='top'><div><div class='brand'>"+esc(sppg.nama_sppg||"SPPG")+"</div><div>"+esc(sppg.alamat||"")+"</div><div>"+esc(sppg.kecamatan||"")+" · "+esc(sppg.kabupaten||"")+"</div></div><div style='text-align:right'><b>"+esc(sppg.kode_sppg||"")+"</b><br><span class='muted'>Dokumen operasional MBG</span></div></div>"+
 "<div class='center'><h1>"+title+"</h1><h2>"+(isBast?"SERAH TERIMA HASIL DISTRIBUSI MBG":"PENGIRIMAN / DISTRIBUSI MBG")+"</h2><div class='number'>Nomor: <b>"+esc(doc.nomor_lengkap)+"</b></div></div>"+
 "<div class='meta'><div><b>Tanggal</b>: "+esc(dist.tanggal||"—")+"</div><div><b>Jam berangkat</b>: "+esc(dist.jam_berangkat||"—")+"</div><div><b>Penerima</b>: "+esc(rec.nama||"—")+"</div><div><b>Kelompok</b>: "+esc(rec.kelompok||"—")+" / "+esc(rec.jenjang||"")+"</div><div><b>Alamat</b>: "+esc(rec.alamat||"—")+"</div><div><b>Menu</b>: "+esc(dist.menu||"—")+"</div><div><b>Pengemudi</b>: "+esc(dist.nama_pengemudi||"—")+"</div><div><b>Kendaraan</b>: "+esc(dist.no_kendaraan||"—")+"</div><div><b>Petugas</b>: "+esc(dist.nama_petugas||"—")+"</div><div><b>Total porsi</b>: "+Number((snap.ringkasan||{}).total_porsi||0).toLocaleString("id-ID")+"</div></div>"+
 "<h3>Rincian Porsi</h3><table class='data'><thead><tr><th style='width:35px'>No.</th><th>Kelompok sasaran</th><th>Jenis porsi</th><th style='width:100px;text-align:right'>Jumlah</th></tr></thead><tbody>"+rows+"</tbody><tfoot><tr><th colspan='3' style='text-align:right'>Total</th><th style='text-align:right'>"+Number((snap.ringkasan||{}).total_porsi||0).toLocaleString("id-ID")+"</th></tr></tfoot></table>"+
 (isBast?realization:"")+
 "<div class='sign'><div>Petugas / Pengemudi<div class='space'></div><b><u>"+esc(dist.nama_petugas||dist.nama_pengemudi||"")+"</u></b></div><div>"+(isBast?"Penerima":"Penerima / Tujuan")+"<div class='space'></div><b><u>"+esc(real.nama_penerima||"")+"</u></b></div></div>"+
 "<div class='footer'>Dokumen dibuat oleh AutoDoc · SPPG Darmaraja 01. Snapshot dokumen: "+esc(doc.created_at||"")+".</div></body></html>";
 const win=window.open("","_blank");if(!win){status("Popup cetak diblokir. Izinkan popup untuk situs AutoDoc.",true);return}
 win.document.open();win.document.write(html);win.document.close();win.focus();
 setTimeout(()=>{try{win.print()}catch(_){}},500);
 api("docs/mark-printed",{document_id:doc.id}).then(()=>loadHistory($("#docsHistoryDate",modal)?.value)).catch(()=>{});
}
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
  const button=$(".save-realization",panel);button.disabled=true;button.textContent="Menyimpan...";
  try{await api("docs/realization",data);status("Realisasi BAST berhasil disimpan.");await loadHistory($("#docsHistoryDate",modal).value)}
  catch(err){status(err.message,true);button.disabled=false;button.textContent="Simpan realisasi"}
 };
 panel.scrollIntoView({behavior:"smooth",block:"nearest"});
}
function init(){
 style();build();
 window.AutoDocDocuments=Object.freeze({open:show,close});
 const launch=document.querySelector("#docsLauncher");
 if(launch){
  // Handler langsung pada tombol; tidak bergantung pada bubbling/delegasi event.
  launch.onclick=event=>{event.preventDefault();show()};
 }
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init,{once:true});else init();
})();