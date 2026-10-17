import 'dotenv/config'
import { pathToFileURL } from 'node:url'
import { createApp } from './app.js'
import { loadConfig } from './config.js'
import { createPool } from './database.js'

export function startServer(env = process.env) {
  let config

  try {
    config = loadConfig(env)
  } catch (error) {
    console.error(`BatchDrop API configuration error: ${error.message}`)
    return null
  }

  const pool = createPool(config.databaseUrl)
  const app = createApp({ ...config, pool })
  const server = app.listen(config.port, () => {
    console.log(`BatchDrop API listening on port ${config.port}`)
  })

  server.on('error', (error) => {
    console.error(`BatchDrop API failed to start: ${error.message}`)
    process.exitCode = 1
  })

  const closeServer = () => {
    server.close(() => {
      pool?.end().catch(() => {
        console.error('PostgreSQL pool shutdown failed.')
      })
    })
  }
  process.once('SIGINT', closeServer)
  process.once('SIGTERM', closeServer)

  return server
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const server = startServer()
  if (!server) process.exitCode = 1
}