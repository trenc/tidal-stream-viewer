// Deutsche Texte.
export default {
  'app.language': 'Sprache',
  'about.title': 'Über Tidal Stream Viewer',
  'about.close': 'Schließen',

  // Der Info-Dialog. Fragmente mit Links sind HTML, gerendert über x-html;
  // die Release-Zeile interpoliert den geladenen Atlas (siehe index.html).
  'about.built.title': 'Entwickelt von',
  'about.built.intro':
    'Dieser Viewer wurde entwickelt von <strong>Tommy Schmucker</strong> <a href="https://tommyschmucker.de/" class="text-cyan-300 underline hover:text-cyan-200" target="_blank" rel="noopener noreferrer">tommyschmucker.de</a>.<br /> Er segelt auf der <strong>SV Tiamat</strong> <a href="https://sailingpathways.com/" class="text-cyan-300 underline hover:text-cyan-200" target="_blank" rel="noopener noreferrer">sailingpathways.com</a>.',
  'about.built.contact':
    'Kontakt: <a href="mailto:current-viewer@tommyschmucker.de" class="text-cyan-300 underline hover:text-cyan-200" target="_blank" rel="noopener noreferrer">current-viewer@tommyschmucker.de</a>',
  'about.built.what':
    'Er zeigt die vom Shom veröffentlichten Gezeitenstromatlanten als Pfeile auf einer Karte und richtet sie an den Gezeiten des Referenzhafens aus.',
  'about.support.title': 'Projekt unterstützen',
  'about.support.pitch':
    'Dieser Viewer ist kostenlos und werbefrei. Wenn er dir auf dem Wasser geholfen hat, freut sich der Entwickler über ein kleines Trinkgeld für Entwicklung und Hosting.',
  'about.support.link': '♥ Auf Ko-fi unterstützen',
  'about.support.note':
    'Das Geld geht an den Autor und unterstützt den Viewer selbst. Es ist keine Bezahlung für die Daten von Shom oder api-maree.fr.',
  'about.data.title': 'Datenquellen und Nachweise',
  'about.data.currents':
    '<strong>Gezeitenströmungen:</strong> © Shom (Service hydrographique et océanographique de la Marine), « Atlas de courants de marée 2D au format netcdf », veröffentlicht unter der <a href="https://www.data.gouv.fr/pages/legal/licences/etalab-2.0" class="text-cyan-300 underline hover:text-cyan-200" target="_blank" rel="noopener noreferrer">Licence Ouverte 2.0</a> (Etalab). Originaldaten: <a href="https://www.data.gouv.fr/organizations/shom/datasets" class="text-cyan-300 underline hover:text-cyan-200" target="_blank" rel="noopener noreferrer">Shom auf data.gouv.fr</a>, <a href="https://dx.doi.org/10.17183/ATLASCOURANTS2D_NETCDF" class="text-cyan-300 underline hover:text-cyan-200" target="_blank" rel="noopener noreferrer">DOI 10.17183/ATLASCOURANTS2D_NETCDF</a>, <a href="https://services.data.shom.fr/static/specifications/Descriptif_contenu_produit_Atlas_courant2D_netcdf.pdf" class="text-cyan-300 underline hover:text-cyan-200" target="_blank" rel="noopener noreferrer">Produktbeschreibung</a>.',
  'about.data.release': 'Geladener Atlas: {file}, Datei vom {release} (TT/MM/JJJJ).',
  'about.data.noRelease': 'Öffne einen Atlas, um hier das Veröffentlichungsdatum seiner Datei zu sehen.',
  'about.data.tides':
    '<strong>Gezeiten (Zeiten und Höhen):</strong> Données de marée fournies par <a href="https://api-maree.fr/" class="text-cyan-300 underline hover:text-cyan-200" target="_blank" rel="noopener noreferrer">api-maree.fr</a> sous licence <a href="https://creativecommons.org/licenses/by/4.0/deed.fr" class="text-cyan-300 underline hover:text-cyan-200" target="_blank" rel="noopener noreferrer">CC BY</a>, calculées à partir de composantes harmoniques <a href="https://sextant.ifremer.fr/geonetwork/srv/api/records/1bc4a49d-d4cd-469e-827c-bd3bd0eeabba/formatters/xsl-view" class="text-cyan-300 underline hover:text-cyan-200" target="_blank" rel="noopener noreferrer">Ifremer / PREVIMER</a>, elles-mêmes sous licence CC BY. Siehe die <a href="https://api-maree.fr/cgu" class="text-cyan-300 underline hover:text-cyan-200" target="_blank" rel="noopener noreferrer">Nutzungsbedingungen von api-maree.fr</a>.',
  'about.data.map':
    '<strong>Karte:</strong> © <a href="https://www.openstreetmap.org/copyright" class="text-cyan-300 underline hover:text-cyan-200" target="_blank" rel="noopener noreferrer">OpenStreetMap</a>-Mitwirkende; Seezeichen © <a href="https://www.openseamap.org/" class="text-cyan-300 underline hover:text-cyan-200" target="_blank" rel="noopener noreferrer">OpenSeaMap</a>-Mitwirkende.',
  'about.changes.title': 'Änderungen an den Daten',
  'about.changes.conversion':
    'Die Atlasdateien werden für schnelles Laden in ein kompaktes Binärformat umgewandelt. Zwischen den beiden veröffentlichten Fällen (Gezeitenkoeffizienten 45 und 95) werden die Pfeile linear auf den Koeffizienten der Gezeit interpoliert. Außerhalb von 45 bis 95 wird extrapoliert (Koeffizienten auf 20 bis 120 begrenzt), was weniger zuverlässig ist. Die Zeitachse richtet sich nach dem Hoch- oder Niedrigwasser des Referenzhafens, das von api-maree.fr stammt.',
  'about.changes.disclaimer':
    'Die angezeigten Geschwindigkeiten und Richtungen sind daher abgeleitete Schätzungen und nicht die vom Shom veröffentlichten Werte. Das Shom ist nicht verantwortlich für Änderungen an den von ihm verbreiteten Daten. Diese Anwendung ist unabhängig und wird weder vom Shom noch von Ifremer oder api-maree.fr unterstützt.',
  'about.notices.title': 'Wichtige Hinweise',
  'about.notices.navigation':
    '<strong>Nicht zur alleinigen Navigation geeignet.</strong> Das Shom gibt an, dass dieses Produkt nur ergänzend zu den amtlichen Seekarten und nautischen Veröffentlichungen zu verwenden ist. Nutze diesen Viewer immer zusammen mit ihnen.',
  'about.notices.typical':
    'Die Atlanten beschreiben Oberflächenströmungen unter typischen Gezeitenbedingungen (mittlere Nipptide und mittlere Springtide). Die tatsächlichen Strömungen können abweichen, etwa durch Wind, Wetter oder Flusswasser.',
  'about.notices.indication':
    'Gezeitenzeiten und -höhen werden aus harmonischen Komponenten berechnet und sind Richtwerte. Der Dienst kann unterbrochen sein. Nutzung und Auslegung der Daten liegen in der Verantwortung des Nutzers.',
  'about.notices.asIs':
    'Diese Anwendung wird ohne jede Gewährleistung „wie besehen“ bereitgestellt. Der Autor haftet nicht für Entscheidungen, die auf Grundlage ihrer Anzeigen getroffen werden.',
  'about.notices.translation':
    'Die französische und die deutsche Fassung sind Übersetzungen zur Erleichterung. Bei Abweichungen gilt der englische Text.',
  'about.privacy.title': 'Datenschutz',
  'about.privacy.storage':
    'Deine Einstellungen (Sprache, Pfeildetail, Zeitzone), die Zahl der Tage, an denen du die App benutzt hast (nur, um einen einzigen Unterstützungshinweis zu zeigen), und zwischengespeicherte Gezeitendaten werden in deinem Browser gespeichert. Die App funktioniert offline mit den bereits geladenen Atlasdaten und Kartenkacheln.',
  'about.privacy.requests':
    'Gezeitenanfragen gehen an den Server dieser Seite, der sie an api-maree.fr weiterleitet und die Antworten bis zu einer Woche behält. Zur Durchsetzung von Nutzungsgrenzen speichert der Server einige Stunden lang eine unkenntlich gemachte (gehashte) Form deiner IP-Adresse. Sie wird für nichts anderes verwendet. Diese App verwendet keine Cookies. Besuche werden mit Plausible Analytics gezählt, einem cookiefreien Dienst, der Daten in der EU verarbeitet. Dein Browser spricht nur mit dem Server dieser Seite; dieser leitet die Seitenadresse, die Herkunftsseite und Browserangaben zusammen mit deiner IP-Adresse an Plausible weiter. Plausible zählt damit eindeutige Besucher, ungefähren Standort und Gerätetyp; die IP-Adresse wird nicht gespeichert, und es gibt keine dauerhafte Kennung. Der Webserver kann Anfragen wie üblich protokollieren.',
  'about.privacy.tiles':
    'Kartenkacheln werden direkt von den Servern von OpenStreetMap und OpenSeaMap geladen, die daher deine IP-Adresse sehen.',
  'about.privacy.kofi':
    'Der Unterstützungslink öffnet ko-fi.com in einem neuen Tab. Aus dieser App wird nichts an Ko-fi gesendet, bevor du klickst; Ko-fi hat eine eigene Datenschutzerklärung.',

  'header.subtitleEmpty': 'Atlasgebiet auf der Karte antippen',
  'header.areas': 'Gebiete zeigen',
  'header.areasTitle': 'Zeigt, wo welcher Atlas gilt – danach auf der Karte antippen',
  'header.about': 'Über',
  'header.support': '♥ Unterstützen',
  'header.fileContains': 'Inhalt der Datei:',

  'hint.useful': 'Nützlich auf Törn?',
  'hint.coffee': 'Ein Kaffee hilft, es am Laufen zu halten.',
  'hint.hide': 'Hinweis ausblenden',

  'update.available': 'Eine neue Version ist bereit.',
  'update.reload': 'Neu laden',
  'update.dismiss': 'Hinweis ausblenden',

  'sidebar.empty':
    'Tippe auf der Karte auf ein Atlasgebiet, um es zu öffnen.',
  'sidebar.disclaimer':
    'Schätzung aus den Shom-Atlanten, nach Gezeitenkoeffizient gewichtet. Nicht zur alleinigen Navigation geeignet. Nur zusammen mit amtlichen Seekarten und nautischen Veröffentlichungen verwenden.',
  'sidebar.creditsCurrents': 'Strömungen: © Shom, Licence Ouverte 2.0',
  'sidebar.creditsFile': ' (Datei vom {date})',
  'sidebar.creditsTides': 'Gezeiten: api-maree.fr, CC BY.',
  'sidebar.aboutLegal': 'Info und rechtliche Hinweise',
  'sidebar.supportProject': '♥ Projekt unterstützen',

  'common.play': 'Start',
  'common.pause': 'Pause',
  'common.now': 'Jetzt',

  'depth.label': 'Tiefe',
  'depth.level': 'Ebene {n}',

  'tidedata.title': 'Gezeitendaten',
  'tidedata.source': 'Die Gezeitendaten stammen von api-maree.fr, über den Server dieser Seite.',
  'tidedata.lookup': 'Online-Abfrage verwenden',
  'tidedata.offline': 'Offline: Referenzgezeit von Hand eingeben.',
  'tidedata.timeOf': 'Zeit von {name} ({zone})',
  'tidedata.coef': 'Gezeitenkoeffizient',
  'tidedata.useManual': 'Manuelle Eingabe verwenden',

  'map.arrows': 'Pfeile',
  'map.arrowsTitle': 'Bis zu {count} Pfeile',
  'arrows.overview': 'Übersicht',
  'arrows.standard': 'Standard',
  'arrows.fine': 'Detailliert',
  'map.speed': 'Geschwindigkeit ({unit})',
  'map.now': 'Jetzt: {value} {unit}',
  'unit.kn': 'kn',
  'tooltip.set': 'Richtung',

  'layers.dark': 'Dunkel (OSM)',
  'layers.osm': 'OpenStreetMap',
  'layers.seamarks': 'OpenSeaMap-Seezeichen',
  'layers.arrows': 'Strompfeile',
  'layers.areas': 'Atlasgebiete',
  'layers.legend': 'Legende (Geschwindigkeit)',

  'picker.title': 'Mehrere Atlanten decken diese Stelle ab',
  'picker.hint': 'Zum Öffnen antippen. Das feinste Raster steht oben.',
  'picker.finest': 'Feinstes Raster',

  'point.max': 'Max in 12 h: {value} {unit}',
  'point.outside': 'Dieser Punkt liegt außerhalb des Atlasrasters.',
  'point.land': 'Hier keine Strömungsdaten: Land im Raster.',
  'point.error': 'Die Strömungsdaten konnten nicht geladen werden.',
  'point.progress': 'Kurve: {done}/{total}',
  'point.noTide': 'Noch keine Gezeitendaten. Die Kurve wartet auf Gezeitenzeiten.',
  'point.curveCaption': 'Geschwindigkeit, nächste 12 h',

  'timeline.goTo': 'Gehe zu',
  'timeline.zone': 'Zeitzone',
  'timeline.back': '{minutes} Minuten zurück',
  'timeline.forward': '{minutes} Minuten vor',
  'timeline.prevHw': 'Voriges Hochwasser',
  'timeline.nextHw': 'Nächstes Hochwasser',
  'timeline.prevLw': 'Voriges Niedrigwasser',
  'timeline.nextLw': 'Nächstes Niedrigwasser',
  'timeline.aria': 'Zeitmarke. Zum Verschieben ziehen, scrollen oder die Pfeiltasten benutzen.',
  'timeline.curveUnavailable': 'Gezeitenkurve nicht verfügbar.',
  'timeline.fallbackSite': 'Referenzhafen',
  'timeline.marker': '{type} {time} · {height} m',
  'timeline.note':
    'Höhen über Kartennull (KN) – {site}. Bernsteinfarbene Punkte: Hochwasser. Blaue Punkte: Niedrigwasser. Zeiten in {zone}. Zum Verschieben der Marke ziehen, scrollen oder die Pfeiltasten benutzen. Die Zeitleiste endet {days} Tage vor und nach heute.',

  'busy.frames': 'Lade Strömungsdaten {done}/{total}',
  'busy.framesOne': 'Lade Strömungsdaten…',
  'busy.opening': 'Atlas wird geöffnet…{percent}',

  'status.enterTime': 'Gib ein vollständiges Datum mit Uhrzeit ein.',
  'status.limited': 'Die Zeitleiste ist auf {days} Tage vor und nach heute begrenzt.',
  'status.enterReferenceTime': 'Gib Datum und Uhrzeit der Referenzgezeit ein.',
  'status.curveUnavailable': 'Gezeitenkurve nicht verfügbar. {message}',
  'status.noTimes': 'Für diesen Zeitraum wurden keine Gezeitenzeiten geliefert.',
  'status.noReference': 'Die Datei nennt keinen Referenzhafen. Nutze die manuelle Eingabe unter „Gezeitendaten“.',
  'status.looking': 'Gezeitenzeiten werden abgefragt…',
  'status.tideFailed': 'Gezeitenabfrage fehlgeschlagen: {message}',
  'status.manual': 'Manuelle Eingabe wird verwendet. Offline keine Gezeitenkurve.',

  'quality.extrapolated': 'Geschwindigkeit extrapoliert',
  'quality.extrapolatedHint': 'Der Gezeitenkoeffizient liegt außerhalb der beiden veröffentlichten Atlasfälle, die Pfeile werden darüber hinaus extrapoliert.',
  'quality.assumed': 'Geschwindigkeit geschätzt',
  'quality.assumedHint': 'Diese Tide hat keinen veröffentlichten Koeffizienten, 70 wird angenommen und die Pfeile sind eine Schätzung.',

  'notice.noAtlas': 'Kein Atlas deckt die Kartenmitte ab. „Gebiete“ zeigt, wo es Atlanten gibt.',
  'notice.alreadyOpen': '{label} ist bereits geöffnet.',

  'atlasList.failed': 'Die Liste der Atlanten konnte nicht geladen werden.',
  'atlasList.retry': 'Erneut versuchen',

  'error.raw': '{text}',
  'error.unsupported':
    'Nicht unterstützte Datei. Der Browser liest nur klassisches NetCDF-3. Zuerst konvertieren: nccopy -k classic input.nc output.nc',

  'tideError.offline': 'Gezeitendienst nicht erreichbar (offline?). Gezeitenzeit von Hand eingeben.',
  'tideError.unexpected': 'Der Gezeitendienst hat eine unerwartete Antwort geliefert. Läuft der Server?',
  'tideError.http': 'Die Gezeiten-API lieferte HTTP {status}.',
  'tideError.server': 'Gezeiten-API: {detail}',
  'tideError.noSite': 'Kein api-maree.fr-Standort namens „{port}“.',

  'session.referenceTide': 'Referenzgezeit',
  'session.next': 'Nächstes {type} {time} · {height} m',
  'session.coef': 'Koeff. {value}',
  'session.coefUnknown': 'Koeff. unbekannt, 70 angenommen',
  'session.mix': ' → {percent} % des Weges von Nipp- zu Springtide',
  'session.edge': ' · mehr als ±6 h von dieser Tide entfernt: letztes verfügbares Bild wird gezeigt',
  'session.waiting': 'Warte auf Gezeitenzeiten. Siehe „Gezeitendaten“ in der Seitenleiste.',
  'session.noTimeAxis': 'Keine Zeitachse',
  'tide.hw': 'HW',
  'tide.lw': 'NW',
};
