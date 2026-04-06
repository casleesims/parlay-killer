const express    = require('express');
const stripe     = require('stripe')(process.env.STRIPE_SECRET_KEY);
const pool       = require('../db/index');
const { requireAuth } = require('../middleware/auth');
const router     = express.Router();

// ── POST /api/billing/create-checkout-session ──────────────
router.post('/create-checkout-session', requireAuth, async (req, res) => {
  const { plan } = req.body;
  if (plan !== 'monthly' && plan !== 'annual') {
    return res.status(400).json({ error: 'Invalid plan. Must be monthly or annual.' });
  }

  try {
    const result = await pool.query('SELECT email FROM users WHERE id = $1', [req.session.userId]);
    if (!result.rows.length) return res.status(404).json({ error: 'User not found' });
    const user = result.rows[0];

    const session = await stripe.checkout.sessions.create({
      customer_email: user.email,
      payment_method_types: ['card'],
      line_items: [{
        price: plan === 'monthly'
          ? process.env.STRIPE_PRICE_MONTHLY
          : process.env.STRIPE_PRICE_ANNUAL,
        quantity: 1,
      }],
      mode: 'subscription',
      success_url: `${process.env.APP_URL}/success.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.APP_URL}/`,
      metadata: { userId: String(req.session.userId) },
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error('Checkout session error:', err);
    res.status(500).json({ error: 'Failed to create checkout session' });
  }
});

// ── POST /api/billing/webhook ──────────────────────────────
// Note: raw body is applied in server.js before express.json()
router.post('/webhook', async (req, res) => {
  const sig    = req.headers['stripe-signature'];
  const secret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, secret);
  } catch (err) {
    console.error('Webhook signature error:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session    = event.data.object;
        const userId     = session.metadata?.userId;
        const customerId = session.customer;
        const subId      = session.subscription;
        if (userId) {
          await pool.query(
            `UPDATE users
             SET plan = 'pro', stripe_customer_id = $1, stripe_subscription_id = $2,
                 subscription_status = 'active', updated_at = NOW()
             WHERE id = $3`,
            [customerId, subId, userId]
          );
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const sub        = event.data.object;
        const customerId = sub.customer;
        await pool.query(
          `UPDATE users
           SET plan = 'free', stripe_subscription_id = NULL,
               subscription_status = 'cancelled', updated_at = NOW()
           WHERE stripe_customer_id = $1`,
          [customerId]
        );
        break;
      }

      case 'invoice.payment_failed': {
        const invoice    = event.data.object;
        const customerId = invoice.customer;
        await pool.query(
          `UPDATE users SET subscription_status = 'past_due', updated_at = NOW()
           WHERE stripe_customer_id = $1`,
          [customerId]
        );
        break;
      }

      default:
        // Unhandled event type — ignore
        break;
    }
  } catch (err) {
    console.error('Webhook handler error:', err);
    return res.status(500).send('Internal error processing webhook');
  }

  res.json({ received: true });
});

// ── GET /api/billing/portal ────────────────────────────────
router.get('/portal', requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT stripe_customer_id FROM users WHERE id = $1',
      [req.session.userId]
    );
    const user = result.rows[0];
    if (!user?.stripe_customer_id) {
      return res.status(400).json({ error: 'No active subscription found' });
    }

    const portalSession = await stripe.billingPortal.sessions.create({
      customer:   user.stripe_customer_id,
      return_url: `${process.env.APP_URL}/`,
    });

    res.json({ url: portalSession.url });
  } catch (err) {
    console.error('Portal session error:', err);
    res.status(500).json({ error: 'Failed to create portal session' });
  }
});

module.exports = router;
