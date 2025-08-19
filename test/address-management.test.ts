import { expect } from 'chai';
import { ethers } from 'hardhat';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { deployFixture } from './utils/helpers';

describe('Address Management', function () {
  describe('Should add/remove relayer, and set new recipient and owner', function () {
    it('addRelayer', async function () {
      const { core, owner1, relayer2, relayers } = await loadFixture(deployFixture);
      expect(await core.connect(owner1).relayers(0)).to.be.eq(relayers[0]);
      await expect(core.connect(owner1).addRelayer(relayer2)).to.emit(core, 'RelayerAdded').withArgs(relayer2);
      expect(await core.connect(owner1).relayers(1)).to.be.eq(relayer2);
    });

    it('removeRelayer', async function () {
      const { core, owner1, relayer1, relayers } = await loadFixture(deployFixture);
      expect(await core.connect(owner1).relayers(0)).to.be.eq(relayers[0]);
      await expect(core.connect(owner1).removeRelayer(relayer1)).to.emit(core, 'RelayerRemoved').withArgs(relayer1);
    });

    it('setRecipient', async function () {
      const { core, owner1, recipient1, recipient2 } = await loadFixture(deployFixture);
      expect(await core.connect(owner1).recipient()).to.be.eq(recipient1);
      await expect(core.connect(owner1).setRecipient(recipient2))
        .to.emit(core, 'RecipientTransferred')
        .withArgs(recipient1, recipient2);
      expect(await core.connect(owner1).recipient()).to.be.eq(recipient2);
    });

    it('transferOwnership', async function () {
      const { core, owner1, owner2 } = await loadFixture(deployFixture);
      expect(await core.connect(owner1).owner()).to.be.eq(owner1);
      await expect(core.connect(owner1).transferOwnership(owner2))
        .to.emit(core, 'OwnershipTransferred')
        .withArgs(owner1, owner2);
      expect(await core.connect(owner1).owner()).to.be.eq(owner2);
    });

    it('renounceOwnership', async function () {
      const { core, owner1 } = await loadFixture(deployFixture);
      expect(await core.connect(owner1).owner()).to.be.eq(owner1);
      await expect(core.connect(owner1).renounceOwnership())
        .to.emit(core, 'OwnershipTransferred')
        .withArgs(owner1, ethers.ZeroAddress);
      expect(await core.connect(owner1).owner()).to.be.eq(ethers.ZeroAddress);
    });
  });

  describe('Should get tokens and relayers', function () {
    it('getTokens', async function () {
      const { core, user1, tokens } = await loadFixture(deployFixture);
      const expectedTokens = tokens.map((t) => [t.token, t.minAmount, t.maxAmount]);
      expect(await core.connect(user1).getTokens()).to.deep.equal(expectedTokens);
    });

    it('getRelayers', async function () {
      const { core, user1, relayers } = await loadFixture(deployFixture);
      expect(await core.connect(user1).getRelayers()).to.deep.equal(relayers);
    });
  });
});
