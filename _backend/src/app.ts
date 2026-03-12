import * as dotenv from 'dotenv';
dotenv.config({ path: '../.env' });

import express from 'express';
import busRouter from './routers/bus-route.js';

console.log('env check...');
console.log('host: ' + process.env.DB_HOST);
console.log('user: ' + process.env.DB_USER);
console.log('passw: ' + process.env.DB_PASSWORD);
console.log('type of pw: ' + typeof process.env.DB_PASSWORD);
console.log('name: ' + process.env.DB_NAME);

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