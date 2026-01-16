export function decimalToRawAmount(decimalAmount: string, decimals: number): string {
  const s = decimalAmount.trim();
  if (!/^[0-9]+(\.[0-9]+)?$/.test(s)) {
    throw new Error('INVALID_DECIMAL_AMOUNT');
  }

  const [intPart, fracPart = ''] = s.split('.');
  const frac = fracPart.padEnd(decimals, '0').slice(0, decimals);
  const raw = `${intPart}${frac}`.replace(/^0+/, '') || '0';
  return raw;
}

export function isRawIntString(v: string): boolean {
  return /^[0-9]+$/.test(v);
}

