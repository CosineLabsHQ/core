import { ethers } from 'hardhat';
import { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers';
import { MockERC20, MockERC20WithFee, MockPermit2, Core } from '../../../typechain-types';

/**
 * Creates a valid Uniswap's Permit2 permit object and signature.
 *
 * @param owner
 * @param token
 * @param spender
 * @param amount
 * @param deadline
 * @returns
 */
export const createPermit2Signature = async (
  owner: HardhatEthersSigner,
  permit2: MockPermit2,
  token: MockERC20 | MockERC20WithFee,
  spender: Core,
  amount: bigint,
  deadline: number,
  mockSignature = false
) => {
  const [, , nonce] = await permit2.allowance(owner.address, await token.getAddress(), await spender.getAddress());
  const eip712 = {
    domain: {
      name: 'Permit2',
      chainId: (await ethers.provider.getNetwork()).chainId,
      verifyingContract: await permit2.getAddress()
    },
    types: {
      PermitSingle: [
        { name: 'details', type: 'PermitDetails' },
        { name: 'spender', type: 'address' },
        { name: 'sigDeadline', type: 'uint256' }
      ],
      PermitDetails: [
        { name: 'token', type: 'address' },
        { name: 'amount', type: 'uint160' },
        { name: 'expiration', type: 'uint48' },
        { name: 'nonce', type: 'uint48' }
      ]
    },
    message: {
      details: {
        token: await token.getAddress(),
        amount: amount,
        expiration: deadline,
        nonce: nonce
      },
      spender: await spender.getAddress(),
      sigDeadline: deadline
    }
  };
  const signature = await owner.signTypedData(eip712.domain, eip712.types, eip712.message);
  const _signature = mockSignature ? ethers.randomBytes(32) : signature;
  return { eip712, signer: owner.address, signature: _signature };
};

/**
 * Creates a valid Uniswap's Permit2 permit request object and signature.
 *
 * @param requestSigner
 * @param core
 * @param token
 * @param Permit2Signature
 * @param recipient
 * @returns
 */
export const createPermit2RequestSignature = async (
  requestSigner: HardhatEthersSigner,
  core: Core,
  token: MockERC20 | MockERC20WithFee,
  permit2Signature: { eip712: any; signer: string; signature: Uint8Array<ArrayBufferLike> | string },
  recipient: HardhatEthersSigner,
  transactionId: Uint8Array
) => {
  const eip712 = {
    domain: {
      name: 'Core',
      version: '1',
      chainId: (await ethers.provider.getNetwork()).chainId,
      verifyingContract: await core.getAddress()
    },
    types: {
      Permit2Payment: [
        { name: 'permit', type: 'PermitSingle' },
        { name: 'transferDetails', type: 'TransferDetails' },
        { name: 'signer', type: 'address' },
        { name: 'signature', type: 'bytes' },
        { name: 'transactionId', type: 'bytes32' }
      ],
      PermitSingle: [
        { name: 'details', type: 'PermitDetails' },
        { name: 'spender', type: 'address' },
        { name: 'sigDeadline', type: 'uint256' }
      ],
      PermitDetails: [
        { name: 'token', type: 'address' },
        { name: 'amount', type: 'uint160' },
        { name: 'expiration', type: 'uint48' },
        { name: 'nonce', type: 'uint48' }
      ],
      TransferDetails: [
        { name: 'to', type: 'address' },
        { name: 'requestedAmount', type: 'uint160' }
      ]
    },
    message: {
      permit: {
        details: {
          token: await token.getAddress(),
          amount: permit2Signature.eip712.message.details.amount,
          expiration: permit2Signature.eip712.message.details.expiration,
          nonce: permit2Signature.eip712.message.details.nonce
        },
        spender: permit2Signature.eip712.message.spender,
        sigDeadline: permit2Signature.eip712.message.sigDeadline
      },
      transferDetails: {
        to: recipient.address,
        requestedAmount: permit2Signature.eip712.message.details.amount
      },
      signer: permit2Signature.signer,
      signature: permit2Signature.signature,
      transactionId: transactionId
    }
  };
  const signature = await requestSigner.signTypedData(eip712.domain, eip712.types, eip712.message);
  return { eip712, signature: signature };
};
