(() => {
"use strict";
function create({ getModal, $, node, esc, api, status, loadHistory }) {
 function showRealization(card,doc){
 const modal=getModal();
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
 return Object.freeze({ showRealization });
}
window.AutoDocBastRealization = Object.freeze({ create });
})();
