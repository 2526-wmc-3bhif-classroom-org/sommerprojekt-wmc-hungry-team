import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import {
  cleanupExpiredOAuthStates,
  cleanupExpiredSessions,
  consumeOAuthState,
  createOAuthState,
  createSession,
  createUser,
  deleteSession,
  findGoogleAccountByUserId,
  findUserByEmail,
  findUserById,
  upsertGoogleAccount,
  updateUser
} from '../repo/auth-repo.js';
import { AuthenticatedRequest, requireAuth, SESSION_COOKIE_NAME } from '../middleware/auth.js';
import { validateEmail, validatePassword, validateRequiredString } from '../utils/validation.js';

const router = Router();

const SESSION_MAX_AGE_DAYS = Number.parseInt(process.env.SESSION_MAX_AGE_DAYS || '3650', 10);
const COOKIE_SECURE = process.env.COOKIE_SECURE === 'true' || (process.env.COOKIE_SECURE !== 'false' && process.env.NODE_ENV === 'production');

function sessionCookieOptions() {
  const options: Record<string, any> = {
    httpOnly: true,
    sameSite: 'lax',
    secure: COOKIE_SECURE
  };

  if (Number.isFinite(SESSION_MAX_AGE_DAYS) && SESSION_MAX_AGE_DAYS > 0) {
    options.maxAge = SESSION_MAX_AGE_DAYS * 24 * 60 * 60 * 1000;
  }

  return options;
}

function issueSessionCookie(res: Response, sessionId: string) {
  res.cookie(SESSION_COOKIE_NAME, sessionId, sessionCookieOptions());
}

router.post('/api/auth/register', async (req: Request, res: Response) => {
  try {
    const emailResult = validateEmail(req.body?.email);
    if (!emailResult.valid) {
      return res.status(400).json({ error: emailResult.error });
    }

    const nameResult = validateRequiredString(req.body?.name, 'name');
    if (!nameResult.valid) {
      return res.status(400).json({ error: nameResult.error });
    }

    const passwordResult = validatePassword(req.body?.password);
    if (!passwordResult.valid) {
      return res.status(400).json({ error: passwordResult.error });
    }

    const existing = findUserByEmail(emailResult.value);
    if (existing) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    const now = new Date().toISOString();
    const userId = randomUUID();
    const passwordHash = await bcrypt.hash(passwordResult.value, 10);

    createUser({
      id: userId,
      email: emailResult.value,
      name: nameResult.value,
      password_hash: passwordHash,
      created_at: now,
      updated_at: now
    });

    const sessionId = randomUUID();
    const expiresAt = SESSION_MAX_AGE_DAYS > 0
      ? new Date(Date.now() + SESSION_MAX_AGE_DAYS * 24 * 60 * 60 * 1000).toISOString()
      : null;
    createSession({
      id: sessionId,
      user_id: userId,
      created_at: now,
      expires_at: expiresAt
    });
    issueSessionCookie(res, sessionId);

    res.json({ id: userId, email: emailResult.value, name: nameResult.value });
  } catch (e) {
    console.error('Register error:', e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/api/auth/login', async (req: Request, res: Response) => {
  try {
    const emailResult = validateEmail(req.body?.email);
    if (!emailResult.valid) {
      return res.status(400).json({ error: emailResult.error });
    }

    const passwordResult = validateRequiredString(req.body?.password, 'password');
    if (!passwordResult.valid) {
      return res.status(400).json({ error: passwordResult.error });
    }

    const user = findUserByEmail(emailResult.value);
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const ok = await bcrypt.compare(passwordResult.value, user.password_hash);
    if (!ok) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const sessionId = randomUUID();
    const loginExpiresAt = SESSION_MAX_AGE_DAYS > 0
      ? new Date(Date.now() + SESSION_MAX_AGE_DAYS * 24 * 60 * 60 * 1000).toISOString()
      : null;
    createSession({
      id: sessionId,
      user_id: user.id,
      created_at: new Date().toISOString(),
      expires_at: loginExpiresAt
    });
    issueSessionCookie(res, sessionId);

    res.json({ id: user.id, email: user.email, name: user.name });

    try { cleanupExpiredSessions(); } catch (e) { console.error('Session cleanup error:', e); }
  } catch (e) {
    console.error('Login error:', e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/api/auth/logout', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  if (req.sessionId) {
    res.clearCookie(SESSION_COOKIE_NAME, { ...sessionCookieOptions(), maxAge: 0 });
    try {
      deleteSession(req.sessionId);
    } catch (e) {
      console.error('Logout error:', e);
    }
  }
  res.json({ status: 'ok' });
});

router.get('/api/auth/me', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const googleAccount = findGoogleAccountByUserId(req.user.id);
  res.json({
    user: req.user,
    googleConnected: Boolean(googleAccount),
    googleEmail: googleAccount?.email ?? null
  });
});

router.put('/api/auth/me', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const updates: any = { updated_at: new Date().toISOString() };
    
    if (req.body.email) {
      const emailResult = validateEmail(req.body.email);
      if (!emailResult.valid) return res.status(400).json({ error: emailResult.error });
      const existing = findUserByEmail(emailResult.value);
      if (existing && existing.id !== req.user.id) {
        return res.status(409).json({ error: 'Email already in use' });
      }
      updates.email = emailResult.value;
    }
    
    if (req.body.name) {
      const nameResult = validateRequiredString(req.body.name, 'name');
      if (!nameResult.valid) return res.status(400).json({ error: nameResult.error });
      updates.name = nameResult.value;
    }
    
    if (req.body.password) {
      const passwordResult = validatePassword(req.body.password);
      if (!passwordResult.valid) return res.status(400).json({ error: passwordResult.error });
      updates.password_hash = await bcrypt.hash(passwordResult.value, 10);
    }

    updateUser(req.user.id, updates);
    res.json({ status: 'ok' });
  } catch (e) {
    console.error('Update user error:', e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/api/auth/google/connect', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const redirectUri = process.env.GOOGLE_OAUTH_REDIRECT_URI;

  if (!clientId || !redirectUri) {
    return res.status(500).json({ error: 'Google OAuth not configured' });
  }

  const user = req.user;
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  cleanupExpiredOAuthStates(new Date().toISOString());

  const stateId = randomUUID();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 10 * 60 * 1000).toISOString();

  createOAuthState({
    id: stateId,
    user_id: user.id,
    created_at: now.toISOString(),
    expires_at: expiresAt
  });

  const scopes = [
    'openid',
    'email',
    'profile',
    'https://www.googleapis.com/auth/calendar.readonly'
  ];

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    access_type: 'offline',
    prompt: 'consent',
    scope: scopes.join(' '),
    state: stateId
  });

  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
});

