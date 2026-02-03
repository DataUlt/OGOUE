#!/usr/bin/env node

const testLogin = async () => {
  const email = "test_kn6yuwj@ogoue.cm";
  const password = "Test@123456";
  
  const payload = {
    email,
    password
  };

  console.log('📝 Payload:', JSON.stringify(payload, null, 2));
  console.log('\n🧪 Envoi vers http://127.0.0.1:3001/api/auth/login\n');

  try {
    const response = await fetch('http://127.0.0.1:3001/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      timeout: 10000
    });

    const text = await response.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      data = text;
    }

    console.log(`✅ Status: ${response.status}`);
    console.log(`📦 Response:`, JSON.stringify(data, null, 2));

    if (response.status === 200) {
      console.log('\n✅ ✅ ✅ LOGIN SUCCESSFUL ✅ ✅ ✅\n');
    } else if (response.status >= 400) {
      console.log('\n❌ Error response received\n');
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
};

testLogin();
