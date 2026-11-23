import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

import { allBounds, boundsOf, covering, hasCoverage } from './atlas-picker.js';
import { formatTime } from './clock.js';
import { curveLabels, markerX, sparklinePath } from './sparkline.js';
import { MS_TO_KNOTS, arrowLengthPx, speedColour } from './speed-scale.js';
import { blendedVector } from './vector-blend.js';

const OSM_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
const OSM_ATTRIBUTION = '© OpenStreetMap contributors';
const SEAMARK_URL = 'https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png';
const SEAMARK_ATTRIBUTION = 'Seamarks © OpenSeaMap contributors';

const AREA_COLOUR = '#55D9D0';
const AREA_FILL = 0.05;
const AREA_FILL_HOVER = 0.16;

function arrowPath(map, lat, lon, east, north, speed) {
  const start = map.latLngToLayerPoint([lat, lon]);
  const length = arrowLengthPx(speed);
  const angle = Math.atan2(-north, east);
  const tip = L.point(start.x + Math.cos(angle) * length, start.y + Math.sin(angle) * length);
  const wing = (spread) =>
    L.point(tip.x - Math.cos(angle + spread) * 6, tip.y - Math.sin(angle + spread) * 6);

  return [start, tip, wing(0.5), tip, wing(-0.5)].map((point) => map.layerPointToLatLng(point));
}

// t(key) gives the layer names in the user's language; call updateLayerLabels() after a language change.
function buildLayersControl(view, t) {
  const { baseLayers, seamarks, vectorLayer, coverageLayer, legendLayer } = view;

  return L.control.layers(
    { [t('layers.dark')]: baseLayers.dark, [t('layers.osm')]: baseLayers.osm },
    {
      [t('layers.seamarks')]: seamarks,
      [t('layers.arrows')]: vectorLayer,
      [t('layers.areas')]: coverageLayer,
      [t('layers.legend')]: legendLayer,
    }
  );
}

export function createMapView(container, onViewChange, t) {
  const map = L.map(container, { preferCanvas: true }).setView([48.5, -4.5], 6);

  const view = {
    map,
    baseLayers: {
      dark: L.tileLayer(OSM_URL, { maxZoom: 18, className: 'tiles-dark', attribution: OSM_ATTRIBUTION }),
      osm: L.tileLayer(OSM_URL, { maxZoom: 18, attribution: OSM_ATTRIBUTION }),
    },
    seamarks: L.tileLayer(SEAMARK_URL, { maxZoom: 18, attribution: SEAMARK_ATTRIBUTION }),
    vectorLayer: L.layerGroup(),
    coverageLayer: L.layerGroup(),
    // Handle for the speed legend: an HTML box over the map, not map data.
    legendLayer: L.layerGroup(),
    layersControl: null,
  };

  view.baseLayers.dark.addTo(map);
  view.seamarks.addTo(map);
  view.vectorLayer.addTo(map);
  // On the map before the control is built, so its checkbox starts ticked.
  view.legendLayer.addTo(map);

  view.layersControl = buildLayersControl(view, t).addTo(map);

  map.on('zoomend moveend', onViewChange);

  return view;
}

// The legend box is shown and hidden through the empty legendLayer: the layers control
// adds and removes it, and cb(true/false) updates the page. The layer starts on the map,
// so the box starts visible; cb only hears the changes.
export function onLegendToggle(view, cb) {
  view.legendLayer.on('add', () => cb(true));
  view.legendLayer.on('remove', () => cb(false));
}

// A tap on the map asks for the current at that point; the callback decides when clicks count.
export function onPointClick(view, onClick) {
  view.map.on('click', (event) => onClick(event.latlng.wrap()));
}

export function closePopup(view) {
  view.map.closePopup();
}

// Calls onClose whenever a popup closes, so a query for a closed popup stops loading.
export function onPopupClose(view, onClose) {
  view.map.on('popupclose', onClose);
}

