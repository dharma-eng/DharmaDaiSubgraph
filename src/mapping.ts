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
import { BigInt, ByteArray, Bytes, Address, log } from '@graphprotocol/graph-ts';

// Block Handlers
//export function handleBlock(block: EthereumBlock): void {
//  let id = block.hash.toHex()
//  let entity = new Block(id)
//  entity.save()
//}

// Event Handlers
export function handleTransfer(event: TransferEvent): void {
  let entity = new Transfer(
    event.transaction.hash.toHex() + '-' + event.logIndex.toString()
  );
  entity.from = event.params.from;
  entity.to = event.params.to;
  entity.value = event.params.value;

  let contract = DharmaDai.bind(event.address);
  let exchangeRate = contract.exchangeRateCurrent();
  entity.underlyingValue = (event.params.value.times(exchangeRate)).dividedBy(BigInt.fromI32(10).pow(18));
  entity.save();

  let accountIn = Account.load(event.params.to.toHex());
  if (accountIn === null) {
    accountIn = new Account(event.params.to.toHex());
    accountIn.totalInterestEarned = BigInt.fromI32(0);
    accountIn.balance = event.params.value;
  } else {
    accountIn.totalInterestEarned = accountIn.totalInterestEarned.plus(
      (
        (accountIn.balance.times(exchangeRate)).dividedBy(BigInt.fromI32(10).pow(18))
      ).minus(accountIn.balanceUnderlying)
    );
    accountIn.balance = accountIn.balance.plus(event.params.value);
  }

  accountIn.balanceUnderlying = contract.balanceOfUnderlying(event.params.to);
  accountIn.lastAction = event.block.number;
  accountIn.save();

  let accountOut = Account.load(event.params.from.toHex());
  if (accountOut === null) {
    accountOut = new Account(event.params.from.toHex());
    accountOut.totalInterestEarned = BigInt.fromI32(0);
    accountOut.balance = contract.balanceOf(event.params.from);
  } else {
    accountOut.totalInterestEarned = accountOut.totalInterestEarned.plus(
      (
        (accountOut.balance.times(exchangeRate)).dividedBy(BigInt.fromI32(10).pow(18))
      ).minus(accountOut.balanceUnderlying)
    );
    accountOut.balance = accountOut.balance.minus(event.params.value);
  }

  accountOut.balanceUnderlying = contract.balanceOfUnderlying(event.params.from);
  accountOut.lastAction = event.block.number;
  accountOut.save();

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
  entity.owner = event.params.owner;
  entity.spender = event.params.spender;
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
  entity.minter = event.params.minter;
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
  entity.redeemer = event.params.redeemer;
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
