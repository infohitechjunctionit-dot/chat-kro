import { sendActionEmail } from "../services/email-service.js";
import { env } from "../config/env.js";
import { logger } from "../lib/logger.js";

async function testEmail() {
  logger.info("Testing email configuration...");
  
  const result = await sendActionEmail({
    to: "itjunction21@gmail.com",
    subject: "Test Email from Relay Chat",
    actionUrl: "https://chat-kro-dashboard.onrender.com/signup",
    actionLabel: "Click here to verify"
  });

  if (result) {
    logger.info("✅ Email sent successfully to itjunction21@gmail.com");
    console.log("✅ Email sent successfully!");
  } else {
    logger.error("❌ Failed to send email");
    console.log("❌ Failed to send email. Check logs for details.");
  }
  
  process.exit(result ? 0 : 1);
}

testEmail().catch((error) => {
  logger.error({ err: error }, "Email test failed with error");
  console.error("❌ Error:", error);
  process.exit(1);
});
