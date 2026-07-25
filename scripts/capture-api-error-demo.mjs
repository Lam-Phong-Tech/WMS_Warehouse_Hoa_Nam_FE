/**
 * Script để capture QA evidence cho API Error Demo page
 * Chạy: node scripts/capture-api-error-demo.mjs
 */

import puppeteer from 'puppeteer';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const EVIDENCE_DIR = path.join(__dirname, '../docs/evidence/api-error-demo');

async function captureEvidence() {
  console.log('Starting browser...');
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });

    // Navigate to demo page
    console.log('Navigating to /demo/api-errors...');
    await page.goto('http://localhost:5173/demo/api-errors', {
      waitUntil: 'networkidle2',
    });

    // Wait for page to load
    await page.waitForSelector('h2', { timeout: 5000 });

    // Capture screenshot of demo page
    console.log('Capturing demo page screenshot...');
    await page.screenshot({
      path: path.join(EVIDENCE_DIR, '02-demo-page.png'),
      fullPage: true,
    });

    console.log('Screenshot saved to:', EVIDENCE_DIR);

    // Test 403 scenario
    console.log('Testing 403 Forbidden...');
    await page.click('button:has-text("Test 403 Forbidden")');
    await page.waitForTimeout(2000); // Wait for API call
    await page.screenshot({
      path: path.join(EVIDENCE_DIR, '03-403-result.png'),
      fullPage: true,
    });

    // Test 422 scenario
    console.log('Testing 422 Validation Error...');
    await page.click('button:has-text("Submit Invalid Data")');
    await page.waitForTimeout(2000);
    await page.screenshot({
      path: path.join(EVIDENCE_DIR, '04-422-result.png'),
      fullPage: true,
    });

    // Test 409 scenario
    console.log('Testing 409 Conflict...');
    await page.click('button:has-text("Test 409 Conflict")');
    await page.waitForTimeout(2000);
    await page.screenshot({
      path: path.join(EVIDENCE_DIR, '05-409-result.png'),
      fullPage: true,
    });

    console.log('All screenshots captured successfully!');
  } catch (error) {
    console.error('Error capturing evidence:', error);
  } finally {
    await browser.close();
  }
}

// Create directory if not exists
import fs from 'fs';
if (!fs.existsSync(EVIDENCE_DIR)) {
  fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
}

captureEvidence().catch(console.error);