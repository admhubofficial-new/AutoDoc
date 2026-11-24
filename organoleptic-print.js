(() => {
"use strict";

const STYLES=`
@page{size:A4 portrait;margin:0}
*{box-sizing:border-box}
html,body{margin:0;padding:0}
html{-webkit-print-color-adjust:exact;print-color-adjust:exact}
body{background:#e8ebe9;color:#000;font-family:"Times New Roman","Liberation Serif",Times,serif;font-size:10pt;line-height:1.35}
.print-toolbar{position:sticky;top:0;z-index:5;display:flex;align-items:center;justify-content:space-between;gap:16px;padding:10px 20px;background:#14201a;color:#fff;font-family:Arial,Helvetica,sans-serif;font-size:14px}
.print-toolbar button{height:36px;padding:0 18px;border:0;border-radius:8px;background:#fff;color:#14201a;font:inherit;font-weight:600;cursor:pointer}
.print-toolbar button:focus-visible{outline:3px solid #9fd3b8;outline-offset:2px}
.sheet{display:flex;width:210mm;height:297mm;min-height:297mm;margin:18px auto;padding:15mm 20mm;background:#fff;box-shadow:0 1px 6px rgba(0,0,0,.18);flex-direction:column;break-after:page;page-break-after:always}
.sheet:last-of-type{break-after:auto;page-break-after:auto}
.sheet-title{margin:4mm 0 0;text-align:center;font-size:13pt;line-height:1.2;font-weight:700}
.sheet-number{margin:1.5mm 0 8mm;text-align:center;font-size:11pt;line-height:1.2}
.sheet-number strong{font-weight:700}
.info{display:grid;grid-template-columns:34mm 4mm minmax(0,1fr);row-gap:1mm;margin:0 0 0;font-size:12pt;line-height:1.35}
.info .lbl{white-space:nowrap}
.info .sep{text-align:center}
.info .val{font-weight:400;overflow-wrap:anywhere}
.caption{margin:14mm 0 1.5mm;text-align:center;font-size:10pt;line-height:1.25;font-weight:700}
table.grid{width:100%;border-collapse:collapse;table-layout:fixed;font-size:10.5pt;line-height:1.2}
table.grid col.menu{width:25.3%}
table.grid col.aspect{width:7.47%}
table.grid th,table.grid td{height:auto;border:1px solid #000;padding:1.5mm .8mm;text-align:center;vertical-align:middle}
table.grid thead th{font-weight:700}
table.grid thead tr:first-child th{font-size:10.5pt}
table.grid thead tr+tr th{font-size:10.5pt;padding:1.3mm .5mm}
table.grid tbody tr{height:10mm}
table.grid tbody th{padding:1.5mm 2mm;text-align:left;font-size:10.5pt;font-weight:400}
table.grid tbody td{height:10mm}
.note{margin:3mm 0 0;font-size:10pt;line-height:1.3}
.note p{margin:0}
.note .row{display:grid;grid-template-columns:12mm minmax(0,1fr)}
.followup{height:60mm;min-height:60mm;margin-top:3mm;padding:2.5mm 3mm;border:1px solid #000;font-size:12pt;font-weight:700;flex:none}
.signs{display:flex;justify-content:space-between;gap:18mm;margin-top:8mm;font-size:11.5pt;line-height:1.25}
.sign{display:flex;width:72mm;min-width:0;flex-direction:column;text-align:center}
.sign-heading{height:10mm;display:flex;flex-direction:column;justify-content:flex-start}
.sign .space{height:22mm;flex:none}
.sign .sign-line{width:82%;height:1px;flex:none;margin:0 auto;border-bottom:1px solid #000}
.sign-person{height:5mm;flex:none;padding-top:0;font-size:10.5pt;white-space:nowrap}
.sign-person.named{text-decoration:underline}
.sheet[data-menu-count="6"] table.grid tbody tr,
.sheet[data-menu-count="7"] table.grid tbody tr,
.sheet[data-menu-count="8"] table.grid tbody tr{height:7.5mm}
.sheet[data-menu-count="6"] table.grid tbody td,
.sheet[data-menu-count="7"] table.grid tbody td,
.sheet[data-menu-count="8"] table.grid tbody td{height:7.5mm}
body.preview-mode{background:#fff}
body.preview-mode .sheet{margin:0;box-shadow:none}
@media print{
  body{background:#fff}
  .print-toolbar{display:none}
  .sheet{margin:0;box-shadow:none}
}
`;

function organolepticElement(doc,tag,className,text){
 const element=doc.createElement(tag);
 if(className)element.className=className;
 if(text!==undefined)element.textContent=String(text??"");
 return element;
}

function organolepticInfoRow(doc,parent,label,valueNode){
 parent.append(
  organolepticElement(doc,"span","lbl",label),
  organolepticElement(doc,"span","sep",":"),
  valueNode
 );
}

function organolepticMealNode(doc){
 const wrap=organolepticElement(doc,"span","val");
 ["Pagi","Siang","Sore"].forEach((meal,index)=>{
  if(index)wrap.append(doc.createTextNode("/"));
  wrap.append(doc.createTextNode(meal));
 });
 return wrap;
}

function organolepticTable(doc,menu){
 const table=organolepticElement(doc,"table","grid");
 const colgroup=doc.createElement("colgroup");
 colgroup.append(organolepticElement(doc,"col","menu"));
 for(let i=0;i<10;i++)colgroup.append(organolepticElement(doc,"col","aspect"));
 table.append(colgroup);

 const thead=doc.createElement("thead");
 const first=doc.createElement("tr");
 const second=doc.createElement("tr");
 const menuHead=organolepticElement(doc,"th","","Menu");
 menuHead.rowSpan=2;
 menuHead.scope="col";
 first.append(menuHead);

 ["Aroma","Suhu","Penampilan","Citarasa","Tekstur"].forEach(aspect=>{
  const heading=organolepticElement(doc,"th","",aspect);
  heading.colSpan=2;
  heading.scope="colgroup";
  first.append(heading);
  const yes=organolepticElement(doc,"th","","Ya");
  yes.scope="col";
  const no=organolepticElement(doc,"th","","Tidak");
  no.scope="col";
  second.append(yes,no);
 });
 thead.append(first,second);

 const tbody=doc.createElement("tbody");
 const menuRows=Array.isArray(menu)?menu.slice(0,8).map(value=>String(value??"").trim()):[];
 while(menuRows.length<5)menuRows.push("");
 menuRows.forEach(name=>{
  const row=doc.createElement("tr");
  const heading=organolepticElement(doc,"th","",name);
  heading.scope="row";
  row.append(heading);
  for(let i=0;i<10;i++)row.append(doc.createElement("td"));
  tbody.append(row);
 });
 table.append(thead,tbody);
 table.dataset.menuCount=String(menuRows.length);
 return table;
}

function organolepticSheet(doc,data,recipient){
 const sheet=organolepticElement(doc,"section","sheet");
 const menu=Array.isArray(data.menu)?data.menu.slice(0,8):[];
 sheet.dataset.menuCount=String(Math.max(5,menu.length));
 sheet.append(organolepticElement(doc,"h1","sheet-title","FORMULIR UJI ORGANOLEPTIK"));
  if(data.nomor)sheet.append(organolepticElement(doc,"p","sheet-number","Nomor: "+data.nomor));

 const info=organolepticElement(doc,"div","info");
 organolepticInfoRow(doc,info,recipient.kelompok==="Posyandu"?"Nama Posyandu":"Nama Sekolah",organolepticElement(doc,"span","val",recipient.nama||""));
 organolepticInfoRow(doc,info,"Hari/Tanggal",organolepticElement(doc,"span","val",data.tanggalLabel||""));
 organolepticInfoRow(doc,info,"Waktu Makan",organolepticMealNode(doc));
 sheet.append(info);
 sheet.append(organolepticElement(doc,"p","caption","Beri tanda check (✓) pada kolom Ya/Tidak"));
 sheet.append(organolepticTable(doc,menu));

 const note=organolepticElement(doc,"div","note");
 note.append(organolepticElement(doc,"p","","Keterangan:"));
 const yes=organolepticElement(doc,"div","row");
 yes.append(organolepticElement(doc,"span","","Ya"),organolepticElement(doc,"span","",": dapat diterima/sesuai"));
 const no=organolepticElement(doc,"div","row");
 no.append(organolepticElement(doc,"span","","Tidak"),organolepticElement(doc,"span","",": tidak dapat diterima/tidak sesuai, lanjutkan ke kolom bawah!"));
 note.append(yes,no);
 sheet.append(note);

 sheet.append(organolepticElement(doc,"div","followup","Tindak Lanjut:"));
 const signs=organolepticElement(doc,"div","signs");
 const left=organolepticElement(doc,"div","sign");
 const leftHeading=organolepticElement(doc,"div","sign-heading");
 leftHeading.append(organolepticElement(doc,"div","","Mengetahui,"),organolepticElement(doc,"div","","Ahli Gizi Dapur"));
 left.append(leftHeading,organolepticElement(doc,"div","space"),
  organolepticElement(doc,"div","sign-person named",data.ahliGizi||"Putri Baitissa'diyah, S.Gz"));
 const right=organolepticElement(doc,"div","sign");
 const rightHeading=organolepticElement(doc,"div","sign-heading");
 rightHeading.append(organolepticElement(doc,"div","","Petugas Uji Organoleptik"));
 right.append(rightHeading,organolepticElement(doc,"div","space"),
  organolepticElement(doc,"div","sign-person","........................................."));
 signs.append(left,right);
 sheet.append(signs);
 return sheet;
}

window.AutoDocOrganolepticPrint=Object.freeze({
 styles:STYLES,
 organolepticElement,
 organolepticInfoRow,
 organolepticMealNode,
 organolepticTable,
 organolepticSheet
});
})();
