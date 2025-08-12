import { expect } from 'chai';
import { ethers } from 'hardhat';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { deployFixture } from './utils/helpers';
import { createEIP2616RequestSignature, createEIP2616Signature } from './utils/signing/eip2616';

describe('Blacklisting', function () {
  describe('Should blacklist and unblacklist users', function () {
    it('blacklist', async function () {
      const { core, owner1, user1, user2 } = await loadFixture(deployFixture);
      await expect(core.connect(owner1).blacklist([user1.address, user2.address]))
        .to.emit(core, 'Blacklisted')
        .withArgs(user1.address)
        .and.to.emit(core, 'Blacklisted')
        .withArgs(user2.address);
      expect(await core.blacklistRegistry(user1.address)).to.be.true;
      expect(await core.blacklistRegistry(user2.address)).to.be.true;
    });

    it('unblacklist', async function () {
      const { core, owner1, user1, user2 } = await loadFixture(deployFixture);
      await core.connect(owner1).blacklist([user1.address, user2.address]);
      await expect(core.connect(owner1).unBlacklist(user1.address))
        .to.emit(core, 'UnBlacklisted')
        .withArgs(user1.address);
      await expect(core.connect(owner1).unBlacklist(user2.address))
        .to.emit(core, 'UnBlacklisted')
        .withArgs(user2.address);
      expect(await core.blacklistRegistry(user1.address)).to.be.false;
      expect(await core.blacklistRegistry(user2.address)).to.be.false;
    });
  });

  describe('Should not emit event when blacklisting already blacklisted user', function () {
    it('blacklist', async function () {
      const { core, owner1, user1 } = await loadFixture(deployFixture);
      await core.connect(owner1).blacklist([user1.address]);
      const tx = await core.connect(owner1).blacklist([user1.address]);
      const receipt = await tx.wait();
      const blacklistedEvents = receipt?.logs.filter((log) => {
        try {
          const parsed = core.interface.parseLog(log);
          return parsed?.name === 'Blacklisted';
        } catch {
          return false;
        }
      });
      expect(blacklistedEvents).to.have.length(0);
    });
  });

  describe('Should prevent blacklisted users from making payments', function () {
    it('payWithPermit', async function () {
      const { core, owner1, user1, token2, recipient1, relayer1 } = await loadFixture(deployFixture);
      await core.connect(owner1).blacklist([user1.address]);
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
      ).to.be.revertedWith('user is blacklisted');
    });

    it('payWithPermit2', async function () {
      const { core, owner1, user1, token1, recipient1 } = await loadFixture(deployFixture);
      await core.connect(owner1).blacklist([user1.address]);
    });
  });
});
