/**
 * Configuração de chaves VAPID (RFC 8292) para Web Push nativo no FutResenha.
 */

export const VAPID_PUBLIC_KEY =
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ||
  'BPKiPEARHD7IBsx4XR-FDhe3wfEyG0EQuK2-DtpmttGkvT_uHiuFAJJ4YZcz0lqs2xjgxBBklKdCCJ4u4RgvClY';

export const VAPID_PRIVATE_KEY =
  process.env.VAPID_PRIVATE_KEY ||
  'Je4N52RS-N72owckib2ifmbFISPSf1cT8eztLvVAago';

export const VAPID_SUBJECT =
  process.env.VAPID_SUBJECT || 'mailto:contato@futresenha.com.br';
