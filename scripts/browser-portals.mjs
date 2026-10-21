// Controlled five-portal integration matrix in a real unpacked Chromium extension.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
const { chromium } = await import(process.env.JOBPILOT_PLAYWRIGHT_MODULE || 'playwright');

const portalCases = [
  {
    id: 'naukri',
    listing: 'https://www.naukri.com/react-jobs-in-noida',
    listingJob: 'https://www.naukri.com/job-listings-frontend-developer-example-1234567801',
    detail: 'https://www.naukri.com/job-listings-frontend-developer-example-1234567802'
  },
  {
    id: 'foundit',
    listing: 'https://www.foundit.in/search/react-jobs',
    listingJob: 'https://www.foundit.in/job/frontend-developer-1234567811',
    detail: 'https://www.foundit.in/job/frontend-developer-1234567812'
  },
  {
    id: 'linkedin',
    listing: 'https://www.linkedin.com/jobs/search/?keywords=react',
    listingJob: 'https://www.linkedin.com/jobs/view/1234567821/',
    detail: 'https://www.linkedin.com/jobs/view/1234567822/'
  },
  {
    id: 'indeed',
    listing: 'https://in.indeed.com/jobs?q=react',
    listingJob: 'https://in.indeed.com/viewjob?jk=qa-indeed-list',
    detail: 'https://in.indeed.com/viewjob?jk=qa-indeed-detail'
  },
  {
    id: 'hirist',
    listing: 'https://www.hirist.tech/jobfeed',
    listingJob: 'https://www.hirist.tech/j/frontend-developer-1234567841',
    detail: 'https://www.hirist.tech/j/frontend-developer-1234567842'
  }
];

const text = 'We require React and JavaScript frontend development experience. ' +
  'Build accessible applications, collaborate with product designers, ' +
  'maintain web interfaces with HTML and CSS, and review testing coverage. ' +
  'Strong practical knowledge of browser APIs and responsive layouts is required.';

function listingHtml(job) {
  return '<!doctype html><html><body>' +
    '<article class="cust-job-tuple job-card jobs-search-results__list-item job_seen_beacon" data-job-id="12345678">' +
    '<h2><a class="title jcs-JobTitle" href="' + job.listingJob + '">Frontend Developer</a></h2>' +
    '<span class="comp-name company-name companyName">QA Test Company</span>' +
    '<span class="expwdth experience">2-4 years</span>' +
    '<span class="locWdth location">Noida, India</span>' +
    '<div class="description job-snippet">Frontend job using React JavaScript and CSS. Posted today. Apply after reviewing the job.</div>' +
    '<time>1 day ago</time>' +
    '</article></body></html>';
}
function detailHtml(job) {
  const data = {
    '@context': 'https://schema.org',
    '@type': 'JobPosting',
    title: 'Frontend Developer Detail',
    identifier: { value: job.id + '-qa-detail' },
    hiringOrganization: { name: 'QA Test Company' },
    description: '<p>' + text + '</p>',
    url: job.detail,
    datePosted: '2026-10-20',
    jobLocation: { address: { addressLocality: 'Noida', addressRegion: 'UP', addressCountry: 'IN' } },
    skills: ['React', 'JavaScript', 'CSS']
  };
  return '<!doctype html><html><body>' +
    '<h1 class="jd-header-title">Frontend Developer Detail</h1>' +
    '<span class="comp-name company-name companyName">QA Test Company</span>' +
    '<span class="expwdth experience">2-4 years</span>' +
    '<span class="locWdth location">Noida, India</span>' +
    '<section id="jobDescriptionText" class="job-description description job-desc jobs-description__content">' + text + '</section>' +
    '<script type="application/ld+json">' + JSON.stringify(data) + '</script>' +
    '</body></html>';
}

const root = path.resolve('.');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'jobpilot-portals-'));
const context = await chromium.launchPersistentContext(temp, {
  channel: 'chromium', headless: true,
  ...(process.env.JOBPILOT_CHROME ? { executablePath: process.env.JOBPILOT_CHROME } : {}),
  args: ['--no-sandbox', '--disable-extensions-except=' + root, '--load-extension=' + root]
});
const errors = [];
context.on('page', page => page.on('pageerror', error => errors.push(error.message)));

async function awaitCachedJob(extensionPage, id, title, timeout = 14000) {
  const stopAt = Date.now() + timeout;
  while (Date.now() < stopAt) {
    const result = await extensionPage.evaluate(async args => {
      const { getJobCache } = await import('../core/storage.js');
      return Object.values(await getJobCache()).find(x =>
        x.portal === args.id && x.title === args.title
      ) || null;
    }, { id, title });
    if (result) return result;
    await new Promise(resolve => setTimeout(resolve, 150));
  }
  throw new Error('Timed out waiting for ' + id + ' ' + title + ' capture');
}
try {
  const worker = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker');
  const base = 'chrome-extension://' + new URL(worker.url()).host + '/';
  const extensionPage = await context.newPage();
  await extensionPage.goto(base + 'onboarding/onboarding.html');

  for (const entry of portalCases) {
    const portalPage = await context.newPage();
    await portalPage.route('**/*', route => {
      if (route.request().isNavigationRequest()) {
        const body = route.request().url() === entry.listing ? listingHtml(entry) : detailHtml(entry);
        return route.fulfill({ status: 200, contentType: 'text/html', body });
      }
      return route.continue();
    });
    await portalPage.goto(entry.listing);
    const listing = await awaitCachedJob(extensionPage, entry.id, 'Frontend Developer');
    assert.equal(listing.company, 'QA Test Company', entry.id + ' company');
    assert.ok(listing.canonicalUrl.includes(new URL(entry.listingJob).pathname), entry.id + ' url');
    await portalPage.goto(entry.detail);
    const detail = await awaitCachedJob(extensionPage, entry.id, 'Frontend Developer Detail');
    assert.ok(detail.description.includes('accessible applications'), entry.id + ' full JD');
    assert.ok(detail.requiredSkills.length >= 1, entry.id + ' required skills');
    await portalPage.close();
    console.log('PASS: ' + entry.id + ' listing and full detail capture');
  }
  assert.deepEqual(errors, [], 'No uncaught page script errors');
  fs.mkdirSync('test-results', { recursive: true });
  await extensionPage.screenshot({ path: 'test-results/portal-matrix.png', fullPage: true });
  console.log('PASS: all five portal content scripts captured controlled listing/detail pages.');
} finally {
  await context.close();
  fs.rmSync(temp, { recursive: true, force: true });
}