// Rebuilds the layer menu with new names; the layers that are switched on stay on.
export function updateLayerLabels(view, t) {
  view.map.removeControl(view.layersControl);
  view.layersControl = buildLayersControl(view, t).addTo(view.map);
}

export function fitToBounds(view, bounds) {
  view.map.fitBounds(bounds, { padding: [20, 20] });
}

export function clearVectors(view) {
  view.vectorLayer.clearLayers();
}

// Atlas areas: one outline per atlas. A tap opens the atlas, or lists the atlases when several overlap.

// "Iroise (560) · 250 m · 5 min" becomes a name and a line of details.
function splitLabel(label) {
  const [name, ...details] = label.split(' · ');
  return { name, details: details.join(' · ') };
}

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

function choiceButton(entry, finestLabel, onChoose) {
  const { name, details } = splitLabel(entry.label);

  const nameLine = element('span', 'atlas-choice-name', name);
  if (finestLabel) nameLine.append(element('span', 'atlas-choice-badge', finestLabel));

  const text = element('span', 'atlas-choice-text');
  text.append(nameLine);
  if (details) text.append(element('span', 'atlas-choice-details', details));

  const button = element('button', 'atlas-choice-item');
  button.type = 'button';
  button.append(text);
  button.addEventListener('click', onChoose);
  return button;
}

function chooseAt(map, entries, latlng, onPick, t) {
  const options = covering(entries, latlng.lat, latlng.lng);
  if (!options.length) return;

  if (options.length === 1) {
    map.closePopup();
    onPick(options[0].id);
    return;
  }

  const list = element('div', 'atlas-choice');
  list.append(
    element('p', 'atlas-choice-title', t('picker.title')),
    element('p', 'atlas-choice-hint', t('picker.hint'))
  );

  options.forEach((entry, index) => {
    list.append(
      choiceButton(entry, index === 0 ? t('picker.finest') : '', () => {
        map.closePopup();
        onPick(entry.id);
      })
    );
  });

  L.popup({
    className: 'atlas-popup',
    minWidth: 240,
    maxWidth: 320,
    keepInView: true,
    autoPanPadding: [16, 16],
  })
    .setLatLng(latlng)
    .setContent(list)
    .openOn(map);
}

// The popup for a tapped point, in the style of the atlas choice popup.
// result is a point-query result; t and number speak the current language.

const SPARK_WIDTH = 216;
const SPARK_HEIGHT = 40;
const SVG_NS = 'http://www.w3.org/2000/svg';

