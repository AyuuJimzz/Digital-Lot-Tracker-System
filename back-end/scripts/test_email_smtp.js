const nodemailer = require("nodemailer");

async function testGmailService() {
  console.log("Testing Nodemailer with service: 'gmail'...");
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: "goldendragonestate@gmail.com",
      pass: "rtlwkfyddtctngmx",
    },
    tls: {
      rejectUnauthorized: false,
    },
  });

  try {
    await transporter.verify();
    console.log("✅ SUCCESS: Service Gmail connection verified!");
  } catch (err) {
    console.error("❌ FAILED:", err.message);
  }
}

testGmailService();
