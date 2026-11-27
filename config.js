(() => {
  "use strict";
  Object.defineProperty(window, "AutoDocConfig", {
    value: Object.freeze({
      apiUrl: "https://cnbomblvtddkmtojzpyd.supabase.co/functions/v1/autodoc-auth",
      publishableKey: "sb_publishable_xSbC7RqRGFkZVaqkFYJ7OA_DJ9qSuyv"
    }),
    writable: false,
    configurable: false
  });
  const config = window.AutoDocConfig;
  // Share concurrent reads only; never cache completed responses or writes.
  const pendingReads=new Map();
  function requestJson(route, options = {}, fallback = "Permintaan tidak berhasil.") {
    const method=String(options.method||"GET").toUpperCase();
    const path=route.replace(/^[/]+/,"");
    if(method!=="GET")pendingReads.clear();
    const share=method==="GET"&&!options.signal&&!options.headers&&!options.body&&["master/list","master/recipients","menus/plans","docs/list"].includes(path.split("?")[0]);
    if(!share)return fetchJson(path,options,fallback);
    const key=JSON.stringify([path,fallback]);
    if(pendingReads.has(key))return pendingReads.get(key);
    const promise=fetchJson(path,options,fallback).finally(()=>{if(pendingReads.get(key)===promise)pendingReads.delete(key)});
    pendingReads.set(key,promise);
    return promise;
  }
  window.addEventListener("autodoc:data-changed",()=>pendingReads.clear());
  async function fetchJson(route, options, fallback) {
    const headers = new Headers(options.headers || {});
    headers.set("apikey", config.publishableKey);
    headers.set("Accept", "application/json");
    const response = await fetch(config.apiUrl + "/" + route.replace(/^[/]+/, ""), {
      ...options, headers, credentials: "include", cache: "no-store"
    });
    let payload = {};
    try { payload = await response.json(); } catch (_) {}
    if (!response.ok) {
      const error = new Error(payload?.message || fallback);
      error.status = response.status;
      throw error;
    }
    return payload;
  }
  function api(route, body, fallback) {
    return requestJson(route, body ? {method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)} : {}, fallback);
  }
  const dateFormatter = new Intl.DateTimeFormat("en-GB",{timeZone:"Asia/Jakarta",year:"numeric",month:"2-digit",day:"2-digit"});
  function today(date = new Date()) {
    const values = Object.fromEntries(dateFormatter.formatToParts(date).filter(part=>part.type!=="literal").map(part=>[part.type,part.value]));
    return values.year+"-"+values.month+"-"+values.day;
  }
  Object.defineProperty(window,"AutoDocCore",{value:Object.freeze({requestJson,api,today}),writable:false,configurable:false});
})();
