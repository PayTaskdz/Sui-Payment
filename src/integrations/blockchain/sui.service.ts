import { Injectable } from '@nestjs/common';
import { SuiClient, getFullnodeUrl } from '@mysten/sui/client';
import { isValidSuiAddress } from '@mysten/sui/utils';

@Injectable()
export class SuiService {
  private readonly client: SuiClient;

  constructor() {
    // Use custom RPC URL or default to mainnet
    const rpcUrl = process.env.SUI_RPC_URL || getFullnodeUrl('mainnet');
    this.client = new SuiClient({ url: rpcUrl });
  }

  /**
   * Get SUI balance for an address
   * Returns balance in SUI (converted from MIST)
   */
  async getBalance(address: string): Promise<string> {
    try {
      // Validate address first
      if (!isValidSuiAddress(address)) {
        throw new Error('Invalid SUI address format');
      }

      // Get balance (returns in MIST, 1 SUI = 10^9 MIST)
      const balance = await this.client.getBalance({
        owner: address,
      });

      // Convert MIST to SUI
      const balanceInSui = (BigInt(balance.totalBalance) / BigInt(1_000_000_000)).toString();
      const remainderMist = BigInt(balance.totalBalance) % BigInt(1_000_000_000);
      
      // Format with decimals (up to 9 decimal places)
      if (remainderMist > 0) {
        const decimal = remainderMist.toString().padStart(9, '0').replace(/0+$/, '');
        return `${balanceInSui}.${decimal}`;
      }
      
      return balanceInSui;
    } catch (error: any) {
      throw new Error(`Failed to query SUI balance: ${error.message}`);
    }
  }

  /**
   * Validate SUI address format
   */
  async validateAddress(address: string): Promise<boolean> {
    return isValidSuiAddress(address);
  }

  /**
   * Get transaction details by digest
   */
  async getTransaction(digest: string) {
    try {
      const tx = await this.client.getTransactionBlock({
        digest,
        options: {
          showInput: true,
          showEffects: true,
          showEvents: true,
        },
      });
      return tx;
    } catch (error: any) {
      throw new Error(`Failed to query transaction: ${error.message}`);
    }
  }
}
