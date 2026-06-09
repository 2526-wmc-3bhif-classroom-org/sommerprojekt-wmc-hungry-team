import * as dotenv from 'dotenv';
dotenv.config({ path: '../.env' });

import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import busRouter from './routers/bus-route.js';
import weatherRouter from './routers/weather.js';
import placesRouter from './routers/places.js';
import { closeNeo4j } from './repo/neo4j-driver.js';
import { closeDb, getDb } from './db/sqlite.js';
import authRouter from './routers/auth.js';
import routinesRouter from './routers/routines.js';
import { globalCSARouter } from './repo/csa-router.js';
import { getNeo4jDriver } from './repo/neo4j-driver.js';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({
    origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        if (/^http:\/\/localhost:\d+$/.test(origin)) {
            return callback(null, true);
        }
        return callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
}));
app.use(express.json());
app.use(cookieParser());

getDb();

// Load the graph for CSA routing in the background
globalCSARouter.loadGraph(getNeo4jDriver()).catch(console.error);

app.use(busRouter);
app.use(weatherRouter);
app.use(placesRouter);
app.use(authRouter);
app.use(routinesRouter);

process.on('SIGINT', async () => {
    console.log('Shutting down...');
    await closeNeo4j();
    closeDb();
    process.exit(0);
});

app.listen(PORT, () => {
    console.log(`Server listening on http://localhost:${PORT}`);
});