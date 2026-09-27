import test from 'node:test';
import assert from 'node:assert/strict';
import {buildDiscoveryPlan,addDiscoveredJobs,portalForUrl,safeJobUrl} from '../core/discovery.js';
const profile={currentRole:'Frontend Developer'};
const prefs={targetRoles:['Frontend Developer'],preferredLocations:['Noida','Delhi'],experienceMin:2,experienceMax:4,freshness:'24h'};
test('search plan uses profile preferences, bounded URLs and selected portals',()=>{
 const plan=buildDiscoveryPlan(profile,prefs,['Frontend Developer','UI Developer'],['indeed','naukri'],20);
 assert.equal(plan.searches.length,8);assert.equal(plan.limit,20);
 const url=new URL(plan.searches[0].url);assert.equal(url.searchParams.get('q'),'Frontend Developer');assert.equal(url.searchParams.get('l'),'Noida');assert.equal(url.searchParams.get('fromage'),'1');
 for(const search of plan.searches)assert.equal(portalForUrl(search.url),search.portal);
 assert.throws(()=>buildDiscoveryPlan(null,prefs,['UI'],['indeed']),/profile/);
 assert.throws(()=>buildDiscoveryPlan(profile,prefs,['UI'],[]),/portal/);
});
test('discovery rejects external, credentialed and non-HTTPS links',()=>{
 for(const url of ['http://in.indeed.com/viewjob?jk=1','https://indeed.com.evil.test/viewjob?jk=1','https://u:p@indeed.com/viewjob?jk=1','javascript:alert(1)','https://indeed.com:444/viewjob?jk=1'])assert.equal(portalForUrl(url),null);
 assert.equal(safeJobUrl('https://in.indeed.com/viewjob?jk=1','indeed'),true);
 assert.equal(safeJobUrl('https://in.indeed.com/rc/clk?jk=1','indeed'),true);
 assert.equal(safeJobUrl('https://in.indeed.com/login','indeed'),false);
 assert.equal(safeJobUrl('https://www.linkedin.com/jobs/view/12','indeed'),false);
});
test('discovery deduplicates, omits applied jobs and respects run limit',()=>{
 const run=buildDiscoveryPlan(profile,prefs,['UI'],['indeed'],2);
 const jobs=[1,2,2,3,4].map(id=>({key:String(id),portal:'indeed',canonicalUrl:'https://in.indeed.com/viewjob?jk='+id}));
 addDiscoveredJobs(run,jobs,['1']);assert.deepEqual(run.jobs,['2','3']);addDiscoveredJobs(run,jobs);assert.equal(run.jobs.length,2);
});
test('every supported portal produces an allowed search URL and plans stay bounded',()=>{
 const plan=buildDiscoveryPlan(profile,prefs,['a','b','c','d'],['naukri','indeed','hirist','foundit','linkedin'],999);
 assert.equal(plan.limit,40);assert.equal(plan.searches.length,18);
 for(const search of plan.searches)assert.equal(portalForUrl(search.url),search.portal);
});
