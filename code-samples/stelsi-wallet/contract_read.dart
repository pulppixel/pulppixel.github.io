import 'dart:developer';

import 'package:http/http.dart';
import 'package:web3dart/web3dart.dart';

import '../models/web3/combine_nft_data.dart';
import '../utils/util_func.dart';
import '../_src/constants.dart';
import '../_src/enums.dart';
import 'web3.dart';

Future<double> tokenBalanceOf(
  int idx,
  NetworkType networkType,
) async {
  final web3Client = Web3Client(_getRpcUrl(networkType), Client());
  try {
    final balance = await _query(
      web3Client: web3Client,
      contract: Web3.tokenContract,
      funcName: 'balanceOf',
      params: [Web3.getPublicAddress(idx)],
    );
    await web3Client.dispose();

    // STELSI Token: 소수점 18자리를 쓴다.
    return bigIntToDouble(balance[0], 18);
  } catch (ex) {
    log('contract_read.dart | tokenBalanceOf() | $ex');
    web3Client.dispose();
    return 0;
  }
}

Future<List<dynamic>> _query({
  required Web3Client web3Client,
  required DeployedContract contract,
  required String funcName,
  required List<dynamic> params,
  BlockNum? atBlock,
}) async {
  final function = contract.function(funcName);
  final result = await web3Client.call(
    contract: contract,
    function: function,
    params: params,
    atBlock: atBlock,
  );

  return result;
}

// 해당 NFT  소유 체크 (0이면 소유 x)
Future<BigInt> nftBalanceOf(
  int idx, {
  required Web3Client client,
  required String nftId,
}) async {
  final result = await _query(
    web3Client: client,
    contract: Web3.nftBaseContract,
    funcName: 'balanceOf',
    params: [
      Web3.getPublicAddress(idx),
      BigInt.parse(nftId),
    ],
  );

  return result[0];
}

Future<bool> isNftApprove(
  Web3Client client,
  int idx,
) async {
  final result = await _query(
    web3Client: client,
    contract: Web3.nftBaseContract,
    funcName: 'isApprovedForAll',
    params: [
      Web3.getPublicAddress(idx),
      EthereumAddress.fromHex(kBuilderHash),
    ],
  );

  return result[0];
}

Future<CombineNftData> combineReceipt(
  int walletIdx, {
  required String trHash,
  required String exteriorName,
  required String interiorName,
  required String landscapeName,
}) async {
  // final client = Web3Client(tDevRpcUrl, Client());
  var result = CombineNftData.getter(
    trHash: trHash,
    exteriorName: exteriorName,
    interiorName: interiorName,
    landscapeName: landscapeName,
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
