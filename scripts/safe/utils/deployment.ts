import { ethers } from 'hardhat';

/**
 * Get deployment data and constructor arguments
 */
export const deployment = async () => {
  const SAFE_ADDRESS = process.env.SAFE_ADDRESS as string;
  const Core = await ethers.getContractFactory('Core');
  const args = {
    tokens: [
      {
        token: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359',
        minAmount: ethers.parseUnits('0.5', 6),
        maxAmount: ethers.parseUnits('1000', 6)
      },
      {
        token: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
        minAmount: ethers.parseUnits('0.5', 6),
        maxAmount: ethers.parseUnits('1000', 6)
      },
      {
        token: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F',
        minAmount: ethers.parseUnits('0.5', 6),
        maxAmount: ethers.parseUnits('1000', 6)
      }
    ],
    relayers: ['0xf51ecc190b29816fb2ab710615837c67b1e70a5e'],
    permit2: '0x000000000022D473030F116dDEE9F6B43aC78BA3',
    recipient: '0x010B4D4D4a8faCb95eC3416c9FaC708FC190Bf60', // safe address (multi-sig)
    owner: SAFE_ADDRESS // safe address (multi-sig)
  };
  const deployment = await Core.getDeployTransaction(
    args.tokens,
    args.relayers,
    args.permit2,
    args.recipient,
    args.owner
  );
  return { data: deployment.data, args: args };
};
