import {buildPortalSearches} from './search-urls.js';
export const DISCOVERY_KEY='jobpilot.discovery.run';
export const PORTALS=['indeed','naukri','hirist','linkedin','foundit'];
export function portalForUrl(value) {
 try { const u=new URL(value); if(u.protocol!=='https:' || u.username || u.password || u.port && u.port!=='443')return null;
 const roots={indeed:'indeed.com',naukri:'naukri.com',hirist:'hirist.tech',linkedin:'linkedin.com',foundit:'foundit.in'};
 return Object.keys(roots).find(id=>u.hostname===roots[id] || u.hostname.endsWith('.'+roots[id])) || null;
 }catch{return null;}
}
export function safeJobUrl(value,portal) {
 if(portalForUrl(value)!==portal)return false;
 const u=new URL(value);
 return ({indeed:()=>['/viewjob','/rc/clk'].includes(u.pathname) && Boolean(u.searchParams.get('jk')) || u.pathname==='/jobs' && Boolean(u.searchParams.get('vjk')),linkedin:()=>/^\/jobs\/view\//.test(u.pathname),naukri:()=>/^\/job-listings?-/.test(u.pathname),hirist:()=>/^\/(?:j|job)\//.test(u.pathname),foundit:()=>/^\/(?:job|job-detail|seeker\/job-details)\//.test(u.pathname)})[portal]?.() || false;
}
export function buildDiscoveryPlan(profile,preferences,queries,portals,limit=20,learned={}) {
 if(!profile || !preferences?.targetRoles?.length)throw new Error('Save your profile and target roles first.');
 const allowed=PORTALS.filter(id=>portals.includes(id));if(!allowed.length)throw new Error('Choose at least one portal.');
 const terms=[...new Set((Array.isArray(queries)?queries:[]).filter(x=>typeof x==='string').map(x=>x.replace(/\s+/g,' ').trim().slice(0,100)).filter(Boolean))].slice(0,3);
 if(!terms.length)throw new Error('Add at least one search query.');
 const locations=preferences.preferredLocations?.length ? preferences.preferredLocations.slice(0,2) : [''];
 const searches=[];
 for(const query of terms)for(const location of locations){
  const spec={primaryRole:query,searchTerms:[query],locations:location?[location]:[],experienceMin:preferences.experienceMin ?? null,experienceMax:preferences.experienceMax ?? null,freshness:preferences.freshness || '7d'};
  const urls=buildPortalSearches(spec,learned);
  for(const portal of allowed) searches.push({portal,query,location,url:urls[portal].url,note:urls[portal].note});
 }
 return {version:1,queries:terms,portals:allowed,limit:Math.max(1,Math.min(40,Math.floor(Number(limit)||20))),searches:searches.slice(0,18),searchIndex:0,screenIndex:0,detailIndex:0,jobs:[],detailKeys:[],events:[],phase:'search',status:'ready',createdAt:new Date().toISOString()};
}
export function addDiscoveredJobs(run,jobs,appliedKeys=[]) {
 const seen=new Set(run.jobs), applied=new Set(appliedKeys);
 for(const job of jobs || []) {
  if(run.jobs.length>=run.limit)break;
  if(job?.key && !seen.has(job.key) && !applied.has(job.key) && safeJobUrl(job.canonicalUrl,job.portal)) {run.jobs.push(job.key);seen.add(job.key);}
 }
 return run;
}
