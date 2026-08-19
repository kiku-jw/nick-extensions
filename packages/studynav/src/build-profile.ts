/**
 * The build script replaces this compile-time identifier. Source-level tests
 * run without that replacement and therefore use the desktop profile.
 */
export const MOBILE_BUILD =
  typeof __STUDYNAV_MOBILE__ !== 'undefined' && __STUDYNAV_MOBILE__;
