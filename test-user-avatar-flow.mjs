// Test script: Verification of Avatar Upload, Persistence, and Deletion for USER
import fs from 'fs';
import path from 'path';

const BASE_URL = 'http://localhost:3000';

async function runAvatarTests() {
  console.log('=== STARTING AVATAR INTEGRATION TESTS ===\n');
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

  const ganiaSessionToken = Buffer.from(
    JSON.stringify({
      userId: 'user-1792744144919',
      role: 'user',
      email: 'ganiasalsa@gmail.com',
      timestamp: Date.now(),
    })
  ).toString('base64');

  // Check Admin's current avatar
  const initialAdminRes = await fetch(`${BASE_URL}/api/auth/profile?userId=admin-owner-talitha`);
  const initialAdminData = await initialAdminRes.json();
  const adminOriginalAvatar = initialAdminData.user.avatar_url;
  console.log(`Admin original avatar: ${adminOriginalAvatar}`);

  // Create a dummy 1x1 PNG image buffer
  const dummyPng = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
  const tempFilePath = path.join(process.cwd(), 'temp-test-avatar.png');
  fs.writeFileSync(tempFilePath, dummyPng);

  // 1. Upload Avatar for GANIA
  console.log('--- Test 1: Upload avatar for GANIA ---');
  const formData = new FormData();
  const fileBlob = new Blob([dummyPng], { type: 'image/png' });
  formData.append('file', fileBlob, 'avatar.png');
  formData.append('userId', 'user-1792744144919');

  const uploadRes = await fetch(`${BASE_URL}/api/auth/profile/avatar`, {
    method: 'POST',
    headers: {
      Cookie: `tatadana_session=${ganiaSessionToken}`,
    },
    body: formData,
  });

  const uploadData = await uploadRes.json();
  assert(uploadRes.status === 200, 'POST /api/auth/profile/avatar returns 200 OK');
  assert(uploadData.success === true, 'Upload response success is true');
  assert(uploadData.avatarUrl && uploadData.avatarUrl.includes('/uploads/avatars/'), `Avatar URL generated: ${uploadData.avatarUrl}`);

  // 2. Verify GANIA's profile now has the new avatar
  console.log('\n--- Test 2: Verify GANIA profile reflects avatar ---');
  const ganiaVerifyRes = await fetch(`${BASE_URL}/api/auth/profile?userId=user-1792744144919`);
  const ganiaVerifyData = await ganiaVerifyRes.json();
  assert(ganiaVerifyData.user.avatar_url === uploadData.avatarUrl, 'GANIA profile has updated avatar_url');

  // 3. Verify ADMIN's avatar was NOT changed or touched
  console.log('\n--- Test 3: Verify Admin avatar unaffected ---');
  const verifyAdminRes = await fetch(`${BASE_URL}/api/auth/profile?userId=admin-owner-talitha`);
  const verifyAdminData = await verifyAdminRes.json();
  assert(verifyAdminData.user.avatar_url === adminOriginalAvatar, 'Admin avatar is completely unaffected');

  // 4. Test USER attempting to delete Admin's avatar (must fail with 403)
  console.log('\n--- Test 4: USER cannot delete Admin avatar ---');
  const illegalDeleteRes = await fetch(`${BASE_URL}/api/auth/profile/avatar`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      Cookie: `tatadana_session=${ganiaSessionToken}`,
    },
    body: JSON.stringify({ userId: 'admin-owner-talitha' }),
  });
  assert(illegalDeleteRes.status === 403, 'Deleting Admin avatar with USER session is rejected (HTTP 403)');

  // 5. Delete GANIA's avatar
  console.log('\n--- Test 5: Delete GANIA avatar ---');
  const deleteRes = await fetch(`${BASE_URL}/api/auth/profile/avatar`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      Cookie: `tatadana_session=${ganiaSessionToken}`,
    },
    body: JSON.stringify({ userId: 'user-1792744144919' }),
  });
  const deleteData = await deleteRes.json();
  assert(deleteRes.status === 200, 'DELETE /api/auth/profile/avatar returns 200 OK');
  assert(deleteData.success === true, 'Avatar deleted successfully');
  assert(deleteData.avatarUrl === '', 'Avatar URL reset to empty string (default initials avatar)');

  // 6. Verify GANIA profile has empty avatar
  const postDeleteRes = await fetch(`${BASE_URL}/api/auth/profile?userId=user-1792744144919`);
  const postDeleteData = await postDeleteRes.json();
  assert(!postDeleteData.user.avatar_url, 'GANIA avatar_url is now empty in persistent profile');

  // Clean up temp file
  if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);

  console.log(`\n=== AVATAR RESULTS: ${passCount} PASSED, ${failCount} FAILED ===`);
  if (failCount > 0) process.exit(1);
}

runAvatarTests().catch((err) => {
  console.error('Avatar test failed:', err);
  process.exit(1);
});
