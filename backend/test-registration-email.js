const axios = require('axios');

async function testRegistrationEmail() {
  console.log('🧪 Testing Registration Email Flow...\n');
  
  const API_URL = 'http://localhost:3001/api';
  const testUser = {
    username: `test_${Date.now()}`,
    email: 'ababalola@power-transitions.com',
    password: 'TestPassword123!',
    full_name: 'Email Test User'
  };
  
  console.log('1. Registering test user...');
  console.log(`   Username: ${testUser.username}`);
  console.log(`   Email: ${testUser.email}\n`);
  
  try {
    const response = await axios.post(`${API_URL}/auth/register`, testUser);
    
    console.log('✅ Registration successful!');
    console.log(`   Message: ${response.data.message}`);
    console.log(`   User Status: ${response.data.user.status}`);
    console.log(`   Email Service: ${response.data.email_service.active ? 'Active' : 'Inactive'}`);
    console.log(`   Mode: ${response.data.email_service.mode}`);
    console.log(`   Note: ${response.data.email_service.note}\n`);
    
    console.log('📧 What should happen:');
    console.log('   1. ✅ User receives registration confirmation email');
    console.log('   2. ✅ Admin receives approval request email');
    console.log('   3. ✅ Both emails sent via Ethereal SMTP');
    console.log('   4. ✅ Admin can click link to approve user');
    console.log('\n💡 Check emails at: https://ethereal.email/');
    
  } catch (error) {
    console.error('❌ Registration failed:', error.response?.data?.message || error.message);
  }
}

testRegistrationEmail();