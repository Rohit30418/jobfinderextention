import test, {beforeEach} from 'node:test';
import assert from 'node:assert/strict';
let data={},session={},listener;
const area=source=>({get:async keys=>structuredClone(Object.fromEntries((typeof keys==='string'?[keys]:keys||Object.keys(source())).filter(key=>key in source()).map(key=>[key,source()[key]]))),set:async value=>Object.assign(source(),structuredClone(value)),remove:async keys=>{for(const key of typeof keys==='string'?[keys]:keys)delete source()[key];}});
const event={addListener(){}};
globalThis.chrome={storage:{local:area(()=>data),session:area(()=>session),sync:area(()=>({}))},runtime:{id:'extension',getURL:path=>'chrome-extension://extension/'+path,onMessage:{addListener(fn){listener=fn;}},onMessageExternal:event,onInstalled:event,onStartup:event},tabs:{onUpdated:event},action:{onClicked:event}};
await import('../background.js');
const store=await import('../core/storage.js');
const {analysisRevision}=await import('../core/analysis-inputs.js');
const profile={skills:['React'],totalExperienceMonths:36,currentRole:'Frontend Developer'};
const job={key:'indeed:a',portal:'indeed',portalJobId:'a',title:'Frontend Developer',canonicalUrl:'https://in.indeed.com/viewjob?jk=a',requiredSkills:['React'],description:'React frontend developer'};
const sender={id:'extension',url:job.canonicalUrl};
const send=(message,from=sender)=>new Promise(resolve=>{const keep=listener(message,from,resolve);if(!keep)resolve({ignored:true});});
beforeEach(async()=>{data={};session={};await store.setState({profile});await store.setPreferences({targetRoles:['Frontend Developer']});await store.persistPortalCapture({portal:'indeed',pageType:'detail',jobs:[],detail:job});});
test('content scripts cannot call privileged storage or start authentication',async()=>{
 assert.equal((await send({type:'jobpilot:storage',name:'getPuterToken',args:[]})).ok,false);
 assert.equal((await send({type:'jobpilot:auth-begin'})).ok,false);
});
test('local analysis works without AI and automatic transmission is off by default',async()=>{
 await store.setPuterToken('synthetic');await store.setAiAuthorized(true);let calls=0;
 globalThis.fetch=async()=>{calls++;throw new Error('Should not call AI');};
 const result=await send({type:'jobpilot:inline-analyze',job});assert.equal(result.ok,true);assert.equal(result.aiStatus,'local');assert.equal(calls,0);assert.ok(result.match);
});
test('AI failures return local match and concurrent requests share one request',async()=>{
 await store.setPuterToken('synthetic');await store.setAiAuthorized(true);
 let calls=0;globalThis.fetch=async()=>{calls++;await new Promise(resolve=>setTimeout(resolve,15));throw new Error('Provider offline');};
 const results=await Promise.all(Array.from({length:4},()=>send({type:'jobpilot:inline-analyze',job,forceAi:true})));
 assert.equal(calls,1);for(const result of results){assert.equal(result.ok,true);assert.equal(result.aiStatus,'unavailable');assert.ok(result.match);}
});
test('changed profile never reuses prior semantic evidence',async()=>{
 await store.setPuterToken('synthetic');await store.setAiAuthorized(true);
 const preferences=await store.getPreferences();
 data[store.JOB_CACHE_KEY][job.key].aiAnalysis={inputRevision:analysisRevision(profile,preferences,job),requiredSkills:['React'],candidateRequirementMatches:[{requirement:'React',status:'EXACT'}]};
 await store.setState({profile:{...profile,skills:[]}});
 const result=await send({type:'jobpilot:inline-analyze',job});assert.deepEqual(result.match.skills.required.exact,[]);
});
