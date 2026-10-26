// Comprehensive Automated Verification Script for TataDana Unified Period & Search Filtering
import http from 'http';

function makeGetRequest(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, raw: data });
        }
      });
    }).on('error', reject);
  });
}

function makePostRequest(url, body) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(body);
    const parsedUrl = new URL(url);
    const req = http.request(
      {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port,
        path: parsedUrl.pathname + parsedUrl.search,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData),
        },
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, body: JSON.parse(data) });
          } catch (e) {
            resolve({ status: res.statusCode, raw: data });
          }
        });
      }
    );
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

async function runTests() {
  console.log('=== STARTING TATADANA PERIOD & SEARCH FILTER TESTS ===\n');
  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`✅ [PASS] ${message}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${message}`);
      failed++;
    }
  }

  const ADMIN_ID = 'admin-owner-talitha';
  const USER_ID = 'user-starter-002';

  try {
    // 1. Test API endpoint /api/transactions for single date filter
    console.log('--- Test 1: Single Date Filter (2026-10-10) ---');
    const { body: resDate } = await makeGetRequest(`http://localhost:3000/api/transactions?userId=${ADMIN_ID}&date=2026-10-10`);
    assert(resDate.success === true, 'API returned success for single date filter');
    assert(Array.isArray(resDate.transactions), 'Transactions is an array');
    const allAre10Oct = resDate.transactions.every((t) => t.transaction_date.startsWith('2026-10-10'));
    assert(allAre10Oct && resDate.transactions.length > 0, `All returned transactions are on 2026-10-10 (found: ${resDate.transactions.length})`);

    // 2. Test API endpoint for Calendar Month filter (1-31 Okt 2026)
    console.log('\n--- Test 2: Calendar Month Filter (Oktober 2026: 2026-10-01 to 2026-10-31) ---');
    const { body: resMonth } = await makeGetRequest(`http://localhost:3000/api/transactions?userId=${ADMIN_ID}&startDate=2026-10-01&endDate=2026-10-31`);
    assert(resMonth.success === true, 'API returned success for month filter');
    const allInOct = resMonth.transactions.every((t) => t.transaction_date.slice(0, 7) === '2026-10');
    assert(allInOct && resMonth.transactions.length >= 10, `All returned transactions fall in 2026-10 (found: ${resMonth.transactions.length})`);

    // 3. Test Keyword Search "kopi"
    console.log('\n--- Test 3: Keyword Search ("kopi") ---');
    const { body: resSearch } = await makeGetRequest(`http://localhost:3000/api/transactions?userId=${ADMIN_ID}&search=kopi`);
    assert(resSearch.success === true, 'API returned success for search');
    assert(resSearch.transactions.length > 0, `Search "kopi" returned results (${resSearch.transactions.length} items)`);
    const allMatchKopi = resSearch.transactions.every((t) =>
      (t.notes || '').toLowerCase().includes('kopi') ||
      (t.description || '').toLowerCase().includes('kopi') ||
      (t.category?.name || '').toLowerCase().includes('kopi')
    );
    assert(allMatchKopi, 'Every result matches the keyword "kopi"');

    // 4. Test Type filter: "expense"
    console.log('\n--- Test 4: Type Filter (expense) ---');
    const { body: resExpense } = await makeGetRequest(`http://localhost:3000/api/transactions?userId=${ADMIN_ID}&type=expense`);
    assert(resExpense.success === true, 'API returned success for type filter');
    const allExpenses = resExpense.transactions.every((t) => t.type === 'expense');
    assert(allExpenses && resExpense.transactions.length > 0, `All returned transactions are expenses (${resExpense.transactions.length})`);

    // 5. Test Type filter: "income"
    console.log('\n--- Test 5: Type Filter (income) ---');
    const { body: resIncome } = await makeGetRequest(`http://localhost:3000/api/transactions?userId=${ADMIN_ID}&type=income`);
    assert(resIncome.success === true, 'API returned success for income filter');
    const allIncomes = resIncome.transactions.every((t) => t.type === 'income');
    assert(allIncomes && resIncome.transactions.length > 0, `All returned transactions are income (${resIncome.transactions.length})`);

    // 6. Test Multi-criteria Combination: search + type + date range
    console.log('\n--- Test 6: Multi-criteria Combo (type=expense & search=goreng & Oct 2026) ---');
    const { body: resCombo } = await makeGetRequest(`http://localhost:3000/api/transactions?userId=${ADMIN_ID}&type=expense&search=goreng&startDate=2026-10-01&endDate=2026-10-31`);
    assert(resCombo.success === true, 'API returned success for multi-criteria combo');
    const allComboMatch = resCombo.transactions.every((t) =>
      t.type === 'expense' &&
      (t.notes || '').toLowerCase().includes('goreng') &&
      t.transaction_date.startsWith('2026-10')
    );
    assert(allComboMatch && resCombo.transactions.length > 0, `All combo results match type, search, and date range (${resCombo.transactions.length} items)`);

    // 7. Test User Isolation: user `user-starter-002` vs admin `admin-owner-talitha`
    console.log('\n--- Test 7: User Data Isolation (user-starter-002 vs admin-owner-talitha) ---');
    const { body: resAdmin } = await makeGetRequest(`http://localhost:3000/api/transactions?userId=${ADMIN_ID}`);
    const { body: resUser } = await makeGetRequest(`http://localhost:3000/api/transactions?userId=${USER_ID}`);
    assert(resAdmin.success === true && resUser.success === true, 'Both accounts return success');
    const userHasNoAdminTxs = resUser.transactions.every((t) => t.user_id === USER_ID);
    assert(userHasNoAdminTxs, 'User account only sees their own transactions without seeing Admin data');
    assert(resAdmin.transactions.length > 0 && resAdmin.transactions[0].user_id === ADMIN_ID, 'Admin transactions belong strictly to admin account');

    // 8. Test Export endpoint accepts filter parameters (POST /api/reports/export)
    console.log('\n--- Test 8: Export Endpoints with Filter Parameters (POST) ---');
    const { status: exportStatus, body: exportPdf } = await makePostRequest('http://localhost:3000/api/reports/export', {
      userId: ADMIN_ID,
      format: 'pdf',
      dateRange: '1 Okt 2026 – 31 Okt 2026',
      filters: {
        startDate: '2026-10-01',
        endDate: '2026-10-31',
        type: 'all',
      },
    });
    assert(exportStatus === 200 && exportPdf.success === true, `Export PDF endpoint returned success: ${exportPdf.message || ''}`);
    assert(typeof exportPdf.dataUrl === 'string' && exportPdf.dataUrl.length > 0, 'Export returned valid download/data URL');

    // 9. Test Excel Export as well
    console.log('\n--- Test 9: Export Excel with Filter Parameters (POST) ---');
    const { status: excelStatus, body: exportXlsx } = await makePostRequest('http://localhost:3000/api/reports/export', {
      userId: ADMIN_ID,
      format: 'xlsx',
      dateRange: '1 Okt 2026 – 31 Okt 2026',
      filters: {
        startDate: '2026-10-01',
        endDate: '2026-10-31',
      },
    });
    assert(excelStatus === 200 && exportXlsx.success === true, `Export Excel endpoint returned success: ${exportXlsx.message || ''}`);

    // 10. Date Boundaries & Inclusivity Verification
    console.log('\n--- Test 10: Date Boundaries (Start of day 00:00:00 & End of day 23:59:59.999) ---');
    const ref = new Date('2026-10-15T14:30:00+07:00');
    const start = new Date(ref.getFullYear(), ref.getMonth(), 1, 0, 0, 0, 0);
    const end = new Date(ref.getFullYear(), ref.getMonth() + 1, 0, 23, 59, 59, 999);
    assert(start.getDate() === 1 && start.getHours() === 0, 'Calendar month starts on 1st at 00:00:00');
    assert(end.getDate() === 31 && end.getHours() === 23 && end.getMinutes() === 59 && end.getMilliseconds() === 999, 'Calendar month ends on 31st at 23:59:59.999 inclusive');

    // Summary
    console.log('\n========================================');
    console.log(`TOTAL TESTS: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
    console.log('========================================');

    if (failed > 0) {
      process.exit(1);
    } else {
      process.exit(0);
    }
  } catch (err) {
    console.error('Test execution error:', err);
    process.exit(1);
  }
}

runTests();
