import { expect } from 'chai';
import { ethers } from 'hardhat';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { deployFixture } from './utils/helpers';
import { createEIP2616Signature, createEIP2616RequestSignature } from './utils/signing/eip2616';
import { createPermit2Signature, createPermit2RequestSignature } from './utils/signing/permit2';

describe('Pausability', function () {
  describe('Should pause and unpause', function () {
    it('pause', async function () {
      const { core, owner1 } = await loadFixture(deployFixture);
      await core.connect(owner1).pause();
      expect(await core.paused()).to.be.true;
    });

    it('unpause', async function () {
      const { core, owner1 } = await loadFixture(deployFixture);
      await core.connect(owner1).pause();
      await core.connect(owner1).unpause();
      expect(await core.paused()).to.be.false;
    });
  });

  describe('Should prevent payment functions when paused', function () {
    it('payWithPermit', async function () {
      const { core, owner1, recipient1, user1, token2, relayer1 } = await loadFixture(deployFixture);
      await core.connect(owner1).pause();
      const transactionId = ethers.randomBytes(32);
      const amount = ethers.parseUnits('100', 18);
      const deadline = Math.floor(Date.now() / 1000) + 3600;
      const eip2616Signature = await createEIP2616Signature(user1, token2, core, amount, deadline);
      const eip2616RequestSignature = await createEIP2616RequestSignature(
        relayer1,
        core,
        token2,
        eip2616Signature,
        recipient1,
        transactionId
      );
      await expect(
        core
          .connect(relayer1)
          .payWithPermit(eip2616RequestSignature.eip712.message, eip2616RequestSignature.signature, 1)
      ).to.be.revertedWithCustomError(core, 'EnforcedPause');
    });

    it('payWithPermit2', async function () {
      const { core, owner1, recipient1, user1, token1, relayer1, permit2 } = await loadFixture(deployFixture);
      await core.connect(owner1).pause();
      await token1.connect(user1).approve(await permit2.getAddress(), ethers.MaxUint256);
      const transactionId = ethers.randomBytes(32);
      const amount = ethers.parseUnits('100', 18);
      const deadline = Math.floor(Date.now() / 1000) + 3600;
      const permit2Signature = await createPermit2Signature(user1, permit2, token1, core, amount, deadline);
      const permit2RequestSignature = await createPermit2RequestSignature(
        relayer1,
        core,
        token1,
        permit2Signature,
        recipient1,
        transactionId
      );
      await expect(
        core
          .connect(relayer1)
          .payWithPermit2(permit2RequestSignature.eip712.message, permit2RequestSignature.signature, 1)
      ).to.be.revertedWithCustomError(core, 'EnforcedPause');
    });
  });
});
