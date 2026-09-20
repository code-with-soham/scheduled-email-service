const nodemailer = require("nodemailer");

async function createAccount() {
  let testAccount = await nodemailer.createTestAccount();
  console.log("Account created:");
  console.log("User:", testAccount.user);
  console.log("Pass:", testAccount.pass);
  console.log("SMTP Host:", testAccount.smtp.host);
  console.log("SMTP Port:", testAccount.smtp.port);
}

createAccount().catch(console.error);