// The speed curve with the time marker at the start (the clicked moment).
function sparkline(series, options) {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${SPARK_WIDTH + 8} ${SPARK_HEIGHT + 4}`);
  svg.setAttribute('class', 'point-popup-spark');
  svg.setAttribute('aria-hidden', 'true');

  const group = document.createElementNS(SVG_NS, 'g');
  group.setAttribute('transform', 'translate(4 2)');

  const path = document.createElementNS(SVG_NS, 'path');
  path.setAttribute('d', sparklinePath(series.map((point) => point.speed), SPARK_WIDTH, SPARK_HEIGHT, options));
  group.append(path);

  // markerX(0) puts the marker at the clicked time, the first point of the series.
  const marker = document.createElementNS(SVG_NS, 'line');
  marker.setAttribute('class', 'point-popup-marker');
  marker.setAttribute('x1', markerX(0, series.length, SPARK_WIDTH));
  marker.setAttribute('x2', markerX(0, series.length, SPARK_WIDTH));
  marker.setAttribute('y1', 0);
  marker.setAttribute('y2', SPARK_HEIGHT);
  group.append(marker);

  svg.append(group);
  return svg;
}

// The popup for a tapped point, in the style of the atlas choice popup.
// result is a point-query result or update; t and number speak the current language.
// The labels under the curve: the strongest speed top-right, the span, and the caption.
function curveLabelsBlock(series, { t, number, offsetMinutes }) {
  const labels = curveLabels(
    series,
    (speed) => speed * MS_TO_KNOTS,
    (ms) => formatTime(ms, offsetMinutes)
  );

  const times = element('div', 'point-popup-times');
  times.append(element('span', null, labels.start), element('span', null, labels.end));

  return [
    element('p', 'point-popup-peak', `${number(labels.max, 2)} ${t('unit.kn')}`),
    times,
    element('p', 'point-popup-caption', t('point.curveCaption')),
  ];
}

export function showPointPopup(view, latlng, result, { t, number, offsetMinutes }) {
  const box = element('div', 'point-popup-card');
  const { status } = result;

  if (status === 'ready' || status === 'current' || status === 'curve') {
    const { current } = result;
    box.append(
      element(
        'p',
        'point-popup-speed',
        `${number(current.speed * MS_TO_KNOTS, 2)} ${t('unit.kn')} · ${t('tooltip.set')} ${Math.round(current.bearing)}°`
      )
    );

    if (status === 'curve') {
      box.append(element('p', 'point-popup-note', t('point.progress', { done: result.done, total: result.total })));
    } else if (status === 'ready' && result.series.length > 1) {
      box.append(element('p', 'point-popup-max', t('point.max', { value: number(result.maxSpeed * MS_TO_KNOTS, 2), unit: t('unit.kn') })));
      box.append(sparkline(result.series, { min: 0 }));
      box.append(...curveLabelsBlock(result.series, { t, number, offsetMinutes }));
    }
  } else {
    const texts = {
      loading: t('busy.framesOne'),
      outside: t('point.outside'),
      noTide: t('point.noTide'),
      land: t('point.land'),
      error: result.message ?? t('point.error'),
    };
    box.append(element('p', 'point-popup-note', texts[status] ?? t('point.error')));
  }

  // Update an open popup in place: re-opening it would fire popupclose and cancel the query.
  const open = view.pointPopup;
  if (open && view.map.hasLayer(open)) {
    open.setLatLng(latlng).setContent(box);
    return;
  }

  view.pointPopup = L.popup({
    className: 'atlas-popup point-popup',
    minWidth: 240,
    maxWidth: 320,
    keepInView: true,
    autoPanPadding: [16, 16],
  })
    .setLatLng(latlng)
    .setContent(box)
    .openOn(view.map);
}

// t is read when a popup opens, so it always speaks the current language.
export function setCoverage(view, entries, onPick, t) {
  const { map, coverageLayer } = view;
  coverageLayer.clearLayers();

  for (const entry of entries.filter(hasCoverage)) {
    const outline = L.rectangle(boundsOf(entry), {
      color: AREA_COLOUR,
      weight: 1.5,
      fillColor: AREA_COLOUR,
      fillOpacity: AREA_FILL,
    });

    outline.bindTooltip(entry.label, { sticky: true });
    outline.on('mouseover', () => outline.setStyle({ fillOpacity: AREA_FILL_HOVER }));
    outline.on('mouseout', () => outline.setStyle({ fillOpacity: AREA_FILL }));
    outline.on('click', (event) => {
      L.DomEvent.stopPropagation(event);
      chooseAt(map, entries, event.latlng, onPick, t);
    });

    outline.addTo(coverageLayer);
  }
}

export function setCoverageVisible(view, visible) {
  if (visible) view.map.addLayer(view.coverageLayer);
  else view.map.removeLayer(view.coverageLayer);
}

export function fitToCoverage(view, entries) {
  const bounds = allBounds(entries);
  if (bounds) fitToBounds(view, bounds);
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
      const path = arrowPath(map, lat, lon, east, north, speed);

      L.polyline(path, {
        color: '#091B27',
        weight: 5,
        opacity: 0.75,
        lineCap: 'round',
        lineJoin: 'round',
        interactive: false,
      }).addTo(vectorLayer);

      L.polyline(path, {
        color: speedColour(speed),
        weight: 2.5,
        opacity: 1,
        lineCap: 'round',
        lineJoin: 'round',
      }).addTo(vectorLayer);

      count++;
    }
  }

  return { count, maxSpeed: frameMax };
}
