import 'dart:developer';

import 'package:flutter/services.dart';
import 'package:dart_bip32_bip44/dart_bip32_bip44.dart';
import 'package:web3dart/web3dart.dart';
import 'package:bip39/bip39.dart' as bip39;

import '../services/cache_service.dart';
import '../utils/util_func.dart';
import '../_src/constants.dart';
import '../_src/enums.dart';

class Web3 {
  static Chain get chain => _chain;

  static DeployedContract get tokenContract => _tokenContract;

  static DeployedContract get nftBaseContract => _nftBaseContract;

  static DeployedContract get builderContract => _builderContract;

  static Future<bool> chainInitializer({
    String mnemonic = '',
    NetworkType networkType = NetworkType.ethereum,
  }) async {
    return mnemonic == ''
        ? await _initChain(networkType)
        : await _setUpChain(mnemonic, networkType);
  }

  static EthPrivateKey getPrivateKey(int idx) {
    return EthPrivateKey.fromHex(getPrivateKeyHash(idx));
  }

  static String getPrivateKeyHash(int idx) {
    return _chain.forPath("m/44'/60'/0'/0/$idx").privateKeyHex();
  }

  static EthereumAddress getPublicAddress(int idx) {
    return EthereumAddress.fromHex(getPublicHash(idx));
  }

  static String getPublicHash(int idx) {
    final ethPrivateKey = EthPrivateKey.fromHex(getPrivateKeyHash(idx));
    final ethereumAddress = ethPrivateKey.address;
    return ethereumAddress.hexEip55;
  }

  // 현재 지갑의 주소(해시)를 인덱스 0번부터 10개 반환
  static List<String> getPublic10Addresses() {
    List<String> result = [];
    for (int i = 0; i < 10; i++) {
      result.add(getPublicHash(i));
    }

    return result;
  }

  // 로컬에 저장된 시드가 있는가 체크
  static Future<bool> hasLocalSeeds() async {
    final seeds = await SecureStorage.getSeeds();
    final result = bip39.validateMnemonic(seeds);
    return result;
  }

  // 암호화된 니모닉을 반환 (로그인 정보는 이걸로 등록)
  static Future<String> getCryptoSeeds() async {
    final seeds = await SecureStorage.getSeeds();
    final sha256 = getSha256Hash(seeds);
    final result = getMd5Hash(sha256);

    return result;
  }

  /* check available address */
  static bool isChecksum(String address) {
    try {
      EthereumAddress.fromHex(address, enforceEip55: true);
      return true;
      // valid!
    } on ArgumentError {
      // Not valid
      return false;
    }
  }

  // 여기서 사용할 Chain을 초기화해준다. (체인 등록 후 앱 사용 가능)
  static Future<bool> _initChain(
    NetworkType networkType,
  ) async {
    try {
      final mnemonic = await SecureStorage.getSeeds();
      _chain = Chain.seed(bip39.mnemonicToSeedHex(mnemonic));
      initContracts(networkType);
      return true;
    } catch (e) {
      log('web3.dart | _initChain() | $e');
      return false;
    }
  }

  // 여기서 사용할 Chain을 초기화해준다. (체인 등록 후 앱 사용 가능)
  static Future<bool> _setUpChain(
    String mnemonic,
    NetworkType networkType,
  ) async {
    try {
      await SecureStorage.setSeeds(mnemonic);
      _chain = Chain.seed(bip39.mnemonicToSeedHex(mnemonic));
      initContracts(networkType);
      return true;
    } catch (e) {
      log('web3.dart | _setUpChain() | $e');
      return false;
    }
  }

  // 스마트 컨트랙트들을 초기화해준다.
  static Future<void> initContracts(
    NetworkType networkType,
  ) async {
    _tokenContract = await _getContract(
      path: 'assets/raw/token.abi.json',
      name: 'stelsi',
      address: _getTokenHash(networkType),
    );
    _nftBaseContract = await _getContract(
      path: 'assets/raw/nftbase.abi.json',
      name: 'proxy',
      address: _getNftBaseHash(networkType),
    );
    _builderContract = await _getContract(
      path: 'assets/raw/builder.abi.json',
      name: 'builder',
      address: kBuilderHash,
    );
  }

  static Future<DeployedContract> _getContract({
    required String path,
    required String name,
    required String address,
  }) async {
    final abi = await rootBundle.loadString(path);
    final contract = DeployedContract(
      ContractAbi.fromJson(abi, name),
      EthereumAddress.fromHex(address),
    );

    return contract;
  }

  static String _getTokenHash(NetworkType networkType) {
    switch (networkType) {
      case NetworkType.ethereum:
        return kLiveTokenHash;
      default:
        return kDevTokenHash;
    }
  }

  static String _getNftBaseHash(NetworkType networkType) {
    switch (networkType) {
      case NetworkType.ethereum:
        return kLiveNftBaseHash;
      default:
        return kDevNftBaseHash;
    }
  }

  static late Chain _chain;
  static late DeployedContract _tokenContract;
  static late DeployedContract _nftBaseContract;
  static late DeployedContract _builderContract;
}
