// Simple verification script for validation constants
import { validateEmail, validatePhone, normalizePhone, formatPhone } from './validation.constants.js';

console.log('=== Email Validation Tests ===\n');

const emailTests = [
  { email: 'user@gmail.com', expected: true, desc: 'Valid Gmail' },
  { email: 'user.name@gmail.com', expected: true, desc: 'Gmail with dot' },
  { email: 'user+tag@gmail.com', expected: true, desc: 'Gmail with plus' },
  { email: 'user@company.com.vn', expected: true, desc: 'Corporate email' },
  { email: 'user@hotmial.com', expected: false, desc: 'Typo: hotmial' },
  { email: 'user@gmai.com', expected: false, desc: 'Typo: gmai' },
  { email: 'user..name@gmail.com', expected: false, desc: 'Consecutive dots' },
  { email: '.user@gmail.com', expected: false, desc: 'Starting with dot' },
  { email: 'invalid', expected: false, desc: 'Invalid format' },
];

let emailPass = 0;
let emailFail = 0;

emailTests.forEach(({ email, expected, desc }) => {
  const result = validateEmail(email);
  const pass = result.isValid === expected;
  if (pass) emailPass++;
  else emailFail++;
  console.log(`${pass ? '✓' : '✗'} ${desc}: ${email} -> ${result.isValid ? 'VALID' : 'INVALID'} ${result.errorMessage ? '(' + result.errorMessage + ')' : ''}`);
});

console.log(`\nEmail Tests: ${emailPass} passed, ${emailFail} failed\n`);

console.log('=== Phone Validation Tests ===\n');

const phoneTests = [
  { phone: '0987654321', expected: true, desc: 'Viettel mobile' },
  { phone: '0912345678', expected: true, desc: 'VinaPhone mobile' },
  { phone: '0901234567', expected: true, desc: 'MobiFone mobile' },
  { phone: '+84987654321', expected: true, desc: 'International format' },
  { phone: '02412345678', expected: true, desc: 'Hanoi landline' },
  { phone: '098 765 4321', expected: true, desc: 'With spaces' },
  { phone: '098-765-4321', expected: true, desc: 'With dashes' },
  { phone: '0101234567', expected: false, desc: 'Invalid prefix' },
  { phone: '123456789', expected: false, desc: 'Too short' },
  { phone: 'abc', expected: false, desc: 'Non-numeric' },
];

let phonePass = 0;
let phoneFail = 0;

phoneTests.forEach(({ phone, expected, desc }) => {
  const result = validatePhone(phone);
  const pass = result.isValid === expected;
  if (pass) phonePass++;
  else phoneFail++;
  console.log(`${pass ? '✓' : '✗'} ${desc}: ${phone} -> ${result.isValid ? 'VALID' : 'INVALID'} ${result.errorMessage ? '(' + result.errorMessage + ')' : ''}`);
});

console.log(`\nPhone Tests: ${phonePass} passed, ${phoneFail} failed\n`);

console.log('=== Phone Normalization Tests ===\n');

const normalizeTests = [
  { input: '+84987654321', expected: '0987654321', desc: 'Convert +84 to 0' },
  { input: '098-765-4321', expected: '0987654321', desc: 'Remove dashes' },
  { input: '098 765 4321', expected: '0987654321', desc: 'Remove spaces' },
];

let normPass = 0;
let normFail = 0;

normalizeTests.forEach(({ input, expected, desc }) => {
  const result = normalizePhone(input);
  const pass = result === expected;
  if (pass) normPass++;
  else normFail++;
  console.log(`${pass ? '✓' : '✗'} ${desc}: ${input} -> ${result} ${pass ? '' : '(expected: ' + expected + ')'}`);
});

console.log(`\nNormalization Tests: ${normPass} passed, ${normFail} failed\n`);

const totalPass = emailPass + phonePass + normPass;
const totalFail = emailFail + phoneFail + normFail;
console.log(`=== SUMMARY ===`);
console.log(`Total: ${totalPass} passed, ${totalFail} failed`);
console.log(totalFail === 0 ? '\n✓ All tests passed!' : '\n✗ Some tests failed');

process.exit(totalFail > 0 ? 1 : 0);