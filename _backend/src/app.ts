import * as dotenv from 'dotenv';
dotenv.config({ path: '../.env' });

import express from 'express';
import cors from 'cors';
import busRouter from './routers/bus-route.js';
import weatherRouter from './routers/weather.js';
import placesRouter from './routers/places.js';
import { closeNeo4j } from './repo/neo4j-driver.js';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({
    origin: /^http:\/\/localhost:\d+$/,
    methods: ['GET'],
}));
app.use(express.json());

app.use(busRouter);
app.use(weatherRouter);
app.use(placesRouter);

process.on('SIGINT', async () => {
    console.log('Shutting down...');
    await closeNeo4j();
    process.exit(0);
});

app.listen(PORT, () => {
    console.log(`Server listening on http://localhost:${PORT}`);
});