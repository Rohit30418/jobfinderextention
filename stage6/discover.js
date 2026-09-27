import {getState,getPreferences,getNaukriNativeFilters,getJobCache,getAppliedJobs,getPuterToken,getAiAuthorized} from '../core/storage.js';
import {DISCOVERY_KEY,buildDiscoveryPlan,addDiscoveredJobs,safeJobUrl} from '../core/discovery.js';
import {analysisRevision} from '../core/analysis-inputs.js';
import {recommendationFor,compareRecommendations} from '../core/agent-recommendation.js';
const $=id=>document.getElementById(id);
let run=null,busy=false,stopped=false,token='',profile,preferences;
const rpc=async message=>{const result=await chrome.runtime.sendMessage(message);if(!result?.ok)throw new Error(result?.error || 'The extension did not respond. Reload and resume.');return result;};
const browser=(action,extra={})=>rpc({type:'jobpilot:discovery-browser',action,token,...extra});
async function inputs(){profile=(await getState()).profile;preferences=await getPreferences();if(!profile || !preferences?.targetRoles?.length)throw new Error('Save your profile and target roles before discovery.');}
async function save(){if(run){run.updatedAt=new Date().toISOString();await chrome.storage.local.set({[DISCOVERY_KEY]:run});}render();}
function event(message){run.events.push(message);run.events=run.events.slice(-40);}
function render(){
 $('start').disabled=busy || !run || run.status==='completed';$('start').textContent=run?.status==='paused'?'Resume discovery':'Start discovery';
 $('prepare').disabled=busy;$('suggest').disabled=busy;$('stop').disabled=!busy;$('skip').disabled=busy || run?.status!=='paused';$('focus').disabled=!token;
 $('status').textContent=run ? (busy?'Running':run.status==='completed'?'Run complete':run.status==='paused'?'Paused':'Plan ready') : 'Ready to plan';
 $('progress').textContent=run ? `Searches ${run.searchIndex}/${run.searches.length} · Collected ${run.jobs.length}/${run.limit} · Screened ${run.screenIndex}/${run.jobs.length} · Details ${run.detailIndex}/${run.detailKeys.length}`:'';
 $('meter').value=run ? run.status==='completed'?100:run.phase==='search'?30*run.searchIndex/Math.max(1,run.searches.length):run.phase==='screen'?30+30*run.screenIndex/Math.max(1,run.jobs.length):60+40*run.detailIndex/Math.max(1,run.detailKeys.length):0;
 $('searches').replaceChildren(...(run?.searches || []).map(search=>{const li=document.createElement('li'),a=document.createElement('a');a.textContent=`${search.portal}: ${search.query}${search.location?' · '+search.location:''}`;a.href=search.url;a.target='_blank';a.rel='noopener';li.append(a);return li;}));
 $('events').replaceChildren(...(run?.events || []).slice(-12).map(text=>{const li=document.createElement('li');li.textContent=text;return li;}));
}
function message(text){$('message').textContent=text;}
function checkpoint(){if(stopped)throw new Error('Stopped. Saved progress is ready to resume.');}
async function ensureInputs(){await inputs();if(run.inputRevision!==analysisRevision(profile,preferences,{}))throw new Error('Your profile or preferences changed. Build a new plan so searches and rankings use the updated details.');}
async function visit(url,kind,expectedJob=null){
 checkpoint();await browser('open',{url});
 const deadline=Date.now()+35000;
 while(Date.now()<deadline){
  checkpoint();await new Promise(resolve=>setTimeout(resolve,1200));checkpoint();
  let captured;try{captured=await browser('read');}catch(error){if(/No tab|tab was closed/i.test(error.message))throw error;continue;}
  if(captured.blocked)throw new Error(captured.reason);
  if(kind==='search' && captured.jobs?.length)return captured;
  if(kind==='detail' && captured.ready && captured.detail?.description?.length>=300 && globalThis.JobPilotPortalEngine.sameJob(captured.detail,expectedJob))return captured;
 }
 return null;
}
async function execute(){
 if(busy || !run)return;
 await navigator.locks.request('jobpilot.discovery.runner',{ifAvailable:true},async lock=>{
  if(!lock){message('Discovery is already running in another JobPilot tab.');return;}
  busy=true;stopped=false;run.status='running';render();message('');
  try{
   await ensureInputs();if(!await getPuterToken() || !await getAiAuthorized())throw new Error('Connect and authorize Puter from Profile, then resume.');
   token=(await browser('begin')).token;await save();
   while(run.phase==='search' && run.searchIndex<run.searches.length && run.jobs.length<run.limit){
    checkpoint();await ensureInputs();const search=run.searches[run.searchIndex];message(`Searching ${search.portal}: ${search.query}`);await save();
    const captured=await visit(search.url,'search');
    if(captured){const before=run.jobs.length;const applied=await getAppliedJobs();const cap=Math.max(2,Math.ceil(run.limit/Math.min(6,run.searches.length)));addDiscoveredJobs(run,captured.jobs.filter(job=>!run.jobs.includes(job.key) && !applied.items?.[job.key]).slice(0,cap),Object.keys(applied.items || {}));event(`${search.portal}: collected ${run.jobs.length-before} new jobs.`);}
    else event(`${search.portal}: no readable listing within 35 seconds. This search was skipped.`);
    run.searchIndex++;await save();
   }
   if(run.phase==='search'){run.phase='screen';await save();}
   while(run.phase==='screen' && run.screenIndex<run.jobs.length){
    checkpoint();await ensureInputs();const keys=run.jobs.slice(run.screenIndex,run.screenIndex+2);message('AI is screening captured jobs against your profile…');
    await rpc({type:'jobpilot:rank-list-ai',jobs:keys.map(key=>({key}))});run.screenIndex+=keys.length;await save();
   }
   if(run.phase==='screen'){const cache=await getJobCache();run.detailKeys=run.jobs.map(key=>cache[key]).filter(job=>job && recommendationFor(job)?.decision!=='SKIP').sort(compareRecommendations).map(job=>job.key);run.phase='details';await save();}
   while(run.phase==='details' && run.detailIndex<run.detailKeys.length){
    checkpoint();await ensureInputs();const key=run.detailKeys[run.detailIndex],job=(await getJobCache())[key];
    if(!job || !safeJobUrl(job.canonicalUrl,job.portal)){event('Skipped a missing or unsupported job link.');run.detailIndex++;await save();continue;}
    message(`Reading full description: ${job.title}`);await save();
    const captured=await visit(job.canonicalUrl,'detail',job);
    if(captured){const current=(await getJobCache())[key] || captured.detail;const result=await rpc({type:'jobpilot:inline-analyze',job:current,forceAi:true});if(result.aiStatus==='unavailable')throw new Error(result.job?.aiError || 'AI unavailable. Resume to retry this job.');event(`${job.title}: ${result.match?.applyDecision?.action || 'REVIEW'}.`);}
    else event(`${job.title}: full description unavailable; listing-only advice retained.`);
    run.detailIndex++;await save();
   }
   checkpoint();run.status='completed';event('Discovery finished. Review the ranked shortlist and its evidence.');await browser('close');token='';message('Run complete. Strong matches are in Recommended; uncertain jobs remain in Review.');
  }catch(error){run.status='paused';message(error?.message || String(error));event(error?.message || String(error));}
  finally{busy=false;await save();}
 });
}
$('suggest').addEventListener('click',async()=>{try{$('suggest').disabled=true;message('AI is planning suitable role searches…');await inputs();const plan=await rpc({type:'jobpilot:discovery-plan'});$('queries').value=plan.queries.join('\n');$('planReason').textContent=plan.reason;message('Search suggestions ready. Build the plan to inspect portal searches.');}catch(error){message(error.message);}finally{$('suggest').disabled=false;}});
$('prepare').addEventListener('click',async()=>navigator.locks.request('jobpilot.discovery.runner',{ifAvailable:true},async lock=>{if(!lock){message('Stop the discovery running in another tab before replacing its plan.');return;}try{await inputs();run=buildDiscoveryPlan(profile,preferences,$('queries').value.split('\n'),[...document.querySelectorAll('[name=portal]:checked')].map(x=>x.value),$('limit').value,await getNaukriNativeFilters());run.inputRevision=analysisRevision(profile,preferences,{});await save();message('Plan ready. Start discovery to visit these searches and analyze the results.');}catch(error){message(error.message);}}));
$('start').addEventListener('click',()=>execute().catch(error=>message(error.message)));
$('stop').addEventListener('click',()=>{stopped=true;message('Stopping after the current operation. Progress will be saved.');});
$('focus').addEventListener('click',()=>browser('focus').catch(error=>message(error.message)));
$('skip').addEventListener('click',async()=>{if(!run || busy)return;if(run.phase==='search')run.searchIndex++;else if(run.phase==='screen')run.screenIndex=Math.min(run.jobs.length,run.screenIndex+2);else run.detailIndex++;event('Current step skipped by you.');await save();message('Step skipped. Resume when ready.');});
await inputs().then(()=>{$('queries').value=preferences.targetRoles.slice(0,3).join('\n');}).catch(error=>message(error.message));
run=(await chrome.storage.local.get(DISCOVERY_KEY))[DISCOVERY_KEY] || null;
if(run?.status==='running'){run.status='paused';message('A saved run is available. Resume if it is no longer running in another tab.');}
render();
