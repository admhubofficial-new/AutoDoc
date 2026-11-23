(() => {
"use strict";
const RECIPIENT_FIELDS = [
 ["kelompok","Kelompok","text"],["nama","Nama penerima","text"],["jenjang","Jenjang","text"],
 ["alamat","Alamat","text"],["siswa_kecil","Siswa kecil","number"],["siswa_besar","Siswa besar","number"],
 ["tendik","Tenaga pendidik","number"],["ibu_hamil","Ibu hamil","number"],
 ["ibu_menyusui","Ibu menyusui","number"],["balita","Balita","number"],
 ["putus_sekolah","Anak putus sekolah","number"],["kader","Kader","number"],
 ["urutan","Urutan","number"],["aktif","Aktif","boolean"],["keterangan","Keterangan","text"],
 ["perlu_verifikasi","Perlu verifikasi","boolean"],["catatan_verifikasi","Catatan verifikasi","text"]
];
const MASTER_FIELDS = {
 settings:[
  ["nama_sppg","Nama SPPG","text"],["kode_sppg","Kode SPPG","text"],["alamat","Alamat SPPG","text"],
  ["kecamatan","Kecamatan","text"],["kabupaten","Kabupaten","text"],
  ["nama_kepala_sppg","Kepala SPPG","text"],["nama_kepala_sppi","Kepala SPPI","text"],
  ["nama_ahli_gizi","Ahli Gizi Dapur","text"],["kabupaten_perlu_verifikasi","Kabupaten perlu diverifikasi","boolean"],
  ["kabupaten_catatan_verifikasi","Catatan verifikasi kabupaten","text"]
 ],
 drivers:[["nama","Nama pengemudi","text"],["urutan","Urutan","number"],["aktif","Aktif","boolean"]],
 vehicles:[["no_kendaraan","Nomor kendaraan","text"],["urutan","Urutan","number"],["aktif","Aktif","boolean"]],
 staff:[["nama","Nama petugas","text"],["jabatan","Jabatan","text"],["urutan","Urutan","number"],["aktif","Aktif","boolean"]],
 menus:[["teks_menu","Nama/menu makanan","text"],["urutan","Urutan","number"],["aktif","Aktif","boolean"]]
};
const MASTER_TITLES={settings:"Identitas SPPG",drivers:"Pengemudi",vehicles:"Kendaraan",staff:"Petugas",menus:"Daftar menu master"};

const COUNT_FIELDS = new Set(["siswa_kecil","siswa_besar","tendik","ibu_hamil","ibu_menyusui","balita","putus_sekolah","kader"]);
const ALLOWED_EXTENSIONS = new Set(["pdf","doc","docx","xls","xlsx","csv","tsv","txt","md","rtf","odt","ppt","pptx","json","html","xml","iif","png","jpg","jpeg","webp"]);
function create({api,el,getRecipients,onApplyMenuPlan,onMasterChanged,setMessage}) {
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
 function setMessageSafe(message,bad=false,state){
  const output=host?.querySelector(".ai-status");
  if(output){
   output.textContent=message||"";
   output.dataset.state=state||(bad?"error":message?"success":"");
   output.setAttribute("role",bad?"alert":"status");
   output.setAttribute("aria-live",bad?"assertive":"polite");
   output.setAttribute("aria-busy",String(state==="loading"));
   output.classList.toggle("error",!!bad);
  }
  if(typeof setMessage==="function")setMessage(message,bad,state);
 }
 function render(container){
  host=container;
  host.innerHTML="";
  const shell=text(host,"div","ai-assistant");
  const inputPanel=text(shell,"section","ai-panel");
  text(inputPanel,"h4","","Asisten AI AutoDoc");
  text(inputPanel,"p","ai-lead","Tempel teks atau unggah dokumen untuk dipetakan ke menu distribusi, penerima manfaat, serta Data Master seperti identitas SPPG, pengemudi, kendaraan, petugas, dan daftar menu master.");
  const grid=text(inputPanel,"div","ai-form-grid");
  const modeSelect=el("select");modeSelect.id="aiMode";
  [["both","Menu, penerima & Data Master"],["menus","Klasifikasi menu harian"],["recipients","Perubahan penerima manfaat"],["master","Data Master lainnya"]].forEach(([value,label])=>{const opt=el("option");opt.value=value;opt.textContent=label;modeSelect.append(opt)});
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
  status.setAttribute("role","status");status.setAttribute("aria-live","polite");status.dataset.state="empty";
  const results=text(shell,"section","ai-panel ai-review-panel");results.hidden=true;
  results.setAttribute("aria-label","Hasil analisis dan usulan AI");
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
   setMessageSafe(files.length+" file siap dianalisis bersama.",false,"success");
  });
  async function analyzeInput(){
   const sourceText=source.value.trim(),files=selectedFiles.slice();
   if(!sourceText&&!files.length){setMessageSafe("Tempel teks atau pilih setidaknya satu file terlebih dahulu.",true);return}
   clearAnalysis();
   if(!date.value&&(modeSelect.value==="both"||modeSelect.value==="menus")){setMessageSafe("Tanggal distribusi perlu dipilih untuk mengelompokkan menu.",true);date.focus();return}
   analyze.disabled=true;analyze.setAttribute("aria-busy","true");analyze.textContent="AI sedang membaca...";
   results.dataset.state="loading";
   setMessageSafe("Menganalisis isi dan mencocokkan data penerima. Ini belum mengubah Data Master.",false,"loading");
   try{
    const filePayloads=[];
    for(const file of files){
     const mime=file.type||"application/octet-stream";
     filePayloads.push({name:file.name,mime,data:await readFile(file)});
    }
    const result=await api("ai/analyze",{mode:modeSelect.value,tanggal:date.value,text:sourceText,files:filePayloads});
    if(!result?.analysis||typeof result.analysis!=="object")throw new Error("Respons analisis tidak lengkap. Periksa sumber dan coba kembali.");
    mode=modeSelect.value;dateValue=date.value;
    renderAnalysis(resultContent,result.analysis);
    results.dataset.state=(result.analysis.menu_groups?.length||result.analysis.recipient_updates?.length||result.analysis.master_updates?.length)?"success":"empty";
    results.hidden=false;
    setMessageSafe(result.message||"Analisis selesai. Periksa seluruh usulan sebelum menyimpan.",false,results.dataset.state);
    results.scrollIntoView({behavior:"auto",block:"start"});
   }catch(error){results.dataset.state="error";setMessageSafe(error.message||"Analisis AI gagal.",true,"error")}
   finally{analyze.disabled=false;analyze.removeAttribute("aria-busy");analyze.textContent="Baca dan klasifikasikan"}
  }
  function renderAnalysis(target,data){
   target.innerHTML="";
   const menuCount=Array.isArray(data.menu_groups)?data.menu_groups.length:0;
   const recipientCount=Array.isArray(data.recipient_updates)?data.recipient_updates.length:0;
   const masterCount=Array.isArray(data.master_updates)?data.master_updates.length:0;
   const total=menuCount+recipientCount+masterCount;
   const summary=text(target,"div","ai-result-summary");
   text(summary,"strong","","Hasil pembacaan AI");
   text(summary,"p","",data.summary||"AI tidak memberikan ringkasan.");
   const counts=text(summary,"div","ai-review-counts");
   counts.append(
    text(counts,"span","",menuCount+" kelompok menu"),
    text(counts,"span","",recipientCount+" usulan penerima"),
    text(counts,"span","",masterCount+" usulan Data Master")
   );
   if(total===0){
    const empty=text(target,"div","ui-empty-state ai-empty-state");
    text(empty,"h4","ui-empty-state__title","Belum ada usulan yang dapat ditinjau");
    text(empty,"p","ui-empty-state__description","Sumber sudah dibaca, tetapi tidak ditemukan perubahan yang cukup jelas. Periksa teks atau file dan coba analisis ulang.");
   }
   text(target,"div","ai-notice","PENTING: AI hanya memberi usulan. Periksa penerima, menu distribusi, identitas, petugas, pengemudi, kendaraan, dan jumlah. Tidak ada perubahan data sebelum Anda menekan tombol konfirmasi.");
   if(data.questions?.length){
    const q=text(target,"div","ai-flag-list");
    data.questions.forEach(item=>text(q,"div","ai-question","Perlu konfirmasi: "+item));
   }
   if(data.warnings?.length){
    const w=text(target,"div","ai-flag-list");
    data.warnings.forEach(item=>text(w,"div","ai-flag",item));
   }
   if(data.menu_groups?.length)renderMenuGroups(target,data.menu_groups);
   else if(mode!=="recipients"&&mode!=="master")text(target,"p","ai-helper","Belum ditemukan kelompok menu harian yang bisa dipetakan.");
   if(data.recipient_updates?.length)renderRecipientUpdates(target,data.recipient_updates);
   else if(mode!=="menus"&&mode!=="master")text(target,"p","ai-helper","Tidak ada perubahan penerima manfaat yang berhasil diekstrak dari sumber.");
   if(data.master_updates?.length)renderMasterUpdates(target,data.master_updates);
   else if(mode==="master"||mode==="both")text(target,"p","ai-helper","Tidak ditemukan perubahan Pengemudi, Kendaraan, Petugas, Daftar Menu Master, atau Identitas SPPG pada sumber.");
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
    const selectable=(row.action!=="review"&&row.changed_fields?.length>0)||row.can_complete_manually===true;
    const check=el("input");check.type="checkbox";check.dataset.includeRecipient="";check.checked=false;check.disabled=!selectable;
    head.append(check);
    const title=(row.proposed?.nama||"Penerima baru")+(row.current?" · data lama":" · data baru");
    text(head,"div","",title);
    text(head,"span","ai-confidence "+(row.confidence==="tinggi"?"high":row.confidence==="rendah"?"low":""),row.confidence||"rendah");
    const body=text(card,"div","ai-card-body");
    text(body,"small","ai-helper",row.reason||"Tidak ada alasan yang diberikan.");
    if(row.source_quote)text(body,"small","ai-helper","Sumber: “"+row.source_quote+"” · "+(row.source_reference||"lokasi sumber tidak disebut"));
    if(row.can_complete_manually){text(body,"div","ai-flag","Data baru belum lengkap. Lengkapi semua kategori jumlah yang kosong di bawah, lalu centang baris untuk menyimpan.");text(body,"small","ai-helper","Kategori yang perlu dilengkapi: "+(row.missing_count_fields||[]).map(key=>key.replace(/_/g," ")).join(", "));}else if(row.action==="review")text(body,"div","ai-flag","Perlu pemeriksaan manual. Tidak dipilih otomatis.");
    if(!row.changed_fields?.length)text(body,"small","ai-helper","Tidak ditemukan perbedaan nilai yang perlu disimpan.");
    const recipientFieldsToRender=row.can_complete_manually?[...new Set([...(row.changed_fields||[]),...COUNT_FIELDS])]:row.changed_fields||[];
    recipientFieldsToRender.forEach(key=>{
     const def=RECIPIENT_FIELDS.find(item=>item[0]===key);if(!def)return;
     const wrap=text(body,"div","ai-change");
     const lab=text(wrap,"label",""," "+def[1]);
     const current=row.current?.[key]??"";
     const input=el("input");input.type=def[2]==="number"?"number":def[2]==="boolean"?"checkbox":"text";input.dataset.recipientField=key;
     if(def[2]==="boolean")input.checked=row.proposed?.[key]===true;else input.value=row.proposed?.[key]??"";
     if(def[2]==="number"){input.min=key==="urutan"?"1":"0";input.step="1";input.inputMode="numeric";}
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
      const key=input.dataset.recipientField,def=RECIPIENT_FIELDS.find(item=>item[0]===key);
      if(COUNT_FIELDS.has(key)){if(input.value.trim()===""||!Number.isSafeInteger(Number(input.value))||Number(input.value)<0)throw new Error("Nilai "+key+" harus bilangan bulat minimal 0.");merged[key]=Number(input.value)}
      else if(def?.[2]==="number"){if(input.value.trim()===""||!Number.isSafeInteger(Number(input.value))||Number(input.value)<1)throw new Error("Urutan harus bilangan bulat minimal 1.");merged[key]=Number(input.value)}
      else if(def?.[2]==="boolean")merged[key]=input.checked;
      else merged[key]=input.value;
     });

     return {
      id:row.current?.id||null,
      expected:row.current||null,
      data:{
       kelompok:merged.kelompok,nama:merged.nama,jenjang:merged.jenjang,alamat:merged.alamat||"",
       siswa_kecil:Number(merged.siswa_kecil||0),siswa_besar:Number(merged.siswa_besar||0),tendik:Number(merged.tendik||0),
       ibu_hamil:Number(merged.ibu_hamil||0),ibu_menyusui:Number(merged.ibu_menyusui||0),balita:Number(merged.balita||0),
       putus_sekolah:Number(merged.putus_sekolah||0),kader:Number(merged.kader||0),
       urutan:Number(merged.urutan||100),aktif:merged.aktif!==false,keterangan:merged.keterangan||"",
       perlu_verifikasi:merged.perlu_verifikasi===true,catatan_verifikasi:merged.catatan_verifikasi||""
      },
      card
     };
    })}catch(error){setMessageSafe(error.message||"Periksa kembali nilai penerima.",true);return}
    if(payload.some(row=>!row.data.kelompok||!row.data.nama||!row.data.jenjang)){setMessageSafe("Kelompok, nama, dan jenjang harus lengkap pada setiap baris.",true);return}
    if(!confirm("Konfirmasi penyimpanan "+payload.length+" penerima? Hanya baris yang dicentang yang akan diperbarui/ditambahkan. Data penerima lain tidak dihapus."))return;
    save.disabled=true;save.textContent="Menyimpan...";
    let saved=0;
    try{
     for(const item of payload){
      await api("ai/recipient-apply",{
       confirm:true,expected:item.expected,
       data:{...item.data,...(item.id?{id:item.id}:{})}
      });
      saved++;
      const checkbox=item.card.querySelector("[data-include-recipient]");
      if(checkbox){checkbox.checked=false;checkbox.disabled=true}
     }
     await onMasterChanged();
     setMessageSafe(saved+" baris penerima berhasil disimpan. Periksa kembali Data Master.");
     checkboxesAfterSave(selected);
    }catch(error){
     if(saved>0)await onMasterChanged();
     setMessageSafe((saved?saved+" baris sudah tersimpan. ":"")+(error.message||"Data penerima gagal disimpan."),true);
    }finally{save.disabled=false;save.textContent="Konfirmasi & simpan penerima"}
   }
   function checkboxesAfterSave(cards){cards.forEach(card=>{const input=card.querySelector("[data-include-recipient]");if(input){input.checked=false;input.disabled=true}})}
  }
  function renderMasterUpdates(target,rows){
   const section=text(target,"section","ai-list");
   text(section,"h4","","Usulan Data Master lainnya");
   text(section,"p","ai-helper","AI memetakan data ke Identitas SPPG, Pengemudi, Kendaraan, Petugas, atau Daftar Menu Master. Baris baru/ubah hanya disimpan setelah Anda memilih dan mengonfirmasi.");
   rows.forEach((row,index)=>{
    const fields=MASTER_FIELDS[row.entity]||[];
    const card=text(section,"article","ai-card");card.dataset.masterRow=String(index);
    const head=text(card,"div","ai-card-head");
    const selectable=(row.action==="new"||row.action==="update")&&(row.changed_fields||[]).length>0&&fields.length>0;
    const check=el("input");check.type="checkbox";check.dataset.includeMaster="";check.checked=false;check.disabled=!selectable;head.append(check);
    const label=(row.proposed?.nama_sppg||row.proposed?.nama||row.proposed?.no_kendaraan||row.proposed?.teks_menu||MASTER_TITLES[row.entity]||"Data Master");
    text(head,"div","",MASTER_TITLES[row.entity]+ " · "+label);
    text(head,"span","ai-confidence "+(row.confidence==="tinggi"?"high":row.confidence==="rendah"?"low":""),row.confidence||"rendah");
    const body=text(card,"div","ai-card-body");
    text(body,"small","ai-helper",row.reason||"Tidak ada alasan klasifikasi.");
    if(row.source_quote)text(body,"small","ai-helper","Sumber: “"+row.source_quote+"” · "+(row.source_reference||"lokasi sumber tidak disebut"));
    if(row.action==="review")text(body,"div","ai-flag","Perlu pemeriksaan manual. Baris ini tidak dapat disimpan otomatis.");
    if(row.action==="new")text(body,"small","ai-helper","Data baru akan ditambahkan ke "+MASTER_TITLES[row.entity]+".");
    (row.changed_fields||[]).forEach(key=>{
     const def=fields.find(item=>item[0]===key);if(!def)return;
     const wrap=text(body,"div","ai-change");
     const lab=text(wrap,"label",""," "+def[1]);
     const input=el("input");input.type=def[2]==="number"?"number":def[2]==="boolean"?"checkbox":"text";input.dataset.masterField=key;
     if(def[2]==="boolean")input.checked=row.proposed?.[key]===true;else input.value=row.proposed?.[key]??"";
     if(def[2]==="number"){input.min=key==="urutan"?"1":"0";input.step="1";input.inputMode="numeric";}
     lab.append(text(lab,"small","","Sebelumnya: "+(row.current?.[key]===null||row.current?.[key]===undefined?"(baru/kosong)":String(row.current[key]))));
     wrap.append(lab,input);
    });
   });
   const controls=text(target,"div","ai-action-row");
   const save=button(controls,"Konfirmasi & simpan Data Master","primary",saveMasterRows);
   async function saveMasterRows(){
    const selected=Array.from(section.querySelectorAll("[data-master-row]")).filter(card=>card.querySelector("[data-include-master]")?.checked);
    if(!selected.length){setMessageSafe("Pilih minimal satu baris Data Master yang sudah diperiksa.",true);return}
    const payload=[];
    try{
     for(const card of selected){
      const row=rows[Number(card.dataset.masterRow)],fields=MASTER_FIELDS[row.entity]||[];
      const data={...(row.current||{}),...(row.proposed||{})};
      card.querySelectorAll("[data-master-field]").forEach(input=>{
       const key=input.dataset.masterField,def=fields.find(item=>item[0]===key);
       if(def?.[2]==="boolean")data[key]=input.checked;
       else if(def?.[2]==="number"){
        if(input.value.trim()===""||!Number.isSafeInteger(Number(input.value))||Number(input.value)<1)throw new Error("Nilai urutan harus bilangan bulat minimal 1.");
        data[key]=Number(input.value);
       }else data[key]=input.value.trim();
      });
      const identity=row.entity==="settings"?"nama_sppg":row.entity==="vehicles"?"no_kendaraan":row.entity==="menus"?"teks_menu":"nama";
      if(!String(data[identity]||"").trim())throw new Error("Kolom identitas wajib pada "+MASTER_TITLES[row.entity]+" belum diisi.");
      payload.push({entity:row.entity,data,expected:row.current||null,card});
     }
    }catch(error){setMessageSafe(error.message||"Periksa kembali data master.",true);return}
    const preview=payload.map(item=>MASTER_TITLES[item.entity]+" · "+String(item.data.nama_sppg||item.data.nama||item.data.no_kendaraan||item.data.teks_menu)).join("\n");
    if(!confirm("Konfirmasi penyimpanan "+payload.length+" data master berikut?\n\n"+preview+"\n\nHanya baris terpilih yang akan disimpan."))return;
    save.disabled=true;save.textContent="Menyimpan...";
    let saved=0;
    try{
     for(const item of payload){
      await api("ai/master-apply",{confirm:true,entity:item.entity,data:item.data,expected:item.expected});
      saved++;
      const check=item.card.querySelector("[data-include-master]");
      if(check){check.checked=false;check.disabled=true}
     }
     await onMasterChanged();
     setMessageSafe(saved+" data master berhasil disimpan.");
    }catch(error){
     if(saved>0)await onMasterChanged();
     setMessageSafe((saved?saved+" data sudah tersimpan. ":"")+(error.message||"Data master gagal disimpan."),true);
    }finally{save.disabled=false;save.textContent="Konfirmasi & simpan Data Master"}
   }
  }

  return { setMessage: setMessageSafe };
 }
 return Object.freeze({render});
}
window.AutoDocAiAssistant=Object.freeze({create});
})();
