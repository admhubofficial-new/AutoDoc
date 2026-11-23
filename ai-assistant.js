(() => {
"use strict";
const RECIPIENT_FIELDS = [
 ["kelompok","Kelompok","text"],["nama","Nama penerima","text"],["jenjang","Jenjang","text"],
 ["alamat","Alamat","text"],["siswa_kecil","Siswa kecil","number"],["siswa_besar","Siswa besar","number"],
 ["tendik","Tenaga pendidik","number"],["ibu_hamil","Ibu hamil","number"],
 ["ibu_menyusui","Ibu menyusui","number"],["balita","Balita","number"],
 ["putus_sekolah","Anak putus sekolah","number"],["kader","Kader","number"]
];
const COUNT_FIELDS = new Set(["siswa_kecil","siswa_besar","tendik","ibu_hamil","ibu_menyusui","balita","putus_sekolah","kader"]);
const ALLOWED_EXTENSIONS = new Set(["pdf","doc","docx","xls","xlsx","csv","tsv","txt","md","rtf","odt","ppt","pptx","json","png","jpg","jpeg","webp"]);
function create({api,el,getRecipients,onApplyMenuPlan,onRecipientsChanged,setMessage}) {
 let host=null, selectedFiles=[], mode="both", dateValue="";
 function text(parent,tag,cls,value){const element=el(tag,cls,value);parent.append(element);return element;}
 function button(parent,label,kind,handler){const item=text(parent,"button","dm-btn"+(kind?" "+kind:""),label);item.type="button";item.addEventListener("click",handler);return item;}
 function field(parent,label,control){const wrap=text(parent,"label","ai-field");text(wrap,"span","ai-field-label",label);wrap.append(control);return wrap;}
 function readFile(file){
  return new Promise((resolve,reject)=>{
   const reader=new FileReader();
   reader.onerror=()=>reject(new Error("File tidak dapat dibaca oleh browser."));
   reader.onload=()=>{
    const result=String(reader.result||"");
    const comma=result.indexOf(",");
    if(comma<0)return reject(new Error("Format file tidak valid."));
    resolve(result.slice(comma+1));
   };
   reader.readAsDataURL(file);
  });
 }
 function setMessageSafe(message,bad=false){
  const node=host?.querySelector(".ai-status");
  if(node){node.textContent=message||"";node.classList.toggle("error",!!bad)}
  if(typeof setMessage==="function")setMessage(message,bad);
 }
 function render(container){
  host=container;
  host.innerHTML="";
  const style=text(host,"style","");
  style.textContent=".ai-assistant{display:grid;gap:15px}.ai-panel{padding:16px;border:1px solid #e1e9e0;border-radius:12px;background:#fff}.ai-panel h4{margin:0 0 7px;color:#294536;font-size:13px}.ai-lead{margin:0 0 14px;color:#718076;font-size:11px;line-height:1.6}.ai-form-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.ai-field{display:grid;gap:6px;min-width:0}.ai-field.wide{grid-column:1/-1}.ai-field-label{font-size:11px;font-weight:750;color:#526258}.ai-field input,.ai-field select,.ai-field textarea{width:100%;min-height:42px;padding:9px 10px;border:1px solid #dce5dc;border-radius:8px;background:#fff;color:#24392d;font:inherit;font-size:12px}.ai-field textarea{min-height:145px;resize:vertical}.ai-helper{color:#77847b;font-size:10px;line-height:1.6}.ai-action-row{display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap;margin-top:12px}.ai-notice{padding:10px 12px;border:1px solid #e5eadd;border-radius:9px;background:#f7faf5;color:#58695c;font-size:10px;line-height:1.6}.ai-result-summary{padding:14px;border:1px solid #dce8dc;border-radius:10px;background:#f8fbf7}.ai-result-summary strong{display:block;margin-bottom:5px;color:#254535;font-size:13px}.ai-result-summary p{margin:0;color:#526258;font-size:11px;line-height:1.6}.ai-list{display:grid;gap:9px;margin-top:12px}.ai-card{padding:13px;border:1px solid #e1e9e0;border-radius:10px;background:#fff}.ai-card-head{display:flex;align-items:flex-start;gap:9px}.ai-card-head input{margin:3px 0 0;accent-color:#174b39}.ai-card-head strong{display:block;color:#294536;font-size:12px}.ai-card-head small{display:block;margin-top:3px;color:#78857b;font-size:10px;line-height:1.5}.ai-confidence{margin-left:auto;padding:3px 7px;border-radius:20px;background:#f1f3f0;color:#68766c;font-size:9px;white-space:nowrap}.ai-confidence.high{background:#e7f3e9;color:#23633e}.ai-confidence.low{background:#fff3dc;color:#916322}.ai-card-body{display:grid;gap:9px;margin:12px 0 0 24px}.ai-card-body textarea,.ai-card-body input{width:100%;min-height:37px;padding:7px 9px;border:1px solid #dce5dc;border-radius:7px;font:inherit;font-size:11px}.ai-card-body textarea{min-height:74px}.ai-change-list{display:grid;gap:6px}.ai-change{display:grid;grid-template-columns:minmax(90px,.7fr) minmax(0,1fr);gap:8px;padding:7px 0;border-bottom:1px solid #edf0ec;font-size:10px}.ai-change label{color:#68766c;font-weight:700}.ai-change small{display:block;color:#8a948d;font-size:9px}.ai-target-list{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px;max-height:190px;overflow:auto;padding:9px;border:1px solid #edf0ec;border-radius:8px}.ai-target{display:flex;align-items:flex-start;gap:6px;color:#405548;font-size:10px;line-height:1.4}.ai-target input{width:14px;min-height:14px;height:14px;margin:1px 0 0;accent-color:#174b39}.ai-target small{color:#849087}.ai-flag-list{display:grid;gap:6px;margin-top:10px}.ai-flag{padding:8px 10px;border-radius:8px;background:#fff8e9;color:#7b5d24;font-size:10px;line-height:1.5}.ai-question{padding:8px 10px;border-radius:8px;background:#f1f6f2;color:#46614e;font-size:10px;line-height:1.5}.ai-status{min-height:18px;margin:0;color:#627168;font-size:11px}.ai-status.error{color:#a43c32}@media(max-width:640px){.ai-form-grid{grid-template-columns:1fr}.ai-field.wide{grid-column:auto}.ai-target-list{grid-template-columns:1fr}.ai-change{grid-template-columns:1fr}}";
  const shell=text(host,"div","ai-assistant");
  const inputPanel=text(shell,"section","ai-panel");
  text(inputPanel,"h4","","Asisten AI AutoDoc");
  text(inputPanel,"p","ai-lead","Tempel teks menu atau unggah file daftar menu/perubahan penerima. AI akan membaca isi, mencocokkan nama dengan Data Master, lalu menyiapkan usulan yang dapat diperiksa sebelum disimpan.");
  const grid=text(inputPanel,"div","ai-form-grid");
  const modeSelect=el("select");modeSelect.id="aiMode";
  [["both","Menu dan penerima manfaat"],["menus","Klasifikasi menu harian"],["recipients","Perubahan penerima manfaat"]].forEach(([value,label])=>{const opt=el("option");opt.value=value;opt.textContent=label;modeSelect.append(opt)});
  field(grid,"Apa yang ingin dianalisis?",modeSelect);
  const date=el("input");date.type="date";date.value=new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Jakarta"}).format(new Date());date.id="aiDate";
  field(grid,"Tanggal distribusi untuk menu",date);
  const source=el("textarea");source.id="aiSourceText";source.placeholder="Tempel pesan WhatsApp, daftar menu, tabel penerima, atau keterangan perubahan di sini...";
  field(grid,"Teks / salinan data",source).classList.add("wide");
  const fileInput=el("input");fileInput.type="file";fileInput.id="aiSourceFiles";fileInput.multiple=true;fileInput.accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.tsv,.txt,.md,.rtf,.odt,.ppt,.pptx,.json,.html,.xml,.iif,.png,.jpg,.jpeg,.webp";
  field(grid,"Atau unggah hingga 5 file (total maksimal 6 MB)",fileInput).classList.add("wide");
  const fileHint=text(grid,"small","ai-helper","Format: PDF, Word, Excel, CSV/TSV, TXT/Markdown, HTML/XML, PowerPoint, JSON, dan gambar JPG/PNG/WebP. Semua file terpilih dianalisis bersama; belum ada data yang disimpan.");
  fileHint.classList.add("wide");
  const actions=text(inputPanel,"div","ai-action-row");
  const analyze=button(actions,"Baca dan klasifikasikan","primary",analyzeInput);
  const status=text(shell,"p","ai-status","Tempel teks atau pilih file, kemudian mulai analisis.");
  const results=text(shell,"section","ai-panel");results.hidden=true;
  const resultContent=text(results,"div","ai-result-content");
  const defaultFileHint=fileHint.textContent;
  function clearAnalysis(){
   results.hidden=true;
   resultContent.innerHTML="";
  }
  source.addEventListener("input",clearAnalysis);
  modeSelect.addEventListener("change",clearAnalysis);
  date.addEventListener("change",clearAnalysis);
  fileInput.addEventListener("change",()=>{
   const files=Array.from(fileInput.files||[]);
   clearAnalysis();
   if(!files.length){
    selectedFiles=[];
    fileHint.textContent=defaultFileHint;
    return;
   }
   const totalBytes=files.reduce((total,file)=>total+file.size,0);
   const valid=files.length<=5&&totalBytes<=6*1024*1024&&files.every(file=>{
    const ext=file.name.toLowerCase().split(".").pop();
    return ALLOWED_EXTENSIONS.has(ext);
   });
   if(!valid){
    selectedFiles=[];fileInput.value="";fileHint.textContent=defaultFileHint;
    setMessageSafe("Pilih maksimal 5 file dengan format didukung dan ukuran gabungan maksimal 6 MB.",true);
    return;
   }
   selectedFiles=files;
   fileHint.textContent=files.length+" file dipilih ("+(totalBytes/1024/1024).toFixed(2)+" MB): "+files.map(file=>file.name).join(", ");
   setMessageSafe(files.length+" file siap dianalisis bersama.");
  });
  async function analyzeInput(){
   const sourceText=source.value.trim(),files=selectedFiles.slice();
   if(!sourceText&&!files.length){setMessageSafe("Tempel teks atau pilih setidaknya satu file terlebih dahulu.",true);return}
   clearAnalysis();
   if(!date.value&&modeSelect.value!=="recipients"){setMessageSafe("Tanggal distribusi perlu dipilih untuk mengelompokkan menu.",true);date.focus();return}
   analyze.disabled=true;analyze.textContent="AI sedang membaca...";
   setMessageSafe("Menganalisis isi dan mencocokkan data penerima. Ini belum mengubah Data Master.");
   try{
    const filePayloads=[];
    for(const file of files){
     const mime=file.type||"application/octet-stream";
     filePayloads.push({name:file.name,mime,data:await readFile(file)});
    }
    const result=await api("ai/analyze",{mode:modeSelect.value,tanggal:date.value,text:sourceText,files:filePayloads});
    mode=modeSelect.value;dateValue=date.value;
    renderAnalysis(resultContent,analysis);
    results.hidden=false;
    setMessageSafe(result.message||"Analisis selesai. Periksa seluruh usulan sebelum menyimpan.");
    results.scrollIntoView({behavior:"smooth",block:"start"});
   }catch(error){setMessageSafe(error.message||"Analisis AI gagal.",true)}
   finally{analyze.disabled=false;analyze.textContent="Baca dan klasifikasikan"}
  }
  function renderAnalysis(target,data){
   target.innerHTML="";
   const summary=text(target,"div","ai-result-summary");
   text(summary,"strong","","Hasil pembacaan AI");
   text(summary,"p","",data.summary||"AI tidak memberikan ringkasan.");
   text(target,"div","ai-notice","PENTING: AI hanya memberi usulan. Periksa penerima, komponen menu, tanggal, dan jumlah. Tidak ada perubahan data sebelum Anda menekan tombol konfirmasi.");
   if(data.questions?.length){
    const q=text(target,"div","ai-flag-list");
    data.questions.forEach(item=>text(q,"div","ai-question","Perlu konfirmasi: "+item));
   }
   if(data.warnings?.length){
    const w=text(target,"div","ai-flag-list");
    data.warnings.forEach(item=>text(w,"div","ai-flag",item));
   }
   if(data.menu_groups?.length)renderMenuGroups(target,data.menu_groups);
   else if(mode!=="recipients")text(target,"p","ai-helper","Belum ditemukan kelompok menu yang bisa dipetakan. Periksa kembali sumber atau isi nama sekolah/tujuan.");
   if(data.recipient_updates?.length)renderRecipientUpdates(target,data.recipient_updates);
   else if(mode!=="menus")text(target,"p","ai-helper","Tidak ada perubahan penerima manfaat yang berhasil diekstrak dari sumber.");
  }
  function renderMenuGroups(target,groups){
   const section=text(target,"section","ai-list");
   text(section,"h4","","Menu yang dikelompokkan AI");
   groups.forEach((group,index)=>{
    const card=text(section,"article","ai-card");card.dataset.menuGroup=String(index);
    const head=text(card,"div","ai-card-head");
    text(head,"strong","",group.label||"Kelompok menu "+(index+1));
    text(head,"span","ai-confidence "+(group.confidence==="tinggi"?"high":group.confidence==="rendah"?"low":""),group.confidence||"rendah");
    const body=text(card,"div","ai-card-body");
    text(body,"small","ai-helper",group.reason||"Alasan klasifikasi tidak tersedia.");
    if(group.source_reference)text(body,"small","ai-helper","Sumber: "+group.source_reference);
    const menu=el("textarea");menu.dataset.menuItems="";menu.value=(group.menu_items||[]).join("\n");
    field(body,"Komponen menu (satu per baris, maksimal 8)",menu);
    const targetList=text(body,"div","ai-target-list");
    const recipients=Array.isArray(getRecipients())?getRecipients():[];
    if(!recipients.length)text(targetList,"span","ai-helper","Daftar penerima belum tersedia.");
    recipients.forEach(recipient=>{
     const label=text(targetList,"label","ai-target");
     const check=el("input");check.type="checkbox";check.dataset.recipientId=String(recipient.id);
     check.checked=recipient.aktif!==false&&(group.target_ids||[]).includes(String(recipient.id));
     label.append(check);
     const caption=text(label,"span", "",recipient.nama||"(Tanpa nama)");
     caption.append(text(caption,"small",""," · "+(recipient.kelompok||"")+" · "+(recipient.jenjang||"")));
     if(recipient.aktif===false)check.disabled=true;
    });
    if(group.target_names?.length)text(body,"small","ai-helper","Nama tujuan dari sumber: "+group.target_names.join(", "));
   });
   const applyRow=text(target,"div","ai-action-row");
   const apply=button(applyRow,"Terapkan menu ke Buat Dokumen","primary",()=>{
    const mapped={},finalGroups=[];
    let conflict=null;
    groups.forEach((group,index)=>{
     const card=section.querySelector("[data-menu-group='"+index+"']");
     const menuItems=card.querySelector("[data-menu-items]").value.split(/\r?\n/).map(item=>item.trim()).filter(Boolean);
     if(menuItems.length<1||menuItems.length>8){conflict=conflict||"invalid-menu-"+(index+1);setMessageSafe("Kelompok "+(index+1)+" harus memiliki 1 sampai 8 komponen menu.",true);return;}
     const recipientIds=Array.from(card.querySelectorAll("[data-recipient-id]:checked")).map(input=>input.dataset.recipientId);
     recipientIds.forEach(id=>{
      if(mapped[id])conflict=getRecipients().find(item=>String(item.id)===id)?.nama||id;
      mapped[id]=menuItems;
     });
     finalGroups.push({label:group.label||"Menu "+(index+1),menu_items:menuItems,recipient_ids:recipientIds});
    });
    if(conflict){if(conflict.startsWith("invalid-menu-"))return;setMessageSafe("Penerima "+conflict+" terpilih pada lebih dari satu kelompok menu. Atur hanya satu menu untuk setiap penerima.",true);return}
    if(!finalGroups.some(group=>group.recipient_ids.length)){setMessageSafe("Pilih minimal satu sekolah/tujuan pada kelompok menu.",true);return}
    const plan={tanggal:dateValue,groups:finalGroups,created_at:new Date().toISOString()};
    if(!confirm("Terapkan "+finalGroups.length+" kelompok menu ke formulir Buat Dokumen untuk tanggal "+dateValue+"? Menu per penerima akan masuk ke snapshot dokumen saat diterbitkan."))return;
    onApplyMenuPlan(plan);
   });
  }
  function renderRecipientUpdates(target,rows){
   const section=text(target,"section","ai-list");
   text(section,"h4","","Usulan perubahan penerima manfaat");
   text(section,"p","ai-helper","Centang baris yang benar. Identitas yang berubah nama/kelompok atau kecocokannya meragukan akan ditandai untuk pemeriksaan manual dan tidak disimpan massal.");
   rows.forEach((row,index)=>{
    const card=text(section,"article","ai-card");card.dataset.recipientRow=String(index);
    const head=text(card,"div","ai-card-head");
    const selectable=row.action!=="review"&&row.changed_fields?.length>0;
    const check=el("input");check.type="checkbox";check.dataset.includeRecipient="";check.checked=false;check.disabled=!selectable;
    head.append(check);
    const title=(row.proposed?.nama||"Penerima baru")+(row.current?" · data lama":" · data baru");
    text(head,"div","",title);
    text(head,"span","ai-confidence "+(row.confidence==="tinggi"?"high":row.confidence==="rendah"?"low":""),row.confidence||"rendah");
    const body=text(card,"div","ai-card-body");
    text(body,"small","ai-helper",row.reason||"Tidak ada alasan yang diberikan.");
    if(row.source_quote)text(body,"small","ai-helper","Sumber: “"+row.source_quote+"” · "+(row.source_reference||"lokasi sumber tidak disebut"));
    if(row.action==="review")text(body,"div","ai-flag","Perlu pemeriksaan manual. Tidak dipilih otomatis.");
    if(!row.changed_fields?.length)text(body,"small","ai-helper","Tidak ditemukan perbedaan nilai yang perlu disimpan.");
    (row.changed_fields||[]).forEach(key=>{
     const def=RECIPIENT_FIELDS.find(item=>item[0]===key);if(!def)return;
     const wrap=text(body,"div","ai-change");
     const lab=text(wrap,"label",""," "+def[1]);
     const current=row.current?.[key]??"";
     const input=el("input");input.type=def[2]==="number"?"number":"text";input.dataset.recipientField=key;
     input.value=row.proposed?.[key]??"";
     if(def[2]==="number"){input.min="0";input.step="1";input.inputMode="numeric";}
     lab.append(text(lab,"small","","Sebelumnya: "+(current===""?"(kosong)":current)));
     wrap.append(lab,input);
    });
   });
   const controls=text(target,"div","ai-action-row");
   const save=button(controls,"Konfirmasi & simpan penerima","primary",saveRecipientRows);
   async function saveRecipientRows(){
    const selected=Array.from(section.querySelectorAll("[data-recipient-row]")).filter(card=>card.querySelector("[data-include-recipient]")?.checked);
    if(!selected.length){setMessageSafe("Pilih minimal satu usulan penerima yang sudah diperiksa.",true);return}
    let payload;try{payload=selected.map(card=>{
     const row=rows[Number(card.dataset.recipientRow)];
     const merged={...(row.current||{}),...(row.proposed||{})};
     card.querySelectorAll("[data-recipient-field]").forEach(input=>{
      const key=input.dataset.recipientField;
      if(COUNT_FIELDS.has(key)){if(input.value.trim()===""||!Number.isSafeInteger(Number(input.value))||Number(input.value)<0)throw new Error("Nilai "+key+" harus bilangan bulat minimal 0.");merged[key]=Number(input.value)}else merged[key]=input.value;
     });
     return {
      kelompok:merged.kelompok,nama:merged.nama,jenjang:merged.jenjang,alamat:merged.alamat||"",
      siswa_kecil:Number(merged.siswa_kecil||0),siswa_besar:Number(merged.siswa_besar||0),tendik:Number(merged.tendik||0),
      ibu_hamil:Number(merged.ibu_hamil||0),ibu_menyusui:Number(merged.ibu_menyusui||0),balita:Number(merged.balita||0),
      putus_sekolah:Number(merged.putus_sekolah||0),kader:Number(merged.kader||0),
      urutan:Number(merged.urutan||100),aktif:merged.aktif!==false,keterangan:merged.keterangan||"",
      perlu_verifikasi:merged.perlu_verifikasi===true,catatan_verifikasi:merged.catatan_verifikasi||""
     };
    })}catch(error){setMessageSafe(error.message||"Periksa kembali nilai penerima.",true);return}
    if(payload.some(row=>!row.kelompok||!row.nama||!row.jenjang)){setMessageSafe("Kelompok, nama, dan jenjang harus lengkap pada setiap baris.",true);return}
    if(!confirm("Konfirmasi penyimpanan "+payload.length+" penerima? Hanya baris yang dicentang yang akan diperbarui/ditambahkan. Data penerima lain tidak dihapus."))return;
    save.disabled=true;save.textContent="Menyimpan...";
    try{
     const result=await api("master/import",{rows:payload});
     await onRecipientsChanged();
     setMessageSafe((result.imported||payload.length)+" baris penerima berhasil disimpan. Periksa kembali Data Master.");
     checkboxesAfterSave(selected);
    }catch(error){setMessageSafe(error.message||"Data penerima gagal disimpan.",true)}
    finally{save.disabled=false;save.textContent="Konfirmasi & simpan penerima"}
   }
   function checkboxesAfterSave(cards){cards.forEach(card=>{const input=card.querySelector("[data-include-recipient]");if(input){input.checked=false;input.disabled=true}})}
  }
  return { setMessage: setMessageSafe };
 }
 return Object.freeze({render});
}
window.AutoDocAiAssistant=Object.freeze({create});
})();
