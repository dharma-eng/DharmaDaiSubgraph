import {
  DharmaDai,
  Transfer as TransferEvent,
  Approval as ApprovalEvent,
  Mint as MintEvent,
  Redeem as RedeemEvent,
  Accrue as AccrueEvent,
  CollectSurplus as CollectSurplusEvent,
} from '../generated/DharmaDai/DharmaDai';
import {
  DharmaDaiSummarizer,
} from '../generated/DharmaDaiSummarizer/DharmaDaiSummarizer';
import {
  Transfer,
  Approval,
  Mint,
  Redeem,
  Accrue,
  CollectSurplus,
  Checkpoint,
  Account,
  Allowance,
} from '../generated/schema';
import { BigInt, BigDecimal, ByteArray, Bytes, Address, log, EthereumBlock } from '@graphprotocol/graph-ts';

let eightDecimals = BigDecimal.fromString("100000000");
let eighteenDecimals = BigDecimal.fromString("1000000000000000000");
let twentyEightDecimals = BigDecimal.fromString("10000000000000000000000000000");

function basicCheckpoint(block: EthereumBlock): void {
  let contract = DharmaDai.bind(Address.fromString(
    "0x00000000001876eB1444c986fD502e618c587430"
  ));
  let entity = Checkpoint.load(block.number.toString());
  if (entity === null) {
    let lastEntity = Checkpoint.load((block.number.minus(BigInt.fromI32(1))).toString());
    if (lastEntity === null) {
      checkpoint(block);
    } else {
      entity = new Checkpoint(block.number.toString())

      if ((block.number).toI32() > 9498304) {
        let summarizer = DharmaDaiSummarizer.bind(Address.fromString(
          "0x45a59cF7985817036A500cb77707137AF7a5B429"
        ));

        let summary = summarizer.brieflySummarizeAsArray();
        entity.exchangeRate = (summary[0].toBigDecimal()).div(twentyEightDecimals);
        entity.supplyRatePerBlock = (summary[1].toBigDecimal()).div(eighteenDecimals);
        entity.currentDaiSurplus = (summary[2].toBigDecimal()).div(eighteenDecimals);        
      } else {
        entity.exchangeRate = (contract.exchangeRateCurrent().toBigDecimal()).div(twentyEightDecimals);
        entity.supplyRatePerBlock = (contract.supplyRatePerBlock().toBigDecimal()).div(eighteenDecimals);
        entity.currentDaiSurplus = (contract.getSurplusUnderlying().toBigDecimal()).div(eighteenDecimals);
      }

      entity.totalSupply = lastEntity.totalSupply;
      entity.totalSupplyUnderlying = ((entity.totalSupply).times(entity.exchangeRate)).truncate(18);
      
      entity.spreadPerBlock = ((entity.supplyRatePerBlock).div(BigDecimal.fromString("9"))).truncate(18); // approx.
      entity.currentCDaiSurplus = ((entity.currentDaiSurplus).div(entity.exchangeRate)).truncate(8);

      entity.version = lastEntity.version; // skip
      entity.lastAccrual = lastEntity.lastAccrual;
      entity.cumulativeCDaiSurplusPulled = lastEntity.cumulativeCDaiSurplusPulled;
      entity.cumulativeDaiSurplusPulled = lastEntity.cumulativeDaiSurplusPulled;
      entity.cumulativeMintedDai = lastEntity.cumulativeMintedDai;
      entity.cumulativeRedeemedDai = lastEntity.cumulativeRedeemedDai;
      entity.cumulativeTransferredDai = lastEntity.cumulativeTransferredDai;

      entity.mints = lastEntity.mints;
      entity.redeems = lastEntity.redeems;
      entity.transfers = lastEntity.transfers;
      entity.holders = lastEntity.holders;

      entity.cumulativeInterestEarned = (
        (
          (entity.totalSupplyUnderlying).plus(entity.cumulativeRedeemedDai)
        ).minus(entity.cumulativeMintedDai)
      ).truncate(18);

      entity.blockNumber = (block.number).toI32();
      entity.blockTime = (block.timestamp).toI32();
      entity.save()
    }
  }
}

