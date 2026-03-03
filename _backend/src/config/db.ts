import { Pool } from 'pg';

// These will pull from your .env or the Docker 'environment' section
const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'transit_user',
    password: process.env.DB_PASSWORD || 'password123',
    database: process.env.DB_NAME || 'gtfs_data',
    port: parseInt(process.env.DB_PORT || '5432'),
};

const pool = new Pool(dbConfig);

// Health check to log where we are actually connected
pool.connect((err, client, release) => {
    if (err) {
        return console.error('❌ Error acquiring client', err.stack);
    }
    console.log(`✅ Connected to PostgreSQL at ${dbConfig.host}`);
    console.log(`📊 Database: ${dbConfig.database} | User: ${dbConfig.user}`);
    release();
});

export default pool;