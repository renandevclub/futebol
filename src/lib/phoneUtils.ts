/**
 * Utilitários centralizados para validação, normalização e formatação de telefones.
 * Padrão brasileiro: DDD (2 dígitos) + Número (8 ou 9 dígitos).
 */

// Lista de DDDs válidos no Brasil
const VALID_DDDS = new Set([
  '11', '12', '13', '14', '15', '16', '17', '18', '19', // SP
  '21', '22', '24', // RJ
  '27', '28', // ES
  '31', '32', '33', '34', '35', '37', '38', // MG
  '41', '42', '43', '44', '45', '46', // PR
  '47', '48', '49', // SC
  '51', '53', '54', '55', // RS
  '61', // DF
  '62', '64', // GO
  '63', // TO
  '65', '66', // MT
  '67', // MS
  '68', // AC
  '69', // RO
  '71', '73', '74', '75', '77', // BA
  '79', // SE
  '81', '87', // PE
  '82', // AL
  '83', // PB
  '84', // RN
  '85', '88', // CE
  '86', '89', // PI
  '91', '93', '94', // PA
  '92', '97', // AM
  '95', // RR
  '96', // AP
  '98', '99', // MA
]);

/**
 * Remove todos os caracteres não-numéricos
 */
export function cleanPhoneNumber(phone?: string | null): string {
  if (!phone) return '';
  return phone.replace(/\D/g, '');
}

/**
 * Extrai os dígitos significativos nacionais (DDD + Número, sem o DDI 55)
 */
export function getNationalDigits(phone?: string | null): string {
  const digits = cleanPhoneNumber(phone);
  if (digits.length >= 12 && digits.startsWith('55')) {
    return digits.slice(2);
  }
  return digits;
}

/**
 * Normaliza o telefone para o formato internacional E.164: +5591999999999
 */
export function normalizePhoneE164(phone?: string | null): string {
  const national = getNationalDigits(phone);
  if (!national) return '';
  return `+55${national}`;
}

/**
 * Normaliza o telefone para armazenamento padronizado no banco (apenas dígitos com DDD): 91999999999
 */
export function normalizePhoneDb(phone?: string | null): string {
  return getNationalDigits(phone);
}

/**
 * Valida se o telefone é válido no formato brasileiro (com DDD válido e 10 ou 11 dígitos)
 */
export function validatePhoneNumber(phone?: string | null): { isValid: boolean; error?: string } {
  const national = getNationalDigits(phone);

  if (!national) {
    return { isValid: false, error: 'Por favor, informe seu número de telefone.' };
  }

  if (national.length < 10 || national.length > 11) {
    return {
      isValid: false,
      error: 'O número de telefone deve conter DDD + 8 ou 9 dígitos (ex: (91) 99999-9999).',
    };
  }

  const ddd = national.slice(0, 2);
  if (!VALID_DDDS.has(ddd)) {
    return {
      isValid: false,
      error: `O DDD informado (${ddd}) não é válido no Brasil.`,
    };
  }

  // Se tem 11 dígitos, o primeiro dígito após o DDD em celulares deve ser 9
  if (national.length === 11) {
    const ninthDigit = national.charAt(2);
    if (ninthDigit !== '9') {
      return {
        isValid: false,
        error: 'Para números celulares com 11 dígitos, o primeiro dígito deve ser 9.',
      };
    }
  }

  return { isValid: true };
}

/**
 * Aplica máscara visual ao telefone: (91) 99999-9999 ou (91) 9999-9999
 */
export function formatPhoneDisplay(phone?: string | null): string {
  const national = getNationalDigits(phone);
  if (!national) return '';

  if (national.length <= 2) {
    return `(${national}`;
  }
  if (national.length <= 6) {
    return `(${national.slice(0, 2)}) ${national.slice(2)}`;
  }
  if (national.length <= 10) {
    return `(${national.slice(0, 2)}) ${national.slice(2, 6)}-${national.slice(6)}`;
  }
  return `(${national.slice(0, 2)}) ${national.slice(2, 7)}-${national.slice(7, 11)}`;
}

/**
 * Gera o identificador RFC 5322 estável e consistente para autenticação no Supabase Auth.
 * Permite usar login por Telefone + Senha sem custos de SMS e com 100% de confiabilidade.
 */
export function getSupabaseAuthEmail(phone?: string | null): string {
  const national = getNationalDigits(phone);
  return `phone_${national}@auth.futresenha.app`;
}

/**
 * Calcula o hash SHA-256 de uma string utilizando a Web Crypto API (nativa em navegadores e Node 18+)
 */
export async function sha256Hex(text: string): Promise<string> {
  const clean = text.trim();
  if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) {
    const msgUint8 = new TextEncoder().encode(clean);
    const hashBuffer = await window.crypto.subtle.digest('SHA-256', msgUint8);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  }
  // Fallback caso executado em ambiente node sem window
  const cryptoModule = await import('crypto');
  return cryptoModule.createHash('sha256').update(clean).digest('hex');
}

/**
 * Formata um código de convite para caixa alta e sem espaços
 */
export function normalizeInviteCode(code?: string | null): string {
  if (!code) return '';
  return code.trim().toUpperCase();
}

