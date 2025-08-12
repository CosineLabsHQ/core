import { expect } from 'chai';
import { ethers } from 'hardhat';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { deployFixture } from './utils/helpers';

describe('Access Control', function () {
  describe('Should restrict owner functions to owner only', function () {
    it('pause/unpause', async function () {
      const { core, user1, user2 } = await loadFixture(deployFixture);
      await expect(core.connect(user1).pause()).to.be.revertedWithCustomError(core, 'OwnableUnauthorizedAccount');
      await expect(core.connect(user2).unpause()).to.be.revertedWithCustomError(core, 'OwnableUnauthorizedAccount');
    });

    it('addRelayer/removeRelayer', async function () {
      const { core, user1, relayer1, relayer2 } = await loadFixture(deployFixture);
      await expect(core.connect(user1).addRelayer(relayer2.address)).to.be.revertedWithCustomError(
        core,
        'OwnableUnauthorizedAccount'
      );
      await expect(core.connect(user1).removeRelayer(relayer1)).to.be.revertedWithCustomError(
        core,
        'OwnableUnauthorizedAccount'
      );
    });

    it('setRecipient', async function () {
      const { core, user1, user2 } = await loadFixture(deployFixture);
      await expect(core.connect(user1).setRecipient(user2.address)).to.be.revertedWithCustomError(
        core,
        'OwnableUnauthorizedAccount'
      );
    });

    it('blacklist/unBlacklist', async function () {
      const { core, user1, user2 } = await loadFixture(deployFixture);
      await expect(core.connect(user1).blacklist([user2.address])).to.be.revertedWithCustomError(
        core,
        'OwnableUnauthorizedAccount'
      );
      await expect(core.connect(user1).unBlacklist(user2.address)).to.be.revertedWithCustomError(
        core,
        'OwnableUnauthorizedAccount'
      );
    });

    it('addToken/removeToken/updateToken', async function () {
      const { core, user1, tokens } = await loadFixture(deployFixture);
      await expect(core.connect(user1).addToken(tokens[0])).to.be.revertedWithCustomError(
        core,
        'OwnableUnauthorizedAccount'
      );
      await expect(core.connect(user1).removeToken(tokens[0].token)).to.be.revertedWithCustomError(
        core,
        'OwnableUnauthorizedAccount'
      );
      await expect(
        core.connect(user1).updateToken([
          {
            token: tokens[0].token,
            minAmount: ethers.parseUnits('1000', 18),
            maxAmount: ethers.parseUnits('5000', 18)
          }
        ])
      ).to.be.revertedWithCustomError(core, 'OwnableUnauthorizedAccount');
    });
  });

  describe('Should restrict owner functions to owner only', function () {
    it('refund', async function () {
      const { core, user1 } = await loadFixture(deployFixture);
      const txId = ethers.randomBytes(32);
      await expect(core.connect(user1).refund(user1, txId)).to.be.revertedWith('not relayer');
    });
  });
});
