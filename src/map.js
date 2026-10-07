import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const MS_TO_KNOTS = 1.943844;

const OSM_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
const OSM_ATTRIBUTION = '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
const SEAMARK_URL = 'https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png';
const SEAMARK_ATTRIBUTION = 'Seamarks © <a href="https://www.openseamap.org">OpenSeaMap</a> contributors';

const COLOUR_STOPS = [
  [0.0, [96, 165, 250]],
  [0.25, [34, 211, 238]],
  [0.5, [74, 222, 128]],
  [0.75, [250, 204, 21]],
  [1.0, [248, 113, 113]],
];

function speedColour(speed, maxSpeed) {
  const ratio = maxSpeed > 0 ? Math.min(speed / maxSpeed, 1) : 0;

  for (let i = 1; i < COLOUR_STOPS.length; i++) {
    const [upperAt, upper] = COLOUR_STOPS[i];
    const [lowerAt, lower] = COLOUR_STOPS[i - 1];

    if (ratio <= upperAt) {
      const local = (ratio - lowerAt) / (upperAt - lowerAt);
      const channel = (n) => Math.round(lower[n] + (upper[n] - lower[n]) * local);
      return `rgb(${channel(0)}, ${channel(1)}, ${channel(2)})`;
    }
  }

  return 'rgb(248, 113, 113)';
}

function arrowPath(map, lat, lon, east, north, speed, maxSpeed) {
  const start = map.latLngToLayerPoint([lat, lon]);
  const length = 10 + 30 * Math.min(speed / maxSpeed, 1);
  const angle = Math.atan2(-north, east);
  const tip = L.point(start.x + Math.cos(angle) * length, start.y + Math.sin(angle) * length);
  const wing = (spread) =>
    L.point(tip.x - Math.cos(angle + spread) * 6, tip.y - Math.sin(angle + spread) * 6);

  return [start, tip, wing(0.5), tip, wing(-0.5)].map((point) => map.layerPointToLatLng(point));
}

function tooltipText(east, north, speed) {
  const bearing = ((Math.atan2(east, north) * 180) / Math.PI + 360) % 360;
  return `${(speed * MS_TO_KNOTS).toFixed(2)} kn<br>Set ${bearing.toFixed(0)}°`;
}

function blendedVector(model, options, y, x) {
  const { frame, depth, low, high, weight } = options;

  const a = model.vectorAt(frame, depth, low, y, x);
  if (!a || low === high) return a;

  const b = model.vectorAt(frame, depth, high, y, x);
  if (!b) return null;

  return [a[0] + weight * (b[0] - a[0]), a[1] + weight * (b[1] - a[1])];
}

export function createMapView(container, onViewChange) {
  const map = L.map(container, { preferCanvas: true }).setView([48.5, -4.5], 6);

  const baseLayers = {
    'Dark (OSM)': L.tileLayer(OSM_URL, { maxZoom: 18, className: 'tiles-dark', attribution: OSM_ATTRIBUTION }),
    OpenStreetMap: L.tileLayer(OSM_URL, { maxZoom: 18, attribution: OSM_ATTRIBUTION }),
  };
  const seamarks = L.tileLayer(SEAMARK_URL, { maxZoom: 18, attribution: SEAMARK_ATTRIBUTION });
  const vectorLayer = L.layerGroup();

  baseLayers['Dark (OSM)'].addTo(map);
  seamarks.addTo(map);
  vectorLayer.addTo(map);

  L.control
    .layers(baseLayers, { 'OpenSeaMap seamarks': seamarks, 'Current arrows': vectorLayer })
    .addTo(map);

  map.on('zoomend moveend', onViewChange);

  return { map, vectorLayer };
}

export function fitToBounds(view, bounds) {
  view.map.fitBounds(bounds, { padding: [20, 20] });
}

export function clearVectors(view) {
  view.vectorLayer.clearLayers();
}

// options: { frame, depth, low, high, weight, maxArrows }
// Returns { count, maxSpeed } where maxSpeed is the strongest current (m/s) in this frame, over the whole grid.
export function drawVectors(view, model, options) {
  const { map, vectorLayer } = view;
  vectorLayer.clearLayers();

  const viewport = map.getBounds().pad(0.2);

  let frameMax = 0;
  let visible = 0;

  for (let y = 0; y < model.ny; y++) {
    for (let x = 0; x < model.nx; x++) {
      const vector = blendedVector(model, options, y, x);
      if (!vector) continue;

      frameMax = Math.max(frameMax, Math.hypot(vector[0], vector[1]));

      if (viewport.contains([model.latAt(y, x), model.lonAt(y, x)])) visible++;
    }
  }

  // Sampling follows the visible area, so zooming in shows more arrows.
  const step = Math.max(1, Math.ceil(Math.sqrt(visible / options.maxArrows)));
  let count = 0;

  for (let y = 0; y < model.ny; y += step) {
    for (let x = 0; x < model.nx; x += step) {
      const vector = blendedVector(model, options, y, x);
      if (!vector) continue;

      const lat = model.latAt(y, x);
      const lon = model.lonAt(y, x);
      if (!viewport.contains([lat, lon])) continue;

      const [east, north] = vector;
      const speed = Math.hypot(east, north);
      const path = arrowPath(map, lat, lon, east, north, speed, model.maxSpeed);

      L.polyline(path, {
        color: '#020617',
        weight: 5,
        opacity: 0.75,
        lineCap: 'round',
        lineJoin: 'round',
        interactive: false,
      }).addTo(vectorLayer);

      L.polyline(path, {
        color: speedColour(speed, model.maxSpeed),
        weight: 2.5,
        opacity: 1,
        lineCap: 'round',
        lineJoin: 'round',
      })
        .bindTooltip(tooltipText(east, north, speed), { sticky: true })
        .addTo(vectorLayer);

      count++;
    }
  }

  return { count, maxSpeed: frameMax };
}
