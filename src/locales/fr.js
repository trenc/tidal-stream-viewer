// Textes français.
export default {
  'app.language': 'Langue',
  'about.title': 'À propos de SHOM Current Viewer',
  'about.close': 'Fermer',

  'header.subtitleEmpty': 'Choisissez un atlas ou ouvrez un fichier NetCDF local',
  'header.areas': 'Zones',
  'header.areasTitle': 'Afficher les zones de chaque atlas, puis toucher l’un d’eux sur la carte',
  'header.atlasHere': 'Atlas ici',
  'header.atlasHereTitle': "Ouvrir l'atlas le plus fin pour le centre de la carte",
  'header.openFile': 'Ouvrir un fichier local',
  'header.reading': 'Lecture…',
  'header.about': 'À propos',
  'header.support': '♥ Soutenir',
  'header.fileContains': 'Contenu du fichier :',

  'hint.useful': 'Utile en navigation ?',
  'hint.coffee': 'Un café aide à le faire vivre.',
  'hint.hide': 'Masquer ce message',

  'sidebar.empty':
    "Touchez une zone d'atlas sur la carte ou ouvrez un fichier NetCDF local du Shom avec les composantes est et nord du courant.",
  'sidebar.disclaimer':
    "Estimation à partir des atlas du Shom, pondérée par le coefficient de marée. Non destiné à la navigation autonome. À utiliser uniquement en complément des cartes et ouvrages nautiques officiels.",
  'sidebar.creditsCurrents': 'Courants : © Shom, Licence Ouverte 2.0',
  'sidebar.creditsFile': ' (fichier du {date})',
  'sidebar.creditsTides': 'Marées : api-maree.fr, CC BY.',
  'sidebar.aboutLegal': 'À propos et mentions légales',
  'sidebar.supportProject': '♥ Soutenir ce projet',

  'common.play': 'Lecture',
  'common.pause': 'Pause',
  'common.now': 'Maintenant',

  'depth.label': 'Profondeur',
  'depth.level': 'Niveau {n}',

  'tidedata.title': 'Données de marée',
  'tidedata.source': "Les heures et hauteurs de marée viennent d'api-maree.fr, via le serveur de ce site.",
  'tidedata.lookup': 'Utiliser la recherche en ligne',
  'tidedata.offline': 'Hors ligne : saisir la marée de référence à la main.',
  'tidedata.timeOf': 'Heure de {name} ({zone})',
  'tidedata.coef': 'Coefficient de marée',
  'tidedata.useManual': 'Utiliser la marée saisie',

  'map.arrows': 'Flèches',
  'map.arrowsTitle': "Jusqu'à {count} flèches",
  'arrows.overview': 'Aperçu',
  'arrows.standard': 'Standard',
  'arrows.fine': 'Fin',
  'map.speed': 'Vitesse ({unit})',
  'map.now': 'Maintenant : {value} {unit}',
  'unit.kn': 'nds',
  'tooltip.set': 'Direction',

  'layers.dark': 'Sombre (OSM)',
  'layers.osm': 'OpenStreetMap',
  'layers.seamarks': 'Balisage OpenSeaMap',
  'layers.arrows': 'Flèches de courant',
  'layers.areas': "Zones d'atlas",

  'picker.title': 'Plusieurs atlas couvrent ce lieu',
  'picker.hint': "Touchez-en un pour l'ouvrir. La grille la plus fine est en premier.",
  'picker.finest': 'Le plus fin',

  'timeline.goTo': 'Aller à',
  'timeline.format': 'Format {format}',
  'timeline.zone': 'Fuseau horaire',
  'timeline.back30': 'Reculer de 30 minutes',
  'timeline.forward30': 'Avancer de 30 minutes',
  'timeline.aria': 'Repère de temps. Faites glisser, défilez ou utilisez les flèches du clavier pour le déplacer.',
  'timeline.curveUnavailable': 'Courbe de marée indisponible.',
  'timeline.fallbackSite': 'port de référence',
  'timeline.note':
    "Hauteurs au-dessus du zéro hydrographique (ZH) – {site}. Points ambre : pleine mer. Points bleus : basse mer. Heures affichées en {zone}. Faites glisser, défilez ou utilisez les flèches du clavier pour déplacer le repère. La chronologie s'arrête {days} jours avant et après aujourd'hui.",
  'format.hint': 'jj/mm/aaaa hh:mm',

  'busy.frames': 'Chargement des courants {done}/{total}',
  'busy.framesOne': 'Chargement des courants…',
  'busy.opening': "Ouverture de l'atlas…{percent}",

  'status.enterTime': "Saisissez l'heure au format {format}.",
  'status.limited': "La chronologie est limitée à {days} jours avant et après aujourd'hui.",
  'status.enterReferenceTime': "Saisissez l'heure de la marée de référence au format {format}.",
  'status.curveUnavailable': 'Courbe de marée indisponible. {message}',
  'status.noTimes': 'Aucune heure de marée reçue pour cette période.',
  'status.noReference': 'Le fichier ne nomme aucun port de référence. Utilisez la marée saisie sous « Données de marée ».',
  'status.looking': 'Recherche des heures de marée…',
  'status.tideFailed': 'Échec de la recherche de marée : {message}',
  'status.manual': 'Marée saisie utilisée. Pas de courbe de marée hors ligne.',

  'notice.noAtlas': "Aucun atlas ne couvre le centre de la carte. « Zones » montre où se trouvent les atlas.",
  'notice.alreadyOpen': '{label} est déjà ouvert.',

  'error.raw': '{text}',
  'error.unsupported':
    "Fichier non pris en charge. L'analyseur du navigateur ne lit que le NetCDF-3 classique. Convertissez-le d'abord : nccopy -k classic input.nc output.nc",

  'tideError.offline': "Service de marée injoignable (hors ligne ?). Saisissez l'heure de marée à la main.",
  'tideError.unexpected': 'Le service de marée a renvoyé une réponse inattendue. Le serveur fonctionne-t-il ?',
  'tideError.http': "L'API de marée a renvoyé HTTP {status}.",
  'tideError.server': 'API de marée : {detail}',
  'tideError.noSite': 'Aucun site api-maree.fr nommé « {port} ».',

  'session.referenceTide': 'marée de référence',
  'session.next': 'Prochaine {type} {time} · {height} m',
  'session.coef': 'coef. {value}',
  'session.coefUnknown': 'coef. inconnu, 70 supposé',
  'session.mix': ' → à {percent} % du chemin de morte-eau vers vive-eau',
  'session.edge': " · au-delà de ±6 h de cette marée : image limite affichée",
  'session.waiting': 'En attente des heures de marée. Voir « Données de marée » dans le panneau.',
  'tide.hw': 'PM',
  'tide.lw': 'BM',
};
