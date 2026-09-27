import {portalForUrl} from './discovery.js';
import {persistPortalCapture} from './storage.js';
const KEY='jobpilot.discovery.browser';
async function current(token){const state=(await chrome.storage.session.get(KEY))[KEY];if(!state || state.token!==token)throw new Error('Discovery session expired. Resume the run.');return state;}
export async function discoveryBrowser(message) {
 if(message.action==='begin') {
  const previous=(await chrome.storage.session.get(KEY))[KEY];
  const state={...previous,token:crypto.randomUUID()};await chrome.storage.session.set({[KEY]:state});return {token:state.token};
 }
 const state=await current(message.token);
 if(message.action==='close') {
  if(state.tabId){try{const tab=await chrome.tabs.get(state.tabId);if(tab.url===state.lastUrl)await chrome.tabs.remove(state.tabId);}catch{}}
  await chrome.storage.session.remove(KEY);return {};
 }
 if(message.action==='focus'){if(state.tabId)await chrome.tabs.update(state.tabId,{active:true});return {};}
 if(message.action==='open') {
  const portal=portalForUrl(message.url);if(!portal)throw new Error('Discovery can only visit supported HTTPS job portals.');
  // Reuse only the tab created by discovery. Never take over an unrelated tab.
  let tab=null;try{if(state.tabId)tab=await chrome.tabs.get(state.tabId);}catch{}
  if(tab && tab.url!==state.lastUrl && tab.pendingUrl!==state.lastUrl)tab=null;
  tab=tab ? await chrome.tabs.update(tab.id,{url:message.url,active:false}) : await chrome.tabs.create({url:message.url,active:false});
  await chrome.storage.session.set({[KEY]:{...state,tabId:tab.id,lastUrl:message.url}});return {tabId:tab.id};
 }
 if(message.action!=='read')throw new Error('Unknown discovery action.');
 const tab=await chrome.tabs.get(state.tabId);
 if(!portalForUrl(tab.url))return {blocked:true,reason:'The portal redirected outside its job site. Open the browser tab to sign in, then resume.'};
 if(tab.status!=='complete')return {waiting:true};
 const results=await chrome.scripting.executeScript({target:{tabId:state.tabId},func:()=>{
  const title=document.title || '';
  const text=(document.body?.innerText || '').slice(0,6000);
  const challenge=/captcha|security check|verify (?:you are|you're|your identity)|access denied|just a moment|unusual traffic/i.test(title) || Boolean(document.querySelector('iframe[src*="captcha"],#challenge-running,#captcha-container'));
  const login=/\/(?:login|signin|sign-in|checkpoint|authwall)(?:\/|$)/i.test(location.pathname) || Boolean(document.querySelector('input[type="password"]')) && /sign in|log in/i.test(text);
  if(challenge || login)return {blocked:true,reason:challenge?'Portal security check. Complete it yourself before resuming.':'Portal sign-in is required. Sign in yourself before resuming.'};
  const engine=globalThis.JobPilotPortalEngine, adapter=engine?.detectAdapter(location.href);
  if(!adapter)return {waiting:true};
  // Split-pane portals can expose both a listing and a selected description.
  const listing=adapter.captureListing?.();const detail=adapter.captureDetail?.();
  const normalize=(job,pageType)=>engine.normalizeJob(job,{portal:adapter.id,pageType,adapterVersion:adapter.version,method:'discovery'});
  const jobs=(listing?.jobs || []).slice(0,60).map(job=>normalize(job,'listing'));
  const job=detail?.job ? normalize(detail.job,'detail') : null;
  return {portal:adapter.id,portalName:adapter.displayName,sourceUrl:location.href,jobs,detail:job,ready:detail?.readiness?.ready!==false};
 }});
 const value=results[0]?.result || {waiting:true};
 if(value.jobs?.length)await persistPortalCapture({...value,pageType:'listing',detail:null});
 if(value.detail && value.ready)await persistPortalCapture({...value,pageType:'detail',jobs:[]});
 return value;
}