function checkpoint(block: EthereumBlock): void {
  let contract = DharmaDai.bind(Address.fromString(
    "0x00000000001876eB1444c986fD502e618c587430"
  ));
  let entity = Checkpoint.load(block.number.toString());
  if (entity === null) {
    entity = new Checkpoint(block.number.toString())

    if ((block.number).toI32() > 9498304) {
      let summarizer = DharmaDaiSummarizer.bind(Address.fromString(
        "0x45a59cF7985817036A500cb77707137AF7a5B429"
      ));

      let summary = summarizer.summarizeAsArray();

      entity.version = summary[0].toI32();
      entity.totalSupply = (summary[1].toBigDecimal()).div(eightDecimals);
      entity.totalSupplyUnderlying = (summary[2].toBigDecimal()).div(eighteenDecimals);
      entity.exchangeRate = (summary[3].toBigDecimal()).div(twentyEightDecimals);
      entity.supplyRatePerBlock = (summary[4].toBigDecimal()).div(eighteenDecimals);
      entity.lastAccrual = summary[5].toI32();
      entity.spreadPerBlock = (summary[6].toBigDecimal()).div(eighteenDecimals);
      entity.currentCDaiSurplus = (summary[7].toBigDecimal()).div(eightDecimals);
      entity.currentDaiSurplus = (summary[8].toBigDecimal()).div(eighteenDecimals);   
    } else {
      entity.version = (contract.getVersion()).toI32();
      entity.totalSupply = (contract.totalSupply().toBigDecimal()).div(eightDecimals);
      entity.totalSupplyUnderlying = (contract.totalSupplyUnderlying().toBigDecimal()).div(eighteenDecimals);
      entity.exchangeRate = (contract.exchangeRateCurrent().toBigDecimal()).div(twentyEightDecimals);
      entity.supplyRatePerBlock = (contract.supplyRatePerBlock().toBigDecimal()).div(eighteenDecimals);
      entity.lastAccrual = (contract.accrualBlockNumber()).toI32();
      entity.spreadPerBlock = (contract.getSpreadPerBlock().toBigDecimal()).div(eighteenDecimals);
      entity.currentCDaiSurplus = (contract.getSurplus().toBigDecimal()).div(eightDecimals);
      entity.currentDaiSurplus = (contract.getSurplusUnderlying().toBigDecimal()).div(eighteenDecimals);
    }

    entity.blockNumber = (block.number).toI32();
    entity.blockTime = (block.timestamp).toI32();
    
    let lastEntity = Checkpoint.load((block.number.minus(BigInt.fromI32(1))).toString());
    if (lastEntity === null) {
      entity.cumulativeCDaiSurplusPulled = BigDecimal.fromString("0");
      entity.cumulativeDaiSurplusPulled = BigDecimal.fromString("0");
      entity.cumulativeMintedDai = BigDecimal.fromString("0");
      entity.cumulativeRedeemedDai = BigDecimal.fromString("0");
      entity.cumulativeTransferredDai = BigDecimal.fromString("0");
      entity.mints = 0;
      entity.redeems = 0;
      entity.transfers = 0;
      entity.holders = 0;
    } else {
      entity.cumulativeCDaiSurplusPulled = lastEntity.cumulativeCDaiSurplusPulled;
      entity.cumulativeDaiSurplusPulled = lastEntity.cumulativeDaiSurplusPulled;
      entity.cumulativeMintedDai = lastEntity.cumulativeMintedDai;
      entity.cumulativeRedeemedDai = lastEntity.cumulativeRedeemedDai;
      entity.cumulativeTransferredDai = lastEntity.cumulativeTransferredDai;
      entity.mints = lastEntity.mints;
      entity.redeems = lastEntity.redeems;
      entity.transfers = lastEntity.transfers;
      entity.holders = lastEntity.holders;
    }

    entity.cumulativeInterestEarned = (
      (
        (entity.totalSupplyUnderlying).plus(entity.cumulativeRedeemedDai)
      ).minus(entity.cumulativeMintedDai)
    ).truncate(18);

    entity.save()
  }
}

// Block Handlers
export function handleBlockOnCall(block: EthereumBlock): void {
  checkpoint(block);
}

