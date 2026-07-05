## 배경

기획안을 분석해 보니 실시간 렌더링이 필요 없는 앱이었고, Unity를 고집할 이유가 없다고 판단했습니다. 대안으로 .NET MAUI와 Flutter로 각각 MVP를 만들어 성능과 개발 효율을 비교한 끝에 Flutter를 최종 채택했습니다. 이때 MAUI MVP에도 MVVM 패턴과 5계층 프로젝트 분리를 적용해 실무 수준으로 구현했기에, 비교 자체의 신뢰도를 확보할 수 있었습니다. 이 결과를 시니어 개발진 앞에서 시연·리뷰하고 리스크에 대비한 폴백 플랜까지 함께 제시해, 스택 전환을 설득으로 이끌어냈습니다.

## 트랜잭션 시연

::youtube kiumIQjVSXg STELSI Wallet - 트랜잭션 시연 1

## Web3 레이어

`Web3` 클래스가 BIP39(니모닉) -> BIP32/BIP44(HD 키 파생) -> web3dart(온체인 통신)을 래핑합니다.

- **HD 지갑** - 하나의 시드에서 `m/44'/60'/0'/0/N` 경로로 10개 주소를 파생. 개인키/공개키/주소를 인덱스로 관리
- **스마트 컨트랙트 3종** - ERC-20 토큰(STELSI), ERC-1155 NFT(Base), Builder(조합/분해). ABI JSON 로드 -> `DeployedContract` 초기화
- **Read/Write 분리** - `eth_read.dart`(잔액, 가스비, 영수증 조회), `eth_write.dart`(ETH 전송), `contract_read.dart`(토큰 잔액, NFT 소유, Approve 확인), `contract_write.dart`(토큰 전송, NFT 조합/분해)
- **네트워크 전환** - Ethereum Mainnet / Goerli Testnet 런타임 스위칭

## 보안

- 시드 구문을 `FlutterSecureStorage`(Android EncryptedSharedPreferences)에 암호화 저장
- 서버 인증용 시드 해시는 SHA-256 -> MD5 이중 해싱
- 앱 진입 시 6자리 Passcode 잠금. Access/Refresh Token을 Secure Storage에 분리 저장

## 아키텍처

- **상태 관리** - Riverpod `Notifier` + `AsyncNotifier`. Wallet, User, Network, NFT, Transaction 각각 독립 Provider
- **라우팅** - GoRouter로 30+ 페이지를 선언적으로 관리
- **모델** - Freezed + json_serializable로 불변 DTO 생성
- **로컬 DB** - SQLite(sqflite)로 지갑, 트랜잭션, NFT 조합 데이터를 영속 저장

::youtube YxORfjvtSng STELSI Wallet - 트랜잭션 시연 2

## 성과

App Store와 Google Play 양대 스토어에 출시하고, 모든 작업 과정을 Confluence에 문서화했습니다. 이후 회사의 방향이 메타버스 월드 쪽으로 옮겨 가면서 추가 개발은 중단되었습니다.

![STELSI Wallet - Google Play 스토어 등록 화면. 500+ 다운로드](/images/st_store.jpg)
