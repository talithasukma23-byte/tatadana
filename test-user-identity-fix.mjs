// Test script: Verification of user identity fix on Settings -> Profile page

const BASE_URL = 'http://localhost:3000';

async function runTests() {
  console.log('=== STARTING IDENTITY & PROFILE VERIFICATION TESTS ===\n');
  let passCount = 0;
  let failCount = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`✅ PASS: ${message}`);
      passCount++;
    } else {
      console.error(`❌ FAIL: ${message}`);
      failCount++;
    }
  }

  // 1. Test USER (GANIA) Profile Fetch with userId query
  console.log('--- Test 1: Fetch GANIA profile by userId ---');
  const ganiaRes = await fetch(`${BASE_URL}/api/auth/profile?userId=user-1792744144919`);
  const ganiaData = await ganiaRes.json();
  assert(ganiaRes.status === 200, 'GET /api/auth/profile for Gania returns 200 OK');
  assert(ganiaData.success === true, 'Response success is true');
  assert(ganiaData.user.full_name === 'GANIA', `User name is GANIA (got "${ganiaData.user?.full_name}")`);
  assert(ganiaData.user.role === 'user', `User role is 'user' (got "${ganiaData.user?.role}")`);
  assert(ganiaData.user.email === 'ganiasalsa@gmail.com', `User email is ganiasalsa@gmail.com (got "${ganiaData.user?.email}")`);
  assert(ganiaData.user.full_name !== 'Talitha Ayu Sukma (Owner & Superadmin)', 'User identity is NOT Superadmin Talitha');

  // 2. Test Fetch GANIA profile by Email
  console.log('\n--- Test 2: Fetch GANIA profile by email query ---');
  const ganiaEmailRes = await fetch(`${BASE_URL}/api/auth/profile?userId=ganiasalsa@gmail.com`);
  const ganiaEmailData = await ganiaEmailRes.json();
  assert(ganiaEmailRes.status === 200, 'GET /api/auth/profile by email returns 200 OK');
  assert(ganiaEmailData.user.full_name === 'GANIA', `User resolved by email is GANIA (got "${ganiaEmailData.user?.full_name}")`);
  assert(ganiaEmailData.user.role === 'user', `User role is 'user' (got "${ganiaEmailData.user?.role}")`);

  // 3. Test ADMIN Profile Fetch
  console.log('\n--- Test 3: Fetch ADMIN profile ---');
  const adminRes = await fetch(`${BASE_URL}/api/auth/profile?userId=admin-owner-talitha`);
  const adminData = await adminRes.json();
  assert(adminRes.status === 200, 'GET /api/auth/profile for Admin returns 200 OK');
  assert(adminData.user.role === 'superadmin', `Admin role is 'superadmin' (got "${adminData.user?.role}")`);
  assert(adminData.user.email === 'talithasukma23@gmail.com', `Admin email is talithasukma23@gmail.com (got "${adminData.user?.email}")`);
  assert(adminData.user.full_name.includes('Talitha'), `Admin name is Talitha (got "${adminData.user?.full_name}")`);

  // 4. Test USER Session Cookie Isolation
  console.log('\n--- Test 4: Authenticated USER session cookie behavior ---');
  const ganiaSessionToken = Buffer.from(
    JSON.stringify({
      userId: 'user-1792744144919',
      role: 'user',
      email: 'ganiasalsa@gmail.com',
      timestamp: Date.now(),
    })
  ).toString('base64');

  const userSessionRes = await fetch(`${BASE_URL}/api/auth/profile`, {
    headers: {
      Cookie: `tatadana_session=${ganiaSessionToken}`,
    },
  });
  const userSessionData = await userSessionRes.json();
  assert(userSessionData.success === true, 'Session cookie successfully extracts user profile');
  assert(userSessionData.user.id === 'user-1792744144919', 'Session correctly identified Gania user-1792744144919');
  assert(userSessionData.user.role === 'user', 'Session user role is strictly user');
  assert(userSessionData.user.full_name === 'GANIA', 'Session user name is strictly GANIA');

  // 5. Test Non-Admin cannot hijack another user profile via query parameter
  console.log('\n--- Test 5: Verify USER cannot view/hijack other accounts ---');
  const hijackedRes = await fetch(`${BASE_URL}/api/auth/profile?userId=admin-owner-talitha`, {
    headers: {
      Cookie: `tatadana_session=${ganiaSessionToken}`,
    },
  });
  const hijackedData = await hijackedRes.json();
  assert(hijackedData.user.id === 'user-1792744144919', 'Non-admin request with session cookie always binds to their own identity');
  assert(hijackedData.user.full_name === 'GANIA', 'Returned profile is GANIA, not Admin');

  // 6. Test USER Profile Update & Persistence
  console.log('\n--- Test 6: USER profile update and separation ---');
  const testPhone = '08828274242';
  const updateRes = await fetch(`${BASE_URL}/api/auth/profile`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Cookie: `tatadana_session=${ganiaSessionToken}`,
    },
    body: JSON.stringify({
      userId: 'user-1792744144919',
      fullName: 'GANIA',
      phoneNumber: testPhone,
      currency: 'IDR',
    }),
  });
  const updateData = await updateRes.json();
  assert(updateRes.status === 200, 'PUT /api/auth/profile returns 200 OK');
  assert(updateData.success === true, 'Profile update successful');
  assert(updateData.user.full_name === 'GANIA', 'Updated user full_name is GANIA');
  assert(updateData.user.role === 'user', 'Updated user role remains USER (strictly protected)');

  // 7. Verify Admin was NOT modified by USER update
  console.log('\n--- Test 7: Verify Admin profile unchanged ---');
  const verifyAdminRes = await fetch(`${BASE_URL}/api/auth/profile?userId=admin-owner-talitha`);
  const verifyAdminData = await verifyAdminRes.json();
  assert(verifyAdminData.user.role === 'superadmin', 'Admin role is still superadmin');
  assert(verifyAdminData.user.email === 'talithasukma23@gmail.com', 'Admin email remains talithasukma23@gmail.com');
  assert(verifyAdminData.user.full_name.includes('Talitha'), 'Admin full name remains Talitha');

  // 8. Test USER cannot modify Admin profile
  console.log('\n--- Test 8: USER authorization check on PUT ---');
  const illegalUpdateRes = await fetch(`${BASE_URL}/api/auth/profile`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Cookie: `tatadana_session=${ganiaSessionToken}`,
    },
    body: JSON.stringify({
      userId: 'admin-owner-talitha',
      fullName: 'Hacked Name',
    }),
  });
  const illegalData = await illegalUpdateRes.json();
  // Server should either bind to user-1792744144919 or reject with 403
  assert(
    illegalUpdateRes.status === 403 || illegalData.user?.id === 'user-1792744144919',
    'USER is prohibited from modifying Admin account'
  );

  console.log(`\n=== RESULTS: ${passCount} PASSED, ${failCount} FAILED ===`);
  if (failCount > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
