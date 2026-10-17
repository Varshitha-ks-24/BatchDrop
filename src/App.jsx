import { useEffect, useMemo, useState } from 'react'
import { DEFAULT_CONSTRAINTS, buildRouteRecommendations, compareCosts } from './routeEngine'
import { SHOP_NAMES, readOrders, resetDemoData, writeOrders } from './storage'
import './App.css'

const money = (value) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(value)
const dateTime = (value) => new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(value))
const localInputTime = (date) => new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16)

function Icon({ name, size = 18 }) {
  const paths = {
    grid: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>,
    box: <><path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Z" /><path d="m4.3 7.6 7.7 4.3 7.7-4.3M12 12v9" /></>,
    route: <><circle cx="6" cy="18" r="2" /><circle cx="18" cy="6" r="2" /><path d="M8 18h2a4 4 0 0 0 4-4v-4a4 4 0 0 1 4-4" /></>,
    plus: <><path d="M12 5v14M5 12h14" /></>,
    search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></>,
    arrow: <><path d="M5 12h14M13 6l6 6-6 6" /></>,
    check: <><path d="m5 12 4 4L19 6" /></>,
    refresh: <><path d="M20 7v5h-5M4 17v-5h5" /><path d="M5.6 9a7 7 0 0 1 11.7-2L20 12M4 12l2.7 5a7 7 0 0 0 11.7-2" /></>,
    close: <><path d="m6 6 12 12M18 6 6 18" /></>,
    clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  }
  return <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>
}

