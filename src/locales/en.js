// English texts. The other languages must have exactly the same keys and placeholders (see i18n.test.js).
export default {
  'app.language': 'Language',
  'about.title': 'About Tidal Stream Viewer',
  'about.close': 'Close',

  'header.subtitleEmpty': 'Tap an atlas area on the map',
  'header.areas': 'Show areas',
  'header.areasTitle': 'Show where each atlas applies, then tap one on the map',
  'header.atlasHere': 'Open atlas here',
  'header.atlasHereTitle': 'Opens the most detailed atlas for the centre of the map',
  'header.about': 'About',
  'header.support': '♥ Support',
  'header.fileContains': 'What the file contains:',

  'hint.useful': 'Useful on passage?',
  'hint.coffee': 'A coffee helps keep it running.',
  'hint.hide': 'Hide this hint',

  'sidebar.empty':
    'Tap an atlas area on the map to open it.',
  'sidebar.disclaimer':
    'Estimate from SHOM atlas data, blended by tide coefficient. Not suitable for navigation on its own. Use with official charts and nautical publications.',
  'sidebar.creditsCurrents': 'Currents: © Shom, Licence Ouverte 2.0',
  'sidebar.creditsFile': ' (file of {date})',
  'sidebar.creditsTides': 'Tides: api-maree.fr, CC BY.',
  'sidebar.aboutLegal': 'About and legal',
  'sidebar.supportProject': '♥ Support this project',

  'common.play': 'Play',
  'common.pause': 'Pause',
  'common.now': 'Now',

  'depth.label': 'Depth',
  'depth.level': 'Level {n}',

  'tidedata.title': 'Tide data',
  'tidedata.source': "Tide times and heights come from api-maree.fr through this site's server.",
  'tidedata.lookup': 'Use online lookup',
  'tidedata.offline': 'Offline: enter the reference tide by hand.',
  'tidedata.timeOf': 'Time of {name} ({zone})',
  'tidedata.coef': 'Tide coefficient',
  'tidedata.useManual': 'Use manual tide',

  'map.arrows': 'Arrows',
  'map.arrowsTitle': 'Up to {count} arrows',
  'arrows.overview': 'Overview',
  'arrows.standard': 'Standard',
  'arrows.fine': 'Fine',
  'map.speed': 'Speed ({unit})',
  'map.now': 'Now: {value} {unit}',
  'unit.kn': 'kn',
  'tooltip.set': 'Set',

  'layers.dark': 'Dark (OSM)',
  'layers.osm': 'OpenStreetMap',
  'layers.seamarks': 'OpenSeaMap seamarks',
  'layers.arrows': 'Current arrows',
  'layers.areas': 'Atlas areas',

  'picker.title': 'Several atlases cover this spot',
  'picker.hint': 'Tap one to open it. The finest grid is first.',
  'picker.finest': 'Finest',

  'timeline.goTo': 'Go to',
  'timeline.zone': 'Time zone',
  'timeline.back30': '30 minutes back',
  'timeline.forward30': '30 minutes forward',
  'timeline.aria': 'Time marker. Drag, scroll or use the arrow keys to move it.',
  'timeline.curveUnavailable': 'Tide curve unavailable.',
  'timeline.fallbackSite': 'the reference port',
  'timeline.note':
    'Heights above chart datum (ZH) at {site}. Amber dots: high water. Blue dots: low water. Times are shown in {zone}. Drag, scroll or use the arrow keys to move the marker. The timeline stops {days} days before and after today.',

  'busy.frames': 'Loading current data {done}/{total}',
  'busy.framesOne': 'Loading current data…',
  'busy.opening': 'Opening atlas…{percent}',

  'status.enterTime': 'Enter a complete date and time.',
  'status.limited': 'The timeline is limited to {days} days before and after today.',
  'status.enterReferenceTime': 'Enter the date and time of the reference tide.',
  'status.curveUnavailable': 'Tide curve unavailable. {message}',
  'status.noTimes': 'No tide times returned for that period.',
  'status.noReference': 'The file names no reference port. Use the manual tide under "Tide data".',
  'status.looking': 'Looking up tide times…',
  'status.tideFailed': 'Tide lookup failed: {message}',
  'status.manual': 'Using the manual tide. No tide curve offline.',

  'notice.noAtlas': 'No atlas covers the middle of the map. "Areas" shows where atlases exist.',
  'notice.alreadyOpen': '{label} is already open.',

  'error.raw': '{text}',
  'error.unsupported':
    'Unsupported file. The browser parser reads classic NetCDF-3 only. Convert it first: nccopy -k classic input.nc output.nc',

  'tideError.offline': 'Could not reach the tide service (offline?). Enter the tide time manually.',
  'tideError.unexpected': 'The tide service returned an unexpected answer. Is the server running?',
  'tideError.http': 'Tide API returned HTTP {status}.',
  'tideError.server': 'Tide API: {detail}',
  'tideError.noSite': 'No api-maree.fr site named "{port}".',

  'session.referenceTide': 'reference tide',
  'session.next': 'Next {type} {time} · {height} m',
  'session.coef': 'coef {value}',
  'session.coefUnknown': 'coef unknown, 70 assumed',
  'session.mix': ' → {percent} % of the way from neap to spring',
  'session.edge': ' · beyond ±6 h of this tide: showing the edge frame',
  'session.waiting': 'Waiting for tide times. Check "Tide data" in the sidebar.',
  'tide.hw': 'HW',
  'tide.lw': 'LW',
};