export function handleBlock(block: EthereumBlock): void {
  basicCheckpoint(block);
}

// Event Handlers
export function handleTransfer(event: TransferEvent): void {
  let entity = new Transfer(
    event.transaction.hash.toHex() + '-' + event.logIndex.toString()
  );

  let contract = DharmaDai.bind(event.address);

  checkpoint(event.block);
  let blockEntity = Checkpoint.load(event.block.number.toString());

  let accountIn = Account.load(event.params.to.toHex());
  if (accountIn === null) {
    accountIn = new Account(event.params.to.toHex());
    accountIn.totalInterestEarned = BigDecimal.fromString("0");
    if (event.params.from.toHex() == "0x0000000000000000000000000000000000000000") {
      accountIn.totalDaiTransferredIn = BigDecimal.fromString("0");
      accountIn.numberOfTransfersIn = 0;
    } else {
      accountIn.totalDaiTransferredIn = (
        (event.params.value.toBigDecimal().div(eightDecimals)).times(blockEntity.exchangeRate)
      ).truncate(18);
      accountIn.numberOfTransfersIn = 1;
    }
    accountIn.totalDaiTransferredOut = BigDecimal.fromString("0");
    accountIn.totalMintedDai = BigDecimal.fromString("0");
    accountIn.totalRedeemedDai = BigDecimal.fromString("0");

    accountIn.numberOfMints = 0;
    accountIn.numberOfRedeems = 0;
    accountIn.numberOfTransfersOut = 0;

    accountIn.balance = BigDecimal.fromString("0");

  } else if (event.params.from.toHex() != "0x0000000000000000000000000000000000000000") {
    accountIn.totalDaiTransferredIn = (accountIn.totalDaiTransferredIn).plus(
      (
        (event.params.value.toBigDecimal().div(eightDecimals)).times(blockEntity.exchangeRate)
      ).truncate(18)
    );
    accountIn.numberOfTransfersIn = accountIn.numberOfTransfersIn + 1;
  }

  let oldBalanceIn = accountIn.balance;
  let newBalanceIn = ((contract.balanceOf(event.params.to)).toBigDecimal()).div(eightDecimals);
  if (
    oldBalanceIn.equals(BigDecimal.fromString("0")) &&
    newBalanceIn.gt(BigDecimal.fromString("0"))
  ) {
    blockEntity.holders = blockEntity.holders + 1;
    blockEntity.save();
  }
  accountIn.balance = newBalanceIn;

  accountIn.balanceUnderlying = (contract.balanceOfUnderlying(event.params.to).toBigDecimal()).div(eighteenDecimals);

  accountIn.totalInterestEarned = (
    (
      accountIn.balanceUnderlying.plus(
        accountIn.totalRedeemedDai.plus(accountIn.totalDaiTransferredOut)
      )
    ).minus(
      accountIn.totalMintedDai.plus(accountIn.totalDaiTransferredIn)
    )
  ).truncate(18);

  accountIn.lastAction = blockEntity.id;
  accountIn.save();

  let accountOut = Account.load(event.params.from.toHex());
  if (accountOut === null) {
    accountOut = new Account(event.params.from.toHex());
    accountOut.totalInterestEarned = BigDecimal.fromString("0");
    accountOut.totalDaiTransferredIn = BigDecimal.fromString("0");
    if (event.params.to.toHex() == "0x0000000000000000000000000000000000000000") {
      accountOut.totalDaiTransferredOut = BigDecimal.fromString("0");
      accountOut.numberOfTransfersOut = 0;
    } else {
      accountOut.totalDaiTransferredOut = (
        (event.params.value.toBigDecimal().div(eightDecimals)).times(blockEntity.exchangeRate)
      ).truncate(18);
      
      accountOut.numberOfTransfersOut = 1;
    }
    accountOut.totalMintedDai = BigDecimal.fromString("0");
    accountOut.totalRedeemedDai = BigDecimal.fromString("0");

    accountOut.numberOfMints = 0;
    accountOut.numberOfRedeems = 0;
    accountOut.numberOfTransfersIn = 0;

    accountOut.balance = BigDecimal.fromString("0");
  } else if (event.params.to.toHex() != "0x0000000000000000000000000000000000000000") {
    accountOut.totalDaiTransferredOut = (accountOut.totalDaiTransferredOut).plus(
      (
        (event.params.value.toBigDecimal().div(eightDecimals)).times(blockEntity.exchangeRate)
      ).truncate(18)
    );
    accountOut.numberOfTransfersOut = accountOut.numberOfTransfersOut + 1;
  }

  let oldBalanceOut = accountOut.balance;
  let newBalanceOut = ((contract.balanceOf(event.params.from)).toBigDecimal()).div(eightDecimals);
  if (
    oldBalanceOut.gt(BigDecimal.fromString("0")) &&
    newBalanceOut.equals(BigDecimal.fromString("0"))
  ) {
    blockEntity.holders = blockEntity.holders - 1;
    blockEntity.save();
  }
  accountOut.balance = newBalanceOut;

  accountOut.balanceUnderlying = (contract.balanceOfUnderlying(event.params.from).toBigDecimal()).div(eighteenDecimals);

  accountOut.totalInterestEarned = (
    (
      accountOut.balanceUnderlying.plus(
        accountOut.totalRedeemedDai.plus(accountOut.totalDaiTransferredOut)
      )
    ).minus(
      accountOut.totalMintedDai.plus(accountOut.totalDaiTransferredIn)
    )
  ).truncate(18);

  accountOut.lastAction = blockEntity.id;
  accountOut.save();

  entity.from = accountOut.id;
  entity.to = accountIn.id;
  entity.value = (event.params.value.toBigDecimal()).div(eightDecimals);
  entity.underlyingAmount = (
    ((event.params.value.toBigDecimal()).div(eightDecimals)).times(blockEntity.exchangeRate)
  ).truncate(18);

  if (
    event.params.from.toHex() != "0x0000000000000000000000000000000000000000" &&
    event.params.to.toHex() != "0x0000000000000000000000000000000000000000"
  ) {
    blockEntity.cumulativeTransferredDai = (blockEntity.cumulativeTransferredDai).plus(
      (
        (event.params.value.toBigDecimal().div(eightDecimals)).times(blockEntity.exchangeRate)
      ).truncate(18)
    );
    blockEntity.transfers = blockEntity.transfers + 1;
    blockEntity.save();
  }

  entity.at = blockEntity.id;
  entity.save();

  log.info(
    'tx {} => Transfer: from 0x{} to 0x{} => {} dDai ({} dai equivalent)',
    [
      event.transaction.hash.toHexString(),
      event.params.from.toHex().slice(2).padStart(40, '0'),
      event.params.to.toHex().slice(2).padStart(40, '0').toString(),
      entity.value.toString(),
      entity.underlyingAmount.toString(),
    ]
  );
}