function App() {
  const [orders, setOrders] = useState(readOrders)
  const [page, setPage] = useState('Overview')
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('All statuses')
  const [constraints, setConstraints] = useState(DEFAULT_CONSTRAINTS)
  const [notice, setNotice] = useState('')
  const [reviewRoute, setReviewRoute] = useState(null)

  const analysis = useMemo(() => buildRouteRecommendations(orders, constraints), [orders, constraints])
  const costs = useMemo(() => compareCosts(analysis.routes, constraints), [analysis.routes, constraints])
  const eligibleCount = analysis.routes.reduce((sum, route) => sum + route.orders.length, 0)
  const readyCount = orders.filter((order) => order.status === 'Ready').length
  const visibleOrders = orders.filter((order) => {
    const text = `${order.id} ${order.shop} ${order.destination}`.toLowerCase()
    return text.includes(query.toLowerCase()) && (statusFilter === 'All statuses' || order.status === statusFilter)
  })

  useEffect(() => { writeOrders(orders) }, [orders])

  function updateOrder(id, updater) {
    setOrders((current) => current.map((order) => order.id === id ? updater(order) : order))
  }

  function addOrder(event) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const deadline = new Date(String(form.get('deadline')))
    const units = Number(form.get('units'))
    if (!Number.isFinite(units) || units < 1 || units > 20) {
      setNotice('Package units must be between 1 and 20.')
      return false
    }
    if (deadline.getTime() <= Date.now()) {
      setNotice('Choose a delivery deadline in the future.')
      return false
    }
    const order = {
      id: `BD-${Date.now().toString().slice(-6)}`,
      shop: String(form.get('shop')),
      destination: String(form.get('destination')).trim(),
      x: Number(form.get('x')),
      y: Number(form.get('y')),
      units,
      deadline: deadline.toISOString(),
      status: form.get('ready') === 'on' ? 'Ready' : 'Preparing',
    }
    setOrders((current) => [order, ...current])
    event.currentTarget.reset()
    setNotice(`${order.id} added. It is saved in this browser.`)
    return true
  }

  function resetData() {
    if (!window.confirm('Reset all saved orders to the original BatchDrop demo data? This replaces orders in this browser.')) return
    setOrders(resetDemoData())
    setQuery('')
    setStatusFilter('All statuses')
    setNotice('Demo orders restored and saved in this browser.')
  }

  function approveRoute(route) {
    const included = new Set(route.orderIds)
    setOrders((current) => current.map((order) => included.has(order.id) ? { ...order, status: 'Approved' } : order))
    setReviewRoute(null)
    setNotice(`${route.id} approved for review. No driver has been dispatched.`)
  }

  function goToRoutes() {
    setPage('Routes')
    setNotice(analysis.routes.length
      ? `${analysis.routes.length} compatible route${analysis.routes.length === 1 ? '' : 's'} recalculated from saved orders.`
      : 'No compatible route meets the current constraints. Review the exclusions below.')
  }

  const toggleReady = (id) => updateOrder(id, (order) => ({ ...order, status: order.status === 'Ready' ? 'Preparing' : 'Ready' }))

  return <div className="app-shell">
    <aside className="sidebar">
      <button className="brand" onClick={() => setPage('Overview')} aria-label="BatchDrop overview"><span className="brand-mark"><Icon name="route" size={20} /></span><span>batch<span>drop</span><small>NEIGHBORHOOD LOGISTICS</small></span></button>
      <div className="side-label">WORKSPACE</div>
      <nav className="side-nav" aria-label="Main navigation">{[['Overview', 'grid'], ['Orders', 'box'], ['Routes', 'route']].map(([label, icon]) => <button key={label} className={`nav-item ${page === label ? 'active' : ''}`} aria-label={label} title={label} onClick={() => setPage(label)}><Icon name={icon} /><span>{label}</span>{label === 'Orders' && <span className="nav-count">{orders.length}</span>}</button>)}</nav>
      <div className="sidebar-bottom"><div className="demo-status"><i className="pulse-dot" />LOCAL DEMO MODE</div><p>Orders are saved in this browser only. Nothing is shared with other shops or devices.</p><button className="reset-button" onClick={resetData} title="Restore the original fictional sample orders"><Icon name="refresh" size={15} /> Reset demo data</button></div>
    </aside>

    <main className="main-area"><header className="topbar"><div className="crumb"><span>Workspace</span><b>/</b><strong>{page}</strong></div><div className="topbar-meta"><button className="mobile-reset" aria-label="Reset demo data" title="Reset demo data" onClick={resetData}><Icon name="refresh" size={15} /></button><span className="local-pill"><i /> Saved locally</span><span className="top-date">{new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric' }).format(new Date())}</span></div></header>
      <div className="page-content">{notice && <div className="notice" role="status"><span>{notice}</span><button aria-label="Dismiss notification" onClick={() => setNotice('')}><Icon name="close" size={16} /></button></div>}
        {page === 'Overview' && <OverviewPage orders={orders} routes={analysis.routes} eligibleCount={eligibleCount} readyCount={readyCount} costs={costs} onFindRoutes={goToRoutes} onOrders={() => setPage('Orders')} onToggleReady={toggleReady} />}
        {page === 'Orders' && <OrdersPage orders={orders} visibleOrders={visibleOrders} query={query} onQuery={setQuery} statusFilter={statusFilter} onStatusFilter={setStatusFilter} onAddOrder={addOrder} onToggleReady={toggleReady} />}
        {page === 'Routes' && <RoutesPage analysis={analysis} costs={costs} constraints={constraints} onConstraintChange={(key, value) => setConstraints((current) => ({ ...current, [key]: Number(value) }))} onReview={setReviewRoute} onOrders={() => setPage('Orders')} />}
      </div><footer className="page-footer">BatchDrop local demo <span>·</span> Distances, travel times, and costs are simulated estimates, not measured road data. <span>·</span> Orders are saved in this browser only, not shared or synchronized.</footer>
    </main>
    {reviewRoute && <ReviewModal route={reviewRoute} costs={costs} constraints={constraints} onClose={() => setReviewRoute(null)} onApprove={() => approveRoute(reviewRoute)} />}
  </div>
}

function PageHeading({ eyebrow, title, description, action }) {
  return <div className="page-heading"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1><p>{description}</p></div>{action}</div>
}

