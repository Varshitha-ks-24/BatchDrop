const DEFAULT_PORT = 3001
const DEFAULT_FRONTEND_ORIGIN = 'http://localhost:5173'

export function loadConfig(env = process.env) {
  const rawPort = env.PORT ?? String(DEFAULT_PORT)
  const port = Number(rawPort)

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT must be an integer between 1 and 65535.')
  }

  const frontendOrigin = env.FRONTEND_ORIGIN ?? DEFAULT_FRONTEND_ORIGIN
  let parsedOrigin

  try {
    parsedOrigin = new URL(frontendOrigin)
  } catch {
    throw new Error('FRONTEND_ORIGIN must be a valid HTTP or HTTPS origin.')
  }

  if (
    !['http:', 'https:'].includes(parsedOrigin.protocol) ||
    parsedOrigin.username ||
    parsedOrigin.password ||
    parsedOrigin.pathname !== '/' ||
    parsedOrigin.search ||
    parsedOrigin.hash
  ) {
    throw new Error('FRONTEND_ORIGIN must contain only an HTTP or HTTPS origin, without a path.')
  }

  const databaseUrl = env.DATABASE_URL?.trim() || null
  if (databaseUrl) {
    let parsedDatabaseUrl
    try {
      parsedDatabaseUrl = new URL(databaseUrl)
    } catch {
      throw new Error('DATABASE_URL must be a valid PostgreSQL connection URL.')
    }

    if (
      !['postgres:', 'postgresql:'].includes(parsedDatabaseUrl.protocol) ||
      !parsedDatabaseUrl.hostname ||
      parsedDatabaseUrl.pathname.length < 2
    ) {
      throw new Error('DATABASE_URL must be a valid PostgreSQL connection URL.')
    }
  }

  return {
    port,
    frontendOrigin: parsedOrigin.origin,
    databaseUrl,
  }
}