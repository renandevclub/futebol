/**
 * Utilitário de geração de Payload PIX (BR Code / Copia e Cola)
 * Segue o padrão oficial do Banco Central do Brasil (EMV Co / BR Code)
 */

export interface PixConfig {
  key: string; // Chave PIX (CPF, CNPJ, E-mail, Celular ou Aleatória)
  name: string; // Nome do recebedor (Max 25 caracteres, sem acentos)
  city: string; // Cidade do recebedor (Max 15 caracteres, sem acentos)
  amount: number; // Valor da transação (ex: 20.00)
  txid?: string; // Identificador da transação (opcional, padrão: ***)
  description?: string; // Descrição opcional
}

/**
 * Remove acentos e caracteres especiais
 */
function sanitizeString(str: string, maxLength: number): string {
  const normalized = str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove acentos
    .replace(/[^a-zA-Z0-9 ]/g, '') // Apenas alfanuméricos e espaço
    .trim()
    .toUpperCase();

  return normalized.substring(0, maxLength);
}

/**
 * Formata um campo no padrão EMV (ID + Tamanho + Valor)
 */
function formatEMVField(id: string, value: string): string {
  const len = value.length.toString().padStart(2, '0');
  return `${id}${len}${value}`;
}

/**
 * Calcula o Checksum CRC16 (CCITT-FALSE) no padrão do Banco Central
 */
function calculateCRC16(str: string): string {
  let crc = 0xffff;
  for (let i = 0; i < str.length; i++) {
    crc ^= str.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      if ((crc & 0x8000) !== 0) {
        crc = (crc << 1) ^ 0x1021;
      } else {
        crc <<= 1;
      }
      crc &= 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

/**
 * Gera a string no formato "PIX Copia e Cola" oficial
 */
export function generatePixPayload(config: PixConfig): string {
  const cleanKey = config.key.trim();
  const cleanName = sanitizeString(config.name || 'FUTRESENHA', 25);
  const cleanCity = sanitizeString(config.city || 'BRASIL', 15);
  const formattedAmount = config.amount > 0 ? config.amount.toFixed(2) : '0.00';
  const cleanTxId = config.txid ? sanitizeString(config.txid, 25) : '***';

  // ID 00: Payload Format Indicator
  let emvStr = formatEMVField('00', '01');

  // ID 26: Merchant Account Information - PIX
  let merchantAccountInfo = formatEMVField('00', 'br.gov.bcb.pix');
  merchantAccountInfo += formatEMVField('01', cleanKey);
  if (config.description) {
    const cleanDesc = sanitizeString(config.description, 40);
    if (cleanDesc) {
      merchantAccountInfo += formatEMVField('02', cleanDesc);
    }
  }
  emvStr += formatEMVField('26', merchantAccountInfo);

  // ID 52: Merchant Category Code
  emvStr += formatEMVField('52', '0000');

  // ID 53: Transaction Currency (986 = BRL)
  emvStr += formatEMVField('53', '986');

  // ID 54: Transaction Amount
  if (config.amount > 0) {
    emvStr += formatEMVField('54', formattedAmount);
  }

  // ID 58: Country Code
  emvStr += formatEMVField('58', 'BR');

  // ID 59: Merchant Name
  emvStr += formatEMVField('59', cleanName);

  // ID 60: Merchant City
  emvStr += formatEMVField('60', cleanCity);

  // ID 62: Additional Data Field Template (TxID)
  const additionalData = formatEMVField('05', cleanTxId);
  emvStr += formatEMVField('62', additionalData);

  // ID 63: CRC16 Checksum Header
  emvStr += '6304';

  // Adiciona o código CRC16 calculado no final
  const crc = calculateCRC16(emvStr);
  return `${emvStr}${crc}`;
}

/**
 * Retorna URL de imagem do QR Code para exibição rápida no frontend
 */
export function getPixQrCodeUrl(payload: string, size = 300): string {
  const encodedPayload = encodeURIComponent(payload);
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&margin=10&data=${encodedPayload}`;
}
