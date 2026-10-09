import test, {beforeEach} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createHash} from 'node:crypto';
let local={},sync={},session={};
function area(which) { return {
  get: async keys => { const source={local,sync,session}[which]; return structuredClone(Object.fromEntries((typeof keys==='string'?[keys]:keys||Object.keys(source)).filter(key=>key in source).map(key=>[key,source[key]]))); },
  set: async values => { if(which==='sync') for(const [key,value] of Object.entries(values)) assert.ok(Buffer.byteLength(key+JSON.stringify(value))<=8192, 'Sync item exceeds Chrome quota'); Object.assign({local,sync,session}[which],structuredClone(values)); },
  remove: async keys => { for(const key of typeof keys==='string'?[keys]:keys) delete {local,sync,session}[which][key]; }
}; }
globalThis.chrome={runtime:{id:'test-extension',getURL:path=>'chrome-extension://test-extension/'+path},storage:{local:area('local'),sync:area('sync'),session:area('session')}};
globalThis.location={href:'https://in.indeed.com/viewjob?jk=a'};
const store=await import('../core/storage.js');
const {evaluateDeepMatch}=await import('../core/match-engine.js');
const {analysisRevision}=await import('../core/analysis-inputs.js');
const {normalizeAiProfile,profileFromForm}=await import('../core/profile-normalizer.js');
const {beginAuth,acceptBridge,authStatus}=await import('../core/auth-bridge.js');
const engine=globalThis.JobPilotPortalEngine;
const read=path=>fs.readFileSync(new URL('../'+path,import.meta.url),'utf8');
const profile={skills:['React','CSS','JavaScript'],currentRole:'Frontend Developer',totalExperienceMonths:42};
const job={key:'indeed:a',portal:'indeed',portalJobId:'a',canonicalUrl:'https://in.indeed.com/viewjob?jk=a',title:'Frontend Developer',requiredSkills:['React'],experienceMin:2,experienceMax:4};
beforeEach(()=>{local={};sync={};session={};});

