export const DEFAULT_CONSTRAINTS = {
  vehicleCapacity: 4,
  proximityKm: 3,
  averageSpeedKmh: 20,
  distanceFactor: 1.25,
  costPerKm: 1.4,
  costPerTrip: 7.5,
  loadingMinutes: 6,
  stopMinutes: 3,
}

export function straightLineKm(first, second) {
  return Math.hypot(first.x - second.x, first.y - second.y)
}

function nearestNeighbor(orders) {
  const remaining = [...orders]
  const sequence = []
  let position = { x: 0, y: 0 }
  while (remaining.length) {
    remaining.sort((a, b) => straightLineKm(position, a) - straightLineKm(position, b) || a.id.localeCompare(b.id))
    const [next] = remaining.splice(0, 1)
    sequence.push(next)
    position = next
  }
  return sequence
}

function estimateRoute(orders, constraints, now) {
  const sequence = nearestNeighbor(orders)
  let distanceKm = 0
  let elapsed = constraints.loadingMinutes
  let position = { x: 0, y: 0 }
  const stops = sequence.map((order, index) => {
    const legKm = straightLineKm(position, order) * constraints.distanceFactor
    distanceKm += legKm
    elapsed += (legKm / constraints.averageSpeedKmh) * 60 + constraints.stopMinutes
    position = order
    return { ...order, sequence: index + 1, etaMinutes: Math.ceil(elapsed) }
  })
  const returnKm = straightLineKm(position, { x: 0, y: 0 }) * constraints.distanceFactor
  distanceKm += returnKm
  return {
    stops,
    distanceKm,
    durationMinutes: Math.ceil(elapsed + (returnKm / constraints.averageSpeedKmh) * 60),
    capacityUsed: orders.reduce((total, order) => total + order.units, 0),
    deadlineMisses: stops.filter((stop) => now + stop.etaMinutes * 60_000 > Date.parse(stop.deadline)),
  }
}

function withinProximity(orders, limit) {
  return orders.every((order, index) => orders.slice(index + 1).every((other) => straightLineKm(order, other) <= limit))
}

export function buildRouteRecommendations(orders, constraints = DEFAULT_CONSTRAINTS, now = Date.now()) {
  const idCounts = new Map()
  for (const order of orders) idCounts.set(order.id, (idCounts.get(order.id) ?? 0) + 1)
  const duplicateIds = new Set([...idCounts].filter(([, count]) => count > 1).map(([id]) => id))
  const uniqueOrders = orders.filter((order) => !duplicateIds.has(order.id))
  const available = uniqueOrders.filter((order) => order.status === 'Ready')
  const remaining = [...available].sort((a, b) => Date.parse(a.deadline) - Date.parse(b.deadline) || a.id.localeCompare(b.id))
  const routes = []

  while (remaining.length > 1) {
    const seed = remaining[0]
    const group = [seed]
    const candidates = remaining.slice(1).sort((a, b) => straightLineKm(seed, a) - straightLineKm(seed, b) || a.id.localeCompare(b.id))
    for (const candidate of candidates) {
      const proposed = [...group, candidate]
      const distinctShops = new Set(proposed.map((order) => order.shop)).size === proposed.length
      const capacity = proposed.reduce((sum, order) => sum + order.units, 0)
      if (!distinctShops || capacity > constraints.vehicleCapacity || !withinProximity(proposed, constraints.proximityKm)) continue
      if (estimateRoute(proposed, constraints, now).deadlineMisses.length === 0) group.push(candidate)
    }

    if (group.length < 2) {
      remaining.shift()
      continue
    }
    const estimate = estimateRoute(group, constraints, now)
    const orderIds = group.map((order) => order.id)
    routes.push({
      id: `RT-${String(routes.length + 1).padStart(2, '0')}`,
      orders: group,
      orderIds,
      shops: [...new Set(group.map((order) => order.shop))],
      ...estimate,
    })
    const included = new Set(orderIds)
    for (let index = remaining.length - 1; index >= 0; index -= 1) {
      if (included.has(remaining[index].id)) remaining.splice(index, 1)
    }
  }

  const routedIds = new Set(routes.flatMap((route) => route.orderIds))
  const readyNotRouted = available.filter((order) => !routedIds.has(order.id))
  const emittedDuplicateIds = new Set()
  const exclusions = orders.filter((order) => {
    if (duplicateIds.has(order.id)) {
      if (emittedDuplicateIds.has(order.id)) return false
      emittedDuplicateIds.add(order.id)
      return true
    }
    return !routedIds.has(order.id)
  }).map((order) => ({
    order,
    reason: duplicateIds.has(order.id)
      ? 'Duplicate order ID; this ID is excluded to prevent ambiguous route assignment.'
      : exclusionReason(order, uniqueOrders, routes, readyNotRouted, constraints, now),
  }))
  return { routes, exclusions }
}

