import { NetCDFReader } from 'netcdfjs';

const MS_TO_KNOTS = 1.943844;
const TIDAL_REFERENCE_MS = Date.UTC(1950, 0, 1, 12, 0, 0);

const CANDIDATES = {
  lon: { standard: ['longitude'], names: ['longitude', 'lon', 'nav_lon'] },
  lat: { standard: ['latitude'], names: ['latitude', 'lat', 'nav_lat'] },
  time: { standard: ['time'], names: ['time', 'time_counter'] },
  depth: { standard: ['depth', 'altitude'], names: ['depth', 'deptht', 'lev', 'level', 'z'] },
  coeff: { standard: [], names: ['coeff', 'coefficient', 'tide_coefficient'] },
  u: {
    standard: [
      'eastward_sea_water_velocity',
      'eastward_sea_water_velocity_due_to_tides',
      'eastward_current_velocity',
      'surface_geostrophic_eastward_sea_water_velocity',
    ],
    names: ['u', 'uo', 'ugos', 'vozocrtx', 'u_velocity'],
  },
  v: {
    standard: [
      'northward_sea_water_velocity',
      'northward_sea_water_velocity_due_to_tides',
      'northward_current_velocity',
      'surface_geostrophic_northward_sea_water_velocity',
    ],
    names: ['v', 'vo', 'vgos', 'vomecrty', 'v_velocity'],
  },
};

function attributesOf(variable) {
  return Object.fromEntries(variable.attributes.map((a) => [a.name, a.value]));
}

function globalAttributesOf(reader) {
  return Object.fromEntries(reader.globalAttributes.map((a) => [a.name, a.value]));
}

function firstNumber(value, fallback) {
  const n = Number(Array.isArray(value) ? value[0] : value);
  return Number.isFinite(n) ? n : fallback;
}

