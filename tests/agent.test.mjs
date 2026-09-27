import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeRecommendation,compareRecommendations,recommendationFor} from '../core/agent-recommendation.js';
import {evaluateDeepMatch} from '../core/match-engine.js';
import {analysisRevision} from '../core/analysis-inputs.js';
const profile={currentRole:'Frontend Developer',skills:['React','CSS'],totalExperienceMonths:42,projects:[{name:'Personal React project'}]};
const preferences={targetRoles:['Frontend Developer']};
const job={key:'a',title:'Frontend Developer',skills:['React'],description:'Build React frontend applications. '.repeat(20)};
const good={fitScore:87,decision:'APPLY',roleFit:'MATCH',confidence:'HIGH',summary:'React frontend alignment',whyApply:['Relevant React experience'],whyNotApply:['Confirm professional React requirements'],unknowns:['Salary not stated'],nextStep:'Check the full requirements',evidence:[{candidateQuote:'React',jobQuote:'React',explanation:'Explicit skill overlap'}],hardBlockers:[]};
const rec=(raw=good,j=job)=>normalizeRecommendation(raw,profile,preferences,j);
test('verified recommendations retain evidence and estimated score',()=>{const r=rec();assert.equal(r.decision,'APPLY');assert.equal(r.fitScore,87);assert.equal(r.basis,'JOB_DESCRIPTION');assert.equal(r.evidence.length,1);});
test('invented evidence cannot earn an APPLY or numeric fit',()=>{const r=rec({...good,evidence:[{candidateQuote:'Next.js',jobQuote:'React',explanation:'Invented'}]});assert.equal(r.decision,'REVIEW');assert.equal(r.fitScore,null);assert.equal(r.confidence,'LOW');});
test('missing or string scores are never converted into fake percentages',()=>{for(const fitScore of [null,undefined,'95',NaN]){const r=rec({...good,fitScore});assert.equal(r.fitScore,null);assert.equal(r.decision,'REVIEW');}});
test('listing advice is provisional and cannot claim high confidence',()=>{const r=rec(good,{...job,description:''});assert.equal(r.confidence,'MEDIUM');assert.equal(r.basis,'LISTING');assert.ok(r.unknowns.some(x=>x.includes('full job')));});
test('unverified blockers cause review while verified conflicts prevent APPLY',()=>{
 const fake=rec({...good,hardBlockers:[{candidateQuote:'No degree',jobQuote:'PhD required',explanation:'Invented'}]});assert.equal(fake.decision,'REVIEW');
 const j={...job,description:'Backend Java role. '.repeat(25),skills:['Java']};
 const raw={...good,roleFit:'MISMATCH',evidence:[{candidateQuote:'Frontend Developer',jobQuote:'Backend Java role',explanation:'Different role'}],hardBlockers:[{candidateQuote:'Frontend Developer',jobQuote:'Backend Java role',explanation:'Different responsibilities'}]};
 const r=rec(raw,j);assert.equal(r.decision,'SKIP');assert.ok(r.fitScore<=59);
});
test('unknown and adjacent roles stay out of strong matches',()=>{for(const roleFit of ['UNKNOWN','ADJACENT']){const r=rec({...good,roleFit});assert.equal(r.decision,'REVIEW');assert.ok(r.fitScore<=74);}});
test('APPLY precedes high-scoring REVIEW; strong APPLY ordered first; full analysis wins',()=>{
 const jobs=[{key:'review',aiRanking:{...rec(),decision:'REVIEW',fitScore:99}},{key:'good',aiRanking:rec()},{key:'best',aiRanking:{...rec(),fitScore:95}},{key:'pending'}];
 assert.deepEqual(jobs.sort(compareRecommendations).map(x=>x.key),['best','good','review','pending']);
 assert.equal(recommendationFor({aiRanking:rec(),aiAnalysis:{recommendation:{...rec(),decision:'SKIP'}}}).decision,'SKIP');
});
test('detail score and decision use the same AI recommendation as job list',()=>{
 const recommendation=rec();const analyzed={...job,aiAnalysis:{inputRevision:analysisRevision(profile,preferences,job),recommendation,requiredSkills:['React']}};
 const match=evaluateDeepMatch(profile,preferences,analyzed);
 assert.equal(match.matchScore.score,recommendation.fitScore);assert.equal(match.applyDecision.action,recommendation.decision);assert.equal(match.confidence.level,recommendation.confidence);
});
