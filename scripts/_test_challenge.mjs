import https from 'node:https';

const API = 'https://aria-backend-production-176b.up.railway.app';

function request(method, path, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : undefined;
    const url = new URL(path, API);
    const options = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}),
      },
    };
    const req = https.request(options, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(d) });
        } catch {
          resolve({ status: res.statusCode, data: d });
        }
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function test() {
  console.log('Testing /challenge/start...\n');
  
  // Test with Geral
  console.log('1. Testing specialty=Geral, num_questions=5');
  const r1 = await request('POST', '/challenge/start', {
    user_id: 'test-user-123',
    specialty: 'Geral',
    num_questions: 5,
    time_per_question: 60,
  });
  console.log('Status:', r1.status);
  console.log('Response:', JSON.stringify(r1.data, null, 2));
  
  console.log('\n---\n');
  
  // Test with Mama
  console.log('2. Testing specialty=Mama, num_questions=3');
  const r2 = await request('POST', '/challenge/start', {
    user_id: 'test-user-456',
    specialty: 'Mama',
    num_questions: 3,
    time_per_question: 60,
  });
  console.log('Status:', r2.status);
  console.log('Response:', JSON.stringify(r2.data, null, 2));
}

test().catch(console.error);