require('dotenv').config();
const express = require('express');
const session = require('express-session');
const axios = require('axios');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

const CLIENT_ID = process.env.STRAVA_CLIENT_ID;
const CLIENT_SECRET = process.env.STRAVA_CLIENT_SECRET;

// Auto-detect URL: Railway provides RAILWAY_PUBLIC_DOMAIN, fallback to localhost
const BASE_URL = process.env.RAILWAY_PUBLIC_DOMAIN
  ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`
  : `http://localhost:${PORT}`;

const REDIRECT_URI = `${BASE_URL}/auth/callback`;

app.use(express.json());
app.use(session({
  secret: 'strava-heatmap-secret',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 6 * 60 * 60 * 1000 } // 6 hours (Strava token lifetime)
}));

app.use(express.static(path.join(__dirname, 'public')));

// ─── Auth routes ────────────────────────────────────────────────────────────

// Redirect to Strava OAuth
app.get('/auth/strava', (req, res) => {
  const scope = 'activity:read_all';
  const url = `https://www.strava.com/oauth/authorize?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=code&scope=${scope}`;
  res.redirect(url);
});

// Strava OAuth callback
app.get('/auth/callback', async (req, res) => {
  const { code, error } = req.query;

  if (error || !code) {
    return res.redirect('/?error=access_denied');
  }

  try {
    const response = await axios.post('https://www.strava.com/oauth/token', {
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      code,
      grant_type: 'authorization_code'
    });

    const { access_token, refresh_token, expires_at, athlete } = response.data;

    req.session.token = access_token;
    req.session.refresh_token = refresh_token;
    req.session.expires_at = expires_at;
    req.session.athlete = {
      id: athlete.id,
      firstname: athlete.firstname,
      lastname: athlete.lastname,
      profile: athlete.profile_medium
    };

    res.redirect('/app');
  } catch (err) {
    console.error('OAuth error:', err.response?.data || err.message);
    res.redirect('/?error=auth_failed');
  }
});

// Refresh token if expired
async function getValidToken(req) {
  const now = Math.floor(Date.now() / 1000);
  if (req.session.expires_at && now > req.session.expires_at - 300) {
    const response = await axios.post('https://www.strava.com/oauth/token', {
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      refresh_token: req.session.refresh_token,
      grant_type: 'refresh_token'
    });
    req.session.token = response.data.access_token;
    req.session.expires_at = response.data.expires_at;
  }
  return req.session.token;
}

// Auth check middleware
function requireAuth(req, res, next) {
  if (!req.session.token) return res.status(401).json({ error: 'Not authenticated' });
  next();
}

// ─── API routes ─────────────────────────────────────────────────────────────

// Get athlete info
app.get('/api/athlete', requireAuth, (req, res) => {
  res.json(req.session.athlete);
});

// Get all activities (paginated)
app.get('/api/activities', requireAuth, async (req, res) => {
  try {
    const token = await getValidToken(req);
    const page = parseInt(req.query.page) || 1;
    const per_page = 100;
    const type = req.query.type || null; // optional filter

    const params = { page, per_page };
    if (req.query.before) params.before = req.query.before;
    if (req.query.after) params.after = req.query.after;

    const response = await axios.get('https://www.strava.com/api/v3/athlete/activities', {
      headers: { Authorization: `Bearer ${token}` },
      params
    });

    let activities = response.data;
    if (type) activities = activities.filter(a => a.type === type);

    res.json({
      activities: activities.map(a => ({
        id: a.id,
        name: a.name,
        type: a.type,
        sport_type: a.sport_type,
        distance: a.distance,
        moving_time: a.moving_time,
        start_date: a.start_date,
        map: a.map // contains summary_polyline
      })),
      hasMore: response.data.length === per_page
    });
  } catch (err) {
    console.error('Activities error:', err.response?.data || err.message);
    res.status(500).json({ error: 'Failed to fetch activities' });
  }
});

// Get GPS stream for a single activity
app.get('/api/activities/:id/stream', requireAuth, async (req, res) => {
  try {
    const token = await getValidToken(req);
    const response = await axios.get(
      `https://www.strava.com/api/v3/activities/${req.params.id}/streams`,
      {
        headers: { Authorization: `Bearer ${token}` },
        params: { keys: 'latlng', key_by_type: true }
      }
    );
    const latlng = response.data?.latlng?.data || [];
    res.json({ latlng });
  } catch (err) {
    console.error('Stream error:', err.response?.data || err.message);
    res.status(500).json({ error: 'Failed to fetch stream', latlng: [] });
  }
});

// Logout
app.get('/auth/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/');
});

// ─── Pages ───────────────────────────────────────────────────────────────────

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get('/app', requireAuth, (req, res) => res.sendFile(path.join(__dirname, 'public', 'app.html')));

app.listen(PORT, () => {
  console.log(`\n🗺️  Strava Heatmap running at http://localhost:${PORT}\n`);
});
