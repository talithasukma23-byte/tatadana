// Debug script for Admin Portal authentication and authorization
import http from 'http';

function makeGet(url, headers = {}) {
  return new Promise((resolve, reject) => {
    http.get(url, { headers }, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data), headers: res.headers });
        } catch {
          resolve({ status: res.statusCode, raw: data, headers: res.headers });
        }
      });
    }).on('error', reject);
  });
}

function makePost(url, body) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(body);
    const parsed = new URL(url);
    const req = http.request({
      hostname: parsed.hostname,
      port: parsed.port,
      path: parsed.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
      }
    }, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data), headers: res.headers });
        } catch {
          resolve({ status: res.statusCode, raw: data, headers: res.headers });
        }
      });
    });
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

async function debug() {
  console.log('=== DEBUGGING ADMIN PORTAL ACCESS ===\n');

  // 1. Test Login with talithasukma23@gmail.com
  const loginRes = await makePost('http://localhost:3000/api/auth/login', {
    identifier: 'talithasukma23@gmail.com',
    password: '#taltal075'
  });
  console.log('1. Login response status:', loginRes.status);
  console.log('   User returned:', loginRes.data?.user?.id, loginRes.data?.user?.email, loginRes.data?.role);
  console.log('   Set-cookie:', loginRes.headers['set-cookie']);

  const cookieHeader = loginRes.headers['set-cookie'] ? loginRes.headers['set-cookie'][0].split(';')[0] : '';
  console.log('   Cookie header to use:', cookieHeader);

  // 2. Test GET /api/admin with this cookie
  const adminApiRes = await makeGet('http://localhost:3000/api/admin?action=users', {
    Cookie: cookieHeader
  });
  console.log('\n2. GET /api/admin status:', adminApiRes.status);
  console.log('   Success:', adminApiRes.data?.success);
  console.log('   Users count:', adminApiRes.data?.users?.length);
  if (adminApiRes.data?.error) {
    console.log('   Error from /api/admin:', adminApiRes.data.error);
  }

  // 3. Test GET /api/auth/profile with cookie
  const profileRes = await makeGet('http://localhost:3000/api/auth/profile', {
    Cookie: cookieHeader
  });
  console.log('\n3. GET /api/auth/profile (without query param):', profileRes.status);
  console.log('   User profile:', profileRes.data?.user?.id, profileRes.data?.user?.email, profileRes.data?.user?.role);

  // 4. Test GET /api/auth/profile?userId=admin-owner-talitha
  const profileWithId = await makeGet('http://localhost:3000/api/auth/profile?userId=admin-owner-talitha', {
    Cookie: cookieHeader
  });
  console.log('\n4. GET /api/auth/profile?userId=admin-owner-talitha:', profileWithId.status);
  console.log('   User profile:', profileWithId.data?.user?.id, profileWithId.data?.user?.email, profileWithId.data?.user?.role);

  // 5. Test GET /api/auth/profile?userId=user-starter-002 with admin cookie
  const profileWithUserId = await makeGet('http://localhost:3000/api/auth/profile?userId=user-starter-002', {
    Cookie: cookieHeader
  });
  console.log('\n5. GET /api/auth/profile?userId=user-starter-002 with admin cookie:');
  console.log('   User profile returned:', profileWithUserId.data?.user?.id, profileWithUserId.data?.user?.email, profileWithUserId.data?.user?.role);
}

debug();
