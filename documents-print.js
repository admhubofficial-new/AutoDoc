(() => {
"use strict";

function safe(escapeHtml,value){
  return typeof escapeHtml==="function"
    ? escapeHtml(value??"")
    : String(value??"").replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));
}

function formatNumber(value){
  if(value===null||value===undefined||value==="")return "";
  const number=Number(value);
  return Number.isFinite(number)?number.toLocaleString("id-ID"):"";
}

function formatDateParts(value){
  const source=String(value??"");
  const match=source.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if(!match)return {display:source,sentence:source};
  const date=new Date(source+"T00:00:00+07:00");
  if(Number.isNaN(date.getTime()))return {display:source,sentence:source};
  const parts=new Intl.DateTimeFormat("id-ID",{
    weekday:"long",day:"2-digit",month:"long",year:"numeric",timeZone:"Asia/Jakarta"
  }).formatToParts(date);
  const values=Object.fromEntries(parts.filter(part=>part.type!=="literal").map(part=>[part.type,part.value]));
  const weekday=values.weekday?values.weekday.charAt(0).toUpperCase()+values.weekday.slice(1):"";
  const display=weekday+", "+[values.day,values.month,values.year].filter(Boolean).join(" ");
  return {display,sentence:[weekday,"tanggal",values.day,values.month,values.year].filter(Boolean).join(" ")};
}

function getHeaderName(sppg){
  const raw=String(sppg.nama_sppg||"SPPG Darmaraja");
  const name=raw.replace(/^satuan pelayanan pemenuhan gizi\s*\(sppg\)\s*/i,"")
    .replace(/^sppg\s*/i,"").replace(/\s+0?1$/,"").trim();
  return (name||"DARMARAJA").toLocaleUpperCase("id-ID");
}

function getHeaderAddress(sppg){
  const address=String(sppg.alamat||"").trim();
  const kecamatan=String(sppg.kecamatan||"").trim();
  const kabupaten=String(sppg.kabupaten||"").trim();
  const parts=[address];
  if(kecamatan&&!address.toLocaleLowerCase("id-ID").includes(kecamatan.toLocaleLowerCase("id-ID")))parts.push("Kecamatan "+kecamatan);
  if(kabupaten&&!address.toLocaleLowerCase("id-ID").includes(kabupaten.toLocaleLowerCase("id-ID")))parts.push("Kabupaten "+kabupaten);
  return parts.filter(Boolean).join(" ");
}

function letterhead(sppg,logoUrl,escapeHtml){
  const name=getHeaderName(sppg);
  const address=getHeaderAddress(sppg);
  return "<header class='letterhead'>"+
    "<div class='letterhead-logo'><img class='top-logo' src='"+safe(escapeHtml,logoUrl)+"' alt='Logo BGN'></div>"+
    "<div class='letterhead-copy'><div class='letterhead-main'>SATUAN PELAYANAN PEMENUHAN GIZI (SPPG)</div>"+
    "<div class='letterhead-place'>"+safe(escapeHtml,name)+"</div>"+
    "<div class='letterhead-address'>Alamat: "+safe(escapeHtml,address)+"</div></div><div class='letterhead-spacer' aria-hidden='true'></div></header>";
}

function documentHeading(kind,number,escapeHtml){
  if(kind==="BAST"){
    return "<div class='document-heading bast-heading'><h1>BERITA ACARA SERAH TERIMA (BAST)</h1>"+
      "<h2>PAKET MAKAN BERGIZI GRATIS (MBG)</h2>"+
      "<p class='document-number'>Nomor: <strong>"+safe(escapeHtml,number)+"</strong></p></div>";
  }
  return "<div class='document-heading sj-heading'><h1>SURAT JALAN</h1>"+
    "<h2>PENGIRIMAN / DISTRIBUSI MBG</h2>"+
    "<p class='document-number'>Nomor: <strong>"+safe(escapeHtml,number)+"</strong></p></div>";
}

