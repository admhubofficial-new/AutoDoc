(() => {
"use strict";
function create({ getModal, $, node, status, api, loadHistory }) {
 const modal = getModal();
 async function loadDistributions(initialOffset=0){
 const target=$(".docs-view-history",modal);if(!target)return;
 target.innerHTML="<div class='docs-days-toolbar'><div><h3 class='docs-section-title'>Arsip distribusi</h3><p class='docs-note' style='margin:4px 0 0'>Cari seluruh arsip, pilih beberapa riwayat, lalu kelola sekaligus.</p></div><input id='docsDaysSearch' type='search' placeholder='Cari tanggal (YYYY-MM-DD), menu, petugas, pengemudi...' aria-label='Cari seluruh arsip'></div><div class='docs-days-selection'><label><input id='docsDaysSelectAll' type='checkbox'> Pilih semua pada halaman ini</label><span id='docsDaysSelectionCount'>0 dipilih</span><button type='button' class='docs-btn danger' id='docsDaysDelete' disabled>Hapus dipilih</button></div><div id='docsDeleteConfirmSlot'></div><div id='docsDaysList' class='docs-days-list'><div class='docs-empty'>Memuat arsip…</div></div><div class='docs-days-pagination'><button type='button' class='docs-btn' id='docsDaysPrevious'>Lebih baru</button><span id='docsDaysPage' class='docs-note'>Memuat halaman…</span><button type='button' class='docs-btn primary' id='docsDaysNext'>Lebih lama</button></div>";
 const list=$("#docsDaysList",target),input=$("#docsDaysSearch",target);
 const previous=$("#docsDaysPrevious",target),next=$("#docsDaysNext",target),pageLabel=$("#docsDaysPage",target);
 const selectAll=$("#docsDaysSelectAll",target),selectionCount=$("#docsDaysSelectionCount",target),deleteButton=$("#docsDaysDelete",target);
 const confirmSlot=$("#docsDeleteConfirmSlot",target);
 let offset=0,hasMore=false,rows=[],searchTimer=null,requestSequence=0;
 const selectedIds=new Set(),selectedDetails=new Map();
 function updateSelection(){
  const count=selectedIds.size;
  selectionCount.textContent=count+" riwayat dipilih";
  deleteButton.textContent=count?"Hapus dipilih ("+count+")":"Hapus dipilih";
  deleteButton.disabled=count===0;
  const selectedOnPage=rows.filter(row=>selectedIds.has(String(row.id))).length;
  selectAll.checked=rows.length>0&&selectedOnPage===rows.length;
  selectAll.indeterminate=selectedOnPage>0&&selectedOnPage<rows.length;
  selectAll.disabled=rows.length===0;
  list.querySelectorAll("[data-distribution-id]").forEach(card=>{
   const checkbox=card.querySelector("input[type=checkbox]");
   if(checkbox)checkbox.checked=selectedIds.has(card.dataset.distributionId);
  });
 }
 function renderDays(){
  list.innerHTML="";
  if(!rows.length){
   list.append(node("div","docs-empty",input.value.trim()?"Tidak ada arsip yang cocok dengan pencarian ini.":"Belum ada riwayat distribusi."));
  }else{
   rows.forEach(row=>{
    const id=String(row.id),card=node("article","docs-day-card");
    card.dataset.distributionId=id;
    const pick=node("label","docs-day-pick");
    const checkbox=node("input");checkbox.type="checkbox";checkbox.checked=selectedIds.has(id);
    checkbox.setAttribute("aria-label","Pilih riwayat "+row.tanggal);
    checkbox.addEventListener("change",()=>{
     if(checkbox.checked){
      if(!selectedIds.has(id)&&selectedIds.size>=60){checkbox.checked=false;status("Maksimal 60 riwayat dapat dipilih untuk satu kali penghapusan.",true);return}
      selectedIds.add(id);selectedDetails.set(id,row);
     }else{selectedIds.delete(id);selectedDetails.delete(id)}
     updateSelection();
    });
    pick.append(checkbox);
    const detail=node("div","docs-day-detail");
    const date=new Date(String(row.tanggal)+"T00:00:00");
    const dateText=Number.isNaN(date.getTime())?row.tanggal:new Intl.DateTimeFormat("id-ID",{weekday:"long",day:"2-digit",month:"long",year:"numeric"}).format(date);
    detail.append(node("strong",null,dateText));
    detail.append(node("small",null,(row.menu||"Menu belum diisi")+" · "+(row.nama_petugas||"Petugas belum diisi")+" · "+(row.nama_pengemudi||"Pengemudi belum diisi")+" · "+(row.no_kendaraan||"Kendaraan belum diisi")));
    const actions=node("div","docs-day-actions");
    const open=node("button","docs-btn primary","Buka");open.type="button";open.onclick=()=>loadHistory(row.tanggal);
    actions.append(open);card.append(pick,detail,actions);list.append(card);
   });
  }
  const first=rows.length?offset+1:0,last=offset+rows.length;
  const search=input.value.trim();
  pageLabel.textContent=rows.length?"Arsip "+first+"–"+last+(search?" · hasil pencarian":"")+(hasMore?" · masih ada hasil":""):"Tidak ada hasil";
  previous.disabled=offset===0;
  next.disabled=!hasMore;
  updateSelection();
 }
 async function loadPage(nextOffset){
  const requestId=++requestSequence;
  status("Memuat arsip…");
  previous.disabled=true;next.disabled=true;
  try{
   const query="?offset="+encodeURIComponent(nextOffset)+"&q="+encodeURIComponent(input.value.trim());
   const result=await api("docs/days"+query);
   if(requestId!==requestSequence)return;
   rows=Array.isArray(result.distributions)?result.distributions:[];
   offset=Number(result.offset||0);hasMore=Boolean(result.has_more);
   rows.forEach(row=>{const id=String(row.id);if(selectedIds.has(id))selectedDetails.set(id,row)});
   renderDays();
   status(rows.length+" riwayat dimuat pada halaman ini.");
  }catch(error){
   if(requestId!==requestSequence)return;
   status(error.message,true);
   list.replaceChildren(node("div","docs-empty","Arsip gagal dimuat. Periksa sesi dan koneksi, lalu coba lagi."));
   previous.disabled=offset===0;next.disabled=true;
  }
 }
 selectAll.addEventListener("change",()=>{
  const selecting=selectAll.checked;
  let capped=false;
  rows.forEach(row=>{
   const id=String(row.id);
   if(selecting){
    if(!selectedIds.has(id)){
     if(selectedIds.size<60){selectedIds.add(id);selectedDetails.set(id,row)}
     else capped=true;
    }
   }else{selectedIds.delete(id);selectedDetails.delete(id)}
  });
  updateSelection();
  if(capped)status("Batas pilihan 60 riwayat tercapai. Hapus pilihan lain untuk menambah data.",true);
 });
 previous.onclick=()=>loadPage(Math.max(0,offset-60));
 next.onclick=()=>loadPage(offset+60);
 input.addEventListener("input",()=>{
  if(searchTimer)clearTimeout(searchTimer);
  searchTimer=setTimeout(()=>{
   selectedIds.clear();selectedDetails.clear();confirmSlot.replaceChildren();loadPage(0);
  },300);
 });
 deleteButton.addEventListener("click",()=>{
  if(!selectedIds.size)return;
  confirmSlot.replaceChildren();
  const ids=Array.from(selectedIds);
  const panel=node("section","docs-delete-panel");
  panel.setAttribute("aria-labelledby","docsDeleteTitle");
  const heading=node("h3",null,"Konfirmasi penghapusan riwayat");
  heading.id="docsDeleteTitle";
  panel.append(heading);
  panel.append(node("p","docs-delete-warning","Tindakan ini permanen. "+ids.length+" riwayat distribusi beserta seluruh Surat Jalan, BAST, data realisasi, dan rincian menu terkait akan dihapus. Nomor dokumen yang sudah pernah terpakai tetap tidak akan digunakan ulang."));
  const summary=node("div","docs-delete-summary");
  ids.slice(0,6).forEach(id=>{
   const item=selectedDetails.get(id);
   summary.append(node("div",null,(item?.tanggal||"Riwayat terpilih")+" · "+(item?.menu||"Menu tidak tersedia")));
  });
  if(ids.length>6)summary.append(node("div","docs-note","Dan "+(ids.length-6)+" riwayat lainnya."));
  panel.append(summary);
  const form=node("form","docs-delete-form");
  const pinLabel=node("label",null,"PIN MASUK untuk konfirmasi");pinLabel.htmlFor="docsDeletePin";
  const pin=node("input");pin.id="docsDeletePin";pin.type="password";pin.name="token";pin.required=true;pin.minLength=6;pin.maxLength=128;pin.autocomplete="current-password";pin.placeholder="Masukkan PIN MASUK";
  const acknowledgement=node("label","docs-delete-ack");
  const check=node("input");check.type="checkbox";check.required=true;
  acknowledgement.append(check,node("span",null,"Saya memahami bahwa penghapusan ini permanen."));
  const actions=node("div","docs-delete-actions");
  const cancel=node("button","docs-btn","Batal");cancel.type="button";cancel.onclick=()=>confirmSlot.replaceChildren();
  const submit=node("button","docs-btn danger","Hapus permanen");submit.type="submit";
  actions.append(cancel,submit);
  form.append(pinLabel,pin,acknowledgement,actions);
  form.addEventListener("submit",async event=>{
   event.preventDefault();
   if(!form.reportValidity())return;
   const token=pin.value;
   submit.disabled=true;cancel.disabled=true;submit.textContent="Memverifikasi PIN dan menghapus…";
   try{
    const result=await api("docs/delete-history",{token,distribution_ids:ids});
    selectedIds.clear();selectedDetails.clear();confirmSlot.replaceChildren();
    status(result.message||"Riwayat berhasil dihapus.");
    await loadPage(0);
    window.dispatchEvent(new Event("autodoc:data-changed"));
   }catch(error){
    status(error.message,true);submit.disabled=false;cancel.disabled=false;submit.textContent="Hapus permanen";
    pin.value="";pin.focus();
   }
  });
  panel.append(form);confirmSlot.append(panel);pin.focus();
 });
 await loadPage(Math.max(0,Number(initialOffset)||0));
}
 return Object.freeze({ loadDistributions });
}
window.AutoDocArchive = Object.freeze({ create });
})();
