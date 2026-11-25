import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

import { allBounds, boundsOf, covering, hasCoverage } from './atlas-picker.js';
import { sampleArrows } from './arrows.js';
import { pointPopupCard } from './point-popup.js';
import { arrowLengthPx, speedColour } from './speed-scale.js';

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

// The popup for a tapped point. result is a point-query result; i18n is
// { t, number, offsetMinutes } and is read when the card is built.
export function showPointPopup(view, latlng, result, i18n) {
  // Update an open popup in place: re-opening it would fire popupclose and cancel the query.
  const open = view.pointPopup;
  if (open && view.map.hasLayer(open)) {
    open.setLatLng(latlng).setContent(pointPopupCard(result, i18n));
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
    .setContent(pointPopupCard(result, i18n))
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
  const { cells, maxSpeed } = sampleArrows(model, options, (lat, lon) => viewport.contains([lat, lon]));

  for (const { lat, lon, east, north, speed } of cells) {
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
  }

  return { count: cells.length, maxSpeed };
}