router.get('/api/auth/google/callback', async (req: Request, res: Response) => {
  try {
    const code = req.query.code as string | undefined;
    const state = req.query.state as string | undefined;

    if (!code || !state) {
      return res.status(400).json({ error: 'Missing code or state' });
    }

    const record = consumeOAuthState(state);
    if (!record || new Date(record.expires_at).getTime() <= Date.now()) {
      return res.status(400).json({ error: 'Invalid OAuth state' });
    }

    const user = findUserById(record.user_id);
    if (!user) {
      return res.status(400).json({ error: 'User not found' });
    }

    const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
    const redirectUri = process.env.GOOGLE_OAUTH_REDIRECT_URI;

    if (!clientId || !clientSecret || !redirectUri) {
      return res.status(500).json({ error: 'Google OAuth not configured' });
    }

    const tokenParams = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code'
    });

    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: tokenParams
    });

    if (!tokenResponse.ok) {
      const body = await tokenResponse.text();
      console.error('Google token error:', body);
      return res.status(500).json({ error: 'Google token exchange failed' });
    }

    const tokenJson = await tokenResponse.json() as {
      access_token: string;
      refresh_token?: string;
      expires_in?: number;
    };

    const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${tokenJson.access_token}` }
    });

    if (!userInfoResponse.ok) {
      const body = await userInfoResponse.text();
      console.error('Google userinfo error:', body);
      return res.status(500).json({ error: 'Google user info fetch failed' });
    }

    const userInfo = await userInfoResponse.json() as {
      sub: string;
      email?: string;
      name?: string;
      picture?: string;
    };

    const now = new Date().toISOString();
    const tokenExpiresAt = tokenJson.expires_in
      ? new Date(Date.now() + tokenJson.expires_in * 1000).toISOString()
      : null;

    upsertGoogleAccount({
      id: randomUUID(),
      user_id: user.id,
      google_sub: userInfo.sub,
      email: userInfo.email ?? null,
      name: userInfo.name ?? null,
      avatar: userInfo.picture ?? null,
      refresh_token: tokenJson.refresh_token ?? null,
      access_token: tokenJson.access_token,
      token_expires_at: tokenExpiresAt,
      created_at: now,
      updated_at: now
    });

    const redirectBase = process.env.FRONTEND_BASE_URL || 'http://localhost:3001';
    res.redirect(`${redirectBase}/settings?google=connected`);
  } catch (e) {
    console.error('Google callback error:', e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
