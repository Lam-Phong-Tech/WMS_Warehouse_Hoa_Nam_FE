/**
 * Test script for Positions Export API endpoints
 * Xác minh thực tế export Excel/PDF content-type từ BE
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const API_BASE = process.env.API_BASE_URL || (() => { throw new Error('API_BASE_URL env var required'); })();

// Read token from cookies.txt
function getToken() {
  const cookiesPath = path.join(__dirname, '..', 'cookies.txt');
  if (fs.existsSync(cookiesPath)) {
    const content = fs.readFileSync(cookiesPath, 'utf8');
    const match = content.match(/Authorization=Bearer\s+(\S+)/);
    if (match) return match[1];
  }
  return null;
}

async function testExportExcel() {
  const token = getToken();
  if (!token) {
    console.log('❌ No token found in cookies.txt');
    return;
  }

  console.log('\n=== Testing GET /positions/export-excel ===');
  
  try {
    const res = await fetch(`${API_BASE}/positions/export-excel`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      },
    });

    console.log('Status:', res.status);
    console.log('Content-Type:', res.headers.get('Content-Type'));
    console.log('Content-Disposition:', res.headers.get('Content-Disposition'));
    
    if (res.status === 200) {
      const blob = await res.blob();
      console.log('Blob type:', blob.type);
      console.log('Blob size:', blob.size, 'bytes');
      
      // Save to file for verification
      const arrayBuffer = await blob.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const outputPath = path.join(__dirname, '..', 'docs', 'evidence', 'positions', 'export-excel-test.xlsx');
      fs.mkdirSync(path.dirname(outputPath), { recursive: true });
      fs.writeFileSync(outputPath, buffer);
      console.log('✅ Saved to:', outputPath);
    } else {
      const text = await res.text();
      console.log('Error response:', text);
    }
  } catch (error) {
    console.error('Error:', error.message);
  }
}

async function testExportPdf() {
  const token = getToken();
  if (!token) {
    console.log('❌ No token found in cookies.txt');
    return;
  }

  console.log('\n=== Testing GET /positions/export-pdf ===');
  
  try {
    const res = await fetch(`${API_BASE}/positions/export-pdf`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json, application/pdf',
      },
    });

    console.log('Status:', res.status);
    console.log('Content-Type:', res.headers.get('Content-Type'));
    console.log('Content-Disposition:', res.headers.get('Content-Disposition'));
    
    if (res.status === 200) {
      const blob = await res.blob();
      console.log('Blob type:', blob.type);
      console.log('Blob size:', blob.size, 'bytes');
      
      // Save to file for verification
      const arrayBuffer = await blob.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const outputPath = path.join(__dirname, '..', 'docs', 'evidence', 'positions', 'export-pdf-test.pdf');
      fs.mkdirSync(path.dirname(outputPath), { recursive: true });
      fs.writeFileSync(outputPath, buffer);
      console.log('✅ Saved to:', outputPath);
    } else {
      const text = await res.text();
      console.log('Error response:', text);
    }
  } catch (error) {
    console.error('Error:', error.message);
  }
}

async function testTrashed() {
  const token = getToken();
  if (!token) {
    console.log('❌ No token found in cookies.txt');
    return;
  }

  console.log('\n=== Testing GET /positions/trashed ===');
  
  try {
    const res = await fetch(`${API_BASE}/positions/trashed`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json',
      },
    });

    console.log('Status:', res.status);
    const data = await res.json();
    console.log('Response:', JSON.stringify(data, null, 2).substring(0, 500));
  } catch (error) {
    console.error('Error:', error.message);
  }
}

// Run all tests
console.log('Starting Positions API tests...');
await testExportExcel();
await testExportPdf();
await testTrashed();