import { Router, Response } from 'express';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth.js';
import { getSettings, upsertSettings } from '../repo/settings-repo.js';

const router = Router();

router.get('/api/settings', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  const settings = getSettings(req.user.id);
  res.json(settings);
});

router.put('/api/settings', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  const settings = upsertSettings(req.user.id, req.body ?? {});
  res.json(settings);
});

export default router;
