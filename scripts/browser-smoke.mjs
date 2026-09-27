// Real Chromium extension smoke test; portal/AI responses are isolated synthetic fixtures.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
const {chromium}=await import(process.env.JOBPILOT_PLAYWRIGHT_MODULE || 'playwright');
async function poll(read, label, timeout = 15000) {
 const deadline = Date.now() + timeout;
 while (Date.now() < deadline) {
  const value = await read();
  if (value) return value;
  await new Promise(resolve => setTimeout(resolve, 100));
 }
 throw new Error('Timed out waiting for ' + label);
}
const root=path.resolve('.');
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'jobpilot-browser-'));
const context=await chromium.launchPersistentContext(temp,{
 channel:'chromium',headless:true,
 ...(process.env.JOBPILOT_CHROME ? {executablePath:process.env.JOBPILOT_CHROME} : {}),
 args:['--no-sandbox',`--disable-extensions-except=${root}`,`--load-extension=${root}`]
});
const errors=[];context.on('page',page=>page.on('pageerror',error=>errors.push(error.message)));
try {
 const worker=context.serviceWorkers()[0] || await context.waitForEvent('serviceworker');
 const id=new URL(worker.url()).host;const base=`chrome-extension://${id}/`;
 const page=await context.newPage();
 await page.addInitScript(() => {
  const original = chrome.runtime.sendMessage.bind(chrome.runtime);
  chrome.runtime.sendMessage = (message, ...args) => message?.type === 'jobpilot:storage'
    ? Promise.resolve(undefined) : original(message, ...args);
 });
 await page.goto(base+'onboarding/onboarding.html');
 await page.locator('#resumeFile').waitFor({state:'attached'});
 await page.evaluate(async()=>{
  const store=await import('../core/storage.js');
  await store.setState({profile:{name:'Synthetic Candidate',currentRole:'Frontend Developer',skills:['React','JavaScript','CSS'],totalExperienceMonths:42,workExperience:[{title:'Engineer',skillsUsed:['Accessibility']}],projects:[{name:'App',description:'Accessible site',skillsUsed:['React']}]}});
  await store.setPreferences({targetRoles:['Frontend Developer'],freshness:'any'});
 });
 await page.goto(base+'preferences/preferences.html');
 assert.equal(await page.locator('#automaticAi').isChecked(),false);
 await page.goto(base+'stage6/list.html');
 await page.locator('#jobList').waitFor({state:'attached'});
 await page.waitForFunction(()=>document.querySelector('#listingStatus')?.textContent!=='Loading');
 assert.ok(!(await page.locator('body').innerText()).includes('Could not load JobPilot list'));
 // Serve a controlled portal document at its actual origin to exercise manifest injection.
 await context.route('https://in.indeed.com/**',route=>route.fulfill({contentType:'text/html',body:`<!doctype html><html><head><title>Fixture job</title></head><body>
 <h1 data-testid="jobsearch-JobInfoHeader-title">Frontend Developer</h1>
 <div data-testid="inlineHeader-companyName">Synthetic Company</div>
 <div data-testid="job-location">Remote</div>
 <div id="jobDetailsSection">2-4 years experience</div>
 <div id="jobDescriptionText"><h2>Requirements</h2><p>We seek a Frontend Developer with React, JavaScript and CSS. Build accessible web applications and responsive interfaces. Collaborate with designers and maintain reliable automated tests. Experience with React and JavaScript is required.</p></div>
 <a href="/viewjob?jk=fixture-a">Frontend Developer</a></body></html>`}));
 const portal=await context.newPage();await portal.goto('https://in.indeed.com/jobs?q=react&vjk=fixture-a');
 const captured=await poll(()=>page.evaluate(async()=>{const x=await chrome.storage.local.get('jobpilot.jobs.cache');return Object.values(x['jobpilot.jobs.cache'] || {}).find(job=>job.portalJobId==='fixture-a');}), 'Indeed capture');
 assert.equal(captured.title,'Frontend Developer');assert.ok(captured.description.includes('accessible'));
 const result=await page.evaluate(async job=>chrome.runtime.sendMessage({type:'jobpilot:inline-analyze',job}),captured);
 assert.equal(result.ok,true);assert.equal(result.aiStatus,'local');assert.ok(result.match);
 // Concurrent extension-page RPC and export/import/undo through the real service worker.
 await page.evaluate(async job=>{
  const s=await import('../core/storage.js');
  await Promise.all([s.markJobApplied(job),s.markJobApplied({...job,key:'indeed:fixture-b',portalJobId:'fixture-b'})]);
  const applied=await s.getAppliedJobs();if(Object.keys(applied.items).length!==2)throw new Error('Lost applied write');
  const backup=await s.exportJobPilotBackup();await s.importJobPilotBackup(backup);await s.undoLastImport();
 },captured);
 // Coordinate writes across two extension documents and the worker even with
 // storage RPC unavailable in the primary document.
 const second = await context.newPage();await second.goto(base+'stage6/list.html');
 await Promise.all([
  page.evaluate(async job=>{const s=await import('../core/storage.js');await Promise.all([0,1].map(i=>s.markJobApplied({...job,key:'lock-page-a-'+i})));},captured),
  second.evaluate(async job=>{const s=await import('../core/storage.js');await Promise.all([0,1].map(i=>s.markJobApplied({...job,key:'lock-page-b-'+i})));},captured),
  page.evaluate(async job=>{await Promise.all([0,1].map(i=>chrome.runtime.sendMessage({type:'jobpilot:toggle-applied',job:{...job,key:'lock-worker-'+i}})));},captured)
 ]);
 await page.evaluate(async()=>{
  const s=await import('../core/storage.js');const saved=await s.getAppliedJobs();
  if(Object.keys(saved.items).length!==8)throw new Error('Cross-context write lost');
  await Promise.all(Object.keys(saved.items).filter(key=>key.startsWith('lock-')).map(key=>s.unmarkJobApplied(key)));
 });
 await second.close();
 // Auth transport tested with a synthetic provider at the allowed bridge origin.
 const state=await page.evaluate(async()=>{const result=await chrome.runtime.sendMessage({type:'jobpilot:auth-begin'});if(!result.ok)throw new Error(result.error);return result.state;});
 await context.route('https://rohit30418.github.io/jobfinderextention/**',route=>{
  const url=new URL(route.request().url());
  if(url.pathname.endsWith('puter-auth.js'))return route.fulfill({contentType:'application/javascript',body:fs.readFileSync('site/puter-auth.js','utf8')});
  return route.fulfill({contentType:'text/html',body:'<!doctype html><div id="status"></div><button id="connectBtn">Connect</button><script>globalThis.puter={auth:{signIn:async()=>({token:"synthetic-browser-test"})},ui:{requestPermission:async()=>true}};</script><script src="puter-auth.js"></script>'});
 });
 const bridge=await context.newPage();await bridge.goto('https://rohit30418.github.io/jobfinderextention/puter-auth.html?state='+state);await bridge.locator('#connectBtn').click();
 await poll(()=>page.evaluate(async()=>{const x=await chrome.storage.session.get('jobpilot.puter.token');return x['jobpilot.puter.token']==='synthetic-browser-test';}), 'bridge token acceptance');
 const auth=await page.evaluate(async state=>chrome.runtime.sendMessage({type:'jobpilot:auth-status',state}),state);assert.equal(auth.completed,true);
 // Exercise the complete agent UI with controlled AI responses (no provider billing).
 await worker.evaluate(() => {
  globalThis.fetch = async (_url, options) => {
   const prompt = JSON.parse(options.body).args.messages[0].content;
   const make = job => ({fitScore:job.title.includes('Best') ? 94 : 82,decision:job.title.includes('Backend') ? 'SKIP' : job.title.includes('Uncertain') ? 'REVIEW' : 'APPLY',roleFit:job.title.includes('Backend') ? 'MISMATCH' : 'MATCH',confidence:'HIGH',summary:'Fixture candidate comparison',whyApply:['React evidence in profile'],whyNotApply:['Verify role-specific requirements'],unknowns:['Salary not stated'],nextStep:'Review the posting',evidence:[{candidateQuote:'React',jobQuote:'React',explanation:'Explicit skill evidence'}],hardBlockers:[]});
   let output;
   if(prompt.startsWith('Create up to 3')) { output={queries:['Frontend Developer'],reason:'Based on frontend experience and React skills'};
   } else if(prompt.includes('\nJOBS:\n')) {
    const jobs=JSON.parse(prompt.split('\nJOBS:\n')[1]);output={results:jobs.map(job=>({key:job.key,recommendation:make(job)}))};
   } else {
    const job=JSON.parse(prompt.split('\nJOB_DATA:\n')[1].split('\nCANDIDATE_DATA:\n')[0]);output={requiredSkills:['React'],candidateRequirementMatches:[{requirement:'React',status:'EXACT',evidence:['React'],explanation:'Explicit skill'}],recommendation:make(job)};
   }
   return {ok:true,status:200,json:async()=>({result:{message:{content:JSON.stringify(output)}}})};
  };
 });
 await page.evaluate(async job=>{
  const s=await import('../core/storage.js');await s.setAiAuthorized(true);
  const jobs=['Best Frontend','Good Frontend','Backend Java','Uncertain Frontend'].map((title,i)=>({...job,key:'indeed:agent-'+i,portalJobId:'agent-'+i,canonicalUrl:'https://in.indeed.com/viewjob?jk=agent-'+i,title,description:'React job responsibilities and qualifications. '.repeat(15)}));
  await s.persistPortalCapture({portal:'indeed',pageType:'listing',jobs});
 },captured);
 await page.locator('#aiRankBtn').click();
 await poll(()=>page.evaluate(async()=>{const x=await chrome.storage.local.get('jobpilot.jobs.cache');return Object.values(x['jobpilot.jobs.cache'] || {}).filter(job=>job.key.startsWith('indeed:agent-') && job.aiRanking).length===4;}),'AI agent complete');
 await poll(async()=>await page.locator('#jobList .job h3').count()===2,'AI shortlist rendering');
 assert.deepEqual(await page.locator('#jobList .job h3').allTextContents(),['Best Frontend','Good Frontend']);
 await page.locator('#jobList .agent-explanation summary').first().click();
 assert.ok((await page.locator('#jobList').innerText()).includes('Why not / gaps'));
 await page.locator('[data-mode="skip"]').click();assert.equal(await page.locator('#jobList .job h3').innerText(),'Backend Java');
 await page.locator('[data-mode="review"]').click();assert.equal(await page.locator('#jobList .job h3').innerText(),'Uncertain Frontend');
 const detail = await page.evaluate(async()=>{const s=await import('../core/storage.js');const job=(await s.getJobCache())['indeed:agent-0'];return chrome.runtime.sendMessage({type:'jobpilot:inline-analyze',job,forceAi:true});});
 assert.equal(detail.ok,true);assert.equal(detail.aiStatus,'completed');assert.equal(detail.match.matchScore.score,94);assert.equal(detail.match.applyDecision.action,'APPLY');
 await page.locator('[data-mode="recommended"]').click();
 // Stop finishes the in-flight batch; Run resumes only pending jobs.
 await page.evaluate(async job=>{
  const s=await import('../core/storage.js');
  await s.persistPortalCapture({portal:'indeed',pageType:'listing',jobs:Array.from({length:4},(_,i)=>({...job,key:'indeed:resume-'+i,portalJobId:'resume-'+i,canonicalUrl:'https://in.indeed.com/viewjob?jk=resume-'+i,title:'Good Frontend '+i}))});
 },captured);
 await worker.evaluate(()=>{const original=globalThis.fetch;globalThis.fetch=async(...args)=>{if(!globalThis.agentGateUsed){globalThis.agentGateUsed=true;await new Promise(resolve=>{globalThis.releaseAgentGate=resolve;});}return original(...args);};});
 await page.locator('#aiRankBtn').click();
 await poll(()=>worker.evaluate(()=>Boolean(globalThis.releaseAgentGate)),'agent request started');
 await page.locator('#agentStopBtn').click();await worker.evaluate(()=>globalThis.releaseAgentGate());
 await poll(()=>page.locator('#aiRankStatus').innerText().then(text=>text.includes('Agent paused')),'agent stopped');
 const countResumed=()=>page.evaluate(async()=>{const s=await import('../core/storage.js');return Object.values(await s.getJobCache()).filter(job=>job.key.startsWith('indeed:resume-') && job.aiRanking).length;});
 assert.equal(await countResumed(),2);
 await page.locator('#aiRankBtn').click();await poll(async()=>await countResumed()===4,'agent resumed');
 // Agent mode also enables AI on detail pages; disabling it stops automatic work.
 await page.locator('#agentAuto').check();
 await poll(()=>page.evaluate(async()=>{const s=await import('../core/storage.js');const p=await s.getPreferences();return p.agentEnabled && p.automaticAi;}),'agent preference enabled');
 await poll(async()=>await countResumed()===4,'automatic agent reanalysis');
 await page.locator('#agentAuto').uncheck();
 await poll(()=>page.evaluate(async()=>{const s=await import('../core/storage.js');const p=await s.getPreferences();return !p.agentEnabled && !p.automaticAi;}),'agent preference disabled');
 // Automatic discovery: real extension-created tab, portal adapters, AI screening,
 // full descriptions, challenge pause, Stop and resume after controller reload.
 let blockDiscovery=true;
 await context.route('https://in.indeed.com/**',route=>{
  const url=new URL(route.request().url());
  if(blockDiscovery)return route.fulfill({contentType:'text/html',body:'<!doctype html><title>Security check</title><h1>Verify you are human</h1>'});
  if(url.pathname==='/jobs')return route.fulfill({contentType:'text/html',body:'<!doctype html><title>Frontend jobs</title>'+['Discovery Best Frontend','Discovery Good Frontend'].map((title,i)=>`<div class="job_seen_beacon" data-jk="discovery-${i}"><h2 class="jobTitle"><a class="jcs-JobTitle" data-jk="discovery-${i}" href="/viewjob?jk=discovery-${i}">${title}</a></h2><span data-testid="company-name">Fixture Company</span><span data-testid="text-location">Remote</span><div class="job-snippet">React CSS JavaScript frontend job development</div><span class="date">Just posted</span></div>`).join('')});
  const best=url.searchParams.get('jk')==='discovery-0';
  return route.fulfill({contentType:'text/html',body:`<!doctype html><title>Job details</title><h1 data-testid="jobsearch-JobInfoHeader-title">Discovery ${best?'Best':'Good'} Frontend</h1><div data-testid="inlineHeader-companyName">Fixture Company</div><div id="job-location">Remote</div><div id="jobDetailsSection">2-4 years experience</div><div id="jobDescriptionText">${'Build React frontend applications using CSS and JavaScript. '.repeat(15)}</div>`});
 });
 const discover=await context.newPage();await discover.goto(base+'stage6/discover.html');
 await discover.locator('#suggest').click();await poll(()=>discover.locator('#planReason').innerText().then(x=>x.includes('React')),'AI search planning');
 for(const portal of ['naukri','hirist'])await discover.locator(`[name="portal"][value="${portal}"]`).uncheck();
 await discover.locator('#limit').fill('2');await discover.locator('#prepare').click();
 await discover.locator('#start').click();
 await poll(()=>discover.locator('#status').innerText().then(x=>x==='Paused'),'portal challenge pause');
 assert.ok((await discover.locator('#message').innerText()).includes('security check'));
 blockDiscovery=false;
 await discover.locator('#start').click();await discover.locator('#stop').click();
 await poll(()=>discover.locator('#status').innerText().then(x=>x==='Paused'),'discovery Stop');
 await discover.reload();await discover.locator('#start').click();
 await poll(()=>discover.locator('#status').innerText().then(x=>x==='Run complete'),'complete discovery pipeline',60000);
 const discovery=await discover.evaluate(async()=>{const s=await import('../core/storage.js');const run=(await chrome.storage.local.get('jobpilot.discovery.run'))['jobpilot.discovery.run'];const cache=await s.getJobCache();return {run,jobs:run.jobs.map(key=>cache[key])};});
 assert.equal(discovery.jobs.length,2);assert.equal(discovery.run.detailIndex,2);
 for(const job of discovery.jobs){assert.ok(job.description.length>=300);assert.equal(job.aiAnalysis.recommendation.decision,'APPLY');}
 await page.reload();await poll(async()=>await page.locator('#jobList').innerText().then(x=>x.includes('Discovery Best Frontend')),'discovered shortlist');
 fs.mkdirSync('test-results',{recursive:true});
 await discover.screenshot({path:'test-results/discovery.png',fullPage:true});
 fs.mkdirSync('test-results',{recursive:true});await page.screenshot({path:'test-results/job-list.png',fullPage:true});
 assert.deepEqual(errors,[],'Browser JavaScript errors');
 console.log('PASS: AI agent shortlist ordering, evidence, review/skip filters and shared detail score with controlled provider responses; real extension startup without storage RPC, cross-context Web Lock saves, preference control, Indeed vjk capture, local match, concurrent storage, backup/undo, and pinned bridge transport. Provider authentication remains a live release gate.');
} finally {await context.close();fs.rmSync(temp,{recursive:true,force:true});}
