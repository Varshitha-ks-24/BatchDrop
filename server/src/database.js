import pg from 'pg'

const { Pool } = pg

export function createPool(databaseUrl) {
  if (!databaseUrl) return null

  const pool = new Pool({
    connectionString: databaseUrl,
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
  })

  pool.on('error', () => {
    console.error('Unexpected idle PostgreSQL pool error.')
  })

  return pool
}