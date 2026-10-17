
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
        } catch (error) {
      console.error('Database health check failed:', {
        code: error.code,
        message: error.message,
      })

      return response.status(503).json({
        status: 'degraded',
        service: 'batchdrop-api',
        database: 'unavailable',
      })
    }
  })

  // Fetch all orders
  app.get('/api/v1/orders', async (_request, response) => {
    if (!pool) {
      return response.status(503).json({
        error: 'Database is not configured',
      })
    }

    try {
      const result = await pool.query(`
        SELECT
          id, shop_name, pickup_details, destination,
          destination_x, destination_y, capacity_units,
          deadline, status, created_at, updated_at
        FROM orders
        ORDER BY created_at DESC
      `)

      return response.json({
        orders: result.rows,
        count: result.rowCount,
      })
    } catch (error) {
      console.error('Failed to fetch orders:', error)
      return response.status(500).json({
        error: 'Failed to fetch orders',
      })
    }
  })

  // Create an order
  app.post('/api/v1/orders', async (request, response) => {
    if (!pool) {
      return response.status(503).json({
        error: 'Database is not configured',
      })
    }

    const {
      id,
      shop_name,
      pickup_details = null,
      destination,
      destination_x,
      destination_y,
      capacity_units,
      deadline,
      status = 'Preparing',
    } = request.body ?? {}

    const x = Number(destination_x)
    const y = Number(destination_y)
    const capacity = Number(capacity_units)

    if (
      typeof id !== 'string' || !id.trim() ||
      typeof shop_name !== 'string' || !shop_name.trim() ||
      typeof destination !== 'string' || !destination.trim() ||
      destination_x === '' || destination_x == null || !Number.isFinite(x) || x < 0 || x > 12 ||
      destination_y === '' || destination_y == null || !Number.isFinite(y) || y < 0 || y > 12 ||
      capacity_units === '' || capacity_units == null || !Number.isInteger(capacity) || capacity <= 0 ||
      typeof deadline !== 'string' || !Number.isFinite(Date.parse(deadline)) ||
      !['Preparing', 'Ready', 'Approved'].includes(status) ||
      (pickup_details !== null && typeof pickup_details !== 'string')
    ) {
      return response.status(400).json({
        error: 'Invalid order data',
      })
    }

    try {
      const result = await pool.query(
        `INSERT INTO orders (
          id, shop_name, pickup_details, destination,
          destination_x, destination_y, capacity_units,
          deadline, status
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING
          id, shop_name, pickup_details, destination,
          destination_x, destination_y, capacity_units,
          deadline, status, created_at, updated_at`,
        [
          id.trim(),
          shop_name.trim(),
          pickup_details?.trim() || null,
          destination.trim(),
          x,
          y,
          capacity,
          new Date(deadline).toISOString(),
          status,
        ],
      )

      return response.status(201).json({
        order: result.rows[0],
      })
    } catch (error) {
      if (error.code === '23505') {
        return response.status(409).json({
          error: 'An order with this ID already exists',
        })
      }

      console.error('Failed to create order:', error)
      return response.status(500).json({
        error: 'Failed to create order',
      })
    }
  })

  app.use((_request, response) => {
    response.status(404).json({ error: 'Not found' })
  })

  app.use((error, _request, response, _next) => {
    void _next

    if (error.type === 'entity.parse.failed') {
      return response.status(400).json({
        error: 'Invalid JSON request body',
      })
    }

    if (error.type === 'entity.too.large') {
      return response.status(413).json({
        error: 'Request body is too large',
      })
    }

    console.error('Unhandled API error:', error)
    return response.status(500).json({
      error: 'Internal server error',
    })
  })

  return app
}
