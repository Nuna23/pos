// Build a Thai PromptPay QR payload (EMVCo / BOT spec) so the customer can scan
// to pay. Pure client-side string building — no external service.

function tlv(tag: string, value: string): string {
  const len = value.length.toString().padStart(2, '0');
  return tag + len + value;
}

// PromptPay target: a 13-digit national/tax id, or a phone number which is
// encoded as "0066" + the number without its leading zero.
function targetField(id: string): string {
  const digits = id.replace(/\D/g, '');
  if (digits.length >= 13) {
    return tlv('02', digits.slice(0, 13));
  }
  const phone = '0066' + digits.replace(/^0/, '');
  return tlv('01', phone);
}

// CRC-16/CCITT-FALSE over the payload (incl. the "6304" tag), per the spec.
function crc16(payload: string): string {
  let crc = 0xffff;
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      crc = crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1;
      crc &= 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

export function promptPayPayload(id: string, amount?: number): string {
  const hasAmount = typeof amount === 'number' && amount > 0;
  const merchant = tlv('29', tlv('00', 'A000000677010111') + targetField(id));

  let payload =
    tlv('00', '01') + // payload format indicator
    tlv('01', hasAmount ? '12' : '11') + // 12 = dynamic (amount), 11 = static
    merchant +
    tlv('53', '764') + // currency THB
    (hasAmount ? tlv('54', amount!.toFixed(2)) : '') +
    tlv('58', 'TH'); // country

  payload += '6304'; // CRC tag + length, value computed over everything so far
  return payload + crc16(payload);
}

// Configured PromptPay receiver (shop). Falls back to a placeholder so the QR
// still renders in dev; set NEXT_PUBLIC_PROMPTPAY_ID for a real, scannable code.
export const PROMPTPAY_ID = process.env.NEXT_PUBLIC_PROMPTPAY_ID ?? '0000000000';
