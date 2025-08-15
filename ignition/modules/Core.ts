import { buildModule } from '@nomicfoundation/hardhat-ignition/modules';
import { ethers } from 'hardhat';

const CoreModule = buildModule('CoreModule', (instance) => {
  const core = instance.contract('Core', [
    [
      {
        token: '0x5Bc72e927B8E9d7D4785474bC4dB6CF2615f3f79',
        minAmount: ethers.parseUnits('0.5', 6),
        maxAmount: ethers.parseUnits('1000', 6)
      },
      {
        token: '0x3d4E32d10E3BDae808551E0205B46Aa8543D2EB7',
        minAmount: ethers.parseUnits('0.5', 6),
        maxAmount: ethers.parseUnits('1000', 6)
      },
      {
        token: '0x7adC5d6a00d6b18BB7f95f0E7dD9d102b02e1E49',
        minAmount: ethers.parseUnits('0.5', 6),
        maxAmount: ethers.parseUnits('1000', 6)
      }
    ],
    ['0xf51ecc190b29816fb2ab710615837c67b1e70a5e'],
    '0x000000000022D473030F116dDEE9F6B43aC78BA3',
    '0x4077f2b63aDd0BE9D1e332a26c15D2Decf1C3792',
    '0x8FccCF3CFaF5772F6F6380044D40763567e80B4c'
  ]);
  return { core };
});

export default CoreModule;
