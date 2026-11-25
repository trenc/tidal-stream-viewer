// Textes français.
export default {
  'app.language': 'Langue',
  'about.title': 'À propos de Tidal Stream Viewer',
  'about.close': 'Fermer',

  // Le dialogue À propos. Les fragments avec liens sont du HTML rendu par x-html ;
  // la ligne de version interpole l’atlas chargé (voir index.html).
  'about.built.title': 'Créé par',
  'about.built.intro':
    'Ce visualiseur a été créé par <strong>Tommy Schmucker</strong> <a href="https://tommyschmucker.de/" class="text-cyan-300 underline hover:text-cyan-200" target="_blank" rel="noopener noreferrer">tommyschmucker.de</a>.<br /> Il navigue sur <strong>SV Tiamat</strong> <a href="https://sailingpathways.com/" class="text-cyan-300 underline hover:text-cyan-200" target="_blank" rel="noopener noreferrer">sailingpathways.com</a>.',
  'about.built.contact':
    'Contact : <a href="mailto:current-viewer@tommyschmucker.de" class="text-cyan-300 underline hover:text-cyan-200" target="_blank" rel="noopener noreferrer">current-viewer@tommyschmucker.de</a>',
  'about.built.what':
    'Il affiche les atlas de courants de marée publiés par le Shom sous forme de flèches sur une carte et les cale sur la marée du port de référence.',
  'about.support.title': 'Soutenir ce projet',
  'about.support.pitch':
    "Ce visualiseur est gratuit et sans publicité. S'il vous a aidé sur l'eau, un petit pourboire pour son développement et son hébergement est le bienvenu.",
  'about.support.link': '♥ Soutenir sur Ko-fi',
  'about.support.note':
    "Les dons vont à l'auteur et soutiennent le visualiseur lui-même. Ils ne rémunèrent ni les données du Shom ni celles d'api-maree.fr.",
  'about.data.title': 'Sources des données et crédits',
  'about.data.currents':
    `<strong>Courants de marée :</strong> © Shom (Service hydrographique et océanographique de la Marine), « Atlas de courants de marée 2D au format netcdf », publié sous <a href="https://www.data.gouv.fr/pages/legal/licences/etalab-2.0" class="text-cyan-300 underline hover:text-cyan-200" target="_blank" rel="noopener noreferrer">Licence Ouverte 2.0</a> (Etalab). Données d'origine : <a href="https://www.data.gouv.fr/organizations/shom/datasets" class="text-cyan-300 underline hover:text-cyan-200" target="_blank" rel="noopener noreferrer">Shom sur data.gouv.fr</a>, <a href="https://dx.doi.org/10.17183/ATLASCOURANTS2D_NETCDF" class="text-cyan-300 underline hover:text-cyan-200" target="_blank" rel="noopener noreferrer">DOI 10.17183/ATLASCOURANTS2D_NETCDF</a>, <a href="https://services.data.shom.fr/static/specifications/Descriptif_contenu_produit_Atlas_courant2D_netcdf.pdf" class="text-cyan-300 underline hover:text-cyan-200" target="_blank" rel="noopener noreferrer">description du produit</a>.`,
  'about.data.release': 'Atlas chargé : {file}, fichier publié le {release} (jj/mm/aaaa).',
  'about.data.noRelease': 'Ouvrez un atlas pour voir ici la date de publication de son fichier.',
  'about.data.tides':
    `<strong>Heures et hauteurs de marée :</strong> Données de marée fournies par <a href="https://api-maree.fr/" class="text-cyan-300 underline hover:text-cyan-200" target="_blank" rel="noopener noreferrer">api-maree.fr</a> sous licence <a href="https://creativecommons.org/licenses/by/4.0/deed.fr" class="text-cyan-300 underline hover:text-cyan-200" target="_blank" rel="noopener noreferrer">CC BY</a>, calculées à partir de composantes harmoniques <a href="https://sextant.ifremer.fr/geonetwork/srv/api/records/1bc4a49d-d4cd-469e-827c-bd3bd0eeabba/formatters/xsl-view" class="text-cyan-300 underline hover:text-cyan-200" target="_blank" rel="noopener noreferrer">Ifremer / PREVIMER</a>, elles-mêmes sous licence CC BY. Voir les <a href="https://api-maree.fr/cgu" class="text-cyan-300 underline hover:text-cyan-200" target="_blank" rel="noopener noreferrer">conditions d'utilisation d'api-maree.fr</a>.`,
  'about.data.map':
    '<strong>Carte :</strong> © contributeurs <a href="https://www.openstreetmap.org/copyright" class="text-cyan-300 underline hover:text-cyan-200" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> ; balisage © contributeurs <a href="https://www.openseamap.org/" class="text-cyan-300 underline hover:text-cyan-200" target="_blank" rel="noopener noreferrer">OpenSeaMap</a>.',
  'about.changes.title': 'Modifications apportées aux données',
  'about.changes.conversion':
    "Les fichiers d'atlas sont convertis dans un format binaire compact pour un chargement rapide. Entre les deux cas publiés (coefficients de marée 45 et 95), les flèches sont interpolées linéairement selon le coefficient de la marée. En dehors de 45 à 95, les valeurs sont extrapolées (coefficients limités à 20–120), ce qui est moins fiable. L'axe du temps est calé sur la pleine mer ou la basse mer du port de référence, fournie par api-maree.fr.",
  'about.changes.disclaimer':
    "Les vitesses et directions affichées sont donc des estimations dérivées, et non les valeurs publiées par le Shom. Le Shom n'est pas responsable des modifications apportées aux données qu'il diffuse. Cette application est indépendante et n'est cautionnée ni par le Shom, ni par l'Ifremer, ni par api-maree.fr.",
  'about.notices.title': 'Avertissements importants',
  'about.notices.navigation':
    '<strong>Ne suffit pas pour naviguer.</strong> Le Shom indique que ce produit doit être utilisé uniquement en complément des cartes et ouvrages nautiques officiels. Utilisez toujours ce visualiseur avec eux.',
  'about.notices.typical':
    "Les atlas décrivent les courants de surface dans des conditions de marée typiques (morte-eau moyenne et vive-eau moyenne). Les courants réels peuvent différer, par exemple sous l'effet du vent, de la météo ou des débits fluviaux.",
  'about.notices.indication':
    "Les heures et hauteurs de marée sont calculées à partir de composantes harmoniques et données à titre indicatif. Le service peut être interrompu. L'utilisation et l'interprétation des données relèvent de la responsabilité de l'utilisateur.",
  'about.notices.asIs':
    "Cette application est fournie en l'état, sans garantie d'aucune sorte. L'auteur décline toute responsabilité pour les décisions prises sur la base de ce qu'elle affiche.",
  'about.notices.translation':
    'Les versions française et allemande sont des traductions fournies pour plus de commodité. En cas de divergence, le texte anglais fait foi.',

  // The offline-atlases section of the About dialog.
  'about.offline.title': 'Atlas hors ligne',
  'about.offline.intro':
    'Téléchargez un atlas ici : il fonctionne sans connexion, flèches et requêtes de point comprises. La carte de fond nécessite une connexion, sauf si ses tuiles ont déjà été affichées ; la courbe de marée peut être saisie à la main dans « Données de marée ».',
  'about.offline.loading': 'Lecture des détails des atlas…',
  'about.offline.storage': 'Stockage du navigateur : {used} sur {quota} utilisés.',
  'about.offline.stateNone': 'Non téléchargé',
  'about.offline.statePartial': '{done} images sur {total}',
  'about.offline.stateComplete': 'Téléchargé',
  'about.offline.download': 'Télécharger',
  'about.offline.finish': 'Terminer le téléchargement',
  'about.offline.confirm': 'Télécharger {size} ?',
  'about.offline.confirmMetered': 'Télécharger {size} sur une connexion limitée ?',
  'about.offline.cancel': 'Annuler',
  'about.offline.remove': 'Supprimer',
  'about.offline.quota':
    '{size} dépasse l\u2019espace libre indiqué par le navigateur ({free}). Le téléchargement peut s\u2019arrêter en route.',
  'about.offline.failed':
    '{count} images n\u2019ont pas pu être téléchargées. L\u2019atlas n\u2019est que partiellement hors ligne ; réessayez avec une connexion.',
  'about.offline.installHint':
    'Astuce : installez cette application sur l\u2019écran d\u2019accueil. Les navigateurs peuvent effacer les données d\u2019un site inutilisé pendant une semaine ; les applications installées en sont exemptées.',
  'about.offline.installHintHide': 'Masquer cette astuce',
  'about.privacy.title': 'Confidentialité',
  'about.privacy.storage':
    "Vos réglages (langue, détail des flèches, fuseau horaire), le nombre de jours d'utilisation (uniquement pour afficher un seul message d’encouragement) et les données de marée en cache sont stockés dans votre navigateur. L'application fonctionne hors ligne avec les données d'atlas et les tuiles de carte déjà chargées.",
  'about.privacy.requests':
    "Les requêtes de marée passent par le serveur de ce site, qui les transmet à api-maree.fr et conserve les réponses jusqu'à une semaine. Pour appliquer des limites d'usage, le serveur conserve pendant quelques heures une forme hachée (brouillée) de votre adresse IP. Elle n'est utilisée à aucune autre fin. Cette application n'utilise pas de cookies. Les visites sont comptées avec Plausible Analytics, un service sans cookies qui traite les données dans l'UE. Votre navigateur ne contacte que le serveur de ce site, qui transmet à Plausible l'adresse de la page, la page d'origine et des informations sur le navigateur, avec votre adresse IP. Plausible s'en sert pour compter les visiteurs uniques, leur localisation approximative et le type d'appareil ; l'adresse IP n'est pas conservée et aucun identifiant persistant n'est utilisé. Le serveur web peut journaliser les requêtes comme d'habitude.",
  'about.privacy.tiles':
    "Les tuiles de carte sont chargées directement depuis les serveurs d'OpenStreetMap et d'OpenSeaMap, qui voient donc votre adresse IP.",
  'about.privacy.kofi':
    "Le lien de soutien ouvre ko-fi.com dans un nouvel onglet. Rien n'est envoyé à Ko-fi depuis cette application avant que vous ne cliquiez, et Ko-fi a sa propre politique de confidentialité.",

  'header.subtitleEmpty': 'Touchez une zone d’atlas sur la carte',
  'header.change': 'Changer',
  'header.areasTitle': 'Afficher les zones de chaque atlas, puis toucher l’un d’eux sur la carte',
  'header.about': 'À propos',
  'header.support': '♥ Soutenir',
  'header.fileContains': 'Contenu du fichier :',

  'hint.useful': 'Utile en navigation ?',
  'hint.coffee': 'Un café aide à le faire vivre.',
  'hint.hide': 'Masquer ce message',

  // What the viewer says when atlas data cannot be fetched offline.
  'offline.atlas':
    'Les données de cette zone ne sont pas disponibles hors ligne. Connectez-vous à Internet, puis téléchargez l\u2019atlas depuis À propos → Atlas hors ligne.',
  'offline.frames':
    'Les données de ce moment ne sont pas disponibles hors ligne. Connectez-vous à Internet, ou téléchargez l\u2019atlas depuis À propos → Atlas hors ligne.',
  'offline.framesPartial':
    'Une partie seulement de cet atlas est téléchargée. Terminez le téléchargement depuis À propos → Atlas hors ligne, ou connectez-vous à Internet.',
  'offline.stale': 'Données indisponibles — le dernier moment chargé est affiché.',
  'offline.needsTide':
    'Les flèches nécessitent la marée : saisissez la pleine mer de référence dans « Données de marée ».',
  'offline.needsTideAction': 'Ouvrir « Données de marée »',

  'update.available': 'Une nouvelle version est prête.',
  'update.reload': 'Recharger',
  'update.dismiss': 'Masquer ce message',

  'sidebar.empty':
    "Touchez une zone d'atlas sur la carte pour l'ouvrir.",
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

  'details.expand': 'Afficher les détails',
  'details.collapse': 'Masquer les détails',

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
  'layers.legend': 'Légende des vitesses',

  'picker.title': 'Plusieurs atlas couvrent ce lieu',
  'picker.hint': "Touchez-en un pour l'ouvrir. La grille la plus fine est en premier.",
  'picker.finest': 'Le plus fin',

  'point.max': 'Max sur 12 h : {value} {unit}',
  'point.outside': "Ce point est en dehors de la grille de l'atlas.",
  'point.land': 'Pas de courant ici : la grille indique la terre.',
  'point.error': "Les données de courant n'ont pas pu être chargées.",
  'point.progress': 'Courbe : {done}/{total}',
  'point.noTide': "Pas encore de données de marée. La courbe attend les heures de marée.",
  'point.curveCaption': 'Vitesse, 12 h à venir',

  'timeline.goTo': 'Aller à',
  'timeline.zone': 'Fuseau horaire',
  'timeline.back': 'Reculer de {minutes} minutes',
  'timeline.forward': 'Avancer de {minutes} minutes',
  'timeline.prevHw': 'Plein mer précédent',
  'timeline.nextHw': 'Plein mer suivant',
  'timeline.prevLw': 'Basse mer précédente',
  'timeline.nextLw': 'Basse mer suivante',
  'timeline.aria': 'Repère de temps. Faites glisser, défilez ou utilisez les flèches du clavier pour le déplacer.',
  'timeline.curveUnavailable': 'Courbe de marée indisponible.',
  'timeline.fallbackSite': 'port de référence',
  'timeline.marker': '{type} {time} · {height} m',
  'timeline.note':
    "Hauteurs au-dessus du zéro hydrographique (ZH) – {site}. Points ambre : pleine mer. Points bleus : basse mer. Heures affichées en {zone}. Faites glisser, défilez ou utilisez les flèches du clavier pour déplacer le repère. La chronologie s'arrête {days} jours avant et après aujourd'hui.",

  'busy.frames': 'Chargement des courants {done}/{total}',
  'busy.framesOne': 'Chargement des courants…',
  'busy.opening': "Ouverture de l'atlas…{percent}",

  'status.enterTime': "Saisissez une date et une heure complètes.",
  'status.limited': "La chronologie est limitée à {days} jours avant et après aujourd'hui.",
  'status.enterReferenceTime': "Saisissez la date et l'heure de la marée de référence.",
  'status.curveUnavailable': 'Courbe de marée indisponible. {message}',
  'status.noTimes': 'Aucune heure de marée reçue pour cette période.',
  'status.noReference': 'Le fichier ne nomme aucun port de référence. Utilisez la marée saisie sous « Données de marée ».',
  'status.looking': 'Recherche des heures de marée…',
  'status.tideFailed': 'Échec de la recherche de marée : {message}',
  'status.manual': 'Marée saisie utilisée. Pas de courbe de marée hors ligne.',

  'quality.extrapolated': 'Vitesse extrapolée',
  'quality.extrapolatedHint': 'Le coefficient de marée est hors des deux cas publiés de l’atlas : les flèches sont extrapolées au-delà.',
  'quality.assumed': 'Vitesse estimée',
  'quality.assumedHint': 'Cette marée n’a pas de coefficient publié : 70 est supposé et les flèches sont une estimation.',

  'notice.noAtlas': "Aucun atlas ne couvre le centre de la carte. « Changer » montre où se trouvent les atlas.",
  'notice.alreadyOpen': '{label} est déjà ouvert.',

  'atlasList.failed': "La liste des atlas n'a pas pu être chargée.",
  'atlasList.retry': 'Réessayer',

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
  'session.waiting': 'En attente des heures de marée. Voir « Données de marée » dans les détails.',
  'session.noTimeAxis': 'Pas d’axe de temps',
  'tide.hw': 'PM',
  'tide.lw': 'BM',
};