function OverviewPage({ orders, routes, eligibleCount, readyCount, costs, onFindRoutes, onOrders, onToggleReady }) {
  const recentOrders = [...orders].sort((a, b) => b.id.localeCompare(a.id)).slice(0, 5)
  const included = new Set(routes.flatMap((route) => route.orderIds))
  return <>
    <PageHeading eyebrow="NEIGHBORHOOD DELIVERY, TOGETHER" title="Good morning, team." description="A clearer view of what is ready, what can travel together, and what each trip might cost." action={<button className="button button-primary" onClick={onFindRoutes}><Icon name="route" /> Find shared routes <Icon name="arrow" size={16} /></button>} />
    <section className="metric-grid" aria-label="Order and route metrics"><Metric label="Total orders" value={orders.length} detail={`${readyCount} ready for pickup`} icon="box" tone="forest" /><Metric label="Eligible to share" value={eligibleCount} detail="In a feasible suggested route" icon="check" tone="lime" /><Metric label="Suggested routes" value={routes.length} detail="Recalculated from current orders" icon="route" tone="sage" /><Metric label="Estimated savings" value={routes.length ? money(costs.netSavings) : '—'} detail={routes.length ? `${Math.abs(costs.savingsPercent).toFixed(0)}% vs separate trips` : 'No route to compare'} icon="arrow" tone="terra" /></section>
    <div className="dashboard-grid"><section className="panel recent-panel"><div className="panel-heading"><div><span className="section-kicker">LIVE ORDER BOARD</span><h2>Recent orders</h2></div><button className="text-button" onClick={onOrders}>All orders <Icon name="arrow" size={15} /></button></div>{recentOrders.length ? <OrdersTable orders={recentOrders} routeOrderIds={included} onToggleReady={onToggleReady} compact /> : <EmptyState title="No orders yet" text="Add an order to start building your neighborhood delivery pool." />}</section>
      <section className="panel savings-panel"><span className="section-kicker">WHY BATCHDROP</span><h2>One neighborhood.<br /><em>Fewer repeated trips.</em></h2><p>BatchDrop checks which ready orders can fit together before suggesting a route. Each stop must be close, fit the vehicle, and meet its delivery deadline.</p><div className="savings-divider" />{routes.length ? <div className="mini-comparison"><div><span>Separate trips</span><strong>{money(costs.separateCost)}</strong></div><b className="mini-arrow">→</b><div><span>Shared estimate</span><strong>{money(costs.sharedCost)}</strong></div></div> : <p className="no-comparison">No eligible shared route to compare yet.</p>}<small>Illustrative estimate using the same cost model as the Routes page.</small></section></div>
    <section className="how-strip"><div className="how-title"><span className="section-kicker">A SIMPLE CHECK, BEFORE THE VAN MOVES</span><h2>Built around real constraints.</h2></div><div className="how-step"><b>01</b><span><strong>Ready first</strong><small>Only pickup-ready orders are considered.</small></span></div><div className="how-step"><b>02</b><span><strong>Check the fit</strong><small>Nearby stops, deadlines, and capacity.</small></span></div><div className="how-step"><b>03</b><span><strong>Compare the cost</strong><small>One route estimate beside separate trips.</small></span></div></section>
  </>
}

function Metric({ label, value, detail, icon, tone }) {
  return <article className={`metric-card metric-${tone}`}><div className="metric-top"><span>{label}</span><i><Icon name={icon} size={17} /></i></div><strong className="metric-value">{value}</strong><small>{detail}</small></article>
}