function exclusionReason(order, allOrders, routes, readyNotRouted, constraints, now) {
  if (order.status === 'Approved') return 'Already approved for review; not included in a new suggestion.'
  if (order.status !== 'Ready') return 'Order is still being prepared and is not ready for pickup.'
  const solo = estimateRoute([order], constraints, now)
  if (solo.deadlineMisses.length) return `Deadline is too soon for the estimated ${solo.durationMinutes}-minute trip.`

  for (const route of routes) {
    const nearest = Math.min(...route.orders.map((stop) => straightLineKm(order, stop)))
    if (nearest > constraints.proximityKm) continue
    const totalUnits = route.capacityUsed + order.units
    if (totalUnits > constraints.vehicleCapacity) {
      return `Adding ${order.units} unit${order.units === 1 ? '' : 's'} would exceed vehicle capacity (${totalUnits}/${constraints.vehicleCapacity}).`
    }
    if (estimateRoute([...route.orders, order], constraints, now).deadlineMisses.some((missed) => missed.id === order.id)) {
      return 'The suggested stop sequence would miss this order’s delivery deadline.'
    }
  }

  const partners = readyNotRouted.filter((other) => other.id !== order.id && other.shop !== order.shop)
  if (!partners.some((other) => straightLineKm(order, other) <= constraints.proximityKm)) {
    const anyReadyShop = allOrders.some((other) => other.status === 'Ready' && other.shop !== order.shop)
    return anyReadyShop
      ? `No ready order from another shop is within ${constraints.proximityKm.toFixed(1)} km.`
      : 'No compatible ready order from another shop is available.'
  }
  for (const partner of partners) {
    const pair = [order, partner]
    const units = pair.reduce((sum, item) => sum + item.units, 0)
    if (units > constraints.vehicleCapacity) return `This pair needs ${units} units, above the ${constraints.vehicleCapacity}-unit vehicle capacity.`
    if (estimateRoute(pair, constraints, now).deadlineMisses.length) return 'A paired route would arrive after at least one order’s deadline.'
  }
  return 'No remaining cross-shop group satisfies the route constraints.'
}

export function compareCosts(routes, constraints = DEFAULT_CONSTRAINTS) {
  const orders = routes.flatMap((route) => route.orders)
  const separateDistanceKm = orders.reduce((sum, order) => sum + 2 * straightLineKm({ x: 0, y: 0 }, order) * constraints.distanceFactor, 0)
  const separateDurationMinutes = orders.reduce((sum, order) => {
    const km = 2 * straightLineKm({ x: 0, y: 0 }, order) * constraints.distanceFactor
    return sum + constraints.loadingMinutes + constraints.stopMinutes + (km / constraints.averageSpeedKmh) * 60
  }, 0)
  const separateCost = orders.length * constraints.costPerTrip + separateDistanceKm * constraints.costPerKm
  const sharedDistanceKm = routes.reduce((sum, route) => sum + route.distanceKm, 0)
  const sharedDurationMinutes = routes.reduce((sum, route) => sum + route.durationMinutes, 0)
  const sharedCost = routes.length * constraints.costPerTrip + sharedDistanceKm * constraints.costPerKm
  const netSavings = separateCost - sharedCost
  return {
    separateDistanceKm, separateDurationMinutes, separateCost,
    sharedDistanceKm, sharedDurationMinutes, sharedCost, netSavings,
    savingsPercent: separateCost ? netSavings / separateCost * 100 : 0,
  }
}