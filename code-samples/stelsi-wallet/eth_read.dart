import 'dart:developer';

import 'package:web3dart/web3dart.dart';
import 'package:http/http.dart';

import '../_src/enums.dart';
import '../_src/constants.dart';
import '../models/web3/transaction_data.dart';
import 'web3.dart';

Future<double> ethBalanceOf(
  int idx,
  NetworkType networkType,
) async {
  final Web3Client web3client = Web3Client(_getRpcUrl(networkType), Client());
  try {
    final EthereumAddress address = Web3.getPublicAddress(idx);
    final EtherAmount amount = await web3client.getBalance(address);
    await web3client.dispose();
    return amount.getValueInUnit(EtherUnit.ether);
  } catch (ex) {
    log('eth_read.dart | ethBalanceOf() | $ex');
    await web3client.dispose();
    return 0;
  }
}

// 현재 블록의 가스비를 받아온다. (가스비 표준이 gwei이기 때문에 이래 둔다.)
Future<double> blockGasPrice(
  NetworkType networkType, {
  EtherUnit unit = EtherUnit.gwei,
}) async {
  final Web3Client web3Client = Web3Client(_getRpcUrl(networkType), Client());
  final gasPrice = await web3Client.getGasPrice();
  await web3Client.dispose();

  final result = gasPrice.getValueInUnit(unit);
  log('eth_read.dart | blockGasPrice() | $result');
  return result;
}

Future<TransactionData> transactionReceipt(
  NetworkType networkType, {
  required String trHash,
  required String from,
  required String to,
  required double amount,
  required int walletIdx,
  required double gas,
  bool isEthereum = false,
}) async {
  final client = Web3Client(_getRpcUrl(networkType), Client());
  var result = TransactionData(
    transactionHash: trHash,
    fromAddress: from,
    toAddress: to,
    status: 0,
    walletIdx: walletIdx,
    isEthereum: isEthereum ? 0 : 1,
    amount: amount,
    gas: gas,
    block: 0,
    nonce: 0,
    dateTime: '',
  );

  if (trHash.contains('Error')) {
    await client.dispose();
    return result..status = 2;
  }

  try {
    final tr = await client.getTransactionByHash(trHash);

    if (tr == null) {
      await client.dispose();
      return result..status = 0;
    }

    // nonce
    result.nonce = tr.nonce;

    // block
    final receipt = await client.getTransactionReceipt(trHash);
    if (receipt == null) {
      await client.dispose();
      return result;
    }

    result.block = receipt.blockNumber.blockNum;

    // status
    if (receipt.status != null) {
      result.status = receipt.status! ? 1 : 2;
    }

    // dateTime
    final timestamp = await client.getBlockInformation(
      blockNumber: receipt.blockNumber.toBlockParam(),
    );
    result.dateTime = timestamp.timestamp.toString();

    // amount
    // result.amount = tr.value.getValueInUnit(EtherUnit.ether);

    // gas
    if (receipt.effectiveGasPrice != null) {
      result.gas = receipt.effectiveGasPrice!.getValueInUnit(EtherUnit.gwei);
    }

    // result
    //   ..status = receipt.status! ? 1 : 2
    //   ..gas = receipt.effectiveGasPrice!.getValueInUnit(EtherUnit.gwei)
    //   ..block = receipt.blockNumber.blockNum
    //   ..dateTime = receipt.da;
  } catch (ex) {
    log('eth_read.dart | transactionReceipt() | $ex');
    await client.dispose();
    return result..status = 2;
  }

  await client.dispose();
  return result;
}

String _getRpcUrl(NetworkType networkType) {
  switch (networkType) {
    case NetworkType.ethereum:
      return tLiveRpcUrl;
    default:
      return tDevRpcUrl;
  }
}
