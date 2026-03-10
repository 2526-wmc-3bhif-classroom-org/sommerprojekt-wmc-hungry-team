// @ts-ignore
import express, { Request, Response } from "express";
import { getUpcomingStops } from "../repo/bus-repo.js";

const app = express();
app.use(express.json());

app.get('/api/bus:stopId', (req: Request, res: Response) => {
  try {
    const a = getUpcomingStops(<string>req.params.stopId);
    a ? res.json(a) : res.sendStatus(404);
  }
  catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

app.listen(3000);