function OrdersPage({ orders, visibleOrders, query, onQuery, statusFilter, onStatusFilter, onAddOrder, onToggleReady }) {
  const [formOpen, setFormOpen] = useState(false)
  const [deadlineDefault, setDeadlineDefault] = useState('')
  function toggleForm() {
    if (!formOpen) setDeadlineDefault(localInputTime(new Date(Date.now() + 60 * 60_000)))
    setFormOpen((open) => !open)
  }
  function submitOrder(event) {
    if (onAddOrder(event)) setFormOpen(false)
  }
  return <>
    <PageHeading eyebrow="ORDER MANAGEMENT" title="Orders" description={`${orders.length} orders in this browser’s local demo workspace.`} action={<button className="button button-primary" onClick={toggleForm}><Icon name="plus" /> Add order</button>} />
    {formOpen && <section className="panel add-order-panel"><div className="panel-heading"><div><span className="section-kicker">NEW DELIVERY REQUEST</span><h2>Add an order</h2></div><button className="icon-button" aria-label="Close add order form" onClick={() => setFormOpen(false)}><Icon name="close" /></button></div><form className="order-form" onSubmit={submitOrder}>
      <label>Shop<select name="shop" required>{SHOP_NAMES.map((shop) => <option key={shop}>{shop}</option>)}</select></label><label>Delivery zone<input name="destination" required maxLength="48" placeholder="e.g. Cedar Square" /></label><label>Grid X (km)<input name="x" type="number" min="0" max="12" step="0.1" defaultValue="1.0" required /></label><label>Grid Y (km)<input name="y" type="number" min="0" max="12" step="0.1" defaultValue="1.0" required /></label><label>Package units<input name="units" type="number" min="1" max="20" step="1" defaultValue="1" required /></label><label>Deliver by<input name="deadline" type="datetime-local" min={localInputTime(new Date())} defaultValue={deadlineDefault} required /></label><label className="form-check"><input name="ready" type="checkbox" defaultChecked /> Ready for pickup</label><div className="form-note">Coordinates use a local demo grid in km from the neighborhood depot at (0, 0). They are not GPS locations.</div><div className="form-actions"><button className="button button-quiet" type="button" onClick={() => setFormOpen(false)}>Cancel</button><button className="button button-primary" type="submit"><Icon name="plus" /> Save order</button></div>
    </form></section>}
    <section className="panel orders-panel"><div className="orders-toolbar"><div><span className="section-kicker">SAVED ORDER LIST</span><h2>All orders <span className="muted-count">{visibleOrders.length} of {orders.length}</span></h2></div><div className="filters"><label className="search-control"><Icon name="search" size={16} /><input aria-label="Search orders" placeholder="Search shop, zone, ID" value={query} onChange={(event) => onQuery(event.target.value)} /></label><select aria-label="Filter by order status" value={statusFilter} onChange={(event) => onStatusFilter(event.target.value)}><option>All statuses</option><option>Ready</option><option>Preparing</option><option>Approved</option></select></div></div>{visibleOrders.length ? <OrdersTable orders={visibleOrders} routeOrderIds={new Set()} onToggleReady={onToggleReady} /> : <EmptyState title={orders.length ? 'No matching orders' : 'No orders yet'} text={orders.length ? 'Try a different search or status filter, or add an order.' : 'Add an order to start building your neighborhood delivery pool.'} />}</section>
    <p className="storage-note"><Icon name="check" size={15} /> Changes are stored in localStorage in this browser. They are not synchronized with other shops or devices.</p>
  </>
}

function OrdersTable({ orders, routeOrderIds, onToggleReady, compact = false }) {
  return <div className={`table-scroll ${compact ? 'compact-table' : ''}`}><table className="orders-table"><thead><tr><th>Order</th><th>Shop</th><th>Destination</th><th>Ready by</th><th>Package</th><th>Status</th><th><span className="sr-only">Actions</span></th></tr></thead><tbody>{orders.map((order) => <tr key={order.id}><td><strong className="order-id">{order.id}</strong></td><td>{order.shop}</td><td><span className="destination-name">{order.destination}</span><small className="coordinates">{order.x.toFixed(1)}, {order.y.toFixed(1)} km grid</small></td><td>{dateTime(order.deadline)}</td><td>{order.units} unit{order.units === 1 ? '' : 's'}</td><td><StatusBadge status={order.status} routed={routeOrderIds.has(order.id)} /></td><td>{order.status === 'Approved' ? <span className="approved-mark" title="Approved for review"><Icon name="check" size={16} /></span> : <button className={`ready-toggle ${order.status === 'Ready' ? 'is-ready' : ''}`} onClick={() => onToggleReady(order.id)} aria-label={`${order.status === 'Ready' ? 'Mark not ready' : 'Mark ready'}: ${order.id}`} title={order.status === 'Ready' ? 'Mark not ready' : 'Mark ready'}>{order.status === 'Ready' ? <Icon name="check" size={15} /> : <span className="toggle-dot" />}</button>}</td></tr>)}</tbody></table></div>
}

function StatusBadge({ status, routed }) {
  return <span className={`status-badge status-${status.toLowerCase()}`}><i />{status === 'Ready' && routed ? 'Route match' : status}</span>
}

