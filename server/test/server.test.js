import assert from 'node:assert/strict'
import { once } from 'node:events'
import test from 'node:test'
import { createApp } from '../src/app.js'
import { loadConfig } from '../src/config.js'

test('starts with documented development defaults and serves the health endpoint', async (context) => {
  const config = loadConfig({})
  assert.deepEqual(config, {
    port: 3001,
    frontendOrigin: 'http://localhost:5173',
    databaseUrl: null,
  })

  const server = createApp(config).listen(0, '127.0.0.1')
  context.after(() => new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve())
  }))
  await once(server, 'listening')

  const address = server.address()
  const response = await fetch(`http://127.0.0.1:${address.port}/api/v1/health`, {
    headers: { Origin: config.frontendOrigin },
  })
  assert.equal(response.status, 200)
  assert.equal(response.headers.get('access-control-allow-origin'), config.frontendOrigin)
  assert.deepEqual(await response.json(), { status: 'ok', service: 'batchdrop-api' })
})

test('rejects invalid startup configuration with actionable messages', () => {
  assert.throws(() => loadConfig({ PORT: 'not-a-port' }), /PORT must be an integer/)
  assert.throws(() => loadConfig({ FRONTEND_ORIGIN: 'ftp://example.test' }), /HTTP or HTTPS origin/)
  assert.throws(() => loadConfig({ FRONTEND_ORIGIN: 'https://example.test/app' }), /without a path/)
  assert.throws(() => loadConfig({ DATABASE_URL: 'https://example.test/db' }), /PostgreSQL connection URL/)
  assert.throws(() => loadConfig({ DATABASE_URL: 'postgresql:///' }), /PostgreSQL connection URL/)
})

test('accepts a server-only PostgreSQL URL without rewriting it', () => {
  const databaseUrl = 'postgresql://example.test:5432/batchdrop?sslmode=require'
  const config = loadConfig({ DATABASE_URL: databaseUrl })
  assert.equal(config.databaseUrl, databaseUrl)
})

test('reports database connectivity without exposing errors and preserves liveness health', async (context) => {
  const secretError = new Error('connection failed for postgresql://secret-user:secret-password@example.test/db')
  const server = createApp({
    frontendOrigin: 'http://localhost:5173',
    pool: { query: async () => { throw secretError } },
  }).listen(0, '127.0.0.1')
  context.after(() => new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve())
  }))
  await once(server, 'listening')

  const origin = `http://127.0.0.1:${server.address().port}`
  const statusResponse = await fetch(`${origin}/api/v1/status`)
  const statusBody = await statusResponse.text()
  assert.equal(statusResponse.status, 503)
  assert.deepEqual(JSON.parse(statusBody), {
    status: 'degraded',
    service: 'batchdrop-api',
    database: 'unavailable',
  })
  assert.doesNotMatch(statusBody, /secret-user|secret-password|example\.test/)

  const healthResponse = await fetch(`${origin}/api/v1/health`)
  assert.equal(healthResponse.status, 200)
  assert.deepEqual(await healthResponse.json(), { status: 'ok', service: 'batchdrop-api' })
})

test('reports an unconfigured database without connecting or disclosing configuration', async (context) => {
  const server = createApp({ frontendOrigin: 'http://localhost:5173' }).listen(0, '127.0.0.1')
  context.after(() => new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve())
  }))
  await once(server, 'listening')

  const response = await fetch(`http://127.0.0.1:${server.address().port}/api/v1/status`)
  assert.equal(response.status, 503)
  assert.deepEqual(await response.json(), {
    status: 'degraded',
    service: 'batchdrop-api',
    database: 'not_configured',
  })
})

test('reports a successful mocked database connectivity check', async (context) => {
  let queryCount = 0
  const server = createApp({
    frontendOrigin: 'http://localhost:5173',
    pool: { query: async (sql) => { queryCount += 1; assert.equal(sql, 'SELECT 1') } },
  }).listen(0, '127.0.0.1')
  context.after(() => new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve())
  }))
  await once(server, 'listening')

  const response = await fetch(`http://127.0.0.1:${server.address().port}/api/v1/status`)
  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), {
    status: 'ok',
    service: 'batchdrop-api',
    database: 'connected',
  })
  assert.equal(queryCount, 1)
})