import assert from 'node:assert/strict'
import test from 'node:test'
import { buildRouteRecommendations, compareCosts, DEFAULT_CONSTRAINTS } from './routeEngine.js'

const now = Date.parse('2026-10-17T12:00:00.000Z')

function createOrder({
  id,
  shop,
  x,
  y = 0,
  units = 1,
  deadlineMinutes = 120,
  status = 'Ready',
}) {
  return {
    id,
    shop,
    destination: `Zone ${id}`,
    x,
    y,
    units,
    deadline: new Date(now + deadlineMinutes * 60_000).toISOString(),
    status,
  }
}

test('groups compatible ready orders and creates deterministic nearest-neighbor stops', () => {
  const orders = [
    createOrder({ id: 'BD-2', shop: 'Shop B', x: 1.4, y: 0.9 }),
    createOrder({ id: 'BD-1', shop: 'Shop A', x: 0.5, y: 0.5 }),
  ]

  const { routes, exclusions } = buildRouteRecommendations(orders, DEFAULT_CONSTRAINTS, now)

  assert.equal(routes.length, 1)
  assert.deepEqual(routes[0].orderIds, ['BD-1', 'BD-2'])
  assert.deepEqual(routes[0].stops.map((stop) => stop.id), ['BD-1', 'BD-2'])
  assert.equal(routes[0].deadlineMisses.length, 0)
  assert.deepEqual(exclusions, [])
})

test('excludes orders that are not ready with a specific reason', () => {
  const preparing = createOrder({ id: 'BD-2', shop: 'Shop B', x: 0.7, status: 'Preparing' })
  const result = buildRouteRecommendations([
    createOrder({ id: 'BD-1', shop: 'Shop A', x: 0.5 }),
    preparing,
  ], DEFAULT_CONSTRAINTS, now)

  assert.equal(result.routes.length, 0)
  assert.equal(result.exclusions.length, 2)
  assert.match(result.exclusions.find(({ order }) => order.id === 'BD-2').reason, /not ready/i)
})

test('rejects a pair whose nearest-neighbor sequence misses a deadline', () => {
  const urgent = createOrder({ id: 'BD-1', shop: 'Shop A', x: 1.2, deadlineMinutes: 15 })
  const nearby = createOrder({ id: 'BD-2', shop: 'Shop B', x: 0.5, deadlineMinutes: 30 })
  const result = buildRouteRecommendations([urgent, nearby], DEFAULT_CONSTRAINTS, now)

  assert.equal(result.routes.length, 0)
  assert.match(result.exclusions.find(({ order }) => order.id === 'BD-1').reason, /paired route.*deadline/i)
})

test('rejects groups whose combined package units exceed vehicle capacity', () => {
  const result = buildRouteRecommendations([
    createOrder({ id: 'BD-1', shop: 'Shop A', x: 0.5, units: 3 }),
    createOrder({ id: 'BD-2', shop: 'Shop B', x: 0.7, units: 2 }),
  ], DEFAULT_CONSTRAINTS, now)

  assert.equal(result.routes.length, 0)
  assert.match(result.exclusions[0].reason, /5 units.*4-unit vehicle capacity/i)
})

test('excludes destinations outside the configured proximity limit', () => {
  const result = buildRouteRecommendations([
    createOrder({ id: 'BD-1', shop: 'Shop A', x: 0.5 }),
    createOrder({ id: 'BD-2', shop: 'Shop B', x: 5 }),
  ], DEFAULT_CONSTRAINTS, now)

  assert.equal(result.routes.length, 0)
  assert.match(result.exclusions[0].reason, /within 3\.0 km/i)
  assert.match(result.exclusions[1].reason, /within 3\.0 km/i)
})

test('assigns each unique order at most once and excludes duplicate IDs explicitly', () => {
  const separatedOrders = [
    createOrder({ id: 'BD-1', shop: 'Shop A', x: 0.5 }),
    createOrder({ id: 'BD-2', shop: 'Shop B', x: 0.8 }),
    createOrder({ id: 'BD-3', shop: 'Shop C', x: 7 }),
    createOrder({ id: 'BD-4', shop: 'Shop D', x: 7.3 }),
  ]
  const result = buildRouteRecommendations(separatedOrders, DEFAULT_CONSTRAINTS, now)
  const assignedIds = result.routes.flatMap((route) => route.orderIds)

  assert.equal(assignedIds.length, 4)
  assert.equal(new Set(assignedIds).size, assignedIds.length)
  assert.equal(result.routes.length, 2)

  const duplicateResult = buildRouteRecommendations([
    createOrder({ id: 'BD-duplicate', shop: 'Shop A', x: 0.5 }),
    createOrder({ id: 'BD-duplicate', shop: 'Shop B', x: 0.7 }),
    createOrder({ id: 'BD-other', shop: 'Shop C', x: 0.8 }),
  ], DEFAULT_CONSTRAINTS, now)
  assert.deepEqual(duplicateResult.routes, [])
  assert.equal(duplicateResult.exclusions.filter(({ order }) => order.id === 'BD-duplicate').length, 1)
  assert.match(duplicateResult.exclusions.find(({ order }) => order.id === 'BD-duplicate').reason, /duplicate order ID/i)
})

test('calculates separate and shared costs, savings, and zero-cost percentage consistently', () => {
  const orders = [
    createOrder({ id: 'BD-1', shop: 'Shop A', x: 0.5, y: 0.5 }),
    createOrder({ id: 'BD-2', shop: 'Shop B', x: 1.4, y: 0.9 }),
  ]
  const { routes } = buildRouteRecommendations(orders, DEFAULT_CONSTRAINTS, now)
  const costs = compareCosts(routes, DEFAULT_CONSTRAINTS)

  assert.equal(costs.separateCost, orders.length * DEFAULT_CONSTRAINTS.costPerTrip + costs.separateDistanceKm * DEFAULT_CONSTRAINTS.costPerKm)
  assert.equal(costs.sharedCost, routes.length * DEFAULT_CONSTRAINTS.costPerTrip + costs.sharedDistanceKm * DEFAULT_CONSTRAINTS.costPerKm)
  assert.equal(costs.netSavings, costs.separateCost - costs.sharedCost)
  assert.equal(costs.savingsPercent, costs.netSavings / costs.separateCost * 100)
  assert.ok(costs.netSavings > 0)

  const expensiveSharedRoute = [{ ...routes[0], distanceKm: 100 }]
  const negativeSavings = compareCosts(expensiveSharedRoute, DEFAULT_CONSTRAINTS)
  assert.ok(negativeSavings.netSavings < 0)
  assert.ok(negativeSavings.savingsPercent < 0)

  assert.deepEqual(compareCosts([]), {
    separateDistanceKm: 0,
    separateDurationMinutes: 0,
    separateCost: 0,
    sharedDistanceKm: 0,
    sharedDurationMinutes: 0,
    sharedCost: 0,
    netSavings: 0,
    savingsPercent: 0,
  })
})

test('handles empty orders and ready orders with no compatible groups', () => {
  assert.deepEqual(buildRouteRecommendations([], DEFAULT_CONSTRAINTS, now), { routes: [], exclusions: [] })

  const noGroups = buildRouteRecommendations([
    createOrder({ id: 'BD-1', shop: 'Shop A', x: 0.5 }),
    createOrder({ id: 'BD-2', shop: 'Shop A', x: 0.7 }),
  ], DEFAULT_CONSTRAINTS, now)
  assert.deepEqual(noGroups.routes, [])
  assert.equal(noGroups.exclusions.length, 2)
  assert.ok(noGroups.exclusions.every(({ reason }) => reason.length > 0))
})