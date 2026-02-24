/**
 * French locale dictionary.
 * Must satisfy the same shape as en.ts.
 */
import type { TranslationKey } from './en';

const fr: Record<TranslationKey, string> = {
  // ── Landing ──────────────────────────────────────────────
  tagline: 'Un espace virtuel où la distance disparaît',
  taglineDescription: 'Audio spatialisé et un canevas infini partagé pour les équipes, les amis ou les communautés.',
  enterSpace: 'Entrer dans l\'espace',
  leaveEmptyForDemo: 'Laissez vide pour l\'espace démo',
  viewOnGithub: 'Voir sur GitHub',
  footerTagline: 'Open source · Auto-hébergeable · Propulsé par WebRTC',
  browserWarning: 'Attention : cette application est testée uniquement sur Chrome. Vous pourriez rencontrer des problèmes sur d\'autres navigateurs.',

  // Landing features
  featureSpatialAudioTitle: 'Audio spatialisé',
  featureSpatialAudioDesc: 'Les voix deviennent plus fortes à mesure que vous vous rapprochez, comme dans une vraie pièce. Approchez-vous pour discuter ou éloignez-vous pour vous concentrer.',
  featureScreenSharingTitle: 'Partage d\'écran',
  featureScreenSharingDesc: 'Partagez votre écran sous forme de fenêtre redimensionnable et déplaçable sur le canevas — tout le monde peut le faire en même temps.',
  featureSharedCanvasTitle: 'Canevas partagé',
  featureSharedCanvasDesc: 'Déplacez votre avatar sur une surface infinie et déposez des notes — tout le monde voit et interagit en temps réel.',
  featureCollaborationTitle: 'Collaboration en temps réel',
  featureCollaborationDesc: 'Notes Markdown enrichies avec blocs de code colorés, co-éditées par tous les participants avec des curseurs en direct.',
  featureSpatialMediaPlayerTitle: 'Lecteur multimédia spatialisé',
  featureSpatialMediaPlayerDesc: 'Diffusez des vidéos YouTube synchronisées entre tous les utilisateurs. Le son de la vidéo s\'atténue de façon réaliste selon la distance de votre avatar.',

  // ── JoinModal ────────────────────────────────────────────
  yourName: 'Votre nom',
  enterYourName: 'Entrez votre nom',
  joinSpace: 'Rejoindre l\'espace',
  backToHome: 'Retour à l\'accueil',
  checkingSpace: 'Vérification de l\'espace...',
  noOneHere: 'Personne ici pour l\'instant — soyez le premier !',
  hereNow: 'Présent(e) :',
  peopleHere: '{{count}} personnes ici :',

  // ── ConnectionStatus ────────────────────────────────────
  connectionLost: 'Connexion perdue. En attente de reconnexion...',
  reconnecting: 'Reconnexion...',
  connected: 'Connecté',

  // ── SpaceNotFound ────────────────────────────────────────
  spaceNotFound: 'Espace introuvable',
  spaceDoesNotExist: 'L\'espace "{{spaceId}}" n\'existe pas.',
  contactAdmin: 'Contactez votre administrateur pour créer cet espace.',
  goHome: 'Accueil',

  // ── ControlBar ──────────────────────────────────────────
  toggleMicrophone: 'Activer/Désactiver le microphone',
  toggleCamera: 'Activer/Désactiver la caméra',
  shareScreen: 'Partager l\'écran',
  addNote: 'Ajouter une note',
  addMedia: 'Ajouter une vidéo YouTube',
  enterYoutubeUrl: 'Entrez l\'URL YouTube :',
  invalidYoutubeUrl: 'URL YouTube invalide',
  recentActivity: 'Activité récente',
  leaveSpace: 'Quitter l\'espace',
  mediaBlockedError: 'Caméra/micro bloqué(s). Cliquez sur l\'icône 🔒 dans la barre d\'adresse pour autoriser l\'accès, puis réessayez.',
  mediaError: 'Erreur média : {{errorName}}',

  // ── ActivityPanel ───────────────────────────────────────
  noRecentActivity: 'Aucune activité récente',
  openedTheSpace: 'a ouvert l\'espace',
  joined: 'a rejoint',
  left: 'est parti(e)',
  closedTheSpace: 'a fermé l\'espace',
  justNow: 'à l\'instant',
  minutesAgo: 'il y a {{count}} min',
  hoursAgo: 'il y a {{count}} h',
  daysAgo: 'il y a {{count}} j',

  // ── TextNote ────────────────────────────────────────────
  note: 'Note',
  fontSize: 'Taille de police',
  fontFamily: 'Famille de police',
  deleteNote: 'Supprimer la note',

  // ── ScreenShare ─────────────────────────────────────────
  yourScreen: 'Votre écran',
  userScreen: 'Écran de {{username}}',
  copySnapshot: 'Copier la capture',
  stopSharing: 'Arrêter le partage',

  // ── MediaPlayer ─────────────────────────────────────────
  loadingYoutube: 'Chargement de YouTube...',
  removeMediaPlayer: 'Supprimer le lecteur multimédia',

  // ── CloseButton ─────────────────────────────────────────
  cancel: 'Annuler',
  delete: 'Supprimer',
  confirmDelete: 'Confirmer la suppression',

  // ── Avatar ──────────────────────────────────────────────
  setStatus: 'Définir le statut...',
  peerConnecting: 'Connexion…',
  peerConnectionFailed: 'Connexion échouée',

  // ── Minimap ─────────────────────────────────────────────
  zoomIn: 'Zoom avant',
  resetView: 'Réinitialiser la vue',
  zoomOut: 'Zoom arrière',
};

export default fr;
