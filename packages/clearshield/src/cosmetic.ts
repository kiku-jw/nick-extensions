/**
 * Small local cosmetic hide list — not a full uBO engine.
 *
 * Keep this list tied to explicit advertising semantics. Generic class/id
 * substring guesses are unsafe because utility CSS can embed arbitrary text
 * (for example, ChatGPT's `--thread-response-height` contains `ad-`).
 */
export const COSMETIC_SELECTORS = [
  // Google / AdSense
  '[id^="google_ads_"]',
  '.google-ad',
  '.GoogleAd',
  'ins.adsbygoogle',
  '[data-ad-slot]',
  '[data-ad-client]',
  '[data-adunit]',
  '[data-google-query-id]',
  'div[id^="div-gpt-ad"]',
  'div[id^="gpt_ad"]',
  // Generic ad containers
  '.ad-banner',
  '.ad-container',
  '.ad-slot',
  '.ad-wrapper',
  '.ad-unit',
  '.adbox',
  '.adsbox',
  '.adsbygoogle',
  '.advert',
  '.advertisement',
  '.advertising',
  '.adhesion-ad',
  '.sponsored',
  '.sponsored-content',
  '.sponsored-post',
  '.sponsor-unit',
  '.dfp-ad',
  '.dfp_ad',
  '.mpu-ad',
  '.promo-ad',
  '.native-ad',
  '.taboola',
  '.trc_rbox',
  '[id^="taboola"]',
  '.outbrain',
  '.Outbrain',
  '[id^="outbrain"]',
  // Iframes
  'iframe[src*="doubleclick.net"]',
  'iframe[src*="googlesyndication.com"]',
  'iframe[src*="googletagservices.com"]',
  'iframe[src*="amazon-adsystem.com"]',
  'iframe[id^="google_ads_iframe"]',
  'iframe[title="Advertisement" i]',
  'iframe[title="Ads" i]',
  // ARIA / labels
  '[aria-label="Ads" i]',
  '[aria-label="Advertisement" i]',
  '[aria-label="Advertisements" i]',
];
