import { ethers } from 'hardhat';
import { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers';
import { MockERC20Permit, MockERC20PermitWithFee, Core } from '../../../typechain-types';
import { Signature } from 'ethers';

/**
 * Creates a valid EIP-2612 permit object and signature.
 *
 * @param owner
 * @param token
 * @param spender
 * @param value
 * @param deadline
 * @returns
 */
export const createEIP2616Signature = async (
  owner: HardhatEthersSigner,
  token: MockERC20Permit | MockERC20PermitWithFee,
  spender: Core,
  value: bigint,
  deadline: number,
  mockSignature = false
) => {
  const eip712 = {
    domain: {
      name: await token.name(),
      version: '1',
      chainId: (await ethers.provider.getNetwork()).chainId,
      verifyingContract: await token.getAddress()
    },
    types: {
      Permit: [
        { name: 'owner', type: 'address' },
        { name: 'spender', type: 'address' },
        { name: 'value', type: 'uint256' },
        { name: 'nonce', type: 'uint256' },
        { name: 'deadline', type: 'uint256' }
      ]
    },
    message: {
      owner: owner.address,
      spender: await spender.getAddress(),
      value: value,
      nonce: await token.nonces(owner.address),
      deadline: deadline
    }
  };
  const signature = await owner.signTypedData(eip712.domain, eip712.types, eip712.message);
  const { v, r, s } = ethers.Signature.from(signature);
  const _signature = mockSignature ? { v: 27, r: ethers.randomBytes(32), s: ethers.randomBytes(32) } : { v, r, s };
  return { eip712, signer: owner.address, signature: _signature };
};

/**
 * Creates a valid EIP-2612 request object and signature.
 *
 * @param requestSigner
 * @param core
 * @param token
 * @param eip2616Signature
 * @param recipient
 * @returns
 */
export const createEIP2616RequestSignature = async (
  requestSigner: HardhatEthersSigner,
  core: Core,
  token: MockERC20Permit | MockERC20PermitWithFee,
  eip2616Signature: {
    eip712: any;
    signer: string;
    signature: {
      v: number;
      r: Uint8Array<ArrayBufferLike> | string;
      s: Uint8Array<ArrayBufferLike> | string;
    };
  },
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
      EIP2612Payment: [
        { name: 'permit', type: 'EIP2612Permit' },
        { name: 'transferDetails', type: 'TransferDetails' },
        { name: 'signer', type: 'address' },
        { name: 'transactionId', type: 'bytes32' }
      ],
      EIP2612Permit: [
        { name: 'permitted', type: 'EIP2612Permitted' },
        { name: 'signature', type: 'EIP2612Signature' }
      ],
      EIP2612Permitted: [
        { name: 'token', type: 'address' },
        { name: 'spender', type: 'address' },
        { name: 'value', type: 'uint256' },
        { name: 'deadline', type: 'uint256' }
      ],
      EIP2612Signature: [
        { name: 'v', type: 'uint8' },
        { name: 'r', type: 'bytes32' },
        { name: 's', type: 'bytes32' }
      ],
      TransferDetails: [
        { name: 'to', type: 'address' },
        { name: 'requestedAmount', type: 'uint160' }
      ]
    },
    message: {
      permit: {
        permitted: {
          token: await token.getAddress(),
          spender: eip2616Signature.eip712.message.spender,
          value: eip2616Signature.eip712.message.value,
          deadline: eip2616Signature.eip712.message.deadline
        },
        signature: {
          v: eip2616Signature.signature.v,
          r: eip2616Signature.signature.r,
          s: eip2616Signature.signature.s
        }
      },
      transferDetails: {
        to: recipient.address,
        requestedAmount: eip2616Signature.eip712.message.value
      },
      signer: eip2616Signature.signer,
      transactionId: transactionId
    }
  };
  const signature = await requestSigner.signTypedData(eip712.domain, eip712.types, eip712.message);
  return { eip712, signature: signature };
};
