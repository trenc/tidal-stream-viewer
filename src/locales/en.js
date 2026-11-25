// English texts. The other languages must have exactly the same keys and placeholders (see i18n.test.js).
export default {
  'app.language': 'Language',
  'about.title': 'About Tidal Stream Viewer',
  'about.close': 'Close',

  // The About dialog. Fragments with links are HTML rendered with x-html; the
  // release line interpolates the loaded atlas (see index.html).
  'about.built.title': 'Built by',
  'about.built.intro':
    'This viewer was built by <strong>Tommy Schmucker</strong> <a href="https://tommyschmucker.de/" class="text-cyan-300 underline hover:text-cyan-200" target="_blank" rel="noopener noreferrer">tommyschmucker.de</a>.<br /> He is sailing on <strong>SV Tiamat</strong> <a href="https://sailingpathways.com/" class="text-cyan-300 underline hover:text-cyan-200" target="_blank" rel="noopener noreferrer">sailingpathways.com</a>.',
  'about.built.contact':
    'Contact: <a href="mailto:current-viewer@tommyschmucker.de" class="text-cyan-300 underline hover:text-cyan-200" target="_blank" rel="noopener noreferrer">current-viewer@tommyschmucker.de</a>',
  'about.built.what':
    'It draws the tidal stream atlases published by Shom as arrows on a map and times them against the tide of the reference port.',
  'about.support.title': 'Support this project',
  'about.support.pitch':
    'This viewer is free and has no ads. If it helped you on the water, a small tip towards its development and hosting is very welcome.',
  'about.support.link': '♥ Support on Ko-fi',
  'about.support.note':
    'Tips go to the author and support the viewer itself. They are not payments for the Shom or api-maree.fr data.',
  'about.data.title': 'Data sources and credits',
  'about.data.currents':
    '<strong>Tidal currents:</strong> © Shom (Service hydrographique et océanographique de la Marine), « Atlas de courants de marée 2D au format netcdf », published under the <a href="https://www.data.gouv.fr/pages/legal/licences/etalab-2.0" class="text-cyan-300 underline hover:text-cyan-200" target="_blank" rel="noopener noreferrer">Licence Ouverte 2.0</a> (Etalab). Original data: <a href="https://www.data.gouv.fr/organizations/shom/datasets" class="text-cyan-300 underline hover:text-cyan-200" target="_blank" rel="noopener noreferrer">Shom on data.gouv.fr</a>, <a href="https://dx.doi.org/10.17183/ATLASCOURANTS2D_NETCDF" class="text-cyan-300 underline hover:text-cyan-200" target="_blank" rel="noopener noreferrer">DOI 10.17183/ATLASCOURANTS2D_NETCDF</a>, <a href="https://services.data.shom.fr/static/specifications/Descriptif_contenu_produit_Atlas_courant2D_netcdf.pdf" class="text-cyan-300 underline hover:text-cyan-200" target="_blank" rel="noopener noreferrer">product description</a>.',
  'about.data.release': 'Loaded atlas: {file}, file released on {release} (dd/mm/yyyy).',
  'about.data.noRelease': 'Open an atlas to see the release date of its file here.',
  'about.data.tides':
    '<strong>Tide times and heights:</strong> Données de marée fournies par <a href="https://api-maree.fr/" class="text-cyan-300 underline hover:text-cyan-200" target="_blank" rel="noopener noreferrer">api-maree.fr</a> sous licence <a href="https://creativecommons.org/licenses/by/4.0/deed.fr" class="text-cyan-300 underline hover:text-cyan-200" target="_blank" rel="noopener noreferrer">CC BY</a>, calculées à partir de composantes harmoniques <a href="https://sextant.ifremer.fr/geonetwork/srv/api/records/1bc4a49d-d4cd-469e-827c-bd3bd0eeabba/formatters/xsl-view" class="text-cyan-300 underline hover:text-cyan-200" target="_blank" rel="noopener noreferrer">Ifremer / PREVIMER</a>, elles-mêmes sous licence CC BY. See the <a href="https://api-maree.fr/cgu" class="text-cyan-300 underline hover:text-cyan-200" target="_blank" rel="noopener noreferrer">terms of use of api-maree.fr</a>.',
  'about.data.map':
    '<strong>Map:</strong> © <a href="https://www.openstreetmap.org/copyright" class="text-cyan-300 underline hover:text-cyan-200" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors; seamarks © <a href="https://www.openseamap.org/" class="text-cyan-300 underline hover:text-cyan-200" target="_blank" rel="noopener noreferrer">OpenSeaMap</a> contributors.',
  'about.changes.title': 'Changes made to the data',
  'about.changes.conversion':
    'The atlas files are converted into a compact binary format for fast loading. Between the two published cases (tide coefficients 45 and 95) the arrows are interpolated linearly to the coefficient of the tide. Outside 45 to 95 the values are extrapolated (coefficients are limited to 20 to 120), which is less reliable. The time axis is aligned to the high or low water of the reference port, taken from api-maree.fr.',
  'about.changes.disclaimer':
    'The speeds and directions shown are therefore derived estimates, not the values published by Shom. Shom is not responsible for any modification made to the data it distributes. This application is independent and is not endorsed by Shom, Ifremer or api-maree.fr.',
  'about.notices.title': 'Important notices',
  'about.notices.navigation':
    '<strong>Not for navigation on its own.</strong> Shom states that this product is to be used only in addition to the official charts and nautical publications. Always use this viewer together with them.',
  'about.notices.typical':
    'The atlases describe surface currents in typical tidal conditions (mean neap and mean spring tide). Actual currents can differ, for example with wind, weather or river discharge.',
  'about.notices.indication':
    'Tide times and heights are calculated from harmonic components and are given as an indication. The service may be interrupted. The use and interpretation of the data are the responsibility of the user.',
  'about.notices.asIs':
    'This application is provided as is, without warranty of any kind. The author accepts no liability for decisions taken on the basis of what it shows.',
  'about.notices.translation':
    'The French and German versions are translations for convenience. If they differ, the English text prevails.',
  'about.privacy.title': 'Privacy',
  'about.privacy.storage':
    'Your settings (language, arrow detail, time zone), the number of days on which you used the app (only to show a single support hint) and cached tide data are stored in your browser. The app works offline with the atlas data and map tiles it has already loaded.',
  'about.privacy.requests':
    "Tide requests go to this site's server, which forwards them to api-maree.fr and keeps the answers for up to a week. To enforce usage limits, the server keeps a scrambled (hashed) form of your IP address for a few hours. It is not used for anything else. This app uses no cookies. It counts visits with Plausible Analytics, a cookie-free service that processes data in the EU. Your browser talks only to this site's server, which forwards the page address, the referrer and your browser details to Plausible together with your IP address. Plausible uses them to count unique visitors, their approximate location and device type; it does not store your IP address and uses no persistent identifier. The web server may log requests as usual.",
  'about.privacy.tiles':
    'Map tiles are loaded directly from the OpenStreetMap and OpenSeaMap servers, which therefore see your IP address.',
  'about.privacy.kofi':
    'The support link opens ko-fi.com in a new tab. Nothing is sent to Ko-fi from this app before you click it, and Ko-fi has its own privacy policy.',

  'header.subtitleEmpty': 'Tap an atlas area on the map',
  'header.areas': 'Show areas',
  'header.areasTitle': 'Show where each atlas applies, then tap one on the map',
  'header.about': 'About',
  'header.support': '♥ Support',
  'header.fileContains': 'What the file contains:',

  'hint.useful': 'Useful on passage?',
  'hint.coffee': 'A coffee helps keep it running.',
  'hint.hide': 'Hide this hint',

  'update.available': 'A new version is ready.',
  'update.reload': 'Reload',
  'update.dismiss': 'Hide this notice',

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
  'layers.legend': 'Speed legend',

  'picker.title': 'Several atlases cover this spot',
  'picker.hint': 'Tap one to open it. The finest grid is first.',
  'picker.finest': 'Finest',

  'point.max': 'Max in 12 h: {value} {unit}',
  'point.outside': 'This point is outside the atlas grid.',
  'point.land': 'No current data here: the grid shows land.',
  'point.error': 'The current data could not be loaded.',
  'point.progress': 'Curve: {done}/{total}',
  'point.noTide': 'No tide data yet. The curve waits for tide times.',
  'point.curveCaption': 'Speed, next 12 h',

  'timeline.goTo': 'Go to',
  'timeline.zone': 'Time zone',
  'timeline.back': '{minutes} minutes back',
  'timeline.forward': '{minutes} minutes forward',
  'timeline.prevHw': 'Previous high water',
  'timeline.nextHw': 'Next high water',
  'timeline.prevLw': 'Previous low water',
  'timeline.nextLw': 'Next low water',
  'timeline.aria': 'Time marker. Drag, scroll or use the arrow keys to move it.',
  'timeline.curveUnavailable': 'Tide curve unavailable.',
  'timeline.fallbackSite': 'the reference port',
  'timeline.marker': '{type} {time} · {height} m',
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

  'quality.extrapolated': 'Speed is extrapolated',
  'quality.extrapolatedHint': 'The tide coefficient lies outside the two published atlas cases, so the arrows are extrapolated beyond them.',
  'quality.assumed': 'Speed is estimated',
  'quality.assumedHint': 'This tide has no published coefficient, so 70 is assumed and the arrows are an estimate.',

  'notice.noAtlas': 'No atlas covers the middle of the map. "Areas" shows where atlases exist.',
  'notice.alreadyOpen': '{label} is already open.',
  'notice.atlasListFailed': 'The list of atlases could not be loaded. Check your connection and reload the page.',

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
  'session.noTimeAxis': 'No time axis',
  'tide.hw': 'HW',
  'tide.lw': 'LW',
};
