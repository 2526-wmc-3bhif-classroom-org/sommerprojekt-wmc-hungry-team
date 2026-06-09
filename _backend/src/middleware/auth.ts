import { NextFunction, Request, Response } from 'express';
import { deleteSession, findSession, findUserById, PublicUser } from '../repo/auth-repo.js';

export const SESSION_COOKIE_NAME = process.env.SESSION_COOKIE_NAME || 'smarthub_session';
const COOKIE_SECURE = process.env.COOKIE_SECURE === 'true' || process.env.NODE_ENV === 'production';

const CLEAR_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: COOKIE_SECURE,
  maxAge: 0
};

export interface AuthenticatedRequest extends Request {
  user?: PublicUser;
  sessionId?: string;
}

function isSessionExpired(expiresAt: string | null): boolean {
  if (!expiresAt) return false;
  return new Date(expiresAt).getTime() <= Date.now();
}

export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const sessionId = req.cookies?.[SESSION_COOKIE_NAME];

  if (!sessionId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const session = findSession(sessionId);
  if (!session || isSessionExpired(session.expires_at)) {
    if (session) {
      deleteSession(sessionId);
    }
    res.clearCookie(SESSION_COOKIE_NAME, CLEAR_COOKIE_OPTIONS);
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const user = findUserById(session.user_id);
  if (!user) {
    deleteSession(sessionId);
    res.clearCookie(SESSION_COOKIE_NAME, CLEAR_COOKIE_OPTIONS);
    return res.status(401).json({ error: 'Unauthorized' });
  }

  req.user = {
    id: user.id,
    email: user.email,
    name: user.name
  };
  req.sessionId = sessionId;

  return next();
}