function RoutesPage({ analysis, costs, constraints, onConstraintChange, onReview, onOrders }) {
  const [showAssumptions, setShowAssumptions] = useState(false)
  return <>
    <PageHeading eyebrow="ROUTE RECOMMENDATIONS" title="Shared routes" description="Suggestions recalculate from saved orders whenever readiness or route constraints change." action={<button className="button button-quiet" onClick={onOrders}><Icon name="box" /> Manage orders</button>} />
    <section className="constraint-bar panel"><div><span className="section-kicker">ROUTE CONSTRAINTS</span><strong>Adjust the demo vehicle</strong></div><label>Capacity <span><input aria-label="Vehicle capacity in units" type="number" min="1" max="20" value={constraints.vehicleCapacity} onChange={(event) => onConstraintChange('vehicleCapacity', event.target.value)} /> units</span></label><label>Max stop distance <span><input aria-label="Maximum destination proximity in kilometers" type="number" min="0.5" max="12" step="0.5" value={constraints.proximityKm} onChange={(event) => onConstraintChange('proximityKm', event.target.value)} /> km</span></label><span className="constraint-live"><i /> Live recalculation</span></section>
    {analysis.routes.length ? <div className="route-list">{analysis.routes.map((route) => <RouteCard key={route.id} route={route} constraints={constraints} onReview={() => onReview(route)} />)}</div> : <section className="panel no-routes"><div className="empty-route-mark"><Icon name="route" size={23} /></div><div><span className="section-kicker">NO COMPATIBLE GROUPS</span><h2>Nothing to batch just yet.</h2><p>We need at least two ready orders from different shops that meet the current distance, capacity, and deadline checks.</p><button className="button button-quiet" onClick={onOrders}>Review order readiness <Icon name="arrow" size={15} /></button></div></section>}
    <div className="route-lower-grid"><section className="panel exclusions-panel"><div className="panel-heading"><div><span className="section-kicker">TRANSPARENT DECISIONS</span><h2>Why orders were excluded</h2></div><span className="count-chip">{analysis.exclusions.length}</span></div>{analysis.exclusions.length ? <div className="exclusion-list">{analysis.exclusions.map(({ order, reason }) => <div className="exclusion-row" key={order.id}><span className="exclusion-icon"><Icon name="clock" size={15} /></span><div><strong>{order.id} <span>· {order.shop}</span></strong><p>{reason}</p></div></div>)}</div> : <EmptyState title={analysis.routes.length ? 'Every order has a route' : 'No orders to evaluate'} text={analysis.routes.length ? 'No orders are currently excluded from route suggestions.' : 'Add orders to see why they can or cannot share a route.'} />}</section>
      <section className="panel cost-panel"><div className="panel-heading"><div><span className="section-kicker">ESTIMATED COST MODEL</span><h2>One route, two scenarios</h2></div><button className="info-button" title="All figures use the same illustrative model." aria-label="Show cost assumptions" onClick={() => setShowAssumptions((show) => !show)}>i</button></div>{analysis.routes.length ? <><div className="cost-options"><CostOption label="Separate trips · same orders" amount={costs.separateCost} distance={costs.separateDistanceKm} time={costs.separateDurationMinutes} color="sage" /><CostOption label="Shared routes" amount={costs.sharedCost} distance={costs.sharedDistanceKm} time={costs.sharedDurationMinutes} color="lime" /></div><div className={`net-savings ${costs.netSavings < 0 ? 'negative' : ''}`}><span>{costs.netSavings >= 0 ? 'Estimated savings' : 'Estimated added cost'}</span><strong>{money(Math.abs(costs.netSavings))}</strong><small>{Math.abs(costs.savingsPercent).toFixed(1)}% {costs.netSavings >= 0 ? 'saved vs separate trips' : 'higher than separate trips'}</small></div></> : <p className="no-comparison cost-empty">No eligible shared route to compare. Cost and savings estimates appear when orders form a feasible route.</p>}{showAssumptions && <div className="assumptions"><strong>Shared assumptions</strong><span>Depot at (0, 0); straight-line distance multiplied by {constraints.distanceFactor.toFixed(2)} as a simple detour factor; average speed {constraints.averageSpeedKmh} km/h.</span><span>{money(constraints.costPerTrip)} per trip + {money(constraints.costPerKm)} per estimated km. Add {constraints.loadingMinutes} min load time and {constraints.stopMinutes} min per stop.</span><span>Simulation only. No figures are measured road distances, quotes, or realized savings.</span></div>}</section></div>
  </>
}

