(() => {
"use strict";
function formatOptionalNumber(value){
 if(value===null||value===undefined||value==="")return "";
 const number=Number(value);
 return Number.isFinite(number)?number.toLocaleString("id-ID"):"";
}
function buildPrintHtml(doc, escapeHtml, logoUrl){
 const snap=doc.snapshot_json||{},sppg=snap.sppg||{},dist=snap.distribusi||{},rec=snap.penerima||{},items=snap.rincian_porsi||[];
 const isBast=doc.jenis==="BAST",real=doc.realisasi||{};
 const realRows=real.items||[];
 const quantityByType=(field)=>realRows.reduce((map,item)=>{const type=String(item.jenis_porsi||"");map[type]=(map[type]||0)+Number(item[field]||0);return map;},{});
 const handedByType=quantityByType("jumlah_diserahkan"),receivedByType=quantityByType("jumlah_diterima");
 const snapshotByType=items.reduce((map,item)=>{const type=String(item.jenis_porsi||"");map[type]=(map[type]||0)+Number(item.jumlah||0);return map;},{});
 const types=["Porsi Kecil","Porsi Besar"];
 const kelompokText=[rec.kelompok,rec.jenjang].filter(Boolean).join(" / ");
 const sppgLocation=[sppg.kecamatan,sppg.kabupaten].filter(Boolean).join(" · ");
 const bastRows=types.map((type,index)=>{
  const groups=items.filter(item=>item.jenis_porsi===type).map(item=>item.kelompok_sasaran).filter(Boolean).join(", ");
  const hasReal=realRows.some(item=>item.jenis_porsi===type);
  const before=hasReal?handedByType[type]:snapshotByType[type]||0;
  const after=hasReal?receivedByType[type]:null;
  return "<tr><td>"+(index+1)+"</td><td>"+escapeHtml(groups)+"</td><td>"+type+"</td><td style='text-align:right'>"+formatOptionalNumber(before)+"</td><td style='text-align:right'>"+formatOptionalNumber(after)+"</td></tr>";
 }).join("");
 const rows=isBast?bastRows:(items.length?items.map((x,i)=>"<tr><td>"+(i+1)+"</td><td>"+escapeHtml(x.kelompok_sasaran)+"</td><td>"+escapeHtml(x.jenis_porsi)+"</td><td style='text-align:right'>"+Number(x.jumlah||0).toLocaleString("id-ID")+"</td></tr>").join(""):"<tr><td colspan='4'>Tidak ada rincian porsi.</td></tr>");
 const suhuText=real.suhu_c===null||real.suhu_c===undefined||real.suhu_c===""?"":escapeHtml(real.suhu_c)+" °C";
 const jabatanText=real.jabatan_penerima?" ("+escapeHtml(real.jabatan_penerima)+")":"";
 const realization=isBast&&real.document_id?"<h3>Realisasi Penerimaan</h3><p>Kondisi: "+escapeHtml(real.kondisi||"")+" · Jam diterima: "+escapeHtml(real.jam_diterima||"")+" · Suhu: "+suhuText+"</p><p>Ompreng kembali: "+escapeHtml(real.ompreng_kembali??"")+" · Penerima: "+escapeHtml(real.nama_penerima||"")+jabatanText+"</p><p>Catatan: "+escapeHtml(real.catatan||"")+"</p>":"";
 const signatureBlock=(title,role,name)=>"<div class='sign-block'><div class='sign-head'><div class='sign-title'>"+title+"</div><div class='sign-role'>"+(role||"&nbsp;")+"</div></div><div class='sign-space'></div><div class='sign-person'>"+(name?escapeHtml(name):"&nbsp;")+"</div><div class='sign-line'></div></div>";
 const signatures=isBast
  ? signatureBlock("Yang Menyerahkan","Petugas Distribusi SPPG",dist.nama_petugas)+
    signatureBlock("Mengetahui,","Kepala SPPI",sppg.nama_kepala_sppi)+
    signatureBlock("Yang Menerima","",real.nama_penerima)
  : signatureBlock("Yang Menyerahkan","Petugas Distribusi SPPG",dist.nama_petugas)+
    signatureBlock("Pengemudi","",dist.nama_pengemudi)+
    signatureBlock("Yang Menerima","","");
 const title=isBast?"BERITA ACARA SERAH TERIMA":"SURAT JALAN";
 const html="<!doctype html><html lang='id'><head><meta charset='utf-8'><title>"+escapeHtml(doc.nomor_lengkap)+"</title><style>@page{size:A4;margin:16mm}*{box-sizing:border-box}body{font-family:Arial,sans-serif;color:#111;font-size:12px;line-height:1.5}.top{display:grid;grid-template-columns:70px minmax(0,1fr);align-items:center;gap:12px;border-bottom:3px double #222;padding-bottom:10px;min-height:82px}.top-logo{display:block;width:68px;height:68px;object-fit:contain}.top-copy{text-align:center}.brand{font-size:15px;font-weight:700}.top-address{font-size:10px;line-height:1.5}center{text-align:center;margin:22px 0 14px}.center h1{font-size:18px;margin:0;letter-spacing:.6px}.center h2{font-size:13px;margin:3px 0;text-decoration:underline}.number{text-align:center;font-size:12px;margin:4px}.meta{display:grid;grid-template-columns:1fr 1fr;gap:7px 22px;margin:17px 0}.meta div{padding:4px 0;border-bottom:1px dotted #bbb}.meta b{display:inline-block;min-width:115px}.data{width:100%;border-collapse:collapse;margin-top:10px}.data th,.data td{padding:7px;border:1px solid #333;text-align:left}.data th{background:#f1f1ed}.sign{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:22px;margin-top:42px;text-align:center;font-size:11px;align-items:start;break-inside:avoid}.sign-block{min-width:0;display:flex;flex-direction:column;align-items:stretch}.sign-head{height:34px;display:flex;flex-direction:column;justify-content:flex-start}.sign-title{min-height:17px;font-weight:600}.sign-role{height:15px;font-size:10px}.sign-space{height:48px;flex:none}.sign-person{height:18px;flex:none;padding-top:2px;font-size:10px;overflow-wrap:anywhere}.sign-line{width:82%;height:1px;flex:none;margin:0 auto;border-bottom:1px solid #222}h3{font-size:13px;margin:20px 0 5px}@media print{body{print-color-adjust:exact;-webkit-print-color-adjust:exact}}</style></head><body>"+
 "<div class='top'><img class='top-logo' src='"+logoUrl+"' alt='Logo BGN'><div class='top-copy'><div class='brand'>"+escapeHtml(sppg.nama_sppg||"SPPG")+"</div><div class='top-address'>"+escapeHtml(sppg.alamat||"")+"</div><div class='top-address'>"+escapeHtml(sppgLocation)+"</div></div></div>"+
 "<div class='center'><h1>"+title+"</h1><h2>"+(isBast?"SERAH TERIMA HASIL DISTRIBUSI MBG":"PENGIRIMAN / DISTRIBUSI MBG")+"</h2><div class='number'>Nomor: <b>"+escapeHtml(doc.nomor_lengkap)+"</b></div></div>"+
 "<div class='meta'><div><b>Tanggal</b>: "+escapeHtml(dist.tanggal||"")+"</div><div><b>Jam berangkat</b>: "+escapeHtml(dist.jam_berangkat||"")+"</div><div><b>Penerima</b>: "+escapeHtml(rec.nama||"")+"</div><div><b>Kelompok</b>: "+escapeHtml(kelompokText)+"</div><div><b>Alamat</b>: "+escapeHtml(rec.alamat||"")+"</div><div><b>Menu</b>: "+escapeHtml(dist.menu||"")+"</div><div><b>Pengemudi</b>: "+escapeHtml(dist.nama_pengemudi||"")+"</div><div><b>Kendaraan</b>: "+escapeHtml(dist.no_kendaraan||"")+"</div><div><b>Petugas</b>: "+escapeHtml(dist.nama_petugas||"")+"</div><div><b>Total porsi</b>: "+formatOptionalNumber((snap.ringkasan||{}).total_porsi)+"</div></div>"+
 "<h3>Rincian Porsi</h3><table class='data'><thead><tr><th style='width:35px'>No.</th><th>Kelompok sasaran</th><th>Jenis porsi</th>"+(isBast?"<th style='text-align:right'>Jumlah Sebelum</th><th style='text-align:right'>Jumlah Sesudah</th>":"<th style='width:100px;text-align:right'>Jumlah</th>")+"</tr></thead><tbody>"+rows+"</tbody><tfoot><tr><th colspan='3' style='text-align:right'>Total</th>"+(isBast?"<th style='text-align:right'>"+formatOptionalNumber(realRows.length?Object.values(handedByType).reduce((a,b)=>a+b,0):(snap.ringkasan||{}).total_porsi)+"</th><th style='text-align:right'>"+(realRows.length?formatOptionalNumber(Object.values(receivedByType).reduce((a,b)=>a+b,0)):"")+"</th>":"<th style='text-align:right'>"+Number((snap.ringkasan||{}).total_porsi||0).toLocaleString("id-ID")+"</th>")+"</tr></tfoot></table>"+
 (isBast?realization:"")+
 "<div class='sign'>"+signatures+"</div>"+
 "</body></html>";
 return html;
}

window.AutoDocPrintRenderer = Object.freeze({ buildPrintHtml });
})();
