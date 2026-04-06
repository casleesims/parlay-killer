const passport       = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const pool           = require('../db/index');

passport.use(new GoogleStrategy({
  clientID:     process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL:  `${process.env.APP_URL}/api/auth/google/callback`,
}, async (accessToken, refreshToken, profile, done) => {
  try {
    const email    = profile.emails[0].value;
    const name     = profile.displayName;
    const googleId = profile.id;
    const avatar   = profile.photos[0]?.value;

    // Check if user exists by google_id
    let result = await pool.query(
      'SELECT * FROM users WHERE google_id = $1', [googleId]
    );
    if (result.rows.length > 0) {
      return done(null, result.rows[0]);
    }

    // Check if email already exists — link google_id to it
    result = await pool.query(
      'SELECT * FROM users WHERE email = $1', [email.toLowerCase()]
    );
    if (result.rows.length > 0) {
      await pool.query(
        'UPDATE users SET google_id = $1, avatar_url = $2, updated_at = NOW() WHERE email = $3',
        [googleId, avatar, email.toLowerCase()]
      );
      return done(null, result.rows[0]);
    }

    // Create new user
    const newUser = await pool.query(
      `INSERT INTO users (email, name, google_id, avatar_url, plan)
       VALUES ($1, $2, $3, $4, 'free') RETURNING *`,
      [email.toLowerCase(), name, googleId, avatar]
    );
    return done(null, newUser.rows[0]);
  } catch (err) {
    return done(err, null);
  }
}));

passport.serializeUser((user, done) => done(null, user.id));

passport.deserializeUser(async (id, done) => {
  try {
    const result = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
    done(null, result.rows[0] || null);
  } catch (err) {
    done(err, null);
  }
});

module.exports = passport;
