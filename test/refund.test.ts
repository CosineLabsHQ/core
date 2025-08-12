import { expect } from 'chai';
import { ethers } from 'hardhat';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { calculateNamespacedTxId, deployFixture } from './utils/helpers';
import { createEIP2616Signature, createEIP2616RequestSignature } from './utils/signing/eip2616';
import { createPermit2Signature, createPermit2RequestSignature } from './utils/signing/permit2';

describe('Refund', function () {
  describe('payWithPermit', function () {
    describe('Should make refund', function () {
      it('relayer (1 = gasless)', async function () {
        const { core, recipient1, user1, token2, relayer1 } = await loadFixture(deployFixture);
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
        const namespacedTransactionId = calculateNamespacedTxId(
          transactionId,
          user1.address,
          await core.getAddress(),
          (await ethers.provider.getNetwork()).chainId
        );
        await expect(
          core
            .connect(relayer1)
            .payWithPermit(eip2616RequestSignature.eip712.message, eip2616RequestSignature.signature, 1)
        )
          .to.emit(core, 'Paid')
          .withArgs(user1.address, await token2.getAddress(), amount, namespacedTransactionId);
        // after payment, the off-chain service delivery fails or becomes unavailable.
        // then, we refund
        await token2.connect(recipient1).approve(await core.getAddress(), ethers.MaxUint256);
        await expect(core.connect(relayer1).refund(user1.address, transactionId))
          .to.emit(core, 'Refunded')
          .withArgs(user1.address, await token2.getAddress(), amount, namespacedTransactionId);
      });

      it('user (2 = direct / gas)', async function () {
        const { core, recipient1, user1, token2, relayer1 } = await loadFixture(deployFixture);
        const transactionId = ethers.randomBytes(32);
        const amount = ethers.parseUnits('100', 18);
        const deadline = Math.floor(Date.now() / 1000) + 3600;
        const eip2616Signature = await createEIP2616Signature(user1, token2, core, amount, deadline);
        const eip2616RequestSignature = await createEIP2616RequestSignature(
          user1,
          core,
          token2,
          eip2616Signature,
          recipient1,
          transactionId
        );
        const namespacedTransactionId = calculateNamespacedTxId(
          transactionId,
          user1.address,
          await core.getAddress(),
          (await ethers.provider.getNetwork()).chainId
        );
        await expect(
          core
            .connect(user1)
            .payWithPermit(eip2616RequestSignature.eip712.message, eip2616RequestSignature.signature, 2)
        )
          .to.emit(core, 'Paid')
          .withArgs(user1.address, await token2.getAddress(), amount, namespacedTransactionId);
        // after payment, the off-chain service delivery fails or becomes unavailable.
        // then, we refund
        await token2.connect(recipient1).approve(await core.getAddress(), ethers.MaxUint256);
        await expect(core.connect(relayer1).refund(user1.address, transactionId))
          .to.emit(core, 'Refunded')
          .withArgs(user1.address, await token2.getAddress(), amount, namespacedTransactionId);
      });
    });
  });

  describe('payWithPermit2', function () {
    describe('Should make refund', function () {
      it('relayer (1 = gasless)', async function () {
        const { core, recipient1, user1, token1, relayer1, permit2 } = await loadFixture(deployFixture);
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
        const namespacedTransactionId = calculateNamespacedTxId(
          transactionId,
          user1.address,
          await core.getAddress(),
          (await ethers.provider.getNetwork()).chainId
        );
        await expect(
          core
            .connect(relayer1)
            .payWithPermit2(permit2RequestSignature.eip712.message, permit2RequestSignature.signature, 1)
        )
          .to.emit(core, 'Paid')
          .withArgs(user1.address, await token1.getAddress(), amount, namespacedTransactionId);
        // after payment, the off-chain service delivery fails or becomes unavailable.
        // then, we refund
        await token1.connect(recipient1).approve(await core.getAddress(), ethers.MaxUint256);
        await expect(core.connect(relayer1).refund(user1.address, transactionId))
          .to.emit(core, 'Refunded')
          .withArgs(user1.address, await token1.getAddress(), amount, namespacedTransactionId);
      });

      it('user (2 = direct / gas)', async function () {
        const { core, recipient1, user1, token1, permit2, relayer1 } = await loadFixture(deployFixture);
        await token1.connect(user1).approve(await permit2.getAddress(), ethers.MaxUint256);
        const transactionId = ethers.randomBytes(32);
        const amount = ethers.parseUnits('100', 18);
        const deadline = Math.floor(Date.now() / 1000) + 3600;
        const permit2Signature = await createPermit2Signature(user1, permit2, token1, core, amount, deadline);
        const permit2RequestSignature = await createPermit2RequestSignature(
          user1,
          core,
          token1,
          permit2Signature,
          recipient1,
          transactionId
        );
        const namespacedTransactionId = calculateNamespacedTxId(
          transactionId,
          user1.address,
          await core.getAddress(),
          (await ethers.provider.getNetwork()).chainId
        );
        await expect(
          core
            .connect(user1)
            .payWithPermit2(permit2RequestSignature.eip712.message, permit2RequestSignature.signature, 2)
        )
          .to.emit(core, 'Paid')
          .withArgs(user1.address, await token1.getAddress(), amount, namespacedTransactionId);
        // after payment, the off-chain service delivery fails or becomes unavailable.
        // then, we refund
        await token1.connect(recipient1).approve(await core.getAddress(), ethers.MaxUint256);
        await expect(core.connect(relayer1).refund(user1.address, transactionId))
          .to.emit(core, 'Refunded')
          .withArgs(user1.address, await token1.getAddress(), amount, namespacedTransactionId);
      });
    });
  });
});