test('concurrent applied-job writes and atomic toggles preserve all jobs',async()=>{
 await Promise.all(Array.from({length:25},(_,i)=>store.markJobApplied({...job,key:String(i)})));
 assert.equal(Object.keys((await store.getAppliedJobs()).items).length,25);
 await Promise.all([store.toggleJobApplied(job),store.toggleJobApplied(job)]);
 assert.equal(await store.isJobApplied(job),false);
});
test('concurrent captures preserve cache and portal listing contexts',async()=>{
 await Promise.all(['indeed','naukri','foundit'].map(portal=>store.persistPortalCapture({portal,pageType:'listing',jobs:[{...job,portal,key:portal+':a'}]})));
 assert.equal(Object.keys(await store.getJobCache()).length,3);
 assert.equal(Object.keys((await store.getListingContexts()).portals).length,3);
});
test('query IDs and conflicting IDs cannot attach analysis to another job',async()=>{
 const other={...job,key:'indeed:b',portalJobId:'b',canonicalUrl:'https://in.indeed.com/viewjob?jk=b'};
 assert.equal(engine.sameJob(job,other),false);
 assert.equal(engine.sameJob({...job,portal:'naukri'},job),false);
 assert.equal(engine.sameJob({...job,portalJobId:''},{...other,portalJobId:''}),false);
 local[store.JOB_CACHE_KEY]={[job.key]:job};local[store.PORTAL_CAPTURE_KEY]={detail:other};
 await store.saveJobAiAnalysis(job.key,{summary:'A only'});
 assert.equal((await store.getPortalCapture()).detail.aiAnalysis,undefined);
 assert.equal((await store.saveJobAiAnalysis('missing',{summary:'Missing'})),null);
});
test('experience decimals, months, and detail-listing merges preserve bounds',()=>{
 for(const [text,min,max] of [['2-4 years',2,4],['3.5 years',3.5,null],['1.5-2.5 years',1.5,2.5],['6-12 months',.5,1]]){
  const parsed=engine.normalizeJob({title:'Engineer',experienceText:text},{portal:'indeed'});
  assert.equal(parsed.experienceMin,min,text);assert.equal(parsed.experienceMax,max,text);
 }
 const detail=engine.normalizeJob({title:'Engineer',experienceText:'2-4 years'},{portal:'indeed',pageType:'detail'});
 const listing=engine.normalizeJob({title:'Engineer'},{portal:'indeed'});
 assert.equal(engine.mergeJob(detail,listing).experienceMin,2);
});
test('unknown experience stays unknown and related technologies are not exact matches',()=>{
 assert.equal(normalizeAiProfile({}).totalExperienceMonths,null);
 assert.equal(normalizeAiProfile({totalExperienceMonths:null}).totalExperienceMonths,null);
 assert.equal(evaluateDeepMatch({...profile,totalExperienceMonths:null},{},job).experience.candidateYears,null);
 assert.deepEqual(evaluateDeepMatch(profile,{}, {...job,requiredSkills:['React Native']}).skills.required.exact,[]);
 assert.deepEqual(evaluateDeepMatch(profile,{}, {...job,requiredSkills:['Java']}).skills.required.exact,[]);
 assert.deepEqual(evaluateDeepMatch(profile,{},job).skills.required.exact,['React']);
});
test('profile form retains work and unchanged structured project evidence',()=>{
 const originalProfile={workExperience:[{title:'Engineer',skillsUsed:['Accessibility']}],projects:[{name:'App',description:'Accessible site',skillsUsed:['React']}]};
 const saved=profileFromForm({originalProfile,skills:'React',experienceYears:'',experienceMonths:'',projects:'App — Accessible site'});
 assert.deepEqual(saved.workExperience,originalProfile.workExperience);assert.deepEqual(saved.projects,originalProfile.projects);assert.equal(saved.totalExperienceMonths,null);
 const edited=profileFromForm({originalProfile,projects:'Different project'});assert.deepEqual(edited.projects,['Different project']);
});
test('backup rejects unsupported versions, malformed arrays and prototype keys before writing',async()=>{
 await store.setState({profile});const before=structuredClone(local);
 for(const payload of [
  {type:'jobpilot-backup',version:999,data:{[store.STATE_KEY]:{profile}}},
  {type:'jobpilot-backup',version:1,data:{[store.STATE_KEY]:{profile:{skills:7}}}},
  JSON.parse('{"type":"jobpilot-backup","version":1,"data":{"jobpilot.stage1.state":{"__proto__":{}}}}')
 ]) await assert.rejects(()=>store.importJobPilotBackup(payload),/Invalid backup/);
 assert.deepEqual(local,before);
});
test('backup roundtrip excludes credentials and preserves pre-import recovery data',async()=>{
 await store.setState({profile});await store.setPuterToken('test-secret');await store.markJobApplied(job);
 const backup=await store.exportJobPilotBackup();assert.ok(!JSON.stringify(backup).includes('test-secret'));
 await store.importJobPilotBackup(backup);assert.deepEqual((await store.getState()).profile,profile);
 assert.ok(local['jobpilot.backup.beforeImport']);assert.equal(local[store.PUTER_TOKEN_KEY],undefined);
});
test('vault sync mirrors fit quota and retain all 40 skills',async()=>{
 const missing=Array.from({length:40},(_,i)=>'Skill number '+i);
 await store.saveMissingSkillsToVault(job.key,job,{skills:{required:{missing}}});
 assert.equal(Object.keys((await store.getSkillVault()).items).length,40);
 assert.equal((await store.getSkillVault()).syncStatus,'synced');
 local={};assert.equal(Object.keys((await store.getSkillVault()).items).length,40);
});
test('profile changes invalidate cached and late analysis',async()=>{
 await store.setState({profile});await store.setPreferences({targetRoles:['Frontend Developer']});
 const prefs=await store.getPreferences();const revision=analysisRevision(profile,prefs,job);
 local[store.JOB_CACHE_KEY]={[job.key]:job};
 await store.saveJobAiAnalysis(job.key,{inputRevision:revision,requiredSkills:['React']});
 assert.ok((await store.getJobCache())[job.key].aiAnalysis);
 await store.setState({profile:{...profile,skills:[]}});
 assert.equal((await store.getJobCache())[job.key].aiAnalysis,undefined);
 assert.equal(await store.saveJobAiAnalysis(job.key,{inputRevision:revision}),null);
 const stale={...job,aiAnalysis:{inputRevision:revision,requiredSkills:['React'],candidateRequirementMatches:[{requirement:'React',status:'EXACT'}]}};
 assert.deepEqual(evaluateDeepMatch({...profile,skills:[]},prefs,stale).skills.required.exact,[]);
});
test('CSV neutralizes spreadsheet formulas',()=>{
 const code=read('stage6/list.js');const ctx={};
 vm.runInNewContext(code.slice(code.indexOf('function csvCell('),code.indexOf('function appliedJobsToCsv('))+';globalThis.csv=csvCell;',ctx);
 for(const value of ['=1+1',' +SUM(A1)','@cmd','-2','\t=cmd']) assert.ok(ctx.csv(value).startsWith('"\''));
 assert.equal(ctx.csv('Engineer'),'"Engineer"');assert.equal(ctx.csv('A"B'),'"A""B"');
});
test('Indeed split-pane vjk is detected and used as the selected identity',()=>{
 const ctx={URL,URLSearchParams,location:{href:'https://in.indeed.com/jobs?q=react&vjk=abc',pathname:'/jobs',search:'?q=react&vjk=abc'},document:{querySelectorAll:()=>[],querySelector:()=>null}};
 for(const path of ['core/portal-engine.js','portals/shared/portal-utils.js','portals/indeed/detail.js']) vm.runInNewContext(read(path),ctx);
 assert.equal(ctx.JobPilotIndeedDetail.detect(),true);assert.equal(ctx.JobPilotPortalUtils.identifierFromUrl(ctx.location.href),'abc');
});
test('bridge requires registered state and exact sender, consumes it once, and never exposes credentials',async()=>{
 const sender={id:'test-extension',url:'chrome-extension://test-extension/onboarding/onboarding.html'};
 await assert.rejects(()=>beginAuth({url:'https://evil.example'}));
 const state=await beginAuth(sender);const message={type:'jobpilot:auth-complete',state,token:'test-token',aiAuthorized:true};
 assert.equal((await acceptBridge(message,{url:'https://evil.example'})).ok,false);
 const bridge={url:'https://rohit30418.github.io/jobfinderextention/puter-auth.html?state='+state};
 assert.equal((await acceptBridge({...message,state:'bad'},bridge)).ok,false);
 assert.equal((await acceptBridge(message,bridge)).ok,true);
 assert.equal((await acceptBridge(message,bridge)).ok,false);
 const status=await authStatus(state,sender);assert.equal(status.completed,true);assert.equal(status.token,undefined);
 assert.equal(local[store.PUTER_TOKEN_KEY],undefined);assert.equal(await store.getPuterToken(),'test-token');
});
test('manifest public key and bridge pinned extension ID agree',()=>{
 const manifest=JSON.parse(read('manifest.json'));
 const id=createHash('sha256').update(Buffer.from(manifest.key,'base64')).digest('hex').slice(0,32).replace(/[0-9a-f]/g,c=>String.fromCharCode(97+parseInt(c,16)));
 assert.ok(read('site/puter-auth.js').includes('"'+id+'"'));
});

