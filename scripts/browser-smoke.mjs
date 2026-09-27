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
 fs.mkdirSync('test-results',{recursive:true});await page.screenshot({path:'test-results/job-list.png',fullPage:true});
 assert.deepEqual(errors,[],'Browser JavaScript errors');
 console.log('PASS: real extension startup without storage RPC, cross-context Web Lock saves, preference control, Indeed vjk capture, local match, concurrent storage, backup/undo, and pinned bridge transport. Provider authentication remains a live release gate.');
} finally {await context.close();fs.rmSync(temp,{recursive:true,force:true});}
