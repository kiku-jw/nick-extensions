export type FeatureId =
  | 'advSearch' | 'actionBar' | 'altText' | 'copyText' | 'cstblView'
  | 'expandWidth' | 'langCount' | 'parLink' | 'verseAudio' | 'mediaPlayerUI' | 'customSub'
  | 'imgGet' | 'mediaCtrl' | 'mediaTS' | 'mediaClip' | 'sndDisp' | 'transcCreate'
  | 'annotations' | 'bookmarks' | 'citations' | 'continueWatching' | 'qrShare' | 'officialOpen';

export type FeatureFlags = Record<FeatureId, boolean> & { masterEnabled?: boolean };

export type FeatureGroup = 'study' | 'core' | 'layout' | 'media';

export const FEATURE_META: { id: FeatureId; name: string; blurb: string; group: FeatureGroup }[] = [
  { id: 'annotations', name: 'Highlights, notes & tags', blurb: 'Keep six-color highlights and searchable notes locally', group: 'study' },
  { id: 'bookmarks', name: 'Save a place to return to', blurb: 'Keep an exact page, paragraph, verse, or verse range in the Study library', group: 'study' },
  { id: 'citations', name: 'Copy a quote with its source', blurb: 'Copy selected words with the publication title, reference, and direct JW link', group: 'study' },
  { id: 'qrShare', name: 'Show QR for this page', blurb: 'Create a local QR code for the precise official page link', group: 'study' },
  { id: 'officialOpen', name: 'Clean publication link', blurb: 'Open the same publication through JW.org without extra address parameters', group: 'study' },
  { id: 'verseAudio', name: 'Download audio for selected verses', blurb: 'Save one verse or several consecutive verses as one WAV file', group: 'core' },
  { id: 'copyText', name: 'Copy clean text', blurb: 'Copy text without verse numbers, reference letters, or StudyNav controls', group: 'core' },
  { id: 'parLink', name: 'Copy precise link', blurb: 'Copy a direct link to a paragraph, verse, or verse range', group: 'core' },
  { id: 'advSearch', name: 'Search by publication code', blurb: 'Open the existing JW search for a publication code or document number', group: 'core' },
  { id: 'altText', name: 'Image descriptions', blurb: 'Show alt text and captions below article images', group: 'core' },
  { id: 'imgGet', name: 'Download article images', blurb: 'Add a compact download button beside article images', group: 'core' },
  { id: 'langCount', name: 'Available languages', blurb: 'Show the number of languages for an article', group: 'core' },
  { id: 'actionBar', name: 'Keep page header visible', blurb: 'Keep the JW.org header in view while scrolling', group: 'layout' },
  { id: 'expandWidth', name: 'Wider reading column', blurb: 'Use more of the window for article text', group: 'layout' },
  { id: 'cstblView', name: 'Clearer tables', blurb: 'Add spacing and row separation to article tables', group: 'layout' },
  { id: 'mediaPlayerUI', name: 'Remove video shading', blurb: 'Keep the picture clear when the player controls appear', group: 'media' },
  { id: 'customSub', name: 'Larger subtitles', blurb: 'Increase subtitle size and background contrast', group: 'media' },
  { id: 'mediaCtrl', name: 'Media keyboard shortcuts', blurb: 'Use Space/K/J/L/F/M while watching media', group: 'media' },
  { id: 'mediaTS', name: 'Copy page and time', blurb: 'Copy the page link together with the current playback time', group: 'media' },
  { id: 'mediaClip', name: 'Download an audio or video segment', blurb: 'Enter start and end times, then save audio as WAV or video as WebM', group: 'media' },
  { id: 'continueWatching', name: 'Continue watching', blurb: 'Keep video progress locally and resume only when asked', group: 'media' },
  { id: 'sndDisp', name: 'Open second display', blurb: 'Open the current media in a popup window', group: 'media' },
  { id: 'transcCreate', name: 'Search available captions', blurb: 'Open a searchable panel only when text is present', group: 'media' },
];

export const DEFAULT_FLAGS: FeatureFlags = {
  masterEnabled: true,
  annotations: true,
  bookmarks: true,
  advSearch: true,
  actionBar: false,
  altText: true,
  copyText: true,
  citations: true,
  continueWatching: true,
  cstblView: false,
  expandWidth: false,
  langCount: true,
  parLink: true,
  qrShare: true,
  officialOpen: true,
  verseAudio: true,
  mediaPlayerUI: true,
  customSub: true,
  imgGet: false,
  mediaCtrl: true,
  mediaTS: true,
  mediaClip: true,
  sndDisp: true,
  transcCreate: true,
};

export type StudyNavInstallDetails = {
  reason?: string;
  previousVersion?: string;
};

function predatesSafeLayoutDefaults(version: string | undefined): boolean {
  const match = /^(\d+)\.(\d+)\.(\d+)(?:\D.*)?$/.exec(version || '');
  if (!match) return false;
  const current = match.slice(1, 4).map(Number);
  const safeDefaultRelease = [1, 2, 4];
  for (let index = 0; index < safeDefaultRelease.length; index += 1) {
    if (current[index] !== safeDefaultRelease[index]) {
      return current[index] < safeDefaultRelease[index];
    }
  }
  return false;
}

export function migrateFlagsForInstall(
  stored: Partial<FeatureFlags> | undefined,
  details: StudyNavInstallDetails,
): FeatureFlags {
  const next: FeatureFlags = { ...DEFAULT_FLAGS, ...stored };
  const resetLayout = details.reason === 'install' ||
    (details.reason === 'update' && predatesSafeLayoutDefaults(details.previousVersion));
  if (!resetLayout) return next;
  return {
    ...next,
    actionBar: false,
    cstblView: false,
    expandWidth: false,
  };
}