export function handleApproval(event: ApprovalEvent): void {
  let entity = new Approval(
    event.transaction.hash.toHex() + '-' + event.logIndex.toString()
  );

  let contract = DharmaDai.bind(event.address);

  checkpoint(event.block);
  let blockEntity = Checkpoint.load(event.block.number.toString());

  let owner = Account.load(event.params.owner.toHex());
  if (owner === null) {
    owner = new Account(event.params.owner.toHex());
    owner.totalInterestEarned = BigDecimal.fromString("0");
    owner.totalDaiTransferredIn = BigDecimal.fromString("0");
    owner.totalDaiTransferredOut = BigDecimal.fromString("0");
    owner.totalMintedDai = BigDecimal.fromString("0");
    owner.totalRedeemedDai = BigDecimal.fromString("0");
    owner.numberOfMints = 0;
    owner.numberOfRedeems = 0;
    owner.numberOfTransfersIn = 0;
    owner.numberOfTransfersOut = 0;
    owner.balance = BigDecimal.fromString("0"); // set during transfer
    owner.balanceUnderlying = (contract.balanceOfUnderlying(event.params.owner).toBigDecimal()).div(eighteenDecimals);
    owner.lastAction = blockEntity.id;
    owner.save();
  }

  let spender = Account.load(event.params.spender.toHex());
  if (spender === null) {
    spender = new Account(event.params.spender.toHex());
    spender.totalInterestEarned = BigDecimal.fromString("0");
    spender.totalDaiTransferredIn = BigDecimal.fromString("0");
    spender.totalDaiTransferredOut = BigDecimal.fromString("0");
    spender.totalMintedDai = BigDecimal.fromString("0");
    spender.totalRedeemedDai = BigDecimal.fromString("0");
    spender.numberOfMints = 0;
    spender.numberOfRedeems = 0;
    spender.numberOfTransfersIn = 0;
    spender.numberOfTransfersOut = 0;
    spender.balance = BigDecimal.fromString("0"); // set during transfer
    spender.balanceUnderlying = (contract.balanceOfUnderlying(event.params.spender).toBigDecimal()).div(eighteenDecimals);
    spender.lastAction = blockEntity.id;
    spender.save();
  }

  entity.owner = owner.id;
  entity.spender = spender.id;
  entity.value = (event.params.value.toBigDecimal()).div(eightDecimals);

  let allowanceEntity = new Allowance(
    event.params.owner.toHex() + '-' + event.params.spender.toHex()
  );

  allowanceEntity.owner = owner.id;
  allowanceEntity.spender = spender.id;
  allowanceEntity.value = (event.params.value.toBigDecimal()).div(eightDecimals);

  entity.at = blockEntity.id;
  entity.save();

  log.info(
    'tx {} => Approve: owner 0x{} & spender 0x{} => {} dDai',
    [
      event.transaction.hash.toHexString(),
      event.params.owner.toHex().slice(2).padStart(40, '0'),
      event.params.spender.toHex().slice(2).padStart(40, '0'),
      entity.value.toString(),
    ]
  );
}

