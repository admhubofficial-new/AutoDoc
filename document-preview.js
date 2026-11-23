(() => {
"use strict";
function create(dependencies){
 const { $, esc, getModal, getMaster, readMenuComponents, readMenuComponentsForRecipient, selectedDocumentKinds, today, logoUrl } = dependencies;
 window.addEventListener("resize",fitPreviewFrame);
 function previewPortionRows(recipient){
 const definitions=[["siswa_kecil","Siswa kecil","Porsi Kecil"],["balita","Balita","Porsi Kecil"],["siswa_besar","Siswa besar","Porsi Besar"],["tendik","Tenaga pendidik","Porsi Besar"],["ibu_hamil","Ibu hamil","Porsi Besar"],["ibu_menyusui","Ibu menyusui","Porsi Besar"],["putus_sekolah","Anak putus sekolah","Porsi Besar"],["kader","Kader","Porsi Besar"]];
 return definitions.flatMap(([key,label,jenis])=>{const jumlah=Number(recipient?.[key]||0);return jumlah>0?[{kelompok_sasaran:label,jenis_porsi:jenis,jumlah}]:[]});
}
function fitPreviewFrame(){
 const frame=$("#docsPreviewFrame",getModal()),host=frame?.parentElement;
 if(!frame||!host||!frame.contentDocument?.body)return;
 const scale=Math.min(1,Math.max(.25,host.clientWidth/794));
 const body=frame.contentDocument.body;
 body.style.width="794px";body.style.minHeight="1123px";body.style.margin="0";body.style.padding=body.dataset.previewType==="organoleptic"?"0":"60px";body.style.boxSizing="border-box";
 body.style.transformOrigin="top left";body.style.transform="scale("+scale+")";
 frame.style.height=Math.ceil(1123*scale)+"px";
}
function renderOrganolepticPreview(frame,recipient,date,menu,settings){
 const renderer=window.AutoDocOrganolepticPrint;
 if(!renderer?.organolepticSheet)return;
 const css="*{box-sizing:border-box}body{margin:0;background:#fff;color:#000;font-family:'Times New Roman',Times,serif;font-size:12pt;line-height:1.35}.sheet{width:210mm;height:297mm;margin:0;padding:15mm;background:#fff;display:flex;flex-direction:column}.title{margin:4mm 0 8mm;text-align:center;font-size:13pt;font-weight:700}.info{display:grid;grid-template-columns:34mm 4mm 1fr;row-gap:1mm;margin-bottom:6mm}.info .val{font-weight:400}.caption{margin:0 0 1.5mm;text-align:center;font-weight:700;font-size:11.5pt}table.grid{width:100%;border-collapse:collapse;table-layout:fixed}table.grid th,table.grid td{border:1px solid #000;padding:1.5mm;text-align:center}table.grid thead th{font-weight:700;font-size:11.5pt}table.grid col.menu{width:28%}table.grid thead tr+tr th{font-size:10.5pt;padding:1.5mm .5mm}table.grid tbody td{height:10mm}table.grid tbody th{font-weight:700;font-size:11.5pt;padding:1.5mm 2mm}.note{margin:5mm 0 4mm;font-size:11.5pt}.note p{margin:0}.note .row{display:grid;grid-template-columns:14mm 1fr}.followup{flex:1 1 auto;min-height:50mm;border:1px solid #000;padding:3mm 4mm;font-weight:700}.signs{display:flex;justify-content:space-between;gap:18mm;margin-top:8mm;font-size:11.5pt}.sign{width:72mm;text-align:center}.sign .space{height:22mm}.sign .sign-line{width:82%;height:1px;margin:0 auto;border-bottom:1px solid #000}.sign .sign-person{min-height:5mm;padding-top:1mm;font-size:10.5pt}";
 const dateLabel=/^\d{4}-\d{2}-\d{2}$/.test(date)?new Intl.DateTimeFormat("id-ID",{weekday:"long",day:"2-digit",month:"long",year:"numeric"}).format(new Date(date+"T00:00:00")):date;
 frame.onload=()=>{
  const doc=frame.contentDocument;if(!doc)return;
  doc.body.dataset.previewType="organoleptic";
  doc.body.style.width="794px";doc.body.style.margin="0";doc.body.style.padding="0";
  const root=doc.getElementById("previewRoot");
  root.append(renderer.organolepticSheet(doc,{tanggalLabel:dateLabel,waktuMakan:$("#docsMealTime",getModal())?.value||"siang",ahliGizi:String(settings.nama_ahli_gizi||""),menu},recipient));
  fitPreviewFrame();
 };
 frame.srcdoc="<!doctype html><html lang='id'><head><meta charset='utf-8'><style>"+css+"</style></head><body data-preview-type='organoleptic'><main id='previewRoot'></main></body></html>";
}
function updateLivePreview(){
 if(!getModal()||!$("#docsPreviewFrame",getModal()))return;
 const form=$("#docsCreateForm",getModal());if(!form)return;
 const selected=Array.from(form.querySelectorAll("input[name='recipient']:checked"));
 const recipients=Array.isArray(getMaster().recipients)?getMaster().recipients:[];
 const recipientSelect=$("#docsPreviewRecipientSelect",getModal()),previousRecipient=recipientSelect?.value||"";
 if(recipientSelect){
  const selectedRecipients=selected.map(input=>recipients.find(item=>String(item.id)===input.value)).filter(Boolean);
  recipientSelect.innerHTML=selectedRecipients.length?selectedRecipients.map(item=>"<option value='"+esc(item.id)+"'>"+esc(item.nama)+"</option>").join(""):"<option value=''>Pilih penerima</option>";
  if(selectedRecipients.some(item=>String(item.id)===previousRecipient))recipientSelect.value=previousRecipient;
 }
 const recipient=selected.length?recipients.find(item=>String(item.id)===(recipientSelect?.value||selected[0].value)):null;
 const fallback=recipient||recipients[0]||{};
 const settings=Array.isArray(getMaster().settings)?(getMaster().settings[0]||{}):(getMaster().settings||{});
 const dateValue=$("#docsDate",form)?.value||today();
 const menu=typeof readMenuComponentsForRecipient==="function"?readMenuComponentsForRecipient(fallback.id,dateValue):readMenuComponents(),kinds=selectedDocumentKinds();
 const includeOrganoleptic=$("#docsIncludeOrganoleptic",form)?.checked===true;
 const available=[...kinds,...(includeOrganoleptic?["ORGANOLEPTIC"]:[])];
 const kindSelect=$("#docsPreviewKind",getModal()),currentKind=kindSelect?.value||"SJ";
 const kind=available.includes(currentKind)?currentKind:(available[0]||"SJ");
 if(kindSelect){kindSelect.value=kind;Array.from(kindSelect.options).forEach(option=>{option.disabled=!available.includes(option.value)});}
 const date=dateValue,frame=$("#docsPreviewFrame",getModal());
 const label=$("#docsPreviewRecipient",getModal());
 if(label)label.textContent=selected.length?(recipient?.nama||"Penerima terpilih"):"Contoh tampilan · pilih penerima untuk data sebenarnya";
 const count=$("#docsSubmitCount",getModal());if(count)count.textContent=selected.length+" penerima dipilih";
 const button=$("#docsCreateButton",getModal());if(button)button.disabled=!selected.length||!kinds.length;
 if(kind==="ORGANOLEPTIC"){
  renderOrganolepticPreview(frame,fallback,date,menu,settings);
  return;
 }
 const snapshot={
  sppg:settings,
  distribusi:{tanggal:date,jam_berangkat:$("#docsTime",form)?.value||"",menu:menu.join(", "),nama_petugas:$("#docsStaff",form)?.value||"",nama_pengemudi:$("#docsDriver",form)?.value||"",no_kendaraan:$("#docsVehicle",form)?.value||""},
  penerima:fallback,rincian_porsi:previewPortionRows(fallback),
  ringkasan:{porsi_kecil:Number(fallback.porsi_kecil||0),porsi_besar:Number(fallback.porsi_besar||0),total_porsi:Number(fallback.total_porsi||0)}
 };
 const doc={jenis:kind,nomor_lengkap:"PRATINJAU",snapshot_json:snapshot,created_at:"Pratinjau langsung"};
 const renderer=window.AutoDocPrintRenderer;if(!renderer?.buildPrintHtml)return;
 let html=renderer.buildPrintHtml(doc,esc,logoUrl());
 html=html.replace("</style>","@page{margin:0}html,body{margin:0!important;background:#fff!important}.preview-ribbon{position:absolute;top:12px;right:16px;padding:4px 8px;border:1px solid #d6dfd6;border-radius:4px;color:#56705e;background:#f4f8f3;font:700 9px Arial;letter-spacing:.7px}</style>");
 html=html.replace("<body>","<body><div class='preview-ribbon'>PRATINJAU · BELUM DITERBITKAN</div>");
 frame.onload=()=>fitPreviewFrame();frame.srcdoc=html;
}

 return Object.freeze({updateLivePreview,fitPreviewFrame});
}
window.AutoDocDocumentPreview=Object.freeze({create});
})();
