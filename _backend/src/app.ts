import express from 'express';
import busRouter from './routers/bus-route.js';
// @ts-ignore
import dotenv from 'dotenv';

dotenv.config({ path: '../../.env' });

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.use(busRouter);

process.on('SIGINT', async () => {
    console.log('Shutting down...');
    process.exit(0);
});

app.listen(PORT, () => {
    console.log(`Server listening on http://localhost:${PORT}`);
});