function distributionMeta(snapshot,escapeHtml){
  const dist=snapshot.distribusi||{};
  const recipient=snapshot.penerima||{};
  const date=formatDateParts(dist.tanggal).display;
  const group=[recipient.kelompok,recipient.jenjang].filter(Boolean).join(" / ");
  const rows=[
    ["Tanggal",date,"Jam berangkat",dist.jam_berangkat],
    ["Penerima",recipient.nama,"Kelompok",group],
    ["Alamat",recipient.alamat,"Menu",dist.menu],
    ["Pengemudi",dist.nama_pengemudi,"Kendaraan",dist.no_kendaraan],
  ];
  return "<table class='meta-table' aria-label='Informasi distribusi'><colgroup><col style='width:14%'><col style='width:33.7%'><col style='width:17.1%'><col style='width:35.2%'></colgroup><tbody>"+
    rows.map(row=>"<tr>"+row.map((value,index)=>index%2===0
      ? "<th scope='row'>"+safe(escapeHtml,value)+"</th>"
      : "<td>: "+safe(escapeHtml,value)+"</td>").join("")+"</tr>").join("")+
    "</tbody></table>";
}

function portionRows(items,escapeHtml){
  return items.length?items.map((item,index)=>"<tr>"+
    "<td class='center'>"+(index+1)+"</td>"+
    "<td>"+safe(escapeHtml,item.kelompok_sasaran)+"</td>"+
    "<td>"+safe(escapeHtml,item.jenis_porsi)+"</td>"+
    "<td class='number-cell'>"+formatNumber(item.jumlah)+"</td></tr>").join("")
    :"<tr><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td></tr>";
}

function portionTable(items,total,escapeHtml){
  return "<h3 class='section-label'>Rincian Porsi</h3>"+
    "<table class='portion-table sj-portions'><colgroup><col style='width:7.2%'><col style='width:50%'><col style='width:28%'><col style='width:14.8%'></colgroup>"+
    "<thead><tr><th>No.</th><th>Kelompok sasaran</th><th>Jenis porsi</th><th class='number-cell'>Jumlah</th></tr></thead>"+
    "<tbody>"+portionRows(items,escapeHtml)+"</tbody>"+
    "<tfoot><tr><th colspan='3' class='total-label'>Total</th><th class='number-cell'>"+formatNumber(total)+"</th></tr></tfoot></table>";
}

function signatureBlock(title,role,personText,named=false){
  return "<div class='signature-cell'><strong>"+title+"</strong><span>"+(role||"&nbsp;")+"</span>"+
    "<div class='signature-space'></div><div class='signature-person"+(named?" signature-name":"")+"'>"+personText+"</div></div>";
}

function sjSignatures(dist,recipient,escapeHtml){
  const blank="( .............................. )";
  return "<div class='signature-grid sj-signatures'>"+
    signatureBlock("Yang Menyerahkan","Petugas Distribusi SPPG",blank)+
    signatureBlock("Pengemudi","&nbsp;",blank)+
    signatureBlock("Yang Menerima",safe(escapeHtml,recipient.nama),blank)+
    "</div>";
}

function buildSuratJalan(snapshot,doc,logoUrl,escapeHtml){
  const dist=snapshot.distribusi||{},recipient=snapshot.penerima||{};
  const items=Array.isArray(snapshot.rincian_porsi)?snapshot.rincian_porsi:[];
  const total=(snapshot.ringkasan||{}).total_porsi??items.reduce((sum,item)=>sum+Number(item.jumlah||0),0);
  return "<main class='sheet surat-jalan'>"+letterhead(snapshot.sppg||{},logoUrl,escapeHtml)+
    documentHeading("SJ",doc.nomor_lengkap,escapeHtml)+
    distributionMeta(snapshot,escapeHtml)+
    portionTable(items,total,escapeHtml)+
    sjSignatures(dist,recipient,escapeHtml)+"</main>";
}

function partyFields(rows,escapeHtml){
  return "<table class='party-fields'><colgroup><col style='width:31.1%'><col></colgroup><tbody>"+
    rows.map(row=>"<tr><td>"+safe(escapeHtml,row[0])+"</td><td>: "+safe(escapeHtml,row[1])+"</td></tr>").join("")+
    "</tbody></table>";
}

