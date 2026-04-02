/*
  ██████╗ ██████╗  ██████╗ ██╗   ██╗██╗██████╗ ███████╗██████╗
  ██╔══██╗██╔══██╗██╔═══██╗██║   ██║██║██╔══██╗██╔════╝██╔══██╗
  ██████╔╝██████╔╝██║   ██║██║   ██║██║██║  ██║█████╗  ██████╔╝
  ██╔═══╝ ██╔══██╗██║   ██║╚██╗ ██╔╝██║██║  ██║██╔══╝  ██╔══██╗
  ██║     ██║  ██║╚██████╔╝ ╚████╔╝ ██║██████╔╝███████╗██║  ██║
  ╚═╝     ╚═╝  ╚═╝ ╚═════╝   ╚═══╝  ╚═╝╚═════╝ ╚══════╝╚═╝  ╚═╝
*/

import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../providers/async_web3_transaction.dart';
import '../providers/async_open_sale_nft.dart';
import '../providers/async_combine_nft.dart';
import '../providers/async_wallet_list.dart';
import '../providers/async_own_nft.dart';
import '../providers/web3_network.dart';
import '../providers/passcode.dart';
import '../providers/wallet.dart';

import '../models/web3/open_sale_nft_data.dart';
import '../models/web3/combine_nft_data.dart';
import '../models/web3/transaction_data.dart';
import '../models/web3/own_nft_data.dart';
import '../models/web3/wallet_data.dart';
import '../models/user/user_data.dart';
import '../providers/user.dart';
import 'enums.dart';

final userProvider = NotifierProvider<User, UserData>(
  User.new,
);

final passcodeProvider = NotifierProvider<Passcode, List<int>>(
  Passcode.new,
);

final networkProvider = NotifierProvider<Web3Network, NetworkType>(
  Web3Network.new,
);

// main wallet
final walletProvider = NotifierProvider<Wallet, WalletData>(
  Wallet.new,
);

final walletListProvider =
    AsyncNotifierProvider<AsyncWalletList, List<WalletData>>(
  AsyncWalletList.new,
);

final transactionListProvider =
    AsyncNotifierProvider<AsyncWeb3Transaction, List<TransactionData>>(
  AsyncWeb3Transaction.new,
);

final combineListProvider =
    AsyncNotifierProvider<AsyncCombineNft, List<CombineNftData>>(
  AsyncCombineNft.new,
);

// open sale list
final openSaleListProvider =
    AsyncNotifierProvider<AsyncOpenSaleNft, List<OpenSaleNftData>>(
  AsyncOpenSaleNft.new,
);

// own nft list
final ownNftListProvider = AsyncNotifierProvider<AsyncOwnNft, List<OwnNftData>>(
  AsyncOwnNft.new,
);
