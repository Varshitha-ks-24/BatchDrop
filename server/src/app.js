import cors from 'cors'
import express from 'express'

export function createApp({ frontendOrigin, pool = null }) {
  const app = express()

  app.disable('x-powered-by')
  app.use(cors({ origin: frontendOrigin }))
  app.use(express.json({ limit: '32kb' }))

  app.get('/api/v1/health', (_request, response) => {
    response.json({ status: 'ok', service: 'batchdrop-api' })
  })

  app.get('/api/v1/status', async (_request, response) => {
    if (!pool) {
      return response.status(503).json({
        status: 'degraded',
        service: 'batchdrop-api',
        database: 'not_configured',
      })
    }

    try {
      await pool.query('SELECT 1')
      return response.json({
        status: 'ok',
        service: 'batchdrop-api',
        database: 'connected',
      })
    } catch {
      return response.status(503).json({
        status: 'degraded',
        service: 'batchdrop-api',
        database: 'unavailable',
      })
    }
  })

  app.use((_request, response) => {
    response.status(404).json({ error: 'Not found' })
  })

  app.use((error, _request, response, _next) => {
    void _next

    if (error.type === 'entity.parse.failed') {
      return response.status(400).json({ error: 'Invalid JSON request body' })
    }

    if (error.type === 'entity.too.large') {
      return response.status(413).json({ error: 'Request body is too large' })
    }

    console.error('Unhandled API error:', error)
    return response.status(500).json({ error: 'Internal server error' })
  })

  return app
}