import { ethers } from 'hardhat';
import { deployment } from './deployment';

/**
 * Get deployment data and constructor arguments
 * See CreateX: https://createx.rocks/deployments
 */
export const deployViaCreateX = async () => {
  const { data } = await deployment();
  const createXFactory = '0xba5Ed099633D3B313e4D5F7bdc1305d3c28ba5Ed';
  const createXABI = [
    {
      inputs: [{ internalType: 'bytes', name: 'initCode', type: 'bytes' }],
      name: 'deployCreate',
      outputs: [{ internalType: 'address', name: 'newContract', type: 'address' }],
      stateMutability: 'payable',
      type: 'function'
    },
    {
      inputs: [
        { internalType: 'bytes32', name: 'salt', type: 'bytes32' },
        { internalType: 'bytes', name: 'initCode', type: 'bytes' }
      ],
      name: 'deployCreate2',
      outputs: [{ internalType: 'address', name: 'newContract', type: 'address' }],
      stateMutability: 'payable',
      type: 'function'
    },
    {
      inputs: [{ internalType: 'bytes', name: 'initCode', type: 'bytes' }],
      name: 'deployCreate2',
      outputs: [{ internalType: 'address', name: 'newContract', type: 'address' }],
      stateMutability: 'payable',
      type: 'function'
    }
  ];
  const iface = new ethers.Interface(createXABI);
  const encodedData = iface.encodeFunctionData('deployCreate', [data]);
  return {
    to: createXFactory,
    data: encodedData
  };
};
