import { run } from 'hardhat';
import { deployment } from './utils/deployment';

/**
 * Verification script
 */
async function verify() {
  const DEPLOYED_ADDRESS = process.env.DEPLOYED_ADDRESS;
  const { args } = await deployment();
  await run('verify:verify', {
    address: DEPLOYED_ADDRESS,
    constructorArguments: [args.tokens, args.relayers, args.permit2, args.recipient, args.owner]
  });
}

verify()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Verification failed:');
    console.error(error);
    process.exit(1);
  });
