// Deutsche Texte.
export default {
  'app.language': 'Sprache',
  'about.title': 'Über Tidal Stream Viewer',
  'about.close': 'Schließen',

  'header.subtitleEmpty': 'Atlasgebiet auf der Karte antippen',
  'header.areas': 'Gebiete zeigen',
  'header.areasTitle': 'Zeigt, wo welcher Atlas gilt – danach auf der Karte antippen',
  'header.atlasHere': 'Atlas hier öffnen',
  'header.atlasHereTitle': 'Öffnet den feinsten Atlas für die Kartenmitte',
  'header.about': 'Über',
  'header.support': '♥ Unterstützen',
  'header.fileContains': 'Inhalt der Datei:',

  'hint.useful': 'Nützlich auf Törn?',
  'hint.coffee': 'Ein Kaffee hilft, es am Laufen zu halten.',
  'hint.hide': 'Hinweis ausblenden',

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

  'picker.title': 'Mehrere Atlanten decken diese Stelle ab',
  'picker.hint': 'Zum Öffnen antippen. Das feinste Raster steht oben.',
  'picker.finest': 'Feinstes Raster',

  'timeline.goTo': 'Gehe zu',
  'timeline.format': 'Format {format}',
  'timeline.zone': 'Zeitzone',
  'timeline.back30': '30 Minuten zurück',
  'timeline.forward30': '30 Minuten vor',
  'timeline.aria': 'Zeitmarke. Zum Verschieben ziehen, scrollen oder die Pfeiltasten benutzen.',
  'timeline.curveUnavailable': 'Gezeitenkurve nicht verfügbar.',
  'timeline.fallbackSite': 'Referenzhafen',
  'timeline.note':
    'Höhen über Kartennull (KN) – {site}. Bernsteinfarbene Punkte: Hochwasser. Blaue Punkte: Niedrigwasser. Zeiten in {zone}. Zum Verschieben der Marke ziehen, scrollen oder die Pfeiltasten benutzen. Die Zeitleiste endet {days} Tage vor und nach heute.',
  'format.hint': 'TT/MM/JJJJ hh:mm',

  'busy.frames': 'Lade Strömungsdaten {done}/{total}',
  'busy.framesOne': 'Lade Strömungsdaten…',
  'busy.opening': 'Atlas wird geöffnet…{percent}',

  'status.enterTime': 'Zeit im Format {format} eingeben.',
  'status.limited': 'Die Zeitleiste ist auf {days} Tage vor und nach heute begrenzt.',
  'status.enterReferenceTime': 'Zeit der Referenzgezeit im Format {format} eingeben.',
  'status.curveUnavailable': 'Gezeitenkurve nicht verfügbar. {message}',
  'status.noTimes': 'Für diesen Zeitraum wurden keine Gezeitenzeiten geliefert.',
  'status.noReference': 'Die Datei nennt keinen Referenzhafen. Nutze die manuelle Eingabe unter „Gezeitendaten“.',
  'status.looking': 'Gezeitenzeiten werden abgefragt…',
  'status.tideFailed': 'Gezeitenabfrage fehlgeschlagen: {message}',
  'status.manual': 'Manuelle Eingabe wird verwendet. Offline keine Gezeitenkurve.',

  'notice.noAtlas': 'Kein Atlas deckt die Kartenmitte ab. „Gebiete“ zeigt, wo es Atlanten gibt.',
  'notice.alreadyOpen': '{label} ist bereits geöffnet.',

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
  'tide.hw': 'HW',
  'tide.lw': 'NW',
};
