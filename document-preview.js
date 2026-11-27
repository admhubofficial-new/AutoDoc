(() => {
"use strict";
function create(dependencies){
 const { $, esc, getModal, getMaster, api, readDistributionForm, contextReady, contextLocked, selectedDocumentKinds, today, logoUrl } = dependencies;
 let numberDate="", numberContext=null, numberRequest=0, numberError=false, previewFrame=0;
 const frameKeys=new WeakMap();
 function invalidateNumbers(){numberRequest++;numberDate="";numberContext=null;numberError=false}
 function reset(){invalidateNumbers();if(previewFrame)cancelAnimationFrame(previewFrame);previewFrame=0}
 function updateLivePreview(){
  if(previewFrame)return;
  previewFrame=requestAnimationFrame(()=>{previewFrame=0;renderLivePreview()});
 }
 function loadNumbers(date){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||date===numberDate)return;
  numberDate=date;
  numberContext=null;
  numberError=false;
  const request=++numberRequest;
  Promise.all([api("master/list?preview=true"),api("docs/list?tanggal="+encodeURIComponent(date)+"&preview=true")]).then(([master,history])=>{
   if(request!==numberRequest)return;
   numberContext={counters:master.data?.numbering||[],existing:history.documents||[]};
   updateLivePreview();
  }).catch(()=>{if(request===numberRequest){numberError=true;updateLivePreview()}});
 }
 window.addEventListener("autodoc:data-changed",()=>{invalidateNumbers();updateLivePreview()});
 let boundDisclosure=null;
 window.addEventListener("resize",fitPreviewFrame);
 function bindPreviewDisclosure(){
  const disclosure=$("#docsPreviewDisclosure",getModal());
  if(!disclosure||disclosure===boundDisclosure)return;
  boundDisclosure=disclosure;
  const pages=disclosure.querySelector("#docsPreviewPages");
  pages.addEventListener("scroll",()=>syncPagePosition(),{passive:true});
  const retry=disclosure.querySelector("#docsPreviewRetry");
  if(retry)retry.onclick=()=>{invalidateNumbers();updateLivePreview()};
  const zoom=disclosure.querySelector("#docsZoom");
  zoom.addEventListener("input",()=>{
   pages.style.setProperty("--sheet-width",Math.round(794*zoom.valueAsNumber/100)+"px");
   zoom.nextElementSibling.value=zoom.value+"%";
   fitPreviewFrame();
   syncPagePosition();
  });
  disclosure.querySelectorAll("[data-page-step]").forEach(button=>{
   button.addEventListener("click",()=>{
    const next=Number(pages.dataset.current||0)+Number(button.dataset.pageStep);
    pages.children[next]?.scrollIntoView({block:"start",behavior:"instant"});
    syncPagePosition(next);
   });
  });

 }
 function previewPortionRows(recipient){
 const definitions=[["siswa_kecil","Siswa kecil","Porsi Kecil"],["balita","Balita","Porsi Kecil"],["siswa_besar","Siswa besar","Porsi Besar"],["tendik","Tenaga pendidik","Porsi Besar"],["ibu_hamil","Ibu hamil","Porsi Besar"],["ibu_menyusui","Ibu menyusui","Porsi Besar"],["putus_sekolah","Anak putus sekolah","Porsi Besar"],["kader","Kader","Porsi Besar"]];
 return definitions.flatMap(([key,label,jenis])=>{const jumlah=Number(recipient?.[key]||0);return jumlah>0?[{kelompok_sasaran:label,jenis_porsi:jenis,jumlah}]:[]});
}
function fitPreviewFrame(){
 getModal()?.querySelectorAll("#docsPreviewPages iframe[data-document-page]").forEach(fitPage);
}
function fitPage(frame){
 const host=frame?.parentElement;
 if(!host||!frame.isConnected||!frame.contentDocument?.body||!frame.getClientRects().length||!host.clientWidth)return;
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
 const height=Math.max(1123,body.scrollHeight);
 frame.style.height=height+"px";
 frame.style.transform="scale("+scale+")";
 host.style.height=Math.ceil(height*scale)+"px";
}
function renderOrganolepticPreview(frame,recipient,date,menu,settings,number,mealTime){
 const renderer=window.AutoDocOrganolepticPrint;
 if(!renderer?.organolepticSheet)return;
 const css=renderer.styles+"body{background:#fff}.sheet{margin:0;box-shadow:none}";
 const dateLabel=/^\d{4}-\d{2}-\d{2}$/.test(date)?new Intl.DateTimeFormat("id-ID",{weekday:"long",day:"2-digit",month:"long",year:"numeric"}).format(new Date(date+"T00:00:00")):date;
 frame.onload=()=>{
  const doc=frame.contentDocument;if(!frame.isConnected||!doc)return;
  doc.body.dataset.previewType="organoleptic";
  doc.body.style.width="794px";doc.body.style.margin="0";doc.body.style.padding="0";
  const root=doc.getElementById("previewRoot");
  root.append(renderer.organolepticSheet(doc,{sppg:settings,logoUrl:logoUrl(),escapeHtml:esc,tanggalLabel:dateLabel,nomor:number,waktuMakan:mealTime,ahliGizi:String(settings.nama_ahli_gizi||""),menu},recipient));
  fitPage(frame);
 };
 frame.srcdoc="<!doctype html><html lang='id'><head><meta charset='utf-8'><style>"+css+"</style></head><body data-preview-type='organoleptic'><main id='previewRoot'></main></body></html>";
}
function renderLivePreview(){
 const modal=getModal();
 const pages=$("#docsPreviewPages",modal);
 if(!pages||modal.hidden||pages.closest(".docs-view-create")?.hidden)return;
 bindPreviewDisclosure();
 const form=$("#docsCreateForm",getModal());if(!form)return;
 const selected=new Set(Array.from(form.querySelectorAll("input[name='recipient']:checked"),input=>input.value));
 const recipients=(getMaster().recipients||[]).filter(item=>selected.has(String(item.id)));
 const kindSelect=$("#docsPreviewKind",getModal()),currentKind=kindSelect?.value||"SJ";
 const includeOrganoleptic=$("#docsIncludeOrganoleptic",form)?.checked===true;
 const kinds=selectedDocumentKinds();
 const available=[...kinds,...(includeOrganoleptic?["ORGANOLEPTIC"]:[])];
 const kind=available.includes(currentKind)?currentKind:(available[0]||"");
 if(kindSelect){kindSelect.value=kind;Array.from(kindSelect.options).forEach(option=>{option.disabled=!available.includes(option.value)});}
 for(const button of getModal().querySelectorAll("[data-preview-kind]")){
  button.disabled=!available.includes(button.dataset.previewKind);
  button.setAttribute("aria-pressed",String(button.dataset.previewKind===kind && !button.disabled));
 }
 const distribution=readDistributionForm();
 const date=distribution.tanggal||today();
 const hasPreview=recipients.length>0&&!!kind&&contextReady();
 if(hasPreview)loadNumbers(date);
 const existing=new Map((numberContext?.existing||[]).map(doc=>[doc.jenis+":"+String(doc.recipient_id||doc.snapshot_json?.penerima?.id),doc]));
 const next=Object.fromEntries((numberContext?.counters||[]).filter(row=>row.locked).map(row=>[row.jenis,Number(row.next_number)]));
 const month=["I","II","III","IV","V","VI","VII","VIII","IX","X","XI","XII"][Number(date.slice(5,7))-1];
 const previewStatus=$("#docsPreviewNumberStatus",getModal());
 const waiting=recipients.length>0&&!!kind&&(!contextReady()||hasPreview&&!numberContext&&!numberError);
 pages.setAttribute("aria-busy",String(waiting));
 if(previewStatus)previewStatus.textContent=!hasPreview?"":numberError
  ?"Nomor belum bisa dimuat."
  :waiting?"Memuat nomor surat…":contextLocked()?"Distribusi terkunci · dokumen terbit memakai arsip.":"Nomor pratinjau bersifat perkiraan.";
 const retry=$("#docsPreviewRetry",modal);if(retry)retry.hidden=!hasPreview||!numberError;
 const previous=pages.children[Number(pages.dataset.current)||0]?.dataset.recipientId;
 const current=Math.max(0,recipients.findIndex(r=>String(r.id)===previous));
 const pageCount=$("#docsPreviewPageCount",getModal());
 if(pageCount){pageCount.textContent=hasPreview?(current+1)+" dari "+recipients.length+" · "+recipients[current].nama:"";pageCount.title=pageCount.textContent}
 const sameLayout=hasPreview&&pages.children.length===recipients.length&&recipients.every((recipient,index)=>pages.children[index]?.dataset.recipientId===String(recipient.id));
 if(!sameLayout&&hasPreview)pages.replaceChildren();
 pages.dataset.current=String(current);
 getModal().querySelector("[data-page-step='-1']").disabled=!hasPreview||current===0;
 getModal().querySelector("[data-page-step='1']").disabled=!hasPreview||current===recipients.length-1;
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
 if(!hasPreview){
  const emptyKey=String(contextReady())+":"+recipients.length+":"+kind;
  if(pages.children.length===1&&pages.firstElementChild.dataset.emptyKey===emptyKey)return;
  pages.replaceChildren();
  const frame=makeFrame("Pratinjau belum tersedia");frame.parentElement.dataset.emptyKey=emptyKey;
  frame.style.height="220px";
  frame.srcdoc="<!doctype html><html lang='id'><head><meta charset='utf-8'><style>*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;padding:32px;background:#fff;color:#647269;font:14px/1.6 Inter,Arial,sans-serif;text-align:center}main{max-width:420px}h2{margin:0 0 8px;color:#1f2a23;font-size:19px}p{margin:0}</style></head><body><main><h2>Pratinjau belum tersedia</h2><p>"+(!contextReady()?"Data distribusi belum tersedia.":!recipients.length?"Pilih penerima pada formulir untuk melihat dokumen dengan data sebenarnya.":"Pilih jenis dokumen untuk melihat pratinjau.")+"</p></main></body></html>";
  return;
 }
 const settings=Array.isArray(getMaster().settings)?(getMaster().settings[0]||{}):(getMaster().settings||{});
 const menu=distribution.menu_items;
 const mealTime=distribution.waktu_makan;
 for(const [index,recipient] of recipients.entries()){
 const frame=sameLayout?pages.children[index].querySelector("iframe"):makeFrame("Pratinjau "+recipient.nama);
 frame.title="Pratinjau "+recipient.nama;
 frame.parentElement.dataset.recipient=recipient.nama;frame.parentElement.dataset.recipientId=String(recipient.id);
 frame.dataset.documentPage="";
 if(index>0)frame.loading="lazy";
 frame.parentElement.classList.add("docs-document-sheet");
 
 const issueKind=kind==="ORGANOLEPTIC"?"SJ":kind;
 const issued=existing.get(issueKind+":"+String(recipient.id));
 let number=issued?.nomor_lengkap||"";
 if(!number&&kinds.includes(issueKind)&&month&&settings.kode_sppg&&Number.isSafeInteger(next[issueKind])&&next[issueKind]>0){
  number=String(next[issueKind]++).padStart(3,"0")+"/"+issueKind+"/"+settings.kode_sppg+"/"+month+"/"+date.slice(0,4);
 }
 if(kind==="ORGANOLEPTIC"){
  const archived=issued?.snapshot_json||existing.get("BAST:"+String(recipient.id))?.snapshot_json;const archivedItems=archived?.distribusi?.menu_items;const actualMenu=Array.isArray(archivedItems)?archivedItems.map(i=>typeof i==="string"?i:String(i?.nama_komponen||"")).filter(Boolean):menu;const args=[archived?.penerima||recipient,date,actualMenu,archived?.sppg||settings,number.replace(/[/]SJ[/]/i,"/ORG/"),archived?.distribusi?.waktu_makan||mealTime];const key="ORG:"+JSON.stringify(args);if(frameKeys.get(frame)!==key){frameKeys.set(frame,key);renderOrganolepticPreview(frame,...args);}
  continue;
 }
 const snapshot={
  sppg:settings,
  distribusi:{...distribution,menu:menu.join(", ")},
  penerima:recipient,rincian_porsi:previewPortionRows(recipient),
  ringkasan:{porsi_kecil:Number(recipient.porsi_kecil||0),porsi_besar:Number(recipient.porsi_besar||0),total_porsi:Number(recipient.total_porsi||0)}
 };
 const doc=issued||{jenis:kind,nomor_lengkap:number,snapshot_json:snapshot};
 const key=kind+":"+JSON.stringify(doc);if(frameKeys.get(frame)===key)continue;
 const renderer=window.AutoDocPrintRenderer;if(!renderer?.buildPrintHtml)return;frameKeys.set(frame,key);
 let html=renderer.buildPrintHtml(doc,esc,logoUrl());
 html=html.replace("</style>","@page{margin:0}html,body{margin:0!important;background:#fff!important}.sheet{margin:0!important;box-shadow:none!important}</style>");
 frame.onload=()=>fitPage(frame);frame.srcdoc=html;
 }
 if(!sameLayout&&current>0)requestAnimationFrame(()=>{if(pages.isConnected&&pages.children[current]?.dataset.recipientId===previous){pages.children[current].scrollIntoView({block:"start",behavior:"instant"});syncPagePosition(current)}});
}



 function syncPagePosition(preferred){
  const host=$("#docsPreviewPages",getModal());
  if(!host?.getClientRects().length||!host.firstElementChild?.dataset.recipient)return;
  const pages=Array.from(host.children);
  const top=Math.max(0,host.getBoundingClientRect().top);
  const threshold=top+Math.min(host.clientHeight,innerHeight-top)*0.35;
  const index=pages.findIndex(page=>page.getBoundingClientRect().bottom>threshold);
  const first=index<0?pages.length-1:index;
  const previous=Number(host.dataset.current);
  const sameRow=pages[previous]?.offsetTop===pages[first].offsetTop;
  const current=Number.isInteger(preferred)&&pages[preferred]?preferred:sameRow?previous:first;
  host.dataset.current=String(current);
  const label=$("#docsPreviewPageCount",getModal());
  label.textContent=(current+1)+" dari "+pages.length+" · "+pages[current].dataset.recipient;
  label.title=label.textContent;
  getModal().querySelector("[data-page-step='-1']").disabled=current===0;
  getModal().querySelector("[data-page-step='1']").disabled=current===pages.length-1;
 }
 window.addEventListener("scroll",()=>syncPagePosition(),{passive:true});
 return Object.freeze({updateLivePreview,fitPreviewFrame,reset});
}
window.AutoDocDocumentPreview=Object.freeze({create});
})();
