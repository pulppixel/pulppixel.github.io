import 'dart:developer';

import 'package:http/http.dart';
import 'package:web3dart/web3dart.dart';

import '../_src/enums.dart';
import '../_src/constants.dart';
import '../utils/util_func.dart';
import 'contract_read.dart';
import 'web3.dart';

Future<String> tokenTransaction(
  int idx,
  NetworkType networkType, {
  required String toAddress,
  required double doubleAmount,
  required double gas, // gwei
  int? nonce,
}) async {
  final Web3Client web3Client = Web3Client(_getRpcUrl(networkType), Client());
  try {
    final to = EthereumAddress.fromHex(toAddress);
    final amount = doubleToBigInt(doubleAmount, 18); // 스텔시 토큰의 소수점 자리수
    final gasPrice = EtherAmount.fromBigInt(
      EtherUnit.wei,
      doubleToBigInt(gas * 1.1, 9), // 이미 GWEI 단위로 분류됨
    );

    final transaction = Transaction.callContract(
      from: Web3.getPublicAddress(idx),
      contract: Web3.tokenContract,
      function: Web3.tokenContract.function('transfer'),
      gasPrice: gasPrice,
      parameters: [
        to,
        amount,
      ],
      nonce: nonce,
    );

    final result = await web3Client.sendTransaction(
      Web3.getPrivateKey(idx),
      transaction,
      chainId: 5,
    );
    web3Client.dispose();
    return result;
  } catch (ex) {
    log('contract_write.dart | tokenTransaction() | $ex');
    web3Client.dispose();
    return ex.toString();
  }
}

// return combine transaction Hash
Future<String> combineNfts(
  int idx,
  NetworkType networkType, {
  required String exteriorId,
  required String interiorId,
  required String landscapeId,
  int? nonce,
}) async {
  final web3Client = Web3Client(_getRpcUrl(networkType), Client());
  try {
    final bal0 = await nftBalanceOf(
      idx,
      client: web3Client,
      nftId: exteriorId,
    );
    if (bal0 == BigInt.zero) {
      return '';
    }

    final bal1 = await nftBalanceOf(
      idx,
      client: web3Client,
      nftId: interiorId,
    );
    if (bal1 == BigInt.zero) {
      return '';
    }

    final bal2 = await nftBalanceOf(
      idx,
      client: web3Client,
      nftId: landscapeId,
    );
    if (bal2 == BigInt.zero) {
      return '';
    }

    await setApproval(
      idx,
      client: web3Client,
      setValue: true,
    );

    final result = await builderCombining(
      idx,
      client: web3Client,
      exteriorId: exteriorId,
      interiorId: interiorId,
      landscapeId: landscapeId,
      nonce: nonce,
    );

    log('contract_write.dart | combineNfts() | $result');
    web3Client.dispose();
    return result;
  } catch (ex) {
    log('contract_write.dart | combineNfts() | $ex');
    web3Client.dispose();
    return ex.toString();
  }
}

Future<String> unCombineNft(
  int idx,
  NetworkType networkType, {
  required String combineId,
  int? nonce,
}) async {
  final web3Client = Web3Client(_getRpcUrl(networkType), Client());
  try {
    final balance = await nftBalanceOf(
      idx,
      client: web3Client,
      nftId: combineId,
    );
    if (balance == BigInt.zero) {
      return '';
    }

    await setApproval(
      idx,
      client: web3Client,
      setValue: true,
    );

    final result = await builderUnCombining(
      idx,
      client: web3Client,
      combineId: combineId,
      nonce: nonce,
    );

    log('contract_write.dart | unCombineNft() | $result');
    web3Client.dispose();
    return result;
  } catch (ex) {
    log('contract_write.dart | unCombineNft() | $ex');
    web3Client.dispose();
    return ex.toString();
  }
}

Future<String> setApproval(
  int idx, {
  required Web3Client client,
  required bool setValue,
}) async {
  final transaction = Transaction.callContract(
    from: Web3.getPublicAddress(idx),
    contract: Web3.nftBaseContract,
    function: Web3.nftBaseContract.function('setApprovalForAll'),
    maxGas: 5000000,
    parameters: [
      // todo: mainnet 생기면 이거 작업하기 (switch ~~ )
      EthereumAddress.fromHex(kBuilderHash),
      setValue,
    ],
    // gasPrice: await web3Client.getGasPrice(),
  );

  final result = await client.sendTransaction(
    Web3.getPrivateKey(idx),
    transaction,
    chainId: 5,
  );

  return result;
}

Future<String> builderCombining(
  int idx, {
  required Web3Client client,
  required String exteriorId,
  required String interiorId,
  required String landscapeId,
  int? nonce,
}) async {
// final gasPrice = await web3Client.getGasPrice();
// final increaseGas = gasPrice.getInWei * (BigInt.from(2) ~/ BigInt.from(1));
  final transaction = Transaction.callContract(
    from: Web3.getPublicAddress(idx),
    contract: Web3.builderContract,
    function: Web3.builderContract.function('combining'),
// gasPrice: EtherAmount.fromBigInt(EtherUnit.wei, increaseGas),
    parameters: [
      BigInt.parse(exteriorId),
      BigInt.parse(interiorId),
      BigInt.parse(landscapeId),
    ],
    nonce: nonce,
  );

  final result = await client.sendTransaction(
    Web3.getPrivateKey(idx),
    transaction,
    chainId: 5,
  );

  return result;
}

Future<String> builderUnCombining(
  int idx, {
  required Web3Client client,
  required String combineId,
  int? nonce,
}) async {
// final gasPrice = await web3Client.getGasPrice();
// final increaseGas = gasPrice.getInWei * (BigInt.from(2) ~/ BigInt.from(1));
  final transaction = Transaction.callContract(
    from: Web3.getPublicAddress(idx),
    contract: Web3.builderContract,
    function: Web3.builderContract.function('unCombining'),
// gasPrice: EtherAmount.fromBigInt(EtherUnit.wei, increaseGas),
    parameters: [
      BigInt.parse(combineId),
    ],
    nonce: nonce,
  );

  final result = await client.sendTransaction(
    Web3.getPrivateKey(idx),
    transaction,
    chainId: 5,
  );

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
