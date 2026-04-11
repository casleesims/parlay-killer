const { Resend } = require('resend');

const FROM = 'Parlay Killer <parlay@parlaykillerapp.com>';
const APP_URL = process.env.APP_URL || 'https://www.parlaykillerapp.com';

let resend;
if (!process.env.RESEND_API_KEY) {
  console.warn('[email] RESEND_API_KEY not set — emails will be skipped');
} else {
  resend = new Resend(process.env.RESEND_API_KEY);
}

async function send(to, subject, html) {
  if (!resend) return;
  try {
    await resend.emails.send({ from: FROM, to, subject, html });
  } catch (err) {
    console.error('[email] Send failed:', err.message);
  }
}

// ── Shared layout ──────────────────────────────────────────
function layout(bodyContent) {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#080808;font-family:Arial,sans-serif;color:#ffffff;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#080808;padding:40px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#111111;border-radius:12px;overflow:hidden;border:1px solid #222222;">
        <!-- Header -->
        <tr>
          <td style="background:#080808;padding:24px 32px;border-bottom:1px solid #1a1a1a;">
            <span style="font-size:22px;font-weight:900;letter-spacing:0.06em;color:#00ff87;">PARLAY</span>
            <span style="font-size:22px;font-weight:900;letter-spacing:0.06em;color:#ffffff;"> KILLER</span>
          </td>
        </tr>
        <!-- Body -->
        <tr><td style="padding:32px;">${bodyContent}</td></tr>
        <!-- Footer -->
        <tr>
          <td style="padding:20px 32px;border-top:1px solid #1a1a1a;text-align:center;">
            <p style="margin:0;font-size:12px;color:#555555;">
              Parlay Killer &mdash; Beat the book, not the bankroll.
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function ctaButton(text, url, style = 'primary') {
  const bg    = style === 'secondary' ? 'transparent' : '#00ff87';
  const color = style === 'secondary' ? '#00ff87'      : '#000000';
  const border = style === 'secondary' ? '2px solid #00ff87' : '2px solid #00ff87';
  return `<a href="${url}" style="display:inline-block;background:${bg};color:${color};font-family:Arial,sans-serif;font-size:15px;font-weight:900;letter-spacing:0.12em;text-transform:uppercase;padding:14px 32px;border-radius:6px;text-decoration:none;border:${border};">${text}</a>`;
}

// ── Welcome email ──────────────────────────────────────────
async function sendWelcomeEmail(email, name) {
  const displayName = name || 'there';
  const html = layout(`
    <h1 style="margin:0 0 8px;font-size:28px;font-weight:900;color:#00ff87;">Welcome, ${displayName}.</h1>
    <p style="margin:0 0 24px;font-size:16px;color:#aaaaaa;line-height:1.6;">
      You're in. You have <strong style="color:#ffffff;">3 free analyses</strong> to start — make them count.
    </p>
    <p style="margin:0 0 24px;font-size:15px;color:#888888;line-height:1.7;">
      Parlay Killer runs the real math on your bets — expected value, implied probability, and the house edge
      hidden in every line. The <strong style="color:#ffffff;">Live Betting Engine</strong> is our most powerful tool:
      enter any player's live stats and current prop line, and get an instant signal on whether the under
      still has value mid-game.
    </p>
    <p style="margin:0 0 32px;font-size:15px;color:#888888;line-height:1.7;">
      Stop guessing. Start running the numbers.
    </p>
    <div style="text-align:center;">
      ${ctaButton('Start Analyzing', APP_URL)}
    </div>
  `);
  await send(email, 'Welcome to Parlay Killer 🎯', html);
}

// ── Usage warning (2 of 3 used) ────────────────────────────
async function sendUsageWarningEmail(email, name) {
  const displayName = name || 'there';
  const html = layout(`
    <h1 style="margin:0 0 8px;font-size:26px;font-weight:900;color:#ffcc00;">1 free analysis left.</h1>
    <p style="margin:0 0 24px;font-size:16px;color:#aaaaaa;line-height:1.6;">
      Hey ${displayName} &mdash; you've used <strong style="color:#ffffff;">2 of your 3 free analyses</strong>.
      You have 1 left.
    </p>
    <p style="margin:0 0 24px;font-size:15px;color:#888888;line-height:1.7;">
      When you hit your limit, the analysis stops. Pro gives you unlimited analyses,
      the full Live Betting Engine, and Value Finder &mdash; all for less than a single bad beat costs you.
    </p>
    <div style="text-align:center;margin-bottom:24px;">
      ${ctaButton('Go Pro &mdash; $9.99/month', `${APP_URL}/?upgrade=true`)}
    </div>
    <p style="margin:0;text-align:center;font-size:13px;color:#555555;">Cancel anytime. No games.</p>
  `);
  await send(email, '⚠️ 1 free analysis left — make it count', html);
}

// ── Limit reached (3 of 3 used) ───────────────────────────
async function sendLimitReachedEmail(email, name) {
  const displayName = name || 'there';
  const html = layout(`
    <h1 style="margin:0 0 8px;font-size:26px;font-weight:900;color:#ff4444;">You've hit your limit.</h1>
    <p style="margin:0 0 24px;font-size:16px;color:#aaaaaa;line-height:1.6;">
      Hey ${displayName} &mdash; you've used all <strong style="color:#ffffff;">3 free analyses</strong>.
    </p>
    <p style="margin:0 0 28px;font-size:15px;color:#888888;line-height:1.7;">
      Upgrade to Pro for unlimited analyses, the full Live Betting Engine, and Value Finder.
      The math doesn't stop working just because your free tier did.
    </p>
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td style="padding-right:8px;">
          <a href="${APP_URL}/?upgrade=true" style="display:block;background:#00ff87;color:#000000;font-family:Arial,sans-serif;font-size:14px;font-weight:900;letter-spacing:0.1em;text-transform:uppercase;padding:14px 16px;border-radius:6px;text-decoration:none;text-align:center;border:2px solid #00ff87;">
            Go Pro Monthly<br><span style="font-size:12px;font-weight:400;">$9.99 / month</span>
          </a>
        </td>
        <td style="padding-left:8px;">
          <a href="${APP_URL}/?upgrade=true&plan=annual" style="display:block;background:transparent;color:#00ff87;font-family:Arial,sans-serif;font-size:14px;font-weight:900;letter-spacing:0.1em;text-transform:uppercase;padding:14px 16px;border-radius:6px;text-decoration:none;text-align:center;border:2px solid #00ff87;">
            Go Pro Annual<br><span style="font-size:12px;font-weight:400;">$39.99 / year &mdash; save 33%</span>
          </a>
        </td>
      </tr>
    </table>
    <p style="margin:20px 0 0;text-align:center;font-size:13px;color:#555555;">Cancel anytime. No games.</p>
  `);
  await send(email, "You've hit your limit — upgrade to keep going", html);
}

// ── Password reset ─────────────────────────────────────────
async function sendPasswordResetEmail(email, name, resetToken) {
  const displayName = name || 'there';
  const resetUrl = `${APP_URL}/reset-password?token=${resetToken}`;
  const html = layout(`
    <h1 style="margin:0 0 8px;font-size:26px;font-weight:900;color:#ffffff;">Reset your password</h1>
    <p style="margin:0 0 24px;font-size:16px;color:#aaaaaa;line-height:1.6;">
      Hey ${displayName} &mdash; we got a request to reset your Parlay Killer password.
    </p>
    <p style="margin:0 0 32px;font-size:15px;color:#888888;line-height:1.7;">
      Click the button below to set a new password. This link expires in <strong style="color:#ffffff;">1 hour</strong>.
      If you didn't request a reset, you can ignore this email &mdash; your password won't change.
    </p>
    <div style="text-align:center;margin-bottom:32px;">
      ${ctaButton('Reset Password', resetUrl)}
    </div>
    <p style="margin:0;text-align:center;font-size:12px;color:#555555;">
      Or copy this link: <span style="color:#888888;">${resetUrl}</span>
    </p>
  `);
  await send(email, 'Reset your Parlay Killer password', html);
}

module.exports = {
  sendWelcomeEmail,
  sendUsageWarningEmail,
  sendLimitReachedEmail,
  sendPasswordResetEmail,
};
