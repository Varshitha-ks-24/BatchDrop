
const API_BASE_URL =
  import.meta.env.VITE_API_URL || 'http://localhost:3001'

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  })

  const data = await response.json().catch(() => ({}))

  if (!response.ok) {
    throw new Error(data.error || `Request failed (${response.status})`)
  }

  return data
}

function fromApiOrder(order) {
  return {
    id: order.id,
    shop: order.shop_name,
    destination: order.destination,
    x: Number(order.destination_x),
    y: Number(order.destination_y),
    units: Number(order.capacity_units),
    deadline: order.deadline,
    status: order.status,
  }
}

export async function getOrders() {
  const data = await request('/api/v1/orders')
  return data.orders.map(fromApiOrder)
}

export async function createOrder(order) {
  const data = await request('/api/v1/orders', {
    method: 'POST',
    body: JSON.stringify({
      id: order.id,
      shop_name: order.shop,
      pickup_details: null,
      destination: order.destination,
      destination_x: order.x,
      destination_y: order.y,
      capacity_units: order.units,
      deadline: order.deadline,
      status: order.status,
    }),
  })

  return fromApiOrder(data.order)
}