function bastPortionRows(items,real,escapeHtml,fallbackTotal=0){
  const realRows=Array.isArray(real.items)?real.items:[];
  const rows=items.length?items.map((item,index)=>{
    const matching=items.filter(row=>row.jenis_porsi===item.jenis_porsi);
    const received=realRows.find(row=>row.jenis_porsi===item.jenis_porsi);
    const first=matching[0]===item;
    const after=received&&first?formatNumber(received.jumlah_diterima)+(matching.length>1?" (total "+item.jenis_porsi+")":""):"";
    return "<tr><td class='center'>"+(index+1)+"</td><td>"+safe(escapeHtml,item.kelompok_sasaran)+
      "</td><td>"+safe(escapeHtml,item.jenis_porsi)+"</td><td class='number-cell'>"+
      formatNumber(item.jumlah)+"</td><td class='number-cell'>"+safe(escapeHtml,after)+"</td></tr>";
  }).join(""):"<tr><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td></td><td></td></tr>";
  const totalBefore=items.reduce((sum,item)=>sum+Number(item.jumlah||0),0)||Number(fallbackTotal||0);
  const totalAfter=realRows.length
    ?realRows.reduce((sum,item)=>sum+Number(item.jumlah_diterima||0),0)
    :"";
  return {rows,totalBefore,totalAfter};
}

function receiptConditions(real,escapeHtml){
  const condition=String(real.kondisi||"").toLowerCase();
  const checks=["baik","kurang baik","tidak layak"].map(value=>
    "["+(condition===value?"✓":"    ")+"] "+(value==="baik"?"Baik":value==="kurang baik"?"Kurang baik":"Tidak layak")
  ).join("        ");
  const time=real.jam_diterima?String(real.jam_diterima).slice(0,5)+" WIB":".................... WIB";
  const containers=real.ompreng_kembali===null||real.ompreng_kembali===undefined||real.ompreng_kembali===""
    ?".................... buah":formatNumber(real.ompreng_kembali)+" buah";
  const notes=real.catatan||"";
  return "<h3 class='section-label condition-heading'>Kondisi makanan saat diterima:</h3>"+
    "<table class='condition-table'><colgroup><col style='width:31.1%'><col></colgroup><tbody>"+
    "<tr><td>Kondisi makanan</td><td>: "+safe(escapeHtml,checks)+"</td></tr>"+
    "<tr><td>Jam diterima</td><td>: "+safe(escapeHtml,time)+"</td></tr>"+
    "<tr><td>Wadah (ompreng) dikembalikan</td><td>: "+safe(escapeHtml,containers)+"</td></tr>"+
    "<tr><td>Catatan</td><td>: "+safe(escapeHtml,notes)+"</td></tr>"+
    "</tbody></table>";
}

function bastSignatures(sppg,escapeHtml){
  const blank="( .............................. )";
  const signer=sppg.nama_kepala_sppg||blank;
  return "<div class='signature-grid bast-signatures'>"+
    signatureBlock("PIHAK PERTAMA,","Yang Menyerahkan",blank)+
    signatureBlock("Mengetahui,","Kepala SPPG Darmaraja",safe(escapeHtml,signer),true)+
    signatureBlock("PIHAK KEDUA,","Yang Menerima",blank)+
    "</div>";
}

