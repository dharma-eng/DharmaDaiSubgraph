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
  Transfer,
  Approval,
  Mint,
  Redeem,
  Accrue,
  CollectSurplus,
  Summary,
  Account,
} from '../generated/schema';
import { BigInt, ByteArray, Bytes, Address, log, EthereumBlock } from '@graphprotocol/graph-ts';

// Block Handlers
export function handleBlock(block: EthereumBlock): void {
  let contract = DharmaDai.bind(Address.fromString(
    "0x00000000001876eB1444c986fD502e618c587430"
  ));
  let entity = new Summary(block.number.toString());
  entity.version = contract.getVersion();
  entity.totalSupply = contract.totalSupply();
  entity.totalSupplyUnderlying = contract.totalSupplyUnderlying();
  entity.exchangeRate = contract.exchangeRateCurrent();
  entity.supplyRatePerBlock = contract.supplyRatePerBlock();
  entity.lastAccrual = contract.accrualBlockNumber();
  entity.spreadPerBlock = contract.getSpreadPerBlock();
  entity.currentCDaiSurplus = contract.getSurplus();
  entity.currentDaiSurplus = contract.getSurplusUnderlying();
  
  // TODO
  entity.cumulativeCDaiSurplus = BigInt.fromI32(0);
  entity.cumulativeDaiSurplus = BigInt.fromI32(0);
  entity.totalInterestEarned = BigInt.fromI32(0);

  entity.save()
}

// Event Handlers
export function handleTransfer(event: TransferEvent): void {
  let entity = new Transfer(
    event.transaction.hash.toHex() + '-' + event.logIndex.toString()
  );

  let contract = DharmaDai.bind(event.address);
  let exchangeRate = contract.exchangeRateCurrent();

  let accountIn = Account.load(event.params.to.toHex());
  if (accountIn === null) {
    accountIn = new Account(event.params.to.toHex());
    accountIn.totalInterestEarned = BigInt.fromI32(0);
  } else {
    accountIn.totalInterestEarned = accountIn.totalInterestEarned.plus(
      (
        (accountIn.balance.times(exchangeRate)).div(BigInt.fromI32(1000000000).times(BigInt.fromI32(1000000000)))
      ).minus(accountIn.balanceUnderlying)
    );
  }

  accountIn.balance = contract.balanceOf(event.params.to);
  accountIn.balanceUnderlying = contract.balanceOfUnderlying(event.params.to);
  accountIn.lastAction = event.block.number;
  accountIn.save();

  let accountOut = Account.load(event.params.from.toHex());
  if (accountOut === null) {
    accountOut = new Account(event.params.from.toHex());
    accountOut.totalInterestEarned = BigInt.fromI32(0);
  } else {
    accountOut.totalInterestEarned = accountOut.totalInterestEarned.plus(
      (
        (accountOut.balance.times(exchangeRate)).div(BigInt.fromI32(1000000000).times(BigInt.fromI32(1000000000)))
      ).minus(accountOut.balanceUnderlying)
    );
    ;
  }

  accountOut.balance = contract.balanceOf(event.params.from);
  accountOut.balanceUnderlying = contract.balanceOfUnderlying(event.params.from);
  accountOut.lastAction = event.block.number;
  accountOut.save();

  entity.from = accountOut.id;
  entity.to = accountIn.id;
  entity.value = event.params.value;
  entity.underlyingAmount = (event.params.value.times(exchangeRate)).div(BigInt.fromI32(1000000000).times(BigInt.fromI32(1000000000)));
  entity.save();

  log.debug(
    'tx {} => Transfer: from 0x{} to 0x{}',
    [
      event.transaction.hash.toHexString(),
      event.params.from.toHex().slice(2).padStart(40, '0'),
      event.params.to.toHex().slice(2).padStart(40, '0'),
    ]
  );
}