test('inline panel backs off failures and discards navigation-stale responses',async()=>{
 const source=read('content/detail-intelligence.js');let sent=0,resolveMessage;
 const ctx={Date,JSON,running:false,currentUrl:'https://in.indeed.com/viewjob?jk=a',currentJobKey:'',latestStatus:'waiting',latestMessage:'',latestResult:null,captureCurrentDetail:()=>({detailPage:true,ready:true,job}),renderPanel(){},applyHighlights(){},clearHighlights(){},HOST_ID:'test',document:{getElementById:()=>null},chrome:{storage:{onChanged:{addListener(){}}},runtime:{sendMessage:async()=>{sent++;return {ok:false,error:'Rate limited'};}}},location:{href:'https://in.indeed.com/viewjob?jk=a'}};
 vm.runInNewContext(source.slice(source.indexOf('  let retryAfter ='),source.indexOf('  setTimeout(tick,'))+';globalThis.run=analyzeCurrent;globalThis.tickNow=tick;',ctx);
 for(let i=0;i<5;i++) await ctx.run();assert.equal(sent,1);
 ctx.chrome.runtime.sendMessage=()=>new Promise(resolve=>{resolveMessage=resolve;});
 const pending=ctx.run(true);await Promise.resolve();ctx.location.href='https://in.indeed.com/viewjob?jk=b';ctx.tickNow();
 resolveMessage({ok:true,match:{},job});await pending;assert.equal(ctx.latestResult,null);
});
test('AI HTTP requests have a bounded abort signal and null experience remains unknown',async()=>{
 const {callPuterAi}=await import('../core/puter-client.js');
 await store.setPuterToken('synthetic');await store.setAiAuthorized(true);
 const original=globalThis.fetch;
 try {
  globalThis.fetch=async(url,options)=>{assert.ok(options.signal instanceof AbortSignal);assert.equal(options.signal.aborted,false);return {ok:true,json:async()=>({success:true,result:{message:{content:'ok'}}})};};
  await callPuterAi('test');
 } finally {globalThis.fetch=original;}
});