function buildBast(snapshot,doc,logoUrl,escapeHtml){
  const sppg=snapshot.sppg||{},dist=snapshot.distribusi||{},recipient=snapshot.penerima||{};
  const items=Array.isArray(snapshot.rincian_porsi)?snapshot.rincian_porsi:[];
  const real=doc.realisasi||{};
  const rows=bastPortionRows(items,real,escapeHtml,(snapshot.ringkasan||{}).total_porsi||0);
  const date=formatDateParts(dist.tanggal).sentence;
  const groups=[
    ["I. PIHAK PERTAMA (yang menyerahkan)",[
      ["Nama",dist.nama_petugas||""],
      ["Jabatan","Petugas Distribusi SPPG Darmaraja"],
      ["Instansi","SPPG Darmaraja (Badan Gizi Nasional)"],
    ]],
    ["II. PIHAK KEDUA (penerima)",[
      ["Nama",real.nama_penerima||""],
      ["Jabatan",real.jabatan_penerima||""],
      ["Instansi / Lembaga",recipient.nama||""],
    ]],
  ];
  return "<main class='sheet bast-page'>"+letterhead(sppg,logoUrl,escapeHtml)+
    documentHeading("BAST",doc.nomor_lengkap,escapeHtml)+
    "<p class='bast-opening'>Pada hari ini, "+safe(escapeHtml,date)+", bertempat di "+safe(escapeHtml,recipient.nama)+", kami yang bertanda tangan di bawah ini:</p>"+
    groups.map(group=>"<section class='party-section'><h3>"+group[0]+"</h3>"+partyFields(group[1],escapeHtml)+"</section>").join("")+
    "<p class='bast-transfer'>PIHAK PERTAMA telah menyerahkan dan PIHAK KEDUA telah menerima paket Makan Bergizi Gratis (MBG) untuk penerima manfaat dengan rincian sebagai berikut:</p>"+
    "<table class='portion-table bast-portions'><colgroup><col style='width:6.2%'><col style='width:37.8%'><col style='width:18.7%'><col style='width:18.65%'><col style='width:18.65%'></colgroup>"+
    "<thead><tr><th>No.</th><th>Kelompok sasaran</th><th>Jenis porsi</th><th>Jumlah Sebelum</th><th>Jumlah Sesudah</th></tr></thead>"+
    "<tbody>"+rows.rows+"</tbody><tfoot><tr><th colspan='3' class='total-label'>TOTAL PORSI</th>"+
    "<th class='number-cell'>"+formatNumber(rows.totalBefore)+"</th><th class='number-cell'>"+(rows.totalAfter===""?"":formatNumber(rows.totalAfter))+"</th></tr></tfoot></table>"+
    receiptConditions(real,escapeHtml)+
    "<p class='bast-closing'>Demikian Berita Acara Serah Terima ini dibuat dengan sebenarnya dalam rangkap 2 (dua) untuk dipergunakan sebagaimana mestinya, sebagai dasar pencatatan jumlah porsi yang diterima penerima manfaat.</p>"+
    bastSignatures(sppg,escapeHtml)+"</main>";
}