export function handleApproval(event: ApprovalEvent): void {
  let entity = new Approval(
    event.transaction.hash.toHex() + '-' + event.logIndex.toString()
  );

  let contract = DharmaDai.bind(event.address);

  let owner = Account.load(event.params.owner.toHex());
  if (owner === null) {
    owner = new Account(event.params.owner.toHex());
    owner.totalInterestEarned = BigInt.fromI32(0);
    owner.balance = contract.balanceOf(event.params.owner);
    owner.balanceUnderlying = contract.balanceOfUnderlying(event.params.owner);
    owner.lastAction = event.block.number;
    owner.save();
  }

  let spender = Account.load(event.params.spender.toHex());
  if (spender === null) {
    spender = new Account(event.params.spender.toHex());
    spender.totalInterestEarned = BigInt.fromI32(0);
    spender.balance = contract.balanceOf(event.params.spender);
    spender.balanceUnderlying = contract.balanceOfUnderlying(event.params.spender);
    spender.lastAction = event.block.number;
    spender.save();
  }

  entity.owner = owner.id;
  entity.spender = spender.id;
  entity.value = event.params.value;
  entity.save();

  log.debug(
    'tx {} => Approve: owner 0x{} & spender 0x{}',
    [
      event.transaction.hash.toHexString(),
      event.params.owner.toHex().slice(2).padStart(40, '0'),
      event.params.spender.toHex().slice(2).padStart(40, '0'),
    ]
  );
}

export function handleMint(event: MintEvent): void {
  let entity = new Mint(
    event.transaction.hash.toHex() + '-' + event.logIndex.toString()
  );

  let minter = Account.load(event.params.minter.toHex());
  if (minter === null) {
    let contract = DharmaDai.bind(event.address);
    minter = new Account(event.params.minter.toHex());
    minter.totalInterestEarned = BigInt.fromI32(0);
    minter.balance = contract.balanceOf(event.params.minter);
    minter.balanceUnderlying = contract.balanceOfUnderlying(event.params.minter);
    minter.lastAction = event.block.number;
    minter.save();
  }

  entity.minter = minter.id;
  entity.dai = event.params.mintAmount;
  entity.dDai = event.params.mintDTokens;
  entity.save();

  log.debug(
    'tx {} => Mint: minter 0x{}',
    [
      event.transaction.hash.toHexString(),
      event.params.minter.toHex().slice(2).padStart(40, '0'),
    ]
  );
}

export function handleRedeem(event: RedeemEvent): void {
  let entity = new Redeem(
    event.transaction.hash.toHex() + '-' + event.logIndex.toString()
  );

  let redeemer = Account.load(event.params.redeemer.toHex());
  if (redeemer === null) {
    let contract = DharmaDai.bind(event.address);
    redeemer = new Account(event.params.redeemer.toHex());
    redeemer.totalInterestEarned = BigInt.fromI32(0);
    redeemer.balance = contract.balanceOf(event.params.redeemer);
    redeemer.balanceUnderlying = contract.balanceOfUnderlying(event.params.redeemer);
    redeemer.lastAction = event.block.number;
    redeemer.save();
  }

  entity.redeemer = redeemer.id;
  entity.dai = event.params.redeemAmount;
  entity.dDai = event.params.redeemDTokens;
  entity.save();

  log.debug(
    'tx {} => Redeem: redeemer 0x{}',
    [
      event.transaction.hash.toHexString(),
      event.params.redeemer.toHex().slice(2).padStart(40, '0'),
    ]
  );
}

export function handleAccrue(event: AccrueEvent): void {
  let entity = new Accrue(
    event.transaction.hash.toHex() + '-' + event.logIndex.toString()
  );
  entity.dDaiExchangeRate = event.params.dTokenExchangeRate;
  entity.cDaiExchangeRate = event.params.cTokenExchangeRate;
  entity.save();

  log.debug(
    'tx {} => Accrue',
    [
      event.transaction.hash.toHexString(),
    ]
  );
}

export function handleCollectSurplus(event: CollectSurplusEvent): void {
  let entity = new CollectSurplus(
    event.transaction.hash.toHex() + '-' + event.logIndex.toString()
  );
  entity.dai = event.params.surplusAmount;
  entity.cDai = event.params.surplusCTokens;
  entity.save();

  log.debug(
    'tx {} => CollectSurplus',
    [
      event.transaction.hash.toHexString(),
    ]
  );
}
