const STORAGE_KEY = 'batchdrop.orders.v1'

export const SHOP_NAMES = ['Fern & Flour', 'Cornerstone Grocer', 'Goodkind Florist']

export function createSampleOrders(now = Date.now()) {
  const deadline = (minutes) => new Date(now + minutes * 60_000).toISOString()
  return [
    { id: 'BD-101', shop: SHOP_NAMES[0], destination: 'Oak & Third', x: 0.5, y: 0.5, units: 2, deadline: deadline(65), status: 'Ready' },
    { id: 'BD-102', shop: SHOP_NAMES[1], destination: 'Maple Court', x: 1.4, y: 0.9, units: 2, deadline: deadline(75), status: 'Ready' },
    { id: 'BD-103', shop: SHOP_NAMES[2], destination: 'Library Steps', x: 0.9, y: 1.6, units: 2, deadline: deadline(100), status: 'Ready' },
    { id: 'BD-104', shop: SHOP_NAMES[0], destination: 'West Market', x: 0.8, y: 0.2, units: 1, deadline: deadline(4), status: 'Ready' },
    { id: 'BD-105', shop: SHOP_NAMES[2], destination: 'Riverside Walk', x: 5.2, y: 3.1, units: 1, deadline: deadline(85), status: 'Preparing' },
  ]
}

function isValidOrder(order) {
  return order && typeof order.id === 'string' && typeof order.shop === 'string' &&
    typeof order.destination === 'string' && Number.isFinite(order.x) &&
    Number.isFinite(order.y) && Number.isFinite(order.units) && order.units > 0 &&
    !Number.isNaN(Date.parse(order.deadline)) &&
    ['Ready', 'Preparing', 'Approved'].includes(order.status)
}

export function readOrders() {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    if (!stored) return createSampleOrders()
    const parsed = JSON.parse(stored)
    return Array.isArray(parsed) && parsed.every(isValidOrder) ? parsed : createSampleOrders()
  } catch {
    return createSampleOrders()
  }
}

export function writeOrders(orders) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(orders))
    return true
  } catch {
    return false
  }
}

export function resetDemoData() {
  const orders = createSampleOrders()
  writeOrders(orders)
  return orders
}