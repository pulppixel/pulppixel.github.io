import 'dart:async';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../_src/constants.dart';
import '../_src/enums.dart';

/* Cache Area */
Future<void> setSeedsCache(String mnemonic) async {
  final prefs = await SharedPreferences.getInstance();
  await prefs.setString(kSeedCacheKey, mnemonic);
}

Future<String> getSeedsCache() async {
  final prefs = await SharedPreferences.getInstance();
  return prefs.getString(kSeedCacheKey) ?? '';
}

Future<void> setNameCache(String name) async {
  final prefs = await SharedPreferences.getInstance();
  await prefs.setString(kNameCacheKey, name);
}

Future<String> getNameCache() async {
  final prefs = await SharedPreferences.getInstance();
  return prefs.getString(kNameCacheKey) ?? '';
}

Future<void> setEmailCache(String name) async {
  final prefs = await SharedPreferences.getInstance();
  await prefs.setString(kEmailCacheKey, name);
}

Future<String> getEmailCache() async {
  final prefs = await SharedPreferences.getInstance();
  return prefs.getString(kEmailCacheKey) ?? '';
}

Future<void> deleteAllCache() async {
  SharedPreferences prefs = await SharedPreferences.getInstance();
  await prefs.clear();
}

class SecureStorage {
  static Future<void> setSeeds(String mnemonic) async {
    final storage = _getStorage();
    await storage.write(key: kSeedPhraseSecureKey, value: mnemonic);
  }

  static Future<String> getSeeds() async {
    final storage = _getStorage();
    return await storage.read(key: kSeedPhraseSecureKey) ?? '';
  }

  static Future<void> setAccessTokenSecure(String token) async {
    final storage = _getStorage();
    await storage.write(key: kAccessTokenKey, value: token);
  }

  static Future<String?> getAccessTokenSecure() async {
    final storage = _getStorage();
    return storage.read(key: kAccessTokenKey);
  }

  static Future<void> setRefreshTokenSecure(String token) async {
    final storage = _getStorage();
    await storage.write(key: kRefreshTokenKey, value: token);
  }

  static Future<String?> getRefreshTokenSecure() async {
    final storage = _getStorage();
    return storage.read(key: kRefreshTokenKey);
  }

  static Future<void> setPasscodeSecure(List<int> passcode) async {
    final storage = _getStorage();
    await storage.write(key: kPasscodeSecureKey, value: passcode.join());
  }

  static Future<List<int>> getPasscodeSecure() async {
    final storage = _getStorage();
    String? str = await storage.read(key: kPasscodeSecureKey);
    if (str == null) {
      return [];
    }

    return str.split('').map(int.parse).toList();
  }

  static Future<void> setNetworkSecure(NetworkType type) async {
    final storage = _getStorage();
    await storage.write(key: kNetworkSecureKey, value: type.name);
  }

  static Future<NetworkType> getNetworkSecure() async {
    final storage = _getStorage();
    final str = await storage.read(key: kNetworkSecureKey);
    if (str == null) {
      return NetworkType.ethereum;
    }

    return NetworkType.values.firstWhere(
      (element) => element.toString().contains(str),
      orElse: () => throw ArgumentError('$str은 유효하지 않습니다.'),
    );
  }

  static Future<void> deleteAllSecure() async {
    final storage = _getStorage();
    await storage.deleteAll();
  }

  static FlutterSecureStorage _getStorage() {
    AndroidOptions getAndroidOptions() {
      return const AndroidOptions(encryptedSharedPreferences: true);
    }

    return FlutterSecureStorage(aOptions: getAndroidOptions());
  }
}
