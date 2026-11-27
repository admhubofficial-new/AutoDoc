import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {runInNewContext} from "node:vm";
const source=readFileSync(new URL("../config.js",import.meta.url),"utf8");
function harness(){
 const calls:any[]=[];const events:Record<string,()=>void>={};
 const window:any={addEventListener:(name:string,fn:()=>void)=>{events[name]=fn}};
 runInNewContext(source,{window,Headers,fetch:(url:string,options:RequestInit)=>new Promise(resolve=>calls.push({url,options,resolve})),Intl,Date});
 return {core:window.AutoDocCore,calls,events};
}
const success=(body:unknown={})=>({ok:true,status:200,json:async()=>body});
test("P4: concurrent reads share work, completed reads never cache",async()=>{
 const {core,calls}=harness();const a=core.api("menus/plans"),b=core.api("menus/plans");
 assert.equal(a,b);assert.equal(calls.length,1);
 calls[0].resolve(success());await a;
 const fresh=core.api("menus/plans");assert.equal(calls.length,2);calls[1].resolve(success());await fresh;
});
test("P4: writes and data-change events invalidate pending reads without sharing mutations",async()=>{
 const {core,calls,events}=harness();const a=core.api("master/list");
 const post=core.api("master/save",{entity:"drivers"});const b=core.api("master/list");
 assert.notEqual(a,b);assert.equal(calls.length,3);
 events["autodoc:data-changed"]();const c=core.api("master/list");assert.notEqual(c,b);assert.equal(calls.length,4);
 for(const call of calls)call.resolve(success());await Promise.all([a,b,c,post]);
});
test("P4: HTTP failure preserves status; retry is a fresh request",async()=>{
 const {core,calls}=harness();const p=core.api("docs/list?tanggal=2026-11-27");
 calls[0].resolve({ok:false,status:401,json:async()=>({message:"Sesi berakhir"})});
 await assert.rejects(p,(e:any)=>e.status===401&&e.message==="Sesi berakhir");
 const retry=core.api("docs/list?tanggal=2026-11-27");assert.equal(calls.length,2);calls[1].resolve(success());await retry;
});
test("P4: API credentials, no-store, partial success, Jakarta midnight",async()=>{
 const {core,calls}=harness();const p=core.api("docs/create",{test:true});const call=calls[0];
 assert.equal(call.options.credentials,"include");assert.equal(call.options.cache,"no-store");
 assert.equal(call.options.method,"POST");assert.equal(call.options.headers.get("Content-Type"),"application/json");
 call.resolve({ok:true,status:207,json:async()=>({partial:true})});assert.equal((await p).partial,true);
 assert.equal(core.today(new Date("2026-11-27T16:59:59Z")),"2026-11-27");
 assert.equal(core.today(new Date("2026-11-27T17:00:00Z")),"2026-11-28");
});
