# BatchDrop

BatchDrop is a local-first MVP for neighborhood businesses to check whether nearby, ready delivery orders can share a route. The fictional demo includes three shops, a compatible pair, an over-capacity candidate, an urgent deadline, and an order still being prepared.

## Run locally

```sh
npm install
npm run dev
```

Open the local URL printed by Vite. Run `npm run lint` and `npm run build` for checks.

## Judge walkthrough

1. On Overview, point out the metrics derived from the current saved orders and choose **Find shared routes**.
2. On Routes, inspect the two-stop route, its full vehicle capacity, deadline feasibility, and estimated costs. The exclusions describe why the other orders did not join.
3. Change vehicle capacity to `3` to see the compatible route disappear, then restore it to `4`.
4. Review and approve the route. Approval marks included orders **Approved** for this local demo; it does not dispatch a driver.
5. In Orders, search/filter, mark an order ready, or add a fictional order with a future deadline. Changes persist after reload.
6. Choose **Reset demo data** and confirm to restore the five sample orders.

## Route and cost assumptions

- Destinations are fictional coordinates on a local kilometer grid; the depot is `(0, 0)`. Euclidean straight-line distance is multiplied by `1.25` as a simple route-detour estimate. It is not road-network distance or GPS.
- The model estimates travel at `20 km/h`, adds 6 minutes for loading and 3 minutes per stop, and checks stop arrival against each order deadline.
- The default simulated vehicle holds 4 package units; each pair of destinations must be within 3 grid km, and each route group contains no more than one order from the same shop.
- Estimated cost uses `$7.50` per trip plus `$1.40` per estimated kilometer for both separate and shared delivery scenarios. Separate trips are estimated as individual depot round trips; shared estimates follow the nearest-neighbor stop order and return to the depot.
- These are illustrative calculations, not live quotes, measured distances, or realized savings.

## Storage and limitations

Orders are read from and written to browser `localStorage` by `src/storage.js`. Sample data initializes a missing or invalid local store and is not re-added on every refresh. Data belongs to this browser profile on this device; it is not shared or synchronized with other shops, users, or devices. Clearing browser storage removes it. The storage adapter is separate from the UI and can later be replaced by a shared FastAPI and SQLite/cloud persistence layer.

The route engine in `src/routeEngine.js` is deterministic and dependency-free. It uses nearest-neighbor ordering, transparent configurable constraints, and specific exclusion reasons. It does not geocode, use maps, dispatch drivers, or provide operational delivery promises.