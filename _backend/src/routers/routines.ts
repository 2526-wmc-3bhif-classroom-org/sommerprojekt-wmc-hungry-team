import { Router, Response } from 'express';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth.js';
import { createRoutine, deleteRoutine, listRoutines, updateRoutine } from '../repo/routines-repo.js';
import { validateDaysOfWeek, validateRequiredString, validateTimeValue } from '../utils/validation.js';

const router = Router();

router.get('/api/routines', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const routines = listRoutines(req.user.id);
  res.json(routines);
});

router.post('/api/routines', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const nameResult = validateRequiredString(req.body?.name, 'name');
  if (!nameResult.valid) {
    return res.status(400).json({ error: nameResult.error });
  }

  const startValue = req.body?.start_time ?? req.body?.startTime;
  const endValue = req.body?.end_time ?? req.body?.endTime;

  const startResult = validateTimeValue(startValue, 'start_time');
  if (!startResult.valid) {
    return res.status(400).json({ error: startResult.error });
  }

  const endResult = validateTimeValue(endValue, 'end_time');
  if (!endResult.valid) {
    return res.status(400).json({ error: endResult.error });
  }

  const daysResult = validateDaysOfWeek(req.body?.days);
  if (!daysResult.valid) {
    return res.status(400).json({ error: daysResult.error });
  }

  const transportMode = req.body?.transport_mode ?? req.body?.transportMode;
  const destination = req.body?.destination;
  const startAddress = req.body?.start_address ?? req.body?.startAddress;
  const arrivalTime = req.body?.arrival_time ?? req.body?.arrivalTime;

  const routine = createRoutine({
    userId: req.user.id,
    name: nameResult.value,
    startTime: startResult.value,
    endTime: endResult.value,
    transportMode,
    destination,
    startAddress,
    arrivalTime,
    days: daysResult.value,
    config: req.body?.config ?? {}
  });

  res.status(201).json(routine);
});

router.put('/api/routines/:id', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const nameResult = validateRequiredString(req.body?.name, 'name');
  if (!nameResult.valid) {
    return res.status(400).json({ error: nameResult.error });
  }

  const startValue = req.body?.start_time ?? req.body?.startTime;
  const endValue = req.body?.end_time ?? req.body?.endTime;

  const startResult = validateTimeValue(startValue, 'start_time');
  if (!startResult.valid) {
    return res.status(400).json({ error: startResult.error });
  }

  const endResult = validateTimeValue(endValue, 'end_time');
  if (!endResult.valid) {
    return res.status(400).json({ error: endResult.error });
  }

  const daysResult = validateDaysOfWeek(req.body?.days);
  if (!daysResult.valid) {
    return res.status(400).json({ error: daysResult.error });
  }

  const transportMode = req.body?.transport_mode ?? req.body?.transportMode;
  const destination = req.body?.destination;
  const startAddress = req.body?.start_address ?? req.body?.startAddress;
  const arrivalTime = req.body?.arrival_time ?? req.body?.arrivalTime;

  const routine = updateRoutine({
    routineId: req.params.id,
    userId: req.user.id,
    name: nameResult.value,
    startTime: startResult.value,
    endTime: endResult.value,
    transportMode,
    destination,
    startAddress,
    arrivalTime,
    days: daysResult.value,
    config: req.body?.config ?? {}
  });

  if (!routine) {
    return res.status(404).json({ error: 'Routine not found' });
  }

  res.json(routine);
});

router.delete('/api/routines/:id', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const ok = deleteRoutine(req.params.id, req.user.id);
  if (!ok) {
    return res.status(404).json({ error: 'Routine not found' });
  }

  res.json({ status: 'ok' });
});

export default router;
