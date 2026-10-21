// End-to-end onboarding checks using the actual unpacked Chrome extension.
// This deliberately uses synthetic candidate data; it never submits real applications.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const { chromium } = await import(process.env.JOBPILOT_PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve('.');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'jobpilot-onboarding-'));
const context = await chromium.launchPersistentContext(temp, {
  channel: 'chromium',
  headless: true,
  ...(process.env.JOBPILOT_CHROME ? { executablePath: process.env.JOBPILOT_CHROME } : {}),
  args: ['--no-sandbox', '--disable-extensions-except=' + root, '--load-extension=' + root]
});
const errors = [];
context.on('page', page => page.on('pageerror', error => errors.push(error.message)));

try {
  const worker = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker');
  const base = 'chrome-extension://' + new URL(worker.url()).host + '/';
  const page = await context.newPage();
  await page.goto(base + 'onboarding/onboarding.html');
  await page.locator('#resumeFile').waitFor({ state: 'attached' });

  // Re-open an AI-created profile containing both project objects and strings.
  await page.evaluate(async () => {
    const store = await import('../core/storage.js');
    const resumeText = [
      'Synthetic Candidate - Frontend Developer - candidate@example.com',
      'Summary',
      'Experienced UI developer building accessible frontend applications using JavaScript React HTML and CSS.',
      'Experience',
      'Developed responsive interfaces, managed browser storage, tested forms, improved navigation, fixed accessibility issues.',
      'Skills',
      'JavaScript React CSS HTML Playwright',
      'Education',
      'University software engineering coursework and practical frontend training.',
      'Projects',
      'Vaani real time audio and video room application.',
      'JobPilot job search browser extension and resume analysis tool.',
      'Additional work includes cross browser testing, application state management, and reusable UI components.'
    ].join('\n');
    await store.setState({
      resume: { text: resumeText, source: 'paste' },
      profile: {
        name: 'Synthetic Candidate',
        currentRole: 'Frontend Developer',
        totalExperienceMonths: 42,
        skills: ['React', 'JavaScript', 'CSS'],
        projects: [
          { name: 'Vaani', description: 'WebRTC rooms', skillsUsed: ['React'] },
          'JobPilot Chrome extension',
          { name: '<img src=x onerror=alert(1)>', description: 'Safe project rendering' }
        ],
        education: [{ qualification: 'B.Tech', institution: 'Example University', year: '2020' }]
      }
    });
  });
  await page.reload();
  await page.locator('#profileReview').getByText('Projects / work').waitFor();
  const review = await page.locator('#profileReview').innerText();
  assert.ok(review.includes('Vaani — WebRTC rooms'), review);
  assert.ok(review.includes('JobPilot Chrome extension'), review);
  assert.ok(!review.includes('[object Object]'), review);
  assert.equal(await page.locator('#profileReview img').count(), 0, 'Project HTML must be escaped');
  assert.ok(review.includes('B.Tech'), 'Structured education should render');
  await page.locator('#editProfileBtn').click();
  assert.ok((await page.locator('#profileProjects').inputValue()).includes('Vaani — WebRTC rooms'));
  await page.locator('#reviewProfileBtn').click();

  // Fresh account: rejected short text -> valid pasted resume -> edit -> review -> save.
  page.once('dialog', dialog => dialog.accept());
  await page.locator('#deleteProfileBtn').click();
  await page.locator('#pasteText').fill('too short');
  await page.locator('#usePasteBtn').click();
  assert.equal(await page.locator('#continueProfileBtn').isDisabled(), true);
  await page.locator('#backToResumeBtn').click();
  const validResume = [
    'Test Candidate - Frontend Developer - test@example.com',
    'Summary',
    'Frontend developer with practical experience building accessible and responsive applications for users across desktop mobile and tablets.',
    'Experience',
    'Developed reusable React components and integrated web APIs. Improved keyboard navigation, loading states, form handling, error handling, page performance, semantic HTML, and CSS layouts.',
    'Skills',
    'React JavaScript TypeScript HTML CSS Redux Git Playwright Jest Accessibility',
    'Projects',
    'A browser extension for searching jobs and reviewing candidate evidence.',
    'A WebRTC room application with real time messaging and audio features.',
    'Education',
    'Bachelors degree in engineering with a focus on web technology and practical software projects.'
  ].join('\n');
  await page.locator('#pasteText').fill(validResume);
  await page.locator('#usePasteBtn').click();
  assert.equal(await page.locator('#continueProfileBtn').isEnabled(), true);
  await page.locator('#continueProfileBtn').click();
  await page.locator('#profileName').fill('Test Candidate');
  await page.locator('#profileCurrentRole').fill('Frontend Developer');
  await page.locator('#profileProjects').fill('Vaani - WebRTC audio rooms\nJobPilot - job extension');
  await page.locator('#reviewProfileBtn').click();
  const finalReview = await page.locator('#profileReview').innerText();
  assert.ok(finalReview.includes('Vaani - WebRTC audio rooms'));
  assert.ok(!finalReview.includes('[object Object]'));
  await page.locator('#saveProfileBtn').click();
  await page.locator('#saveMessage.success').waitFor();
  await page.reload();
  await page.locator('#profileReview').getByText('Projects / work').waitFor();
  assert.ok((await page.locator('#profileReview').innerText()).includes('JobPilot - job extension'));
  const persisted = await page.evaluate(async () => (await import('../core/storage.js')).getState());
  assert.equal(persisted.profile.name, 'Test Candidate');
  assert.equal(persisted.profile.projects.length, 2);
  assert.equal(persisted.resume.source, 'paste');
  assert.deepEqual(errors, [], 'No uncaught browser JavaScript errors');
  fs.mkdirSync('test-results', { recursive: true });
  await page.screenshot({ path: 'test-results/onboarding-review.png', fullPage: true });
  console.log('PASS: existing structured-project review, HTML escaping, editable review, short-text rejection, valid pasted resume, profile save and persistence after reload.');
} finally {
  await context.close();
  fs.rmSync(temp, { recursive: true, force: true });
}