export function handleMint(event: MintEvent): void {
  let entity = new Mint(
    event.transaction.hash.toHex() + '-' + event.logIndex.toString()
  );

  checkpoint(event.block);
  let blockEntity = Checkpoint.load(event.block.number.toString());
  blockEntity.cumulativeMintedDai = blockEntity.cumulativeMintedDai.plus((event.params.mintAmount.toBigDecimal()).div(eighteenDecimals));
  blockEntity.mints = blockEntity.mints + 1;
  blockEntity.cumulativeInterestEarned = (
    (
      (blockEntity.totalSupplyUnderlying).plus(blockEntity.cumulativeRedeemedDai)
    ).minus(blockEntity.cumulativeMintedDai)
  ).truncate(18);

  blockEntity.save();

  let minter = Account.load(event.params.minter.toHex());
  if (minter === null) {
    let contract = DharmaDai.bind(event.address);
    minter = new Account(event.params.minter.toHex());
    minter.totalInterestEarned = BigDecimal.fromString("0");
    minter.totalDaiTransferredIn = BigDecimal.fromString("0");
    minter.totalDaiTransferredOut = BigDecimal.fromString("0");
    minter.totalMintedDai = (event.params.mintAmount.toBigDecimal()).div(eighteenDecimals);
    minter.totalRedeemedDai = BigDecimal.fromString("0");
    minter.numberOfMints = 1;
    minter.numberOfRedeems = 0;
    minter.numberOfTransfersIn = 0;
    minter.numberOfTransfersOut = 0;
    minter.balance = BigDecimal.fromString("0"); // set during transfer
    minter.balanceUnderlying = (contract.balanceOfUnderlying(event.params.minter).toBigDecimal()).div(eighteenDecimals);
    minter.lastAction = blockEntity.id;
  } else {
    minter.totalMintedDai = (minter.totalMintedDai).plus(
      (event.params.mintAmount.toBigDecimal().div(eighteenDecimals)).truncate(18)
    );
    minter.numberOfMints = minter.numberOfMints + 1;
  }
  minter.save();

  entity.minter = minter.id;
  entity.dai = (event.params.mintAmount.toBigDecimal()).div(eighteenDecimals);
  entity.dDai = (event.params.mintDTokens.toBigDecimal()).div(eightDecimals);

  entity.at = blockEntity.id;
  entity.save();

  log.info(
    'tx {} => Mint: minter 0x{} => {} dDai ({} dai equivalent)',
    [
      event.transaction.hash.toHexString(),
      event.params.minter.toHex().slice(2).padStart(40, '0'),
      entity.dDai.toString(),
      entity.dai.toString(),
    ]
  );
}

