import { ethers } from 'hardhat';

/**
 * Pauses execution for the specified number of milliseconds.
 */
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Strips the 12-byte zero-padding from a 32-byte ABI-encoded address such as those found in transaction logs.
 * E.g:
 *   Input:  0x00000000000000000000000002831ae5c600cfbf3fb5a9521313868f546a7ea4
 *   Output: 0x02831aE5C600cFBF3FB5a9521313868F546A7ea4
 */
export const stripAddressPadding = (address: string) => {
  const rawAddress = '0x' + address.slice(26);
  return ethers.getAddress(rawAddress);
};

/**
 * Repeatedly fetches a transaction receipt until it is found or the maximum number of retries is reached.
 */
export const getTransactionReceipt = async (hash: string, retries = 15): Promise<any> => {
  try {
    const receipt = await ethers.provider.getTransactionReceipt(hash);
    if (!receipt || receipt?.logs?.length == 0) {
      if (retries <= 0) throw new Error(`Max retries reached for ${hash}`);
      await sleep(5000);
      return getTransactionReceipt(hash, retries - 1);
    }
    return receipt;
  } catch (error: any) {
    if (error.name === 'TransactionReceiptNotFoundError') {
      if (retries <= 0) throw new Error(`Max retries reached for ${hash}`);
      await sleep(5000);
      return getTransactionReceipt(hash, retries - 1);
    }
    throw error;
  }
};