const PRINT_STYLES=`
@page{size:A4 portrait;margin:0}
*{box-sizing:border-box}
html,body{margin:0;padding:0}
body{background:#e8ebe9;color:#111;font-family:Arial,Helvetica,sans-serif;font-size:10pt;line-height:1.25;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.sheet{width:210mm;min-height:297mm;margin:18px auto;padding:15mm 20mm;background:#fff;box-shadow:0 1px 6px rgba(0,0,0,.18)}
.letterhead{display:grid;grid-template-columns:24.65mm minmax(0,1fr) 19.4mm;align-items:center;min-height:27mm;padding:0 0 4mm;border-bottom:3px double #111}
.letterhead-logo{display:flex;align-items:center;justify-content:flex-start}
.top-logo{display:block;width:20.6mm;height:20.4mm;object-fit:contain}
.letterhead-copy{text-align:center;min-width:0}
.letterhead-main{font-size:14pt;font-weight:700;line-height:1.15}
.letterhead-place{font-size:15pt;font-weight:700;line-height:1.2}
.letterhead-address{margin-top:1mm;font-size:9pt;line-height:1.25}
.document-heading{text-align:center}
.document-heading h1,.document-heading h2,.document-heading p{margin:0}
.sj-heading{margin:7mm 0 4mm}
.sj-heading h1{font-size:15pt;line-height:1.15;font-weight:700}
.sj-heading h2{margin-top:1mm;font-size:10pt;line-height:1.2;text-decoration:underline;font-weight:700}
.document-number{margin-top:2mm!important;font-size:10pt}
.document-number strong{font-weight:700}
.bast-heading{margin:3mm 0 3mm}
.bast-heading h1{font-size:13pt;line-height:1.2;font-weight:700}
.bast-heading h2{margin-top:1mm;font-size:11pt;line-height:1.2;font-weight:700}
.bast-heading .document-number{margin-top:2mm!important;font-size:10pt}
.meta-table,.party-fields,.condition-table{width:100%;table-layout:fixed;border-collapse:collapse;font-size:10pt;line-height:1.25}
.meta-table col.meta-label-col{width:14%}
.meta-table col.meta-label-col-right{width:17.1%}
.meta-table th,.meta-table td,.party-fields td,.condition-table td{padding:1mm 1.5mm;vertical-align:middle}
.meta-table th{font-weight:700;text-align:left;white-space:nowrap}
.meta-table td{border-bottom:1px dotted #777;overflow-wrap:anywhere}
.meta-table th{border-bottom:1px dotted #777}
.section-label{margin:7mm 0 1.5mm;font-size:10pt;line-height:1.2;font-weight:700}
.portion-table{width:100%;table-layout:fixed;border-collapse:collapse;font-size:10pt;line-height:1.2;break-inside:avoid}
.portion-table th,.portion-table td{border:1px solid #000;padding:1mm 1.5mm;vertical-align:middle}
.portion-table thead th,.portion-table tfoot th{background:#f0f0f0;font-weight:700}
.portion-table thead th{text-align:left}
.portion-table .center{text-align:center}
.portion-table .number-cell{text-align:right}
.portion-table .total-label{text-align:right}
.sj-portions thead th:first-child{text-align:center}
.sj-portions tfoot th{background:#f0f0f0}
.signature-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:0;margin-top:9mm;text-align:center;break-inside:avoid}
.signature-cell{display:flex;min-width:0;flex-direction:column;align-items:center;font-size:10pt;line-height:1.25}
.signature-cell strong{display:block;font-size:10pt;font-weight:700}
.signature-cell span{display:block;min-height:4mm}
.signature-space{height:27mm;flex:none}
.signature-person{min-height:4mm;padding-top:1mm;font-size:10pt;overflow-wrap:anywhere}.signature-name{text-decoration:underline;font-weight:700}.signature-dots{font-size:10pt;white-space:nowrap}
.bast-opening{margin:0 0 2mm;text-align:justify;font-size:10pt;line-height:1.25}
.party-section{margin:0 0 1mm}
.party-section h3{margin:0 0 1mm;font-size:10pt;line-height:1.2;font-weight:700}
.party-fields td:first-child{padding-left:1.5mm}
.party-fields td:last-child,.condition-table td:last-child{border-bottom:1px dotted #777;overflow-wrap:anywhere}
.party-section+.party-section{margin-top:1mm}
.bast-transfer{margin:3mm 0 2mm;text-align:justify;font-size:10pt;line-height:1.25}
.bast-portions{margin:0}
.bast-portions thead th{text-align:left}
.bast-portions thead th:first-child{text-align:center}
.bast-portions tfoot th{background:#f0f0f0}
.condition-heading{margin:2.5mm 0 1mm}
.condition-table td{padding:1mm 1.5mm}
.bast-closing{margin:2.5mm 0 0;text-align:justify;font-size:10pt;line-height:1.25}
.bast-signatures{margin-top:4mm}
.bast-signatures .signature-space{height:25mm}
.signature-name{font-size:10pt;font-weight:700;text-decoration:underline;white-space:nowrap}
@media print{
  body{background:#fff}
  .sheet{margin:0;box-shadow:none;min-height:0}
  .signature-grid{break-inside:avoid}
}
`;

function buildPrintHtml(doc,escapeHtml,logoUrl){
  const snapshot=doc.snapshot_json||{};
  const kind=doc.jenis==="BAST"?"BAST":"SJ";
  const body=kind==="BAST"
    ?buildBast(snapshot,doc,logoUrl,escapeHtml)
    :buildSuratJalan(snapshot,doc,logoUrl,escapeHtml);
  return "<!doctype html><html lang='id'><head><meta charset='utf-8'><meta name='viewport' content='width=device-width,initial-scale=1'><title>"+
    safe(escapeHtml,doc.nomor_lengkap)+"</title><style>"+PRINT_STYLES+"</style></head><body>"+body+"</body></html>";
}

window.AutoDocPrintRenderer=Object.freeze({buildPrintHtml,formatDateParts});
})();
