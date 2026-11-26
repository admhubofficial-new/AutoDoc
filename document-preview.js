(() => {
"use strict";
function create(dependencies){
 const { $, esc, getModal, getMaster, api, readMenuComponents, selectedDocumentKinds, today, logoUrl } = dependencies;
 let numberDate="", numberContext=null, numberRequest=0;
 function loadNumbers(date){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||date===numberDate)return;
  numberDate=date;
  numberContext=null;
  const request=++numberRequest;
  Promise.all([api("master/list?preview=true"),api("docs/list?tanggal="+encodeURIComponent(date)+"&preview=true")]).then(([master,history])=>{
   if(request!==numberRequest)return;
   numberContext={counters:master.data?.numbering||[],existing:history.documents||[]};
   updateLivePreview();
  }).catch(()=>{});
 }
 window.addEventListener("autodoc:data-changed",()=>{numberDate="";numberContext=null;updateLivePreview()});
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
 getModal()?.querySelectorAll("#docsPreviewPages iframe[data-document-page]").forEach(fitPage);
}
function fitPage(frame){
 const host=frame.parentElement;
 if(!frame||!host||!frame.contentDocument?.body||!frame.getClientRects().length||!host.clientWidth)return;
 const scale=Math.min(1,host.clientWidth/794);
 const doc=frame.contentDocument;
 const body=doc.body;
 doc.documentElement.style.overflow="hidden";
 body.style.overflow="hidden";
 body.style.width="794px";
 body.style.minHeight="1123px";
 body.style.margin="0";
 body.style.padding="0";
 body.style.boxSizing="border-box";
 body.style.transformOrigin="top left";
 body.style.transform="scale("+scale+")";
 frame.style.height=Math.ceil(Math.max(1123,body.scrollHeight)*scale)+"px";
}
function renderOrganolepticPreview(frame,recipient,date,menu,settings,number){
 const renderer=window.AutoDocOrganolepticPrint;
 if(!renderer?.organolepticSheet)return;
 const css=renderer.styles+"body{background:#fff}.sheet{margin:0;box-shadow:none}";
 const dateLabel=/^\d{4}-\d{2}-\d{2}$/.test(date)?new Intl.DateTimeFormat("id-ID",{weekday:"long",day:"2-digit",month:"long",year:"numeric"}).format(new Date(date+"T00:00:00")):date;
 frame.onload=()=>{
  const doc=frame.contentDocument;if(!doc)return;
  doc.body.dataset.previewType="organoleptic";
  doc.body.style.width="794px";doc.body.style.margin="0";doc.body.style.padding="0";
  const root=doc.getElementById("previewRoot");
  root.append(renderer.organolepticSheet(doc,{tanggalLabel:dateLabel,nomor:number,waktuMakan:$("#docsMealTime",getModal())?.value||"siang",ahliGizi:String(settings.nama_ahli_gizi||""),menu},recipient));
  fitPage(frame);
 };
 frame.srcdoc="<!doctype html><html lang='id'><head><meta charset='utf-8'><style>"+css+"</style></head><body data-preview-type='organoleptic'><main id='previewRoot'></main></body></html>";
}
function updateLivePreview(){
 const pages=$("#docsPreviewPages",getModal());
 if(!pages)return;
 bindPreviewDisclosure();
 const form=$("#docsCreateForm",getModal());if(!form)return;
 const selected=new Set(Array.from(form.querySelectorAll("input[name='recipient']:checked"),input=>input.value));
 const recipients=(getMaster().recipients||[]).filter(item=>selected.has(String(item.id)));
 const kindSelect=$("#docsPreviewKind",getModal()),currentKind=kindSelect?.value||"SJ";
 const includeOrganoleptic=$("#docsIncludeOrganoleptic",form)?.checked===true;
 const kinds=selectedDocumentKinds();
 const available=[...kinds,...(includeOrganoleptic?["ORGANOLEPTIC"]:[])];
 const kind=available.includes(currentKind)?currentKind:(available[0]||"SJ");
 if(kindSelect){kindSelect.value=kind;Array.from(kindSelect.options).forEach(option=>{option.disabled=!available.includes(option.value)});}
 for(const button of getModal().querySelectorAll("[data-preview-kind]")){
  button.disabled=!available.includes(button.dataset.previewKind);
  button.setAttribute("aria-pressed",String(button.dataset.previewKind===kind && !button.disabled));
 }
 const date=$("#docsDate",form)?.value||today();
 if(recipients.length)loadNumbers(date);
 const existing=new Map((numberContext?.existing||[]).map(doc=>[doc.jenis+":"+String(doc.recipient_id||doc.snapshot_json?.penerima?.id),doc]));
 const next=Object.fromEntries((numberContext?.counters||[]).filter(row=>row.locked).map(row=>[row.jenis,Number(row.next_number)]));
 const month=["I","II","III","IV","V","VI","VII","VIII","IX","X","XI","XII"][Number(date.slice(5,7))-1];
 const previewStatus=$("#docsPreviewNumberStatus",getModal());
 if(previewStatus)previewStatus.textContent=recipients.length?"Nomor baru mengikuti urutan saat diterbitkan.":"";
 pages.replaceChildren();
 const makeFrame=(title)=>{
  const paper=document.createElement("div");
  paper.className="docs-preview-paper";
  const frame=document.createElement("iframe");
  if(!pages.children.length)frame.id="docsPreviewFrame";
  frame.title=title;
  frame.setAttribute("scrolling","no");
  paper.append(frame);
  pages.append(paper);
  return frame;
 };
 if(!recipients.length){
  const frame=makeFrame("Pratinjau belum tersedia");
  frame.style.height="220px";
  frame.srcdoc="<!doctype html><html lang='id'><head><meta charset='utf-8'><style>*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;padding:32px;background:#fff;color:#647269;font:14px/1.6 Inter,Arial,sans-serif;text-align:center}main{max-width:420px}h2{margin:0 0 8px;color:#1f2a23;font-size:19px}p{margin:0}</style></head><body><main><h2>Pratinjau belum tersedia</h2><p>Pilih penerima pada formulir untuk melihat dokumen dengan data sebenarnya.</p></main></body></html>";
  return;
 }
 for(const recipient of recipients){
 const frame=makeFrame("Pratinjau "+recipient.nama);
 frame.dataset.documentPage="";
 if(pages.children.length>1)frame.loading="lazy";
 frame.style.aspectRatio="794 / 1123";
 const settings=Array.isArray(getMaster().settings)?(getMaster().settings[0]||{}):(getMaster().settings||{});
 const menu=readMenuComponents();
 const issueKind=kind==="ORGANOLEPTIC"?"SJ":kind;
 const issued=existing.get(issueKind+":"+String(recipient.id));
 let number=issued?.nomor_lengkap||"";
 if(!number&&kinds.includes(issueKind)&&month&&settings.kode_sppg&&Number.isSafeInteger(next[issueKind])&&next[issueKind]>0){
  number=String(next[issueKind]++).padStart(3,"0")+"/"+issueKind+"/"+settings.kode_sppg+"/"+month+"/"+date.slice(0,4);
 }
 if(kind==="ORGANOLEPTIC"){
  renderOrganolepticPreview(frame,recipient,date,menu,settings,number.replace(/\/SJ\//i,"/ORG/"));
  continue;
 }
 const snapshot={
  sppg:settings,
  distribusi:{tanggal:date,jam_berangkat:$("#docsTime",form)?.value||"",menu:menu.join(", "),nama_petugas:$("#docsStaff",form)?.value||"",nama_pengemudi:$("#docsDriver",form)?.value||"",no_kendaraan:$("#docsVehicle",form)?.value||""},
  penerima:recipient,rincian_porsi:previewPortionRows(recipient),
  ringkasan:{porsi_kecil:Number(recipient.porsi_kecil||0),porsi_besar:Number(recipient.porsi_besar||0),total_porsi:Number(recipient.total_porsi||0)}
 };
 const doc=issued||{jenis:kind,nomor_lengkap:number,snapshot_json:snapshot};
 const renderer=window.AutoDocPrintRenderer;if(!renderer?.buildPrintHtml)return;
 let html=renderer.buildPrintHtml(doc,esc,logoUrl());
 html=html.replace("</style>","@page{margin:0}html,body{margin:0!important;background:#fff!important}.sheet{margin:0!important;box-shadow:none!important}</style>");
 frame.onload=()=>fitPage(frame);frame.srcdoc=html;
 }
}



 return Object.freeze({updateLivePreview,fitPreviewFrame});
}
window.AutoDocDocumentPreview=Object.freeze({create});
})();
