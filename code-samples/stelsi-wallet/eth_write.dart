import 'dart:developer';

import 'package:http/http.dart';
import 'package:web3dart/web3dart.dart';

import '../_src/enums.dart';
import '../_src/constants.dart';
import '../utils/util_func.dart';
import 'web3.dart';

Future<String> ethTransaction(
  int idx,
  NetworkType networkType, {
  required String toAddress,
  required double amount,
  required double gas,
  int? nonce,
}) async {
  final Web3Client web3Client = Web3Client(_getRpcUrl(networkType), Client());
  try {
    final to = EthereumAddress.fromHex(toAddress);
    final value = EtherAmount.fromBigInt(
      EtherUnit.wei,
      doubleToBigInt(amount, 18),
    );
    final gasPrice = EtherAmount.fromBigInt(
      EtherUnit.wei,
      doubleToBigInt(gas * 1.1, 9), // 이미 GWEI 단위로 분류됨
    );

    final transaction = Transaction(
      to: to,
      value: value,
      gasPrice: gasPrice,
      nonce: nonce,
    );

    final result = await web3Client.sendTransaction(
      Web3.getPrivateKey(idx),
      transaction,
      chainId: 5, // Goerli ChainID: 5
    );

    await web3Client.dispose();
    return result;
  } catch (ex) {
    log('eth_write.dart | ethTransaction() | $ex');
    web3Client.dispose();
    return ex.toString();
  }
}

String _getRpcUrl(NetworkType networkType) {
  switch (networkType) {
    case NetworkType.ethereum:
      return tLiveRpcUrl;
    default:
      return tDevRpcUrl;
  }
}
