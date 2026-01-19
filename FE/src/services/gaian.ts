/**
 * Gaian API Service
 * Handles QR code parsing via the Gaian payment gateway API
 */

const API_URL = import.meta.env.VITE_GAIAN_API_URL;
const API_KEY = import.meta.env.VITE_GAIAN_API_KEY;

export interface GaianQrResponse {
    success: boolean;
    qrInfo?: {
        isValid: boolean;
        bankBin: string;
        accountNumber: string;
        beneficiaryName: string;
        amount?: number;
        memo?: string;
    };
    error?: string;
}

export interface ParsedBankInfo {
    bankBin: string;
    bankName: string;
    accountNumber: string;
    beneficiaryName: string;
    amount?: number;
    memo?: string;
}

// Bank BIN to Bank Name mapping (common Vietnamese banks)
const BANK_BIN_MAP: Record<string, string> = {
    '970436': 'Vietcombank',
    '970418': 'BIDV',
    '970407': 'Techcombank',
    '970422': 'MB Bank',
    '970415': 'VietinBank',
    '970405': 'Agribank',
    '970416': 'ACB',
    '970432': 'VPBank',
    '970423': 'TPBank',
    '970403': 'Sacombank',
    '970414': 'OCB',
    '970448': 'SHB',
    '970406': 'HDBank',
    '970429': 'SCB',
    '970431': 'Eximbank',
    '970443': 'VIB',
    '970454': 'VietABank',
    '970439': 'PVcomBank',
    '970426': 'MSB',
    '970441': 'VRB',
    '970458': 'UOB',
    '970452': 'KienlongBank',
    '970449': 'LienVietPostBank',
    '970427': 'VietBank',
    '970400': 'SaigonBank',
    '970433': 'ABBANK',
    '970409': 'BacABank',
    '970428': 'NAB',
    '970434': 'Indovina',
    '970438': 'BaoVietBank',
    '970440': 'SeABank',
    '970437': 'NCBBANK',
    '970425': 'AnBinhBank',
    '970456': 'IBK',
    '970462': 'Woori',
    '970457': 'Shinhan',
    '970455': 'CIMB',
    '970424': 'SCBVL',
    '970430': 'GPBank',
    '970419': 'NHBank',
};

/**
 * Get bank name from BIN code
 */
export function getBankNameFromBin(bin: string): string {
    return BANK_BIN_MAP[bin] || `Bank (${bin})`;
}

/**
 * Parse QR string using Gaian API
 * @param qrString - The raw QR code string
 * @returns Parsed bank information or null if invalid
 */
export async function parseQrString(qrString: string): Promise<ParsedBankInfo | null> {
    if (!API_URL || !API_KEY) {
        console.error('[Gaian] API credentials not configured');
        return null;
    }

    try {
        const response = await fetch(`${API_URL}/api/v1/parseQr`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': API_KEY,
            },
            body: JSON.stringify({
                qrString: qrString,
                country: 'VN',
            }),
        });

        if (!response.ok) {
            return null;
        }

        const data: GaianQrResponse = await response.json();

        if (!data.success || !data.qrInfo || !data.qrInfo.isValid) {
            return null;
        }

        const { bankBin, accountNumber, beneficiaryName, amount, memo } = data.qrInfo;

        if (!bankBin || !accountNumber) {
            return null;
        }

        return {
            bankBin,
            bankName: getBankNameFromBin(bankBin),
            accountNumber,
            beneficiaryName: beneficiaryName || 'Unknown',
            amount: amount ? Number(amount) : undefined,
            memo,
        };
    } catch {
        return null;
    }
}

/**
 * Check if a string starts with HiddenWallet prefix
 */
export function isHiddenWalletQr(str: string): boolean {
    const trimmed = str.trim();
    if (trimmed.startsWith('@')) return true;
    if (trimmed.toLowerCase().startsWith('hiddenwallet:')) return true;
    return false;
}

/**
 * Extract username from HiddenWallet QR string
 */
export function extractHiddenWalletUsername(str: string): string {
    let username = str.trim();

    if (username.toLowerCase().startsWith('hiddenwallet:')) {
        username = username.substring(13);
    }

    if (username.startsWith('@')) {
        username = username.substring(1);
    }

    return username.toLowerCase();
}
