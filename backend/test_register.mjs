#!/usr/bin/env node

const testRegister = async () => {
  const email = `test_${Math.random().toString(36).substring(7)}@ogoue.cm`;
  
  const payload = {
    email,
    password: 'Test@123456',
    firstName: 'John',
    lastName: 'Doe',
    organizationName: 'OGOUE Test Company'
  };

  console.log('📝 Payload:', JSON.stringify(payload, null, 2));
  console.log('\n🧪 Envoi vers http://127.0.0.1:3001/api/auth/register\n');

  try {
    const response = await fetch('http://127.0.0.1:3001/api/auth/register', {
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

    if (response.status === 201) {
      console.log('\n✅ ✅ ✅ REGISTRATION SUCCESSFUL ✅ ✅ ✅\n');
    } else if (response.status >= 400) {
      console.log('\n❌ Error response received\n');
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Stack:', error.stack);
  }
};

testRegister();
