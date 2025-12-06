import { expect } from 'chai';
import { ethers } from 'hardhat';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { calculateNamespacedTxId, deployFixture } from './utils/helpers';
import { createEIP2616Signature, createEIP2616RequestSignature } from './utils/signing/eip2616';
import { createPermit2Signature, createPermit2RequestSignature } from './utils/signing/permit2';

describe('Payments', function () {
  describe('payWithPermit', function () {
    it('Should make payment (1 = gasless)', async function () {
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
        .withArgs(user1, await token2.getAddress(), amount, namespacedTransactionId);
    });

    it('Should make payment (2 = direct / gas)', async function () {
      const { core, recipient1, user1, token2 } = await loadFixture(deployFixture);
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
        core.connect(user1).payWithPermit(eip2616RequestSignature.eip712.message, eip2616RequestSignature.signature, 2)
      )
        .to.emit(core, 'Paid')
        .withArgs(user1, await token2.getAddress(), amount, namespacedTransactionId);
    });

    it('Should make payment (3 = unknown request type)', async function () {
      const { core, recipient1, user1, token2 } = await loadFixture(deployFixture);
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
      await expect(
        core.connect(user1).payWithPermit(eip2616RequestSignature.eip712.message, eip2616RequestSignature.signature, 3)
      ).to.be.revertedWith('invalid request type');
    });

    describe('Should make payment (handles frontrun by attacker and falls back to allowance to prevent DoS)', async function () {
      it('relayer (1 = gasless)', async function () {
        const { core, recipient1, user1, token2, relayer1, attacker } = await loadFixture(deployFixture);
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
        const { owner, spender, value } = eip2616Signature.eip712.message;
        const { v, r, s } = eip2616Signature.signature;
        // attacker frontruns this transaction, either before it is broadcasted or while it is in the mempool.
        await token2.connect(attacker).permit(owner, spender, value, deadline, v, r, s);
        await expect(
          core
            .connect(relayer1)
            .payWithPermit(eip2616RequestSignature.eip712.message, eip2616RequestSignature.signature, 1)
        )
          .to.emit(core, 'Paid')
          .withArgs(user1, await token2.getAddress(), amount, namespacedTransactionId);
      });

      it('user (2 = direct / gas)', async function () {
        const { core, recipient1, user1, token2, attacker } = await loadFixture(deployFixture);
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
        const { owner, spender, value } = eip2616Signature.eip712.message;
        const { v, r, s } = eip2616Signature.signature;
        // attacker frontruns this transaction, either before it is broadcasted or while it is in the mempool.
        await token2.connect(attacker).permit(owner, spender, value, deadline, v, r, s);
        await expect(
          core
            .connect(user1)
            .payWithPermit(eip2616RequestSignature.eip712.message, eip2616RequestSignature.signature, 2)
        )
          .to.emit(core, 'Paid')
          .withArgs(user1, await token2.getAddress(), amount, namespacedTransactionId);
      });
    });

    describe('Should make payment (invalid signature [causing revert])', async function () {
      it('relayer (1 = gasless)', async function () {
        const { core, recipient1, user1, token2, relayer1 } = await loadFixture(deployFixture);
        const transactionId = ethers.randomBytes(32);
        const amount = ethers.parseUnits('100', 18);
        const deadline = Math.floor(Date.now() / 1000) + 3600;
        const eip2616Signature = await createEIP2616Signature(user1, token2, core, amount, deadline, true); // mock fake signature
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
        ).to.be.revertedWith('permit failed');
      });

      it('user (2 = direct / gas)', async function () {
        const { core, recipient1, user1, token2 } = await loadFixture(deployFixture);
        const transactionId = ethers.randomBytes(32);
        const amount = ethers.parseUnits('100', 18);
        const deadline = Math.floor(Date.now() / 1000) + 3600;
        const eip2616Signature = await createEIP2616Signature(user1, token2, core, amount, deadline, true); // mock fake signature
        const eip2616RequestSignature = await createEIP2616RequestSignature(
          user1,
          core,
          token2,
          eip2616Signature,
          recipient1,
          transactionId
        );
        await expect(
          core
            .connect(user1)
            .payWithPermit(eip2616RequestSignature.eip712.message, eip2616RequestSignature.signature, 2)
        ).to.be.revertedWith('permit failed');
      });
    });
  });

  describe('payWithPermit2', function () {
    it('Should make payment (1 = gasless)', async function () {
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
        .withArgs(user1, await token1.getAddress(), amount, namespacedTransactionId);
    });

    it('Should make payment (2 = direct / gas)', async function () {
      const { core, recipient1, user1, token1, permit2 } = await loadFixture(deployFixture);
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
        core.connect(user1).payWithPermit2(permit2RequestSignature.eip712.message, permit2RequestSignature.signature, 2)
      )
        .to.emit(core, 'Paid')
        .withArgs(user1, await token1.getAddress(), amount, namespacedTransactionId);
    });

    it('Should make payment (5 = unknown request type)', async function () {
      const { core, recipient1, user1, token1, permit2 } = await loadFixture(deployFixture);
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
      await expect(
        core.connect(user1).payWithPermit2(permit2RequestSignature.eip712.message, permit2RequestSignature.signature, 5)
      ).to.be.revertedWith('invalid request type');
    });

    describe('Should make payment (handles frontrun by attacker and falls back to allowance to prevent DoS)', async function () {
      it('relayer (1 = gasless)', async function () {
        const { core, recipient1, user1, token1, relayer1, permit2, attacker } = await loadFixture(deployFixture);
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
        const { permit } = permit2RequestSignature.eip712.message;
        // attacker frontruns this transaction, either before it is broadcasted or while it is in the mempool.
        await permit2
          .connect(attacker)
          ['permit(address,((address,uint160,uint48,uint48),address,uint256),bytes)'](
            user1.address,
            permit,
            permit2Signature.signature
          );
        await expect(
          core
            .connect(relayer1)
            .payWithPermit2(permit2RequestSignature.eip712.message, permit2RequestSignature.signature, 1)
        )
          .to.emit(core, 'Paid')
          .withArgs(user1, await token1.getAddress(), amount, namespacedTransactionId);
      });

      it('user (2 = direct / gas)', async function () {
        const { core, recipient1, user1, token1, permit2, attacker } = await loadFixture(deployFixture);
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
        const { permit } = permit2RequestSignature.eip712.message;
        // attacker frontruns this transaction, either before it is broadcasted or while it is in the mempool.
        await permit2
          .connect(attacker)
          ['permit(address,((address,uint160,uint48,uint48),address,uint256),bytes)'](
            user1.address,
            permit,
            permit2Signature.signature
          );
        await expect(
          core
            .connect(user1)
            .payWithPermit2(permit2RequestSignature.eip712.message, permit2RequestSignature.signature, 2)
        )
          .to.emit(core, 'Paid')
          .withArgs(user1, await token1.getAddress(), amount, namespacedTransactionId);
      });
    });

    describe('Should make payment (invalid signature [causing revert])', async function () {
      it('relayer (1 = gasless)', async function () {
        const { core, recipient1, user1, token1, relayer1, permit2 } = await loadFixture(deployFixture);
        await token1.connect(user1).approve(await permit2.getAddress(), ethers.MaxUint256);
        const transactionId = ethers.randomBytes(32);
        const amount = ethers.parseUnits('100', 18);
        const deadline = Math.floor(Date.now() / 1000) + 3600;
        const permit2Signature = await createPermit2Signature(user1, permit2, token1, core, amount, deadline, true);
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
        ).to.be.revertedWith('permit2 failed');
      });

      it('user (2 = direct / gas)', async function () {
        const { core, recipient1, user1, token1, permit2 } = await loadFixture(deployFixture);
        await token1.connect(user1).approve(await permit2.getAddress(), ethers.MaxUint256);
        const transactionId = ethers.randomBytes(32);
        const amount = ethers.parseUnits('100', 18);
        const deadline = Math.floor(Date.now() / 1000) + 3600;
        const permit2Signature = await createPermit2Signature(user1, permit2, token1, core, amount, deadline, true);
        const permit2RequestSignature = await createPermit2RequestSignature(
          user1,
          core,
          token1,
          permit2Signature,
          recipient1,
          transactionId
        );
        await expect(
          core
            .connect(user1)
            .payWithPermit2(permit2RequestSignature.eip712.message, permit2RequestSignature.signature, 2)
        ).to.be.revertedWith('permit2 failed');
      });
    });
  });
});
