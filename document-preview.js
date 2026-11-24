(() => {
"use strict";
function create(dependencies){
 const { $, esc, getModal, getMaster, readMenuComponents, readMenuComponentsForRecipient, selectedDocumentKinds, today, logoUrl } = dependencies;
 let boundDisclosure=null;
 window.addEventListener("resize",fitPreviewFrame);
 function bindPreviewDisclosure(){
  const disclosure=$("#docsPreviewDisclosure",getModal());
  if(!disclosure||disclosure===boundDisclosure)return;
  boundDisclosure=disclosure;
  disclosure.addEventListener("toggle",fitPreviewFrame);
 }
 function previewPortionRows(recipient){
 const definitions=[["siswa_kecil","Siswa kecil","Porsi Kecil"],["balita","Balita","Porsi Kecil"],["siswa_besar","Siswa besar","Porsi Besar"],["tendik","Tenaga pendidik","Porsi Besar"],["ibu_hamil","Ibu hamil","Porsi Besar"],["ibu_menyusui","Ibu menyusui","Porsi Besar"],["putus_sekolah","Anak putus sekolah","Porsi Besar"],["kader","Kader","Porsi Besar"]];
 return definitions.flatMap(([key,label,jenis])=>{const jumlah=Number(recipient?.[key]||0);return jumlah>0?[{kelompok_sasaran:label,jenis_porsi:jenis,jumlah}]:[]});
}
function fitPreviewFrame(){
 const frame=$("#docsPreviewFrame",getModal()),host=frame?.parentElement;
 if(!frame||!host||!frame.contentDocument?.body||!frame.getClientRects().length||!host.clientWidth)return;
 const scale=Math.min(1,Math.max(.25,host.clientWidth/794));
 const body=frame.contentDocument.body;
 body.style.width="794px";body.style.minHeight="1123px";body.style.margin="0";body.style.padding="0";body.style.boxSizing="border-box";body.style.background="#fff";
 body.style.transformOrigin="top left";body.style.transform="scale("+scale+")";
 frame.style.height=Math.ceil(1123*scale)+"px";
}
function renderOrganolepticPreview(frame,recipient,date,menu,settings){
 const renderer=window.AutoDocOrganolepticPrint;
 if(!renderer?.organolepticSheet)return;
 const css=renderer.styles;
 const dateLabel=/^\d{4}-\d{2}-\d{2}$/.test(date)?new Intl.DateTimeFormat("id-ID",{weekday:"long",day:"2-digit",month:"long",year:"numeric"}).format(new Date(date+"T00:00:00")):date;
 frame.onload=()=>{
  const doc=frame.contentDocument;if(!doc)return;
  doc.body.dataset.previewType="organoleptic";
  doc.body.classList.add("preview-mode");
  doc.body.style.width="794px";doc.body.style.minHeight="1123px";doc.body.style.margin="0";doc.body.style.padding="0";doc.body.style.background="#fff";
  const root=doc.getElementById("previewRoot");
  root.append(renderer.organolepticSheet(doc,{tanggalLabel:dateLabel,waktuMakan:$("#docsMealTime",getModal())?.value||"siang",ahliGizi:String(settings.nama_ahli_gizi||""),menu},recipient));
  fitPreviewFrame();
 };
 frame.srcdoc="<!doctype html><html lang='id'><head><meta charset='utf-8'><style>"+css+"</style></head><body class='preview-mode' data-preview-type='organoleptic'><main id='previewRoot'></main></body></html>";
}
function updateLivePreview(){
 if(!getModal()||!$("#docsPreviewFrame",getModal()))return;
 bindPreviewDisclosure();
 const form=$("#docsCreateForm",getModal());if(!form)return;
 const selected=Array.from(form.querySelectorAll("input[name='recipient']:checked"));
 const recipients=Array.isArray(getMaster().recipients)?getMaster().recipients:[];
 const recipientSelect=$("#docsPreviewRecipientSelect",getModal()),previousRecipient=recipientSelect?.value||"";
 const selectedRecipients=selected.map(input=>recipients.find(item=>String(item.id)===input.value)).filter(Boolean);
 if(recipientSelect){
  recipientSelect.innerHTML=selectedRecipients.length?selectedRecipients.map(item=>"<option value='"+esc(item.id)+"'>"+esc(item.nama)+"</option>").join(""):"<option value=''>Pilih penerima</option>";
  if(selectedRecipients.some(item=>String(item.id)===previousRecipient))recipientSelect.value=previousRecipient;
 }
 const kindSelect=$("#docsPreviewKind",getModal()),currentKind=kindSelect?.value||"SJ";
 const includeOrganoleptic=$("#docsIncludeOrganoleptic",form)?.checked===true;
 const kinds=selectedDocumentKinds();
 const available=[...kinds,...(includeOrganoleptic?["ORGANOLEPTIC"]:[])];
 const kind=available.includes(currentKind)?currentKind:(available[0]||"SJ");
 if(kindSelect){kindSelect.value=kind;Array.from(kindSelect.options).forEach(option=>{option.disabled=!available.includes(option.value)});}
 const date=$("#docsDate",form)?.value||today();
 const frame=$("#docsPreviewFrame",getModal());
 const label=$("#docsPreviewRecipient",getModal());
 if(!selected.length){
  if(label)label.textContent="Belum ada penerima dipilih.";
  frame.onload=null;
  frame.srcdoc="<!doctype html><html lang='id'><head><meta charset='utf-8'><style>*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;padding:32px;background:#fff;color:#647269;font:14px/1.6 Inter,Arial,sans-serif;text-align:center}main{max-width:420px}h2{margin:0 0 8px;color:#1f2a23;font-size:19px}p{margin:0}</style></head><body><main><h2>Pratinjau belum tersedia</h2><p>Pilih penerima pada formulir untuk melihat dokumen dengan data sebenarnya.</p></main></body></html>";
  return;
 }
 const recipient=selectedRecipients.find(item=>String(item.id)===(recipientSelect?.value||selected[0].value))||selectedRecipients[0]||{};
 const settings=Array.isArray(getMaster().settings)?(getMaster().settings[0]||{}):(getMaster().settings||{});
 const menu=typeof readMenuComponentsForRecipient==="function"?readMenuComponentsForRecipient(recipient.id,date):readMenuComponents();
 if(label)label.textContent=recipient.nama||"Penerima terpilih";
 if(kind==="ORGANOLEPTIC"){
  renderOrganolepticPreview(frame,recipient,date,menu,settings);
  return;
 }
 const snapshot={
  sppg:settings,
  distribusi:{tanggal:date,jam_berangkat:$("#docsTime",form)?.value||"",menu:menu.join(", "),nama_petugas:$("#docsStaff",form)?.value||"",nama_pengemudi:$("#docsDriver",form)?.value||"",no_kendaraan:$("#docsVehicle",form)?.value||""},
  penerima:recipient,rincian_porsi:previewPortionRows(recipient),
  ringkasan:{porsi_kecil:Number(recipient.porsi_kecil||0),porsi_besar:Number(recipient.porsi_besar||0),total_porsi:Number(recipient.total_porsi||0)}
 };
 const doc={jenis:kind,nomor_lengkap:"PRATINJAU",snapshot_json:snapshot,created_at:"Pratinjau langsung"};
 const renderer=window.AutoDocPrintRenderer;if(!renderer?.buildPrintHtml)return;
 let html=renderer.buildPrintHtml(doc,esc,logoUrl());
 html=html.replace("</style>","body.preview-mode{background:#fff!important}.preview-ribbon{position:absolute;top:12px;right:16px;padding:4px 8px;border:1px solid #d6dfd6;border-radius:4px;color:#56705e;background:#f4f8f3;font:700 9px Arial;letter-spacing:.7px;z-index:2}</style>");
 html=html.replace("<body>","<body class='preview-mode'><div class='preview-ribbon'>PRATINJAU · BELUM DITERBITKAN</div>");
 frame.onload=()=>fitPreviewFrame();frame.srcdoc=html;
}



 return Object.freeze({updateLivePreview,fitPreviewFrame});
}
window.AutoDocDocumentPreview=Object.freeze({create});
})();