function titleCase(text) {
  return text.toLowerCase().replace(/(^|[\s'-])(\p{L})/gu, (_, sep, letter) => sep + letter.toUpperCase());
}

function findVariable(reader, candidate) {
  const variables = reader.variables;

  const byStandard = variables.find((v) =>
    candidate.standard.includes(String(attributesOf(v).standard_name || '').toLowerCase())
  );
  if (byStandard) return byStandard;

  return variables.find((v) => candidate.names.includes(v.name.toLowerCase()));
}

function shapeOf(reader, variable) {
  return variable.dimensions.map((id) => {
    const dimension = reader.dimensions[id];
    const isRecord = reader.recordDimension && reader.recordDimension.id === id;
    return {
      name: dimension.name,
      size: isRecord ? reader.recordDimension.length : dimension.size,
    };
  });
}

function readValues(reader, variable) {
  const raw = reader.getDataVariable(variable.name);
  const flat = Array.isArray(raw[0]) ? raw.flat() : raw;

  // Classic NetCDF pads small types to 4 bytes, and netcdfjs returns the padding too.
  const expected = shapeOf(reader, variable).reduce((product, d) => product * d.size, 1);
  const length = Math.min(flat.length, expected);

  const attrs = attributesOf(variable);
  const scale = firstNumber(attrs.scale_factor, 1);
  const offset = firstNumber(attrs.add_offset, 0);
  const fills = [attrs._FillValue, attrs.missing_value]
    .flat()
    .filter((value) => value !== undefined && value !== null)
    .map(Number);

  const out = new Float64Array(length);

  for (let i = 0; i < length; i++) {
    const value = flat[i];
    const invalid = !Number.isFinite(value) || fills.includes(value) || Math.abs(value) > 1e20;
    out[i] = invalid ? NaN : value * scale + offset;
  }

  return out;
}

function speedFactor(units) {
  const text = String(units || '').toLowerCase();
  if (/cm/.test(text)) return 0.01;
  if (/knot|^kt/.test(text)) return 1 / MS_TO_KNOTS;
  return 1;
}

function parseTimes(values, units) {
  const match = String(units || '').match(/^(seconds?|minutes?|hours?|days?)\s+since\s+(.+)$/i);
  if (!match) return Array.from(values, () => null);

  const unit = match[1].toLowerCase().replace(/s$/, '');
  const milliseconds = { second: 1e3, minute: 6e4, hour: 36e5, day: 864e5 }[unit];

  let origin = match[2].trim().replace(' ', 'T');
  if (!/(Z|[+-]\d\d:?\d\d)$/.test(origin)) origin += 'Z';

  const originMs = Date.parse(origin);
  if (Number.isNaN(originMs)) throw new Error(`Unsupported time units: ${units}`);

  return Array.from(values, (value) => new Date(originMs + value * milliseconds));
}

function isTidalAtlasEpoch(date) {
  return (
    date instanceof Date &&
    date.getUTCFullYear() === 1950 &&
    date.getUTCMonth() === 0 &&
    date.getUTCDate() === 1
  );
}

// Reads the reference tide (port and HW/LW) from global attributes,
// falling back to the time variable's comment ("Reference maree: PM  Concarneau").
function readReference(reader, timeVariable) {
  const globals = globalAttributesOf(reader);
  const comment = timeVariable ? String(attributesOf(timeVariable).comment || '') : '';
  const fromComment = comment.match(/\b(PM|BM)\b\s+(.+)$/i);

  const port = String(globals.Portref || fromComment?.[2] || '').trim();
  if (!port) return null;

  const isLowWater =
    globals.isBM !== undefined ? firstNumber(globals.isBM, 0) === 1 : /^BM$/i.test(fromComment?.[1] || '');

  return {
    port: titleCase(port),
    code: globals.code_du_port_de_reference ? String(globals.code_du_port_de_reference) : '',
    type: isLowWater ? 'LW' : 'HW',
    title: String(globals.title || ''),
  };
}

function describeFile(reader) {
  return JSON.stringify(
    {
      globalAttributes: globalAttributesOf(reader),
      dimensions: reader.dimensions.map((d) => `${d.name}=${d.size || reader.recordDimension?.length}`),
      variables: reader.variables.map((v) => ({
        name: v.name,
        dims: v.dimensions.map((id) => reader.dimensions[id].name),
        standard_name: attributesOf(v).standard_name,
        units: attributesOf(v).units,
      })),
    },
    null,
    2
  );
}

function normaliseLongitude(value) {
  return value > 180 ? value - 360 : value;
}

export function parseCurrents(buffer) {
  const reader = new NetCDFReader(buffer);
  const info = describeFile(reader);

  const found = Object.fromEntries(
    Object.entries(CANDIDATES).map(([key, candidate]) => [key, findVariable(reader, candidate)])
  );

  const missing = ['lon', 'lat', 'u', 'v'].filter((key) => !found[key]);
  if (missing.length) {
    const error = new Error(`Could not identify variables: ${missing.join(', ')}. See "File structure" for what the file contains.`);
    error.info = info;
    throw error;
  }

  const u = readValues(reader, found.u);
  const v = readValues(reader, found.v);
  const factor = speedFactor(attributesOf(found.u).units);

  const shape = shapeOf(reader, found.u);
  const names = shape.map((d) => d.name);
  const strides = shape.map((_, i) => shape.slice(i + 1).reduce((product, d) => product * d.size, 1));

  const axisOf = (variable) => (variable ? names.indexOf(shapeOf(reader, variable)[0].name) : -1);
  const timeAxis = axisOf(found.time);
  const depthAxis = axisOf(found.depth);
  const coeffAxis = axisOf(found.coeff);
  const yAxis = shape.length - 2;
  const xAxis = shape.length - 1;

  const ny = shape[yAxis].size;
  const nx = shape[xAxis].size;
  const timeCount = timeAxis >= 0 ? shape[timeAxis].size : 1;
  const depthCount = depthAxis >= 0 ? shape[depthAxis].size : 1;
  const coeffCount = coeffAxis >= 0 ? shape[coeffAxis].size : 1;

  const lonValues = readValues(reader, found.lon);
  const latValues = readValues(reader, found.lat);
  const curvilinear = found.lon.dimensions.length === 2;

  const lonAt = curvilinear
    ? (y, x) => normaliseLongitude(lonValues[y * nx + x])
    : (y, x) => normaliseLongitude(lonValues[x]);
  const latAt = curvilinear ? (y, x) => latValues[y * nx + x] : (y) => latValues[y];

  const index = (t, d, c, y, x) =>
    (timeAxis >= 0 ? t * strides[timeAxis] : 0) +
    (depthAxis >= 0 ? d * strides[depthAxis] : 0) +
    (coeffAxis >= 0 ? c * strides[coeffAxis] : 0) +
    y * strides[yAxis] +
    x * strides[xAxis];

  let south = Infinity;
  let north = -Infinity;
  let west = Infinity;
  let east = -Infinity;
  for (let y = 0; y < ny; y++) {
    for (let x = 0; x < nx; x++) {
      const lat = latAt(y, x);
      const lon = lonAt(y, x);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
      south = Math.min(south, lat);
      north = Math.max(north, lat);
      west = Math.min(west, lon);
      east = Math.max(east, lon);
    }
  }

  const times = found.time
    ? parseTimes(readValues(reader, found.time), attributesOf(found.time).units)
    : [null];

  // SHOM tidal atlases use a fictive date: reference tide = 1950-01-01 12:00Z.
  const tidal = isTidalAtlasEpoch(times[0]);
  const offsets = times.map((t) => (tidal && t ? Math.round((t.getTime() - TIDAL_REFERENCE_MS) / 6e4) : null));

  const depths = found.depth ? Array.from(readValues(reader, found.depth)) : [];
  const coeffs = found.coeff ? Array.from(readValues(reader, found.coeff)) : [];

  return {
    info,
    ny,
    nx,
    timeCount,
    depthCount,
    coeffCount,
    times,
    offsets,
    tidal,
    reference: tidal ? readReference(reader, found.time) : null,
    depths,
    coeffs,
    bounds: [
      [south, west],
      [north, east],
    ],
    latAt,
    lonAt,
    // Returns [east, north] in m/s, or null for land / missing data.
    vectorAt(t, d, c, y, x) {
      const i = index(t, d, c, y, x);
      const eastward = u[i] * factor;
      const northward = v[i] * factor;
      return Number.isFinite(eastward) && Number.isFinite(northward) ? [eastward, northward] : null;
    },
  };
}