export function handleRedeem(event: RedeemEvent): void {
  let entity = new Redeem(
    event.transaction.hash.toHex() + '-' + event.logIndex.toString()
  );

  checkpoint(event.block);
  let blockEntity = Checkpoint.load(event.block.number.toString());
  blockEntity.cumulativeRedeemedDai = blockEntity.cumulativeRedeemedDai.plus((event.params.redeemAmount.toBigDecimal()).div(eighteenDecimals));
  blockEntity.redeems = blockEntity.redeems + 1;
  blockEntity.cumulativeInterestEarned = (
    (
      (blockEntity.totalSupplyUnderlying).plus(blockEntity.cumulativeRedeemedDai)
    ).minus(blockEntity.cumulativeMintedDai)
  ).truncate(18);
  blockEntity.save();

  let redeemer = Account.load(event.params.redeemer.toHex());
  if (redeemer === null) {
    log.critical("Redeemer should always be created already!", [])
  } else {
    redeemer.totalRedeemedDai = (redeemer.totalRedeemedDai).plus(
      (event.params.redeemAmount.toBigDecimal().div(eighteenDecimals)).truncate(18)
    );
    redeemer.numberOfRedeems = redeemer.numberOfRedeems + 1;
  }
  redeemer.save();

  entity.redeemer = redeemer.id;
  entity.dai = (event.params.redeemAmount.toBigDecimal()).div(eighteenDecimals);
  entity.dDai = (event.params.redeemDTokens.toBigDecimal()).div(eightDecimals);

  entity.at = blockEntity.id;
  entity.save();

  log.info(
    'tx {} => Redeem: redeemer 0x{} => {} dDai ({} dai equivalent)',
    [
      event.transaction.hash.toHexString(),
      event.params.redeemer.toHex().slice(2).padStart(40, '0'),
      entity.dDai.toString(),
      entity.dai.toString(),
    ]
  );
}

export function handleAccrue(event: AccrueEvent): void {
  let entity = new Accrue(
    event.transaction.hash.toHex() + '-' + event.logIndex.toString()
  );

  checkpoint(event.block);
  let blockEntity = Checkpoint.load(event.block.number.toString());

  entity.dDaiExchangeRate = (event.params.dTokenExchangeRate.toBigDecimal()).div(twentyEightDecimals);
  entity.cDaiExchangeRate = (event.params.cTokenExchangeRate.toBigDecimal()).div(twentyEightDecimals);

  entity.at = blockEntity.id;
  entity.save();

  log.info(
    'tx {} => Accrue => dDai rate {} & cDai rate {}',
    [
      event.transaction.hash.toHexString(),
      entity.dDaiExchangeRate.toString(),
      entity.cDaiExchangeRate.toString(),
    ]
  );
}

export function handleCollectSurplus(event: CollectSurplusEvent): void {
  let entity = new CollectSurplus(
    event.transaction.hash.toHex() + '-' + event.logIndex.toString()
  );

  checkpoint(event.block);
  let blockEntity = Checkpoint.load(event.block.number.toString());
  blockEntity.cumulativeCDaiSurplusPulled = (blockEntity.cumulativeCDaiSurplusPulled).plus((event.params.surplusCTokens.toBigDecimal()).div(eightDecimals));
  blockEntity.cumulativeDaiSurplusPulled = (blockEntity.cumulativeDaiSurplusPulled).plus((event.params.surplusAmount.toBigDecimal()).div(eighteenDecimals));
  blockEntity.save();

  entity.dai = (event.params.surplusAmount.toBigDecimal()).div(eightDecimals);
  entity.cDai = (event.params.surplusCTokens.toBigDecimal()).div(eighteenDecimals);

  entity.at = blockEntity.id;
  entity.save();

  log.info(
    'tx {} => CollectSurplus => {} cDai ({} dai equivalent)',
    [
      event.transaction.hash.toHexString(),
      entity.cDai.toString(),
      entity.dai.toString(),
    ]
  );
}
