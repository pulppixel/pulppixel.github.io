import 'package:riverpod_annotation/riverpod_annotation.dart';

import '../../_src/enums.dart';
import '../models/web3/wallet_data.dart';
import '../_src/providers.dart';

class Wallet extends Notifier<WalletData> {
  @override
  WalletData build() {
    return WalletData.getter();
  }

  void setWallet({
    required WalletData wallet,
  }) {
    state = wallet;
  }

  void update({
    String? walletName,
    double? ethAmount,
    double? stlAmount,
    double? usdAmount,
  }) {
    state = state.copyWith(
      id: state.id,
      address: state.address,
      name: walletName ?? state.name,
      ethAmount: ethAmount ?? state.ethAmount,
      stlAmount: stlAmount ?? state.stlAmount,
      usdAmount: usdAmount ?? state.usdAmount,
    );
  }

  Future<void> updateAuto(NetworkType networkType) async {
    await WalletData.updateData(state, networkType);
    update(
      stlAmount: state.stlAmount,
      ethAmount: state.ethAmount,
      usdAmount: state.usdAmount,
    );

    // hard coding..
    ref.read(walletListProvider.notifier).updateWalletData(state);
  }
}
