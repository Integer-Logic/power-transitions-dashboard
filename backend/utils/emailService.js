// backend/utils/emailService.js
const sendEmail = async (emailData) => {
  const { to, subject, html } = emailData;
  
  // For development, just log the email
  console.log('\n📧 EMAIL WOULD BE SENT:');
  console.log(`To: ${to}`);
  console.log(`Subject: ${subject}`);
  console.log(`Preview: ${html.substring(0, 100)}...\n`);
  
  return Promise.resolve(true);
};

module.exports = { sendEmail };