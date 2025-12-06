import { expect } from 'chai';
import { ethers } from 'hardhat';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { deployFixture } from './utils/helpers';

describe('Token Management', function () {
  describe('Should add, remove, and update tokens', function () {
    it('addToken', async function () {
      const { core, owner1, token4 } = await loadFixture(deployFixture);
      const newToken = {
        token: await token4.getAddress(),
        minAmount: ethers.parseUnits('25', 18),
        maxAmount: ethers.parseUnits('15000', 18),
        supported: true
      };
      await expect(core.connect(owner1).addToken(newToken)).to.emit(core, 'TokenAdded').withArgs(newToken.token);
      const token = await core.tokenRegistry(newToken.token);
      expect(token.supported).to.be.true;
      expect(token.minAmount).to.equal(newToken.minAmount);
      expect(token.maxAmount).to.equal(newToken.maxAmount);
    });

    it('removeToken', async function () {
      const { core, owner1, token1 } = await loadFixture(deployFixture);
      await expect(core.connect(owner1).removeToken(await token1.getAddress()))
        .to.emit(core, 'TokenRemoved')
        .withArgs(await token1.getAddress());
      const token = await core.tokenRegistry(await token1.getAddress());
      expect(token.supported).to.be.false;
      expect(token.minAmount).to.equal(0);
      expect(token.maxAmount).to.equal(0);
    });

    it('updateToken', async function () {
      const { core, owner1, token1, token2 } = await loadFixture(deployFixture);
      const updates = [
        {
          token: await token1.getAddress(),
          minAmount: ethers.parseUnits('2', 18),
          maxAmount: ethers.parseUnits('2000', 18)
        },
        {
          token: await token2.getAddress(),
          minAmount: ethers.parseUnits('20', 18),
          maxAmount: ethers.parseUnits('20000', 18)
        }
      ];
      await expect(core.connect(owner1).updateToken(updates))
        .to.emit(core, 'TokenUpdated')
        .withArgs(await token1.getAddress())
        .and.to.emit(core, 'TokenUpdated')
        .withArgs(await token2.getAddress());
      const updatedToken1 = await core.tokenRegistry(await token1.getAddress());
      expect(updatedToken1.minAmount).to.equal(updates[0].minAmount);
      expect(updatedToken1.maxAmount).to.equal(updates[0].maxAmount);
    });
  });

  describe('Should revert when', function () {
    it('adding duplicate token', async function () {
      const { core, owner1, token1 } = await loadFixture(deployFixture);
      const duplicateToken = {
        token: await token1.getAddress(),
        minAmount: ethers.parseUnits('1', 18),
        maxAmount: ethers.parseUnits('1000', 18),
        supported: true
      };
      await expect(core.connect(owner1).addToken(duplicateToken)).to.be.revertedWith('token already supported');
    });

    it('removing non-existent token', async function () {
      const { core, owner1 } = await loadFixture(deployFixture);
      const token = '0xdac17f958d2ee523a2206206994597c13d831ec7';
      await expect(core.connect(owner1).removeToken(token)).to.be.revertedWith('token not supported');
    });

    it('adding zero address token', async function () {
      const { core, owner1 } = await loadFixture(deployFixture);
      const zeroToken = {
        token: ethers.ZeroAddress,
        minAmount: ethers.parseUnits('1', 18),
        maxAmount: ethers.parseUnits('1000', 18),
        supported: true
      };
      await expect(core.connect(owner1).addToken(zeroToken)).to.be.revertedWith('token cannot be address zero');
    });

    it('minAmount > maxAmount in update', async function () {
      const { core, owner1, token1 } = await loadFixture(deployFixture);
      const invalidUpdate = [
        {
          token: await token1.getAddress(),
          minAmount: ethers.parseUnits('1000', 18),
          maxAmount: ethers.parseUnits('100', 18)
        }
      ];
      await expect(core.connect(owner1).updateToken(invalidUpdate)).to.be.revertedWith(
        'minAmount cannot be greater than maxAmount'
      );
    });
  });
});