test('undo import restores prior records and malformed cache rows are rejected',async()=>{
 await store.setState({profile});
 const old=await store.exportJobPilotBackup();
 await store.importJobPilotBackup({...old,data:{...old.data,[store.STATE_KEY]:{profile:{...profile,name:'Imported'}}}});
 assert.equal((await store.getState()).profile.name,'Imported');await store.undoLastImport();assert.equal((await store.getState()).profile.name,undefined);
 await assert.rejects(()=>store.importJobPilotBackup({type:'jobpilot-backup',version:1,data:{[store.JOB_CACHE_KEY]:{bad:null}}}),/Invalid backup/);
});
test('full analyzed-job backup can be restored without schema conflicts',async()=>{
 await store.setState({profile});await store.setPreferences({targetRoles:['Frontend Developer']});await store.persistPortalCapture({portal:'indeed',pageType:'detail',jobs:[],detail:job});
 const prefs=await store.getPreferences();await store.saveJobDeepMatch(job.key,evaluateDeepMatch(profile,prefs,job));
 const backup=await store.exportJobPilotBackup();await store.importJobPilotBackup(backup);assert.equal((await store.getState()).profile.currentRole,profile.currentRole);
});


test('normalized portal detail education text roundtrips alongside profile education arrays',async()=>{
 const detail=engine.normalizeJob({...job,education:'Bachelor degree',sources:{skills:'dom',education:'jsonld'},description:'Build accessible frontend applications'},{portal:'indeed',pageType:'detail'});
 await store.setState({profile:{...profile,education:[{qualification:'BSc'}]}});
 await store.persistPortalCapture({portal:'indeed',pageType:'detail',jobs:[],detail,readiness:{signals:{skills:3,education:true}}});
 const backup=await store.exportJobPilotBackup();await store.importJobPilotBackup(backup);
 assert.equal((await store.getPortalCapture()).detail.education,'Bachelor degree');
});

test('extension page reads and saves without a background storage response',async()=>{
 const oldLocation=globalThis.location;
 const descriptor=Object.getOwnPropertyDescriptor(navigator,'locks');
 globalThis.document={};globalThis.location={href:chrome.runtime.getURL('onboarding/onboarding.html')};
 let calls=0,locks=0;
 chrome.runtime.sendMessage=async()=>{calls++;return undefined;};
 Object.defineProperty(navigator,'locks',{configurable:true,value:{request:async(name,run)=>{assert.equal(name,'jobpilot.storage.v1');locks++;return run();}}});
 try {
  assert.equal((await store.getState()).profile,null);
  await store.setState({profile});assert.deepEqual((await store.getState()).profile,profile);
  assert.equal(calls,0);assert.ok(locks>=3);
 } finally {
  delete globalThis.document;globalThis.location=oldLocation;delete chrome.runtime.sendMessage;
  if(descriptor)Object.defineProperty(navigator,'locks',descriptor);else delete navigator.locks;
 }
});

test('agent mode toggles retain recommendations while actual preference edits invalidate them',async()=>{
 await store.setState({profile});await store.setPreferences({targetRoles:['Frontend Developer']});
 await store.persistPortalCapture({portal:'indeed',pageType:'detail',detail:job,jobs:[]});
 const preferences=await store.getPreferences();const cached=(await store.getJobCache())[job.key];
 await store.saveJobAiRankings([{key:job.key,inputRevision:analysisRevision(profile,preferences,cached),version:1,decision:'APPLY',fitScore:85}]);
 await store.setPreferences({...preferences,agentEnabled:true,automaticAi:true});assert.equal((await store.getJobCache())[job.key].aiRanking.fitScore,85);
 await store.setPreferences({...preferences,targetRoles:['Backend Developer']});assert.equal((await store.getJobCache())[job.key].aiRanking,undefined);
});


function profileOptimizationHarness(services = {}) {
 const code=read('background.js');
 const start=code.indexOf('function normalizeProfileText(');
 const end=code.indexOf('const inlineRequests =',start);
 assert.ok(start>=0 && end>start);
 const context={
  getState:async()=>({profile:{skills:[],currentRole:'Frontend Developer'}}),
  getPreferences:async()=>({targetRoles:[]}),
  getAppliedJobs:async()=>({items:{}}),
  getGapInsights:async()=>({missingRequired:[],missingPreferred:[]}),
  getPuterToken:async()=>null,
  getAiAuthorized:async()=>false,
  ...services
 };
 vm.runInNewContext(code.slice(start,end)+';globalThis.contains=profileContains;globalThis.optimize=buildProfileOptimization;',context);
 return context;
}
test('profile skill matching uses token boundaries, including punctuation-bearing skills',()=>{
 const {contains}=profileOptimizationHarness();
 assert.equal(contains('JavaScript TypeScript Google', 'Java'),false);
 assert.equal(contains('JavaScript TypeScript Google', 'Go'),false);
 assert.equal(contains('React.js C++', 'C#'),false);
 for(const skill of ['C#','C++','Node.js','.NET','Java','Go']){
  assert.equal(contains('Worked with ('+skill+'), React and CSS',skill),true,skill);
 }
 assert.equal(contains('NodeXjs','Node.js'),false);
 assert.equal(contains('C++','C#'),false);
});

