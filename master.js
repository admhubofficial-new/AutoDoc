(() => {
"use strict";
const { apiUrl: API, publishableKey: KEY } = window.AutoDocConfig;
const { parseCsv, parseCsvBoolean } = window.AutoDocMasterUtils;
const defs={
 settings:{title:"Identitas SPPG",fields:[["nama_sppg","Nama SPPG","text",1],["kode_sppg","Kode SPPG","text",1],["alamat","Alamat","textarea"],["kecamatan","Kecamatan","text",1],["kabupaten","Kabupaten","text",1],["nama_kepala_sppg","Nama Kepala SPPG","text"],["nama_kepala_sppi","Nama Kepala SPPI","text"],["nama_ahli_gizi","Nama Ahli Gizi Dapur","text"],["kabupaten_perlu_verifikasi","Kabupaten perlu diverifikasi","checkbox"],["kabupaten_catatan_verifikasi","Catatan verifikasi","textarea"]]},
 recipients:{title:"Penerima manfaat",fields:[["kelompok","Kelompok","select",1,["Sekolah/Lembaga","Posyandu"]],["nama","Nama penerima","text",1],["jenjang","Jenjang","text",1],["alamat","Alamat","textarea"],["siswa_kecil","Siswa kecil","number"],["siswa_besar","Siswa besar","number"],["tendik","Tenaga pendidik","number"],["ibu_hamil","Ibu hamil","number"],["ibu_menyusui","Ibu menyusui","number"],["balita","Balita","number"],["putus_sekolah","Putus sekolah","number"],["kader","Kader","number"],["urutan","Urutan","number"],["keterangan","Keterangan","textarea"],["perlu_verifikasi","Perlu verifikasi","checkbox"],["catatan_verifikasi","Catatan verifikasi","textarea"],["aktif","Aktif","checkbox"]]},
 drivers:{title:"Pengemudi",fields:[["nama","Nama pengemudi","text",1],["urutan","Urutan","number"],["aktif","Aktif","checkbox"]]},
 vehicles:{title:"Kendaraan",fields:[["no_kendaraan","Nomor kendaraan","text",1],["urutan","Urutan","number"],["aktif","Aktif","checkbox"]]},
 staff:{title:"Petugas",fields:[["nama","Nama petugas","text",1],["jabatan","Jabatan","text"],["urutan","Urutan","number"],["aktif","Aktif","checkbox"]]},
 menus:{title:"Menu makanan",fields:[["teks_menu","Nama/menu makanan","text",1],["urutan","Urutan","number"],["aktif","Aktif","checkbox"]]}
};
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
let modal=null,entity="recipients",cache={},returnFocusEl=null,aiController=null;
async function api(path,body){const h={"apikey":KEY,"Accept":"application/json"};const r=await fetch(API+"/"+path,{method:body?"POST":"GET",headers:body?{...h,"Content-Type":"application/json"}:h,body:body?JSON.stringify(body):undefined,credentials:"include",cache:"no-store"});let d={};try{d=await r.json()}catch(_){}if(!r.ok)throw Error(d.message||"Permintaan gagal.");return d;}
function msg(text,bad=false,state){
 const output=modal?.querySelector(".dm-msg");
 if(!output)return;
 output.textContent=text||"";
 output.dataset.state=state||(bad?"error":text?"success":"");
 output.setAttribute("role",bad?"alert":"status");
 output.setAttribute("aria-live",bad?"assertive":"polite");
 output.classList.toggle("error",!!bad);
}
function close(){if(!modal)return;modal.hidden=true;document.body.style.overflow="";if(returnFocusEl&&returnFocusEl.isConnected)returnFocusEl.focus();}
function el(tag,cls,text){const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;}
function init(){
 const home=document.querySelector(".home-content");if(!home)return;

 modal=el("div","dm-overlay");modal.hidden=true;const dialog=el("section","dm-dialog");dialog.setAttribute("role","dialog");dialog.setAttribute("aria-modal","true");dialog.setAttribute("aria-labelledby","dmTitle");
 const head=el("header","dm-head");const h=el("h2",null,"Data Master");h.id="dmTitle";const closeBtn=el("button","dm-close","Tutup");closeBtn.type="button";closeBtn.onclick=close;head.append(h,closeBtn);
 const tabs=el("nav","dm-tabs");tabs.setAttribute("aria-label","Bagian Data Master");const content=el("div","dm-content");const toolbar=el("div","dm-toolbar");const title=el("h3");const actions=el("div");toolbar.append(title,actions);const intro=el("p",null,"Data master dipakai untuk dokumen baru. Dokumen yang sudah diterbitkan tetap menyimpan snapshot lama.");
 const search=el("input","dm-search");search.type="search";search.placeholder="Cari nama, lokasi, status, atau informasi…";search.setAttribute("aria-label","Cari data master");search.autocomplete="off";
 const formSlot=el("div");const table=el("div","dm-table-wrap");const message=el("p","dm-msg");
 content.append(toolbar,intro,search,formSlot,table,message);dialog.append(head,tabs,content);modal.append(dialog);document.body.append(modal);
 aiController=window.AutoDocAiAssistant?.create({
  api,el,getRecipients:()=>Array.isArray(cache.recipients)?cache.recipients:[],
  onApplyMenuPlan:plan=>{
   close();
   if(window.AutoDocDocuments?.applyAiMenuPlan)window.AutoDocDocuments.applyAiMenuPlan(plan);
   else{modal.hidden=false;document.body.style.overflow="hidden";entity="ai";render();msg("Modul Buat Dokumen belum siap. Muat ulang halaman dan coba kembali.",true)}
  },
  onMasterChanged:async()=>{const updated=await api("master/list");cache=updated.data||{};window.dispatchEvent(new Event("autodoc:data-changed"))},
  setMessage:msg
 })||null;
 modal.addEventListener("click",e=>{if(e.target===modal)close()});document.addEventListener("keydown",e=>{
  if(modal.hidden)return;
  if(e.key==="Escape"){close();return}
  if(e.key==="Tab"){
   const focusable=Array.from(modal.querySelectorAll("button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex]:not([tabindex='-1'])")).filter(item=>!item.closest("[hidden]")&&item.getClientRects().length>0);
   if(!focusable.length)return;
   const first=focusable[0],last=focusable[focusable.length-1];
   if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus()}
   else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus()}
  }
 });
 function applySearch(){
  const query=search.value.trim().toLocaleLowerCase("id-ID");
  const rows=Array.from(table.querySelectorAll("tbody tr.dm-data-row"));
  let visible=0;
  rows.forEach(row=>{row.hidden=!!query&&!row.dataset.search.includes(query);if(!row.hidden)visible++});
  const emptyFilter=table.querySelector("[data-filter-empty]");
  const emptyData=table.querySelector(".dm-empty-row");
  if(emptyData)emptyData.hidden=!!query&&rows.length>0;
  if(emptyFilter)emptyFilter.hidden=!query||visible>0||rows.length===0;
  if(query&&rows.length>0&&visible===0)table.dataset.state="empty";
  else table.dataset.state=rows.length?"success":"empty";
 }
 search.addEventListener("input",applySearch);
 function open(nextEntity,initialSearch){
  if(nextEntity==="ai"||(nextEntity&&Object.prototype.hasOwnProperty.call(defs,nextEntity)))entity=nextEntity;
  const requestedSearch=String(initialSearch||"");
  returnFocusEl=document.activeElement;
  modal.hidden=false;document.body.style.overflow="hidden";search.value="";render();
  document.querySelectorAll("[data-home-nav]").forEach(button=>{
   if(button.dataset.homeNav==="master")button.setAttribute("aria-current","page");
   else button.removeAttribute("aria-current");
  });
  closeBtn.focus();
  load().then(()=>{search.value=requestedSearch;applySearch()});
 }
 window.AutoDocMaster=Object.freeze({open,close});
 function render(){
  tabs.innerHTML="";Object.entries(defs).forEach(([key,d])=>{const b=el("button",null,d.title);b.type="button";b.setAttribute("aria-selected",String(key===entity));b.onclick=()=>{entity=key;render()};tabs.append(b)});const aiTab=el("button",null,"Asisten AI");aiTab.type="button";aiTab.setAttribute("aria-selected",String(entity==="ai"));aiTab.onclick=()=>{entity="ai";render()};tabs.append(aiTab);
  title.textContent=entity==="ai"?"Asisten AI AutoDoc":defs[entity].title;actions.innerHTML="";search.value="";
  if(entity==="ai"){
   intro.textContent="Tempel teks atau unggah dokumen. AI akan menyiapkan usulan menu per sekolah dan perbandingan penerima manfaat. Tidak ada perubahan tersimpan sebelum Anda mengonfirmasi.";
   search.hidden=true;table.hidden=true;formSlot.innerHTML="";
   if(aiController)aiController.render(formSlot);
   else formSlot.textContent="Modul Asisten AI belum siap.";
   return;
  }
  intro.textContent="Data master dipakai untuk dokumen baru. Dokumen yang sudah diterbitkan tetap menyimpan snapshot lama.";
  search.hidden=false;table.hidden=false;
  if(entity!=="settings"){const add=el("button","dm-btn primary","+ Tambah");add.onclick=()=>form(null);actions.append(add)}
  if(entity==="recipients"){const imp=el("button","dm-btn","Impor CSV");imp.onclick=importCsv;actions.append(imp)}
  const cols=entity==="settings"?["nama_sppg","kode_sppg","alamat","kecamatan","kabupaten","nama_kepala_sppg","nama_kepala_sppi","nama_ahli_gizi"]:entity==="recipients"?["nama","kelompok","jenjang","total_porsi","alamat","aktif","perlu_verifikasi"]:entity==="vehicles"?["no_kendaraan","aktif"]:entity==="menus"?["teks_menu","aktif"]:["nama",...(entity==="staff"?["jabatan"]:[]),"aktif"];
  const labels={nama_sppg:"Nama SPPG",kode_sppg:"Kode",alamat:"Alamat",kecamatan:"Kecamatan",kabupaten:"Kabupaten",nama_kepala_sppg:"Kepala SPPG",nama_kepala_sppi:"Kepala SPPI",nama_ahli_gizi:"Ahli Gizi Dapur",nama:"Nama",kelompok:"Kelompok",jenjang:"Jenjang",total_porsi:"Porsi",aktif:"Status",perlu_verifikasi:"Verifikasi",no_kendaraan:"Kendaraan",teks_menu:"Menu",jabatan:"Jabatan"};
  const t=el("table","dm-table"),thead=el("thead"),tr=el("tr");t.setAttribute("aria-label","Tabel "+defs[entity].title);cols.concat(["Aksi"]).forEach(c=>tr.append(el("th",null,labels[c]||c)));thead.append(tr);const tb=el("tbody");
  (cache[entity]||[]).forEach(row=>{const r=el("tr","dm-data-row");r.dataset.search=Object.entries(row).map(([key,value])=>{
    if(key==="perlu_verifikasi")return value?"true perlu verifikasi perlu cek":"false";
    if(key==="alamat"&&!String(value||"").trim())return "alamat kosong alamat belum dilengkapi";
    return value===null||value===undefined?"":String(value);
   }).join(" ").toLocaleLowerCase("id-ID");cols.forEach(c=>{let v=row[c];if(c==="aktif")v=v?"Aktif":"Nonaktif";if(c==="perlu_verifikasi")v=v?"Perlu cek":"—";r.append(el("td",null,v??"—"))});const td=el("td");const b=el("button",null,"Ubah");b.onclick=()=>form(row);td.append(b);r.append(td);tb.append(r)});
  if(!(cache[entity]||[]).length){const r=el("tr","dm-empty-row");const d=el("td",null,"Belum ada data "+defs[entity].title.toLocaleLowerCase("id-ID")+". Gunakan tombol + Tambah untuk membuat data pertama.");d.colSpan=cols.length+1;r.append(d);tb.append(r)}
  const filterRow=el("tr","dm-filter-empty");filterRow.dataset.filterEmpty="";filterRow.hidden=true;
  const filterCell=el("td",null,"Tidak ada data yang cocok dengan pencarian. Ubah kata kunci atau bersihkan pencarian.");
  filterCell.colSpan=cols.length+1;filterRow.append(filterCell);tb.append(filterRow);
  t.append(thead,tb);table.innerHTML="";table.append(t);table.dataset.state=(cache[entity]||[]).length?"success":"empty";formSlot.innerHTML="";applySearch();
  if(entity==="settings"&&(cache.settings||[])[0])form(cache.settings[0]);
 }
 function form(row){
  formSlot.innerHTML="";const f=el("form","dm-form");
  defs[entity].fields.forEach(([key,label,type,required,options])=>{const wrap=el("div","dm-field"+(type==="textarea"?" wide":""));
   const inputId="dmField_"+key;
   if(type==="checkbox"){const lab=el("label",null,label);const input=el("input");input.id=inputId;lab.htmlFor=inputId;input.type="checkbox";input.dataset.key=key;input.checked=row ? row[key]===true : key==="aktif";wrap.append(lab,input)}
   else{const lab=el("label",null,label);let input;if(type==="textarea")input=el("textarea");else if(type==="select"){input=el("select");options.forEach(o=>{const op=el("option",null,o);op.value=o;input.append(op)})}else{input=el("input");input.type=type}input.id=inputId;lab.htmlFor=inputId;input.dataset.key=key;input.required=!!required;if(["nama_kepala_sppg","nama_kepala_sppi","nama_ahli_gizi"].includes(key))input.maxLength=150;if(row?.[key]!==undefined&&row[key]!==null)input.value=row[key];else if(type==="number")input.value=key==="urutan"?"100":"0";if(type==="number"){input.min=key==="urutan"?"1":"0";input.step="1"}wrap.append(lab,input)}
   if(entity==="settings"&&key==="nama_kepala_sppi")wrap.append(el("small","dm-hint","Nama ini digunakan pada bagian tanda tangan Kepala SPPI di BAST."));
   if(entity==="settings"&&key==="nama_ahli_gizi")wrap.append(el("small","dm-hint","Nama ini dicetak pada bagian Mengetahui di Formulir Uji Organoleptik."));
   f.append(wrap);
  });
  if(row?.id){const id=el("input");id.type="hidden";id.dataset.key="id";id.value=row.id;f.append(id)}
  const buttons=el("div","dm-form-actions");const cancel=el("button","dm-btn","Batal");cancel.type="button";cancel.onclick=()=>formSlot.innerHTML="";const save=el("button","dm-btn primary","Simpan");save.type="submit";buttons.append(cancel,save);f.append(buttons);f.onsubmit=async e=>{e.preventDefault();const data={};f.querySelectorAll("[data-key]").forEach(x=>data[x.dataset.key]=x.type==="checkbox"?x.checked:x.value);save.disabled=true;save.textContent="Menyimpan…";msg("Menyimpan data "+defs[entity].title.toLocaleLowerCase("id-ID")+"…",false,"loading");try{await api("master/save",{entity,data});await load();msg("Data berhasil disimpan.",false,"success");window.dispatchEvent(new Event("autodoc:data-changed"))}catch(err){msg(err.message||"Data gagal disimpan.",true,"error");save.disabled=false;save.textContent="Simpan"}};formSlot.append(f);f.scrollIntoView({behavior:"smooth",block:"nearest"});
 }
 async function load(){
  msg("Memuat Data Master…",false,"loading");
  table.dataset.state="loading";
  table.setAttribute("aria-busy","true");
  table.replaceChildren();
  const skeleton=node("div","dm-loading-state");
  skeleton.setAttribute("role","status");skeleton.setAttribute("aria-live","polite");
  skeleton.append(node("span","ui-skeleton dm-skeleton-line"),node("span","ui-skeleton dm-skeleton-line wide"),node("span","ui-skeleton dm-skeleton-line"));
  table.append(skeleton);
  try{
   const d=await api("master/list");cache=d.data||{};
   if(entity!=="ai"){
    render();table.setAttribute("aria-busy","false");
    msg((cache[entity]||[]).length+" data "+defs[entity].title.toLocaleLowerCase("id-ID")+" dimuat.",false,(cache[entity]||[]).length?"success":"empty");
   }else msg("Data Master siap untuk pencocokan AI.",false,"success");
  }catch(error){
   table.dataset.state="error";table.setAttribute("aria-busy","false");table.replaceChildren();
   const panel=node("div","ui-error-banner dm-load-error");
   const content=node("div","ui-error-banner__content");
   content.append(node("strong","ui-error-banner__title","Data Master gagal dimuat"),node("span",null,error.message||"Periksa sesi dan koneksi, lalu coba lagi."));
   const retry=node("button","dm-btn","Coba lagi");retry.type="button";retry.addEventListener("click",load);
   panel.append(content,retry);table.append(panel);
   msg(error.message||"Data Master gagal dimuat.",true,"error");
  }
 }
 async function importCsv(){
  const input=el("input");input.type="file";input.accept=".csv,text/csv";
  input.onchange=async()=>{
   const file=input.files[0];if(!file)return;
   try{
    const data=parseCsv(await file.text());
    if(!data.length)throw Error("File CSV kosong.");
    const headers=data.shift().map(v=>v.trim().toLowerCase().replace(/[_-]+/g," ").replace(/\s+/g," "));
    const aliases={kelompok:["kelompok"],nama:["nama","nama penerima"],jenjang:["jenjang"],alamat:["alamat"],siswa_kecil:["siswa kecil"],siswa_besar:["siswa besar"],tendik:["tendik","tenaga pendidik"],ibu_hamil:["ibu hamil"],ibu_menyusui:["ibu menyusui"],balita:["balita"],putus_sekolah:["putus sekolah"],kader:["kader"],urutan:["urutan"],aktif:["aktif","status"],keterangan:["keterangan"],perlu_verifikasi:["perlu verifikasi"],catatan_verifikasi:["catatan verifikasi"]};
    const ix={};Object.entries(aliases).forEach(([k,a])=>ix[k]=headers.findIndex(h=>a.includes(h)));
    if(ix.kelompok<0||ix.nama<0||ix.jenjang<0)throw Error("Kolom wajib: kelompok, nama, jenjang.");
    const rows=data.filter(r=>r.some(x=>x.trim())).map((r,i)=>{
     const g=k=>ix[k]<0?"":(r[ix[k]]||"").trim();
     return{
      kelompok:g("kelompok"),nama:g("nama"),jenjang:g("jenjang"),alamat:g("alamat"),
      siswa_kecil:g("siswa_kecil")||0,siswa_besar:g("siswa_besar")||0,tendik:g("tendik")||0,
      ibu_hamil:g("ibu_hamil")||0,ibu_menyusui:g("ibu_menyusui")||0,balita:g("balita")||0,
      putus_sekolah:g("putus_sekolah")||0,kader:g("kader")||0,urutan:g("urutan")||100+i,
      aktif:parseCsvBoolean(g("aktif"),true),keterangan:g("keterangan"),
      perlu_verifikasi:parseCsvBoolean(g("perlu_verifikasi"),false),catatan_verifikasi:g("catatan_verifikasi")
     };
    });
    if(!rows.length||rows.length>500)throw Error("Jumlah baris harus 1–500.");
    if(rows.some(row=>!row.kelompok||!row.nama||!row.jenjang))throw Error("Setiap baris wajib memiliki kelompok, nama, dan jenjang.");
    if(!confirm("Impor "+rows.length+" penerima? Kelompok+nama yang sama akan diperbarui; data lain tidak dihapus."))return;
    msg("Mengimpor "+rows.length+" penerima…",false,"loading");
    const result=await api("master/import",{rows});await load();msg((result.imported||0)+" baris penerima berhasil diimpor.",false,"success");window.dispatchEvent(new Event("autodoc:data-changed"));
   }catch(e){msg(e.message||"Impor CSV gagal.",true,"error")}
  };
  input.click();
 }
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init,{once:true});else init();
})();