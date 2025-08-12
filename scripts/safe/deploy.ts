import { ethers } from 'hardhat';
import SafeApiKit from '@safe-global/api-kit';
import Safe from '@safe-global/protocol-kit';
import { OperationType } from '@safe-global/types-kit';
import { deployViaCreateX } from './utils/deployViaCreateX';
import { getTransactionReceipt, stripAddressPadding } from './utils/helpers';

/**
 * Deployment script
 */
async function deploy() {
  const [signer] = await ethers.getSigners();

  const CHAIN_ID = BigInt(process.env.CHAIN_ID as string);
  const CHAIN_RPC_URL = process.env.CHAIN_RPC_URL as string;
  const PRIVATE_KEY = process.env.PRIVATE_KEY as string;
  const SAFE_ADDRESS = process.env.SAFE_ADDRESS as string;
  const SAFE_API_KEY = process.env.SAFE_API_KEY as string;

  const protocolKit = await Safe.init({
    provider: CHAIN_RPC_URL,
    signer: PRIVATE_KEY,
    safeAddress: SAFE_ADDRESS
  });
  const apiKit = new SafeApiKit({
    chainId: CHAIN_ID,
    apiKey: SAFE_API_KEY
  });

  const trx = await deployViaCreateX();
  const safeTransaction = await protocolKit.createTransaction({
    transactions: [{ ...trx, value: '0', operation: OperationType.Call }]
  });
  const safeTxHash = await protocolKit.getTransactionHash(safeTransaction);
  const signature = await protocolKit.signHash(safeTxHash);

  await apiKit.proposeTransaction({
    safeAddress: SAFE_ADDRESS,
    safeTransactionData: safeTransaction.data,
    safeTxHash,
    senderAddress: signer.address,
    senderSignature: signature.data
  });

  const threshold = await protocolKit.getThreshold();
  console.log(`Current signatures: ${safeTransaction.signatures.size + 1}, Required: ${threshold}`);

  // the number of signatures included in the safe trx + protocol kit signer [>=] threshold
  if (safeTransaction.signatures.size + 1 >= threshold) {
    const { hash } = await protocolKit.executeTransaction(safeTransaction);
    const receipt = await getTransactionReceipt(hash);
    const createX = receipt?.logs.find((log: any) => log.address.toLowerCase() == trx.to.toLowerCase());
    const deployedAt = createX?.topics[1];
    if (deployedAt) {
      console.log('Transaction hash: ', hash);
      console.log('Contract successfully deployed at: ', stripAddressPadding(deployedAt));
    }
  } else {
    // required threshold - protocol kit signer
    console.log(`Waiting for atleast ${threshold - 1} more signature(s) before execution`);
    console.log(`Share this transaction hash with other Safe owners: ${safeTxHash}`);
  }
}

deploy()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Deployment failed:');
    console.error(error);
    process.exit(1);
  });
