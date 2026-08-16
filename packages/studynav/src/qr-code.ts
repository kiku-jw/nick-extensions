import encodeQR from 'qr';
import { isSupportedJwHttpsUrl } from './document-actions';

export function qrSvgForStudyUrl(url: string): string | null {
  if (!isSupportedJwHttpsUrl(url)) return null;
  return encodeQR(url, 'svg', {
    border: 4,
    ecc: 'medium',
    optimize: true,
    scale: 5,
  });
}
