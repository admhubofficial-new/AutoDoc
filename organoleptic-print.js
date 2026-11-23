(() => {
"use strict";
function organolepticElement(doc,tag,className,text){
 const element=doc.createElement(tag);
 if(className)element.className=className;
 if(text!==undefined)element.textContent=String(text??"");
 return element;
}
function organolepticInfoRow(doc,parent,label,valueNode){
 parent.append(organolepticElement(doc,"span","lbl",label),organolepticElement(doc,"span","sep",":"),valueNode);
}
function organolepticMealNode(doc,selected){
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
 table.append(colgroup);
 const thead=doc.createElement("thead"),first=doc.createElement("tr"),second=doc.createElement("tr");
 const menuHead=organolepticElement(doc,"th","","Menu");
 menuHead.rowSpan=2;menuHead.scope="col";first.append(menuHead);
 ["Aroma","Suhu","Penampilan","Citarasa","Tekstur"].forEach(aspect=>{
  const head=organolepticElement(doc,"th","",aspect);head.colSpan=2;head.scope="colgroup";first.append(head);
  const yes=organolepticElement(doc,"th","","Ya");yes.scope="col";
  const no=organolepticElement(doc,"th","","Tidak");no.scope="col";
  second.append(yes,no);
 });
 thead.append(first,second);
 const tbody=doc.createElement("tbody");
 const rows=menu.length?menu.slice(0,8):Array(5).fill("");
 rows.forEach(name=>{
  const row=doc.createElement("tr"),heading=organolepticElement(doc,"th","",name);
  heading.scope="row";row.append(heading);
  for(let i=0;i<10;i++)row.append(doc.createElement("td"));
  tbody.append(row);
 });
 table.append(thead,tbody);
 return table;
}
function organolepticSheet(doc,data,recipient){
 const sheet=organolepticElement(doc,"section","sheet");
 sheet.append(organolepticElement(doc,"h1","title","FORMULIR UJI ORGANOLEPTIK"));
 const info=organolepticElement(doc,"div","info");
 organolepticInfoRow(doc,info,recipient.kelompok==="Posyandu"?"Nama Posyandu":"Nama Sekolah",organolepticElement(doc,"span","val",recipient.nama||""));
 organolepticInfoRow(doc,info,"Hari/Tanggal",organolepticElement(doc,"span","val",data.tanggalLabel));
 organolepticInfoRow(doc,info,"Waktu Makan",organolepticMealNode(doc,data.waktuMakan));
 sheet.append(info);
 sheet.append(organolepticElement(doc,"p","caption","Beri tanda check (✓) pada kolom Ya/Tidak"));
 sheet.append(organolepticTable(doc,data.menu));
 const note=organolepticElement(doc,"div","note");
 note.append(organolepticElement(doc,"p","","Keterangan:"));
 const yes=organolepticElement(doc,"div","row");
 yes.append(organolepticElement(doc,"span","","Ya"),organolepticElement(doc,"span","",": dapat diterima/sesuai"));
 const no=organolepticElement(doc,"div","row");
 no.append(organolepticElement(doc,"span","","Tidak"),organolepticElement(doc,"span","",": tidak dapat diterima/tidak sesuai, lanjutkan ke kolom bawah!"));
 note.append(yes,no);sheet.append(note);
 sheet.append(organolepticElement(doc,"div","followup","Tindak Lanjut:"));
 const signs=organolepticElement(doc,"div","signs");
 const left=organolepticElement(doc,"div","sign");
 const leftHeading=organolepticElement(doc,"div","sign-heading");leftHeading.append(organolepticElement(doc,"div","","Mengetahui,"),organolepticElement(doc,"div","","Ahli Gizi Dapur"));
 left.append(leftHeading,organolepticElement(doc,"div","space"),organolepticElement(doc,"div","sign-person",data.ahliGizi||""),organolepticElement(doc,"div","sign-line"));
 const right=organolepticElement(doc,"div","sign");
 const rightHeading=organolepticElement(doc,"div","sign-heading");rightHeading.append(organolepticElement(doc,"div","","Petugas Uji Organoleptik"));
 right.append(rightHeading,organolepticElement(doc,"div","space"),organolepticElement(doc,"div","sign-person",""),organolepticElement(doc,"div","sign-line"));
 signs.append(left,right);sheet.append(signs);
 return sheet;
}

window.AutoDocOrganolepticPrint = Object.freeze({
 organolepticElement,
 organolepticInfoRow,
 organolepticMealNode,
 organolepticTable,
 organolepticSheet
});
})();
