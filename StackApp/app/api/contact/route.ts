import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";

// Email addresses (with defaults)
const CONTACT_EMAIL = process.env.CONTACT_EMAIL || "contact@perkos.io";
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || "noreply@perkos.io";

// Lazy initialization of Resend to handle build-time without API key
let resend: Resend | null = null;

function getResendClient(): Resend {
  if (!resend) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      throw new Error("RESEND_API_KEY environment variable is not configured");
    }
    resend = new Resend(apiKey);
  }
  return resend;
}

interface ContactFormData {
  name: string;
  email: string;
  subject: string;
  message: string;
  company?: string;
}

/**
 * POST /api/contact
 * Handle contact form submissions with auto-responder
 */
export async function POST(req: NextRequest) {
  try {
    const body: ContactFormData = await req.json();
    const { name, email, subject, message, company } = body;

    // Validate required fields
    if (!name || !email || !subject || !message) {
      return NextResponse.json(
        { error: "Missing required fields: name, email, subject, message" },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: "Invalid email format" },
        { status: 400 }
      );
    }

    // Get Resend client (lazy initialization)
    const resendClient = getResendClient();

    // 1. Send notification email to the team
    const notificationResult = await resendClient.emails.send({
      from: FROM_EMAIL,
      to: CONTACT_EMAIL,
      subject: `[PerkOS Contact] ${subject}`,
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
          </head>
          <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1e293b; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #0f172a 0%, #1e3a5f 100%); border-radius: 12px; padding: 30px; margin-bottom: 20px;">
              <h1 style="color: #22d3ee; margin: 0; font-size: 24px;">New Contact Form Submission</h1>
            </div>

            <div style="background: #f8fafc; border-radius: 12px; padding: 24px; border: 1px solid #e2e8f0;">
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 12px 0; border-bottom: 1px solid #e2e8f0;">
                    <strong style="color: #64748b;">Name:</strong>
                  </td>
                  <td style="padding: 12px 0; border-bottom: 1px solid #e2e8f0; color: #1e293b;">
                    ${escapeHtml(name)}
                  </td>
                </tr>
                <tr>
                  <td style="padding: 12px 0; border-bottom: 1px solid #e2e8f0;">
                    <strong style="color: #64748b;">Email:</strong>
                  </td>
                  <td style="padding: 12px 0; border-bottom: 1px solid #e2e8f0;">
                    <a href="mailto:${escapeHtml(email)}" style="color: #3b82f6; text-decoration: none;">${escapeHtml(email)}</a>
                  </td>
                </tr>
                ${company ? `
                <tr>
                  <td style="padding: 12px 0; border-bottom: 1px solid #e2e8f0;">
                    <strong style="color: #64748b;">Company:</strong>
                  </td>
                  <td style="padding: 12px 0; border-bottom: 1px solid #e2e8f0; color: #1e293b;">
                    ${escapeHtml(company)}
                  </td>
                </tr>
                ` : ''}
                <tr>
                  <td style="padding: 12px 0; border-bottom: 1px solid #e2e8f0;">
                    <strong style="color: #64748b;">Subject:</strong>
                  </td>
                  <td style="padding: 12px 0; border-bottom: 1px solid #e2e8f0; color: #1e293b;">
                    ${escapeHtml(subject)}
                  </td>
                </tr>
              </table>

              <div style="margin-top: 20px;">
                <strong style="color: #64748b;">Message:</strong>
                <div style="margin-top: 10px; padding: 16px; background: white; border-radius: 8px; border: 1px solid #e2e8f0; white-space: pre-wrap; color: #1e293b;">
${escapeHtml(message)}
                </div>
              </div>
            </div>

            <div style="margin-top: 20px; padding: 16px; background: #f1f5f9; border-radius: 8px; text-align: center;">
              <p style="margin: 0; color: #64748b; font-size: 12px;">
                Received at ${new Date().toISOString()}
              </p>
            </div>
          </body>
        </html>
      `,
    });

    if (notificationResult.error) {
      console.error("Failed to send notification email:", notificationResult.error);
      return NextResponse.json(
        { error: "Failed to send message. Please try again later." },
        { status: 500 }
      );
    }

    // 2. Send auto-responder thank you email to the submitter
    const autoResponderResult = await resendClient.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: "Thank you for contacting PerkOS Stack",
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
          </head>
          <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1e293b; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8fafc;">
            <div style="background: linear-gradient(135deg, #0f172a 0%, #1e3a5f 100%); border-radius: 16px 16px 0 0; padding: 40px 30px; text-align: center;">
              <h1 style="color: #22d3ee; margin: 0 0 10px 0; font-size: 28px;">Thank You for Reaching Out!</h1>
              <p style="color: #94a3b8; margin: 0; font-size: 16px;">We've received your message</p>
            </div>

            <div style="background: white; border-radius: 0 0 16px 16px; padding: 40px 30px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
              <p style="color: #1e293b; font-size: 16px; margin-top: 0;">
                Hi <strong>${escapeHtml(name)}</strong>,
              </p>

              <p style="color: #475569; font-size: 15px;">
                Thank you for contacting PerkOS Stack. We appreciate you taking the time to reach out to us.
              </p>

              <p style="color: #475569; font-size: 15px;">
                Our team has received your message and will review it promptly. You can expect to hear back from us within <strong>24-48 hours</strong> during business days.
              </p>

              <div style="background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%); border-radius: 12px; padding: 20px; margin: 24px 0; border-left: 4px solid #22d3ee;">
                <p style="color: #0369a1; font-size: 14px; margin: 0;">
                  <strong>Your message summary:</strong>
                </p>
                <p style="color: #0c4a6e; font-size: 14px; margin: 10px 0 0 0;">
                  Subject: ${escapeHtml(subject)}
                </p>
              </div>

              <p style="color: #475569; font-size: 15px;">
                In the meantime, you can:
              </p>

              <ul style="color: #475569; font-size: 15px; padding-left: 20px;">
                <li style="margin-bottom: 8px;">Explore our <a href="https://x402.perkos.io" style="color: #3b82f6; text-decoration: none;">documentation</a></li>
                <li style="margin-bottom: 8px;">Check out our <a href="https://x402.perkos.io/api/v2/x402/supported" style="color: #3b82f6; text-decoration: none;">supported networks</a></li>
                <li>Follow us on <a href="https://twitter.com/perkos_io" style="color: #3b82f6; text-decoration: none;">Twitter</a> for updates</li>
              </ul>

              <p style="color: #475569; font-size: 15px; margin-bottom: 0;">
                Best regards,<br>
                <strong style="color: #1e293b;">The PerkOS Stack Team</strong>
              </p>
            </div>

            <div style="text-align: center; padding: 24px;">
              <p style="color: #94a3b8; font-size: 12px; margin: 0;">
                PerkOS Stack - Multi-chain Payment Infrastructure
              </p>
              <p style="color: #94a3b8; font-size: 12px; margin: 8px 0 0 0;">
                <a href="https://x402.perkos.io" style="color: #64748b; text-decoration: none;">x402.perkos.io</a>
              </p>
            </div>
          </body>
        </html>
      `,
    });

    if (autoResponderResult.error) {
      // Log but don't fail - the main notification was sent
      console.error("Failed to send auto-responder:", autoResponderResult.error);
    }

    return NextResponse.json({
      success: true,
      message: "Your message has been sent successfully. We'll get back to you soon!",
    });
  } catch (error) {
    console.error("Contact form error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred. Please try again later." },
      { status: 500 }
    );
  }
}

// Helper function to escape HTML to prevent XSS
function escapeHtml(text: string): string {
  const htmlEntities: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  };
  return text.replace(/[&<>"']/g, (char) => htmlEntities[char] || char);
}
