import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { isValidSuiAddress } from '@mysten/sui/utils';

const SUI_COIN_TYPE = '0x2::sui::SUI';



type SuiBalanceChange = {
  owner: unknown;
  coinType: string;
  amount: string;
};

type SuiTransactionBlock = {
  digest: string;
  effects: {
    status: { status: string };
  };
  balanceChanges?: SuiBalanceChange[];
};

@Injectable()
export class SuiRpcService {
  private readonly rpcUrl: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
  ) {
    this.rpcUrl = this.configService.get<string>('SUI_RPC_URL') ?? '';
  }

  private async rpc<T>(method: string, params: unknown[]): Promise<T> {
    if (!this.rpcUrl) {
      throw new Error('SUI_RPC_URL_NOT_CONFIGURED');
    }

    const response = await firstValueFrom(
      this.httpService.post<any>(this.rpcUrl, {
        jsonrpc: '2.0',
        id: 1,
        method,
        params,
      }),
    );

    const data: any = response.data as any;
    if (data?.error) {
      const msg = typeof data.error?.message === 'string' ? data.error.message : 'SUI_RPC_ERROR';
      throw new Error(msg);
    }

    return (data?.result ?? null) as T;
  }

  /**
   * Get SUI balance for an address (returns balance in SUI, converted from MIST).
   */
  async getBalance(address: string): Promise<string> {
    if (!isValidSuiAddress(address)) {
      throw new Error('Invalid SUI address format');
    }
    const balance = await this.rpc<{ totalBalance: string }>('suix_getBalance', [
      address,
      SUI_COIN_TYPE,
    ]);
    if (!balance?.totalBalance) {
      return '0';
    }
    const totalMist = BigInt(balance.totalBalance);
    const balanceInSui = totalMist / BigInt(1_000_000_000);
    const remainderMist = totalMist % BigInt(1_000_000_000);
    if (remainderMist > 0n) {
      const decimal = remainderMist.toString().padStart(9, '0').replace(/0+$/, '');
      return `${balanceInSui}.${decimal}`;
    }
    return balanceInSui.toString();
  }

  /**
   * Validate SUI address format.
   */
  async validateAddress(address: string): Promise<boolean> {
    return isValidSuiAddress(address);
  }

  async getCurrentEpoch(): Promise<string> {
    const tryParseEpoch = (state: any) => {
      const epoch = state?.epoch;
      if (typeof epoch === 'string' && epoch.length > 0) return epoch;
      if (typeof epoch === 'number' && Number.isFinite(epoch)) return String(epoch);
      return null;
    };

    // Sui JSON-RPC uses suix_* for extended endpoints.
    // Testnet fullnode commonly supports `suix_getLatestSuiSystemState`.
    try {
      const state = await this.rpc<any>('suix_getLatestSuiSystemState', []);
      const epoch = tryParseEpoch(state);
      if (epoch) return epoch;
    } catch {
      // ignore and try fallback
    }

    // Fallbacks for compatibility with some nodes/proxies
    for (const method of ['suix_getSuiSystemState', 'sui_getLatestSuiSystemState', 'sui_getSuiSystemState'] as const) {
      try {
        const state = await this.rpc<any>(method, []);
        const epoch = tryParseEpoch(state);
        if (epoch) return epoch;
      } catch {
        // keep trying
      }
    }

    throw new Error('SUI_EPOCH_NOT_FOUND');
  }
  async getTransaction(txDigest: string, retries = 5, delayMs = 2000): Promise<SuiTransactionBlock | null> {
    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        const result = await this.rpc<SuiTransactionBlock>('sui_getTransactionBlock', [
          txDigest,
          {
            showInput: false,
            showEffects: true,
            showEvents: false,
            showObjectChanges: false,
            showBalanceChanges: true,
          },
        ]);
        if (result) return result;
      } catch {
        // Transaction might not be indexed yet
      }

      // Wait before retrying (except on last attempt)
      if (attempt < retries - 1) {
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
    return null;
  }

  private static normalizeSuiAddress(address: string) {
    const a = address.toLowerCase();
    return a.startsWith('0x') ? a : `0x${a}`;
  }

  private static isPositiveOrZeroIntString(v: string) {
    return /^[0-9]+$/.test(v);
  }

  private static lteIntString(a: string, b: string) {
    // a <= b, both non-negative integer strings
    if (a.length !== b.length) return a.length < b.length;
    return a <= b;
  }

  private static extractOwnerAddress(owner: unknown): string | null {
    if (!owner || typeof owner !== 'object') return null;

    const o: any = owner;

    if (typeof o.AddressOwner === 'string') return SuiRpcService.normalizeSuiAddress(o.AddressOwner);
    if (typeof o.ObjectOwner === 'string') return SuiRpcService.normalizeSuiAddress(o.ObjectOwner);

    if (o.Shared) return null;
    if (o.Immutable) return null;

    return null;
  }

  async verifyTransfer(
    txDigest: string,
    expectedRecipient: string,
    expectedCoinType: string,
    minAmountRaw: string,
  ): Promise<{ success: boolean; message?: string; actualAmount?: string }> {
    if (!SuiRpcService.isPositiveOrZeroIntString(minAmountRaw)) {
      return { success: false, message: 'INVALID_MIN_AMOUNT_RAW' };
    }

    const tx = await this.getTransaction(txDigest);
    if (!tx) {
      return { success: false, message: 'Transaction not found' };
    }

    if (tx.effects.status.status !== 'success') {
      return { success: false, message: 'Transaction failed' };
    }

    const recipient = SuiRpcService.normalizeSuiAddress(expectedRecipient);
    const coinType = expectedCoinType;

    const changes = tx.balanceChanges ?? [];
    let received = '0';

    for (const ch of changes) {
      if (ch.coinType !== coinType) continue;

      const ownerAddress = SuiRpcService.extractOwnerAddress(ch.owner);
      if (!ownerAddress || ownerAddress !== recipient) continue;

      // amount is a signed string (can be negative). For receiver it should be positive.
      if (!ch.amount || typeof ch.amount !== 'string') continue;
      if (!/^-?[0-9]+$/.test(ch.amount)) continue;
      if (ch.amount.startsWith('-')) continue;

      // sum received
      received = (BigInt(received) + BigInt(ch.amount)).toString();
    }

    if (received === '0') {
      return { success: false, message: 'NO_MATCHING_COIN_RECEIVE_FOUND' };
    }

    if (!SuiRpcService.lteIntString(minAmountRaw, received)) {
      return { success: false, message: 'RECEIVED_AMOUNT_TOO_LOW', actualAmount: received };
    }

    return { success: true, actualAmount: received };
  }
}