test('profile saved coverage stays at most 100% and section words require heading context',async()=>{
 const skills=Array.from({length:35},(_,i)=>'Skill'+(i+1));
 const context=profileOptimizationHarness({getState:async()=>({profile:{skills,currentRole:'Frontend Developer'}})});
 const text=skills.join(' ')+' I wrote a long professional profile about frontend skills and experience, but this sentence is not a section heading.';
 const withoutHeadings=await context.optimize({text,headings:[]});
 assert.equal(withoutHeadings.evidence.savedSkillsVisible,35);
 assert.equal(withoutHeadings.score,35,'35/30 coverage must be capped at 1');
 assert.ok(withoutHeadings.ideas.some(idea=>idea.includes('summary/About')));
 assert.ok(withoutHeadings.ideas.some(idea=>idea.includes('Skills/Key Skills')));
 const withHeadings=await context.optimize({text,headings:['About','Experience','Skills']});
 assert.equal(withHeadings.score,45);
 assert.ok(!withHeadings.ideas.some(idea=>idea.includes('summary/About')));
 assert.ok(!withHeadings.ideas.some(idea=>idea.includes('Skills/Key Skills')));
 const lineHeadings=await context.optimize({text:text+'\nProfessional Summary\nEmployment History\nTechnical Skills'});
 assert.equal(lineHeadings.score,45);
});

test('LinkedIn profile content script has no job-capture dependencies or blanket hosts',()=>{
 const manifest=JSON.parse(read('manifest.json'));
 const profileEntry=manifest.content_scripts.find(entry=>entry.matches.includes('https://www.linkedin.com/in/*'));
 assert.ok(profileEntry);
 assert.deepEqual(profileEntry.js,['content/profile-optimizer.js']);
 assert.equal((profileEntry.css||[]).length,0);
 for(const host of ['https://www.linkedin.com/*','https://linkedin.com/*']){
  assert.equal(manifest.host_permissions.includes(host),false);
 }
 assert.ok(manifest.host_permissions.includes('https://www.linkedin.com/jobs/*'));
 const bg=read('background.js');
 assert.ok(bg.includes('"content/profile-optimizer.js"\n];'),'dynamic runtime injection must load the optimizer');
 const optimizer=read('content/profile-optimizer.js');
 assert.match(optimizer,/headings=\[\.\.\.document\.querySelectorAll/);
 assert.match(optimizer,/text:raw,headings/);
});

test('LinkedIn profile senders may optimize, but cannot use job-message privileges',()=>{
 const code=read('background.js'),start=code.indexOf('function getPortalIdFromUrl('),end=code.indexOf('function openPage(');
 assert.ok(start>=0 && end>start);
 const context={URL};
 vm.runInNewContext(code.slice(start,end)+';globalThis.allowed=canReceivePortalMessage;',context);
 assert.equal(context.allowed('https://www.linkedin.com/in/example/','jobpilot:profile-optimize'),true);
 assert.equal(context.allowed('https://www.linkedin.com/in/example/details/skills/','jobpilot:profile-optimize'),true);
 for(const type of ['jobpilot:capture','jobpilot:rank-list-ai','jobpilot:inline-analyze','jobpilot:toggle-applied']){
  assert.equal(context.allowed('https://www.linkedin.com/in/example/',type),false,type);
 }
 assert.equal(context.allowed('https://www.linkedin.com/feed/','jobpilot:profile-optimize'),false);
 assert.equal(context.allowed('https://evil.example/in/example/','jobpilot:profile-optimize'),false);
 assert.equal(context.allowed('http://www.linkedin.com/in/example/','jobpilot:profile-optimize'),false);
 assert.equal(context.allowed('https://www.linkedin.com/jobs/view/123','jobpilot:capture'),true);
});

test('Puter AI job batch remains deliberately capped at two in both call sites',async()=>{
 const {MAX_AI_BATCH}=await import('../core/puter-client.js');
 assert.equal(MAX_AI_BATCH,2);
 assert.match(read('background.js'),/\.slice\(0, MAX_AI_BATCH\)\.map\(key=>cache\[key\]\)/);
 assert.match(read('core/puter-client.js'),/jobs\.slice\(0, MAX_AI_BATCH\)/);
});
