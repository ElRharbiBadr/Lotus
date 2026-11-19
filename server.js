import 'dotenv/config';
import pg from 'pg';

// A pool keeps several connections open and reuses them.
export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
});

pool.on('error', (err) => console.error('Postgres pool error', err));

export const query = (text, params) => pool.query(text, params);
//--------------------------------------------------------------------------------------
import 'dotenv/config';
import Redis from 'ioredis';

export const redis = new Redis(process.env.REDIS_URL);

redis.on('error', (err) => console.error('Redis error', err));
redis.on('connect', () => console.log('Redis connected'));
//--------------------------------------------------------------------------------------

