(() => {
"use strict";
const esc=value=>String(value??"").replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));
function node(tag,className,text){
 const item=document.createElement(tag);
 if(className)item.className=className;
 if(text!==undefined)item.textContent=text;
 return item;
}
function installStyles(){
 if(document.getElementById("gs-sync-styles"))return;
 const style=node("style");style.id="gs-sync-styles";
 style.textContent=".gs-shell{display:grid;gap:14px}.gs-intro{margin:0;color:#627168;font-size:12px;line-height:1.65}.gs-panel{padding:16px;border:1px solid #e2e9e1;border-radius:12px;background:#fff}.gs-panel h4{margin:0 0 8px;color:#284234;font-size:14px}.gs-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:14px}.gs-btn{min-height:38px;padding:8px 12px;border:1px solid #dce6dc;border-radius:8px;background:#fff;color:#31513d;font-size:12px;font-weight:700;cursor:pointer}.gs-btn.primary{background:#174b39;color:#fff;border-color:#174b39}.gs-btn:disabled{opacity:.5;cursor:not-allowed}.gs-meta{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-top:12px}.gs-meta div{padding:9px;border-radius:8px;background:#f5f8f4}.gs-meta small{display:block;color:#718075;font-size:10px}.gs-meta strong{display:block;margin-top:3px;color:#284234;font-size:12px;overflow-wrap:anywhere}.gs-status{min-height:18px;margin:8px 0 0;color:#627168;font-size:11px;line-height:1.5}.gs-status.error{color:#a43c32}.gs-status.ok{color:#237148}.gs-code{display:block;margin:8px 0;padding:9px 10px;border-radius:8px;background:#f5f7f4;color:#294234;font:11px ui-monospace,monospace;overflow-wrap:anywhere}.gs-table-wrap{max-height:420px;overflow:auto;margin-top:12px;border:1px solid #e2e9e1;border-radius:9px}.gs-table{width:100%;min-width:680px;border-collapse:collapse;font-size:11px}.gs-table th,.gs-table td{padding:9px;border-bottom:1px solid #edf0ec;text-align:left;vertical-align:top}.gs-table th{position:sticky;top:0;background:#f5f8f4;color:#637268;font-size:10px}.gs-table td small{display:block;margin-top:3px;color:#7c887f}.gs-pill{display:inline-block;padding:3px 7px;border-radius:20px;background:#f1f3f1;color:#58665d;font-size:10px;font-weight:700}.gs-pill.update{background:#fff4df;color:#875a13}.gs-pill.new{background:#e7f3eb;color:#276044}.gs-pill.review{background:#fbe9e7;color:#963e33}.gs-warning{padding:10px 12px;border-radius:8px;background:#fff8e9;color:#805d21;font-size:11px;line-height:1.5}.gs-check{width:15px;height:15px}.gs-muted{color:#79867d;font-size:11px;line-height:1.5}@media(max-width:620px){.gs-meta{grid-template-columns:1fr}.gs-panel{padding:13px}}";
 document.head.append(style);
}
function render(container,message,api){
 if(!container)return;
 installStyles();container.innerHTML="";
 const root=node("div","gs-shell");
 const intro=node("p","gs-intro","Hubungkan Google Sheets untuk membaca perubahan Penerima Manfaat dan mengirim data AutoDoc kembali ke spreadsheet. Tab sumber lama tetap dijaga; ekspor pertama membuat tab khusus AutoDoc_Penerima.");
 const connection=node("section","gs-panel");
 connection.append(node("h4","","Koneksi Google Sheets"));
 const statusBox=node("div","gs-status","Memeriksa konfigurasi koneksi…");
 const meta=node("div","gs-meta");
 const actions=node("div","gs-actions");
 const connectBtn=node("button","gs-btn primary","Uji koneksi");
 connectBtn.type="button";
 const readBtn=node("button","gs-btn","Baca & bandingkan");
 readBtn.type="button";readBtn.disabled=true;
 const pushBtn=node("button","gs-btn","Kirim AutoDoc ke Sheets");
 pushBtn.type="button";pushBtn.disabled=true;
 actions.append(connectBtn,readBtn,pushBtn);
 connection.append(statusBox,meta,actions);
 const setup=node("section","gs-panel");
 setup.append(node("h4","","Aktifkan koneksi satu kali"));
 setup.append(node("p","gs-muted","1. Buka spreadsheet, pilih Ekstensi → Apps Script, lalu salin isi file Code.gs dari repository AutoDoc."));
 const setupLink=node("a","gs-code","Panduan lengkap aktivasi Google Sheets");
 setupLink.href="https://github.com/admhubofficial-new/AutoDoc/blob/main/google-apps-script/README.md";setupLink.target="_blank";setupLink.rel="noopener noreferrer";
 setup.append(setupLink);
 const scriptLink=node("a","gs-code","Buka google-apps-script/Code.gs di GitHub");
 scriptLink.href="https://github.com/admhubofficial-new/AutoDoc/blob/main/google-apps-script/Code.gs";
 scriptLink.target="_blank";scriptLink.rel="noopener noreferrer";
 setup.append(scriptLink);
 setup.append(node("p","gs-muted","2. Di Project Settings → Script Properties, tambahkan AUTODOC_WEBHOOK_SECRET dengan kode acak pribadi minimal 32 karakter."));
 setup.append(node("p","gs-muted","3. Deploy → New deployment → Web app. Pilih Execute as: Me dan Who has access: Anyone. Salin URL /exec."));
 setup.append(node("p","gs-muted","4. Di Supabase → Edge Functions → Secrets, tambahkan dua secret berikut. Nilainya tidak dimasukkan ke halaman AutoDoc."));
 for(const key of ["GOOGLE_SHEETS_WEB_APP_URL","GOOGLE_SHEETS_WEBHOOK_SECRET"])setup.append(node("code","gs-code",key));
 setup.append(node("p","gs-muted","Gunakan URL deployment Apps Script dan nilai secret yang sama dengan Script Property. Jangan gunakan PIN MASUK atau API key OpenAI sebagai secret integrasi."));
 const previewPanel=node("section","gs-panel");previewPanel.hidden=true;
 previewPanel.append(node("h4","","Pratinjau perubahan dari spreadsheet"));
 const summary=node("p","gs-muted");
 const warnings=node("div");
 const tableWrap=node("div","gs-table-wrap");
 const table=node("table","gs-table");
 const thead=node("thead"),tbody=node("tbody");
 const header=node("tr");
 ["Pilih","Baris","Penerima","Kelompok","Tindakan","Perubahan / catatan"].forEach(label=>header.append(node("th","",label)));
 thead.append(header);table.append(thead,tbody);tableWrap.append(table);
 const importActions=node("div","gs-actions");
 const selectAll=node("button","gs-btn","Pilih semua yang siap");selectAll.type="button";
 const applyBtn=node("button","gs-btn primary","Terapkan pilihan ke AutoDoc");applyBtn.type="button";applyBtn.disabled=true;
 importActions.append(selectAll,applyBtn);
 previewPanel.append(summary,warnings,tableWrap,importActions);
 root.append(intro,connection,setup,previewPanel);container.append(root);

 let connectionReady=false,previewData=null;
 const selected=new Set();
 function status(text,kind){
  statusBox.textContent=text;statusBox.className="gs-status"+(kind?" "+kind:"");
 }
 function setConnected(ready){
  connectionReady=ready;readBtn.disabled=!ready;pushBtn.disabled=!ready;
 }
 function refreshSelection(){
  const rows=previewData?.changes||[];
  const eligible=rows.filter(row=>row.can_apply);
  applyBtn.disabled=selected.size===0;
  applyBtn.textContent=selected.size?"Terapkan "+selected.size+" baris terpilih":"Terapkan pilihan ke AutoDoc";
  selectAll.disabled=!eligible.length;
 }
 function drawPreview(data){
  previewData=data;selected.clear();previewPanel.hidden=false;tbody.innerHTML="";warnings.innerHTML="";
  const s=data.summary||{};
  summary.textContent="Sumber: "+(data.sheet_name||"tab Google Sheets")+" · "+(s.source_rows||0)+" baris · "+(s.updated||0)+" perubahan · "+(s.new||0)+" data baru · "+(s.review||0)+" perlu ditinjau.";
  (data.warnings||[]).forEach(item=>warnings.append(node("p","gs-warning",item)));
  (data.changes||[]).forEach(row=>{
   const tr=node("tr");const pick=node("td");
   const checkbox=node("input","gs-check");checkbox.type="checkbox";checkbox.disabled=!row.can_apply;
   checkbox.setAttribute("aria-label","Pilih baris "+row.row_number+" "+(row.proposed?.nama||""));
   checkbox.addEventListener("change",()=>{if(checkbox.checked)selected.add(row.row_number);else selected.delete(row.row_number);refreshSelection()});
   pick.append(checkbox);tr.append(pick,node("td","",String(row.row_number)));
   const person=node("td","",row.proposed?.nama||"—");
   if(row.current?.id)person.append(node("small","", "Sudah ada di AutoDoc"));
   tr.append(person,node("td","",row.proposed?.kelompok||"—"));
   const action=node("td");const pill=node("span","gs-pill "+(row.action==="update"?"update":row.action==="new"?"new":row.action==="review"?"review":""));
   pill.textContent=row.action==="update"?"Perbarui":row.action==="new"?"Baru":row.action==="review"?"Tinjau":"Sama";
   action.append(pill);tr.append(action);
   const fieldLabels={kelompok:"Kelompok",nama:"Nama",jenjang:"Jenjang",alamat:"Alamat",siswa_kecil:"Siswa kecil",siswa_besar:"Siswa besar",tendik:"Tendik",ibu_hamil:"Ibu hamil",ibu_menyusui:"Ibu menyusui",balita:"Balita",putus_sekolah:"Putus sekolah",kader:"Kader",urutan:"Urutan",aktif:"Status aktif",keterangan:"Keterangan",perlu_verifikasi:"Verifikasi",catatan_verifikasi:"Catatan verifikasi"};
   const detail=node("td","",row.changed_fields?.length?row.changed_fields.map(field=>fieldLabels[field]||field).join(", "):(row.review_reason||"Tidak ada perubahan"));
   if(row.review_reason)detail.append(node("small","",row.review_reason));
   tr.append(detail);tbody.append(tr);
  });
  if(!(data.changes||[]).length){const row=node("tr");const cell=node("td","","Tidak ada baris yang dapat dibaca.");cell.colSpan=6;row.append(cell);tbody.append(row)}
  refreshSelection();
 }
 async function checkConnection(){
  connectBtn.disabled=true;status("Menguji koneksi server ke Google Sheets…");
  try{
   const result=await api("sheets/status",{});
   if(!result.configured){setConnected(false);status("Secret integrasi belum dipasang di Supabase. Ikuti empat langkah aktivasi di bawah.","error");return}
   if(!result.connected){setConnected(false);status(result.message||"Koneksi belum berhasil.","error");return}
   setConnected(true);meta.innerHTML="";
   [["Spreadsheet",result.spreadsheet_title],["Tab sumber awal",result.source_sheet_name||"gid "+result.source_sheet_gid],["Tab sinkronisasi",result.managed_sheet_exists?"AutoDoc_Penerima tersedia":"Dibuat saat ekspor pertama"],["Status","Terhubung"]].forEach(([label,value])=>{
    const item=node("div");item.append(node("small","",label),node("strong","",value||"—"));meta.append(item);
   });
   status("Google Sheets berhasil terhubung.","ok");
  }catch(error){setConnected(false);status(error.message||"Gagal menguji koneksi.","error")}
  finally{connectBtn.disabled=false}
 }
 connectBtn.addEventListener("click",checkConnection);
 async function loadPreview(){
  readBtn.disabled=true;status("Membaca spreadsheet dan mencocokkan penerima…");
  try{const data=await api("sheets/preview",{});drawPreview(data);status("Pratinjau selesai. Tidak ada data yang diubah.","ok")}
  catch(error){previewPanel.hidden=true;status(error.message||"Gagal membaca spreadsheet.","error")}
  finally{readBtn.disabled=!connectionReady}
 }
 readBtn.addEventListener("click",loadPreview);
 selectAll.addEventListener("click",()=>{
  const eligible=(previewData?.changes||[]).filter(row=>row.can_apply);
  const allSelected=eligible.every(row=>selected.has(row.row_number));
  eligible.forEach(row=>{if(allSelected)selected.delete(row.row_number);else selected.add(row.row_number)});
  drawCheckboxState();refreshSelection();
 });
 function drawCheckboxState(){
  tbody.querySelectorAll("input[type=checkbox]").forEach((checkbox,index)=>{
   const row=previewData?.changes?.[index];if(row)checkbox.checked=selected.has(row.row_number);
  });
 }
 applyBtn.addEventListener("click",async()=>{
  const rowNumbers=[...selected].sort((a,b)=>a-b);if(!rowNumbers.length)return;
  if(!window.confirm("Terapkan "+rowNumbers.length+" baris terpilih ke Data Master AutoDoc? Data lain yang tidak dipilih tidak akan dihapus."))return;
  applyBtn.disabled=true;status("Menerapkan perubahan terpilih…");
  try{
   const result=await api("sheets/apply",{row_numbers:rowNumbers});
   status((result.imported||0)+" baris berhasil diterapkan ke Data Master AutoDoc.","ok");
   await loadPreview();
   window.dispatchEvent(new Event("autodoc:data-changed"));
  }catch(error){status(error.message||"Gagal menerapkan perubahan.","error")}
  finally{refreshSelection()}
 });
 pushBtn.addEventListener("click",async()=>{
  if(!window.confirm("Kirim seluruh data Penerima Manfaat dari AutoDoc ke tab khusus AutoDoc_Penerima di spreadsheet? Tab sumber lama tidak akan ditimpa."))return;
  pushBtn.disabled=true;status("Mengirim data Penerima Manfaat ke Google Sheets…");
  try{
   const result=await api("sheets/push",{confirm:true});
   status((result.row_count||0)+" penerima berhasil dikirim ke tab "+(result.sheet_name||"AutoDoc_Penerima")+". Tab ini menjadi sumber sinkronisasi berikutnya.","ok");
   await checkConnection();
  }catch(error){status(error.message||"Gagal mengirim data ke spreadsheet.","error")}
  finally{pushBtn.disabled=!connectionReady}
 });
 checkConnection();
}
window.AutoDocSheetsSync=Object.freeze({render});
})();