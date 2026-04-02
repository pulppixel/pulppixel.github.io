# STELSI Wallet — 코드 샘플

> 2023 · 이더리움 HD 지갑 앱 · Flutter 1인 개발 · App Store + Google Play 출시  
> 159개 소스 파일 중 8개 선별

## 포함된 파일

### Web3 레이어
- **`web3.dart`** — BIP39(니모닉) → BIP32/BIP44(HD 키 파생) → web3dart 래퍼.
  - `m/44'/60'/0'/0/N` 경로로 10개 주소 파생
  - 3종 스마트 컨트랙트 초기화 (ERC-20 Token, ERC-1155 NFT, Builder)
  - 시드 구문 SHA-256 → MD5 이중 해싱
  - Ethereum Mainnet / Goerli Testnet 전환

### 블록체인 Read/Write
- **`eth_read.dart`** — ETH 잔액 조회, 가스비 조회, 트랜잭션 영수증 폴링 (블록 번호, 상태, 타임스탬프).
- **`eth_write.dart`** — ETH 전송. 가스비 10% 버퍼 적용.
- **`contract_read.dart`** — ERC-20 토큰 잔액, NFT 소유 확인, Approval 상태 조회. 내부 `_query()` 헬퍼.
- **`contract_write.dart`** — 토큰 전송, NFT 조합(combining)/분해(uncombining). 소유권 검증 → Approval → 트랜잭션 순서 보장.

### 상태 관리 · 보안
- **`wallet.dart`** — Riverpod `Notifier`. 지갑 상태 관리 + 잔액 자동 갱신.
- **`providers_setup.dart`** — Riverpod Provider 선언부. Wallet, User, Network, NFT, Transaction 각각 독립 관리.
- **`cache_service.dart`** — `FlutterSecureStorage`(Android EncryptedSharedPreferences) 래퍼. 시드/토큰/패스코드/네트워크 설정 암호화 저장.