function RouteCard({ route, constraints, onReview }) {
  const routeCost = route.distanceKm * constraints.costPerKm + constraints.costPerTrip
  return <article className="route-card panel"><div className="route-card-head"><div><span className="route-id">{route.id}</span><span className="route-ready"><i /> DEADLINES FEASIBLE</span><h2>{route.shops.join(' + ')}</h2><p>{route.orders.length} orders <span>·</span> {route.stops.length} delivery stops</p></div><button className="button button-quiet review-button" onClick={onReview}>Review route <Icon name="arrow" size={15} /></button></div>
    <div className="route-body"><div className="route-visual" aria-label={`Suggested stop sequence for ${route.id}`}><div className="route-origin"><span className="origin-dot" /><span><strong>BatchDrop depot</strong><small>Pickup origin · (0, 0)</small></span></div><div className="route-stops">{route.stops.map((stop) => <div className="route-stop" key={stop.id}><span className="stop-number">{stop.sequence}</span><span className="stop-line" /><div><strong>{stop.destination}</strong><small>{stop.shop} · {stop.x.toFixed(1)}, {stop.y.toFixed(1)} km grid</small></div><span className="stop-eta">~{stop.etaMinutes} min</span></div>)}</div><div className="route-destination"><span className="origin-dot end-dot" /><span><strong>Return to depot</strong><small>Route complete</small></span></div></div>
      <div className="route-stats"><div><span>EST. DISTANCE</span><strong>{route.distanceKm.toFixed(1)} <small>km</small></strong></div><div><span>EST. DURATION</span><strong>{route.durationMinutes} <small>min</small></strong></div><div><span>VEHICLE CAPACITY</span><strong>{route.capacityUsed}<small> / {constraints.vehicleCapacity} units</small></strong><div className="capacity-track"><i style={{ width: `${Math.min(100, route.capacityUsed / constraints.vehicleCapacity * 100)}%` }} /></div><small className="capacity-remaining">{constraints.vehicleCapacity - route.capacityUsed} units remaining</small></div><div className="deadline-check"><Icon name="check" size={16} /><span>Each stop arrives before its order deadline</span></div></div>
    </div><div className="route-card-foot"><span>Included: {route.orderIds.join(', ')}</span><span>Estimated shared cost <strong>{money(routeCost)}</strong></span></div></article>
}

function CostOption({ label, amount, distance, time, color }) {
  return <div className="cost-option"><div className={`cost-marker ${color}`} /><div className="cost-option-info"><span>{label}</span><strong>{money(amount)}</strong><small>{distance.toFixed(1)} km <i>·</i> {Math.round(time)} min</small></div></div>
}

function ReviewModal({ route, costs, constraints, onClose, onApprove }) {
  const routeCost = route.distanceKm * constraints.costPerKm + constraints.costPerTrip
  return <div className="modal-backdrop" onClick={(event) => { if (event.target === event.currentTarget) onClose() }}><section className="review-modal" role="dialog" aria-modal="true" aria-labelledby="review-title"><div className="modal-top"><span className="section-kicker">REVIEW SUGGESTION · {route.id}</span><button className="icon-button" aria-label="Close review" onClick={onClose}><Icon name="close" /></button></div><h2 id="review-title">Approve this shared route?</h2><p className="modal-copy">Approval marks these orders for review in the local demo. This does not assign a driver or dispatch a delivery.</p><div className="review-summary"><div><span>PARTICIPATING SHOPS</span><strong>{route.shops.join(' + ')}</strong></div><div><span>ORDER IDS</span><strong>{route.orderIds.join(', ')}</strong></div><div><span>EST. ROUTE</span><strong>{route.distanceKm.toFixed(1)} km · {route.durationMinutes} min</strong></div><div><span>EST. SHARED COST</span><strong>{money(routeCost)}</strong></div><div><span>COMPARED WITH SEPARATE</span><strong>{money(costs.separateCost)}</strong></div></div><div className="modal-actions"><button className="button button-quiet" onClick={onClose}>Keep as suggestion</button><button className="button button-primary" onClick={onApprove}><Icon name="check" /> Approve for review</button></div></section></div>
}

function EmptyState({ title, text }) {
  return <div className="empty-state"><span className="empty-mark"><Icon name="box" size={20} /></span><strong>{title}</strong><p>{text}</p></div>
}

export default App