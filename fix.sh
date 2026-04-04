#!/bin/bash
# fix-special-chars.sh
# 레포 루트에서 실행: bash fix-special-chars.sh
#
# AI 티 나는 특수문자를 키보드로 칠 수 있는 문자로 치환
# 대상: .astro, .ts 파일 (minigame 내부 게임용 특수문자는 제외)

set -e

echo "=== 치환 전 현황 ==="
echo "em dash (—):"
grep -rc '—' src/ --include="*.astro" --include="*.ts" 2>/dev/null | grep -v ':0$' || echo "  없음"
echo "middle dot (·):"
grep -rc '·' src/ --include="*.astro" 2>/dev/null | grep -v ':0$' || echo "  없음"
echo "arrow (→):"
grep -rc '→' src/ --include="*.astro" 2>/dev/null | grep -v ':0$' || echo "  없음"
echo ""

# === .astro 파일 전체 치환 ===
find src/ -name "*.astro" -exec sed -i \
  -e 's/—/-/g' \
  -e 's/ · /, /g' \
  -e 's/·/, /g' \
  -e 's/→/->/g' \
  -e 's/←/<-/g' \
  {} +

# === data.ts (프로젝트 설명 텍스트만) ===
# minigame 코드의 게임용 특수문자(★, ◆, ♥ 등)는 건드리지 않음
sed -i \
  -e "s/link: '#', off: { x: 0, z: 1.5 }/link: '\/projects\/math-master\/', off: { x: 0, z: 1.5 }/" \
  src/scripts/explore/data.ts

echo "=== 치환 완료 ==="
echo "em dash (—) 잔여:"
grep -rc '—' src/ --include="*.astro" 2>/dev/null | grep -v ':0$' || echo "  없음 (OK)"
echo "middle dot (·) 잔여:"
grep -rc '·' src/ --include="*.astro" 2>/dev/null | grep -v ':0$' || echo "  없음 (OK)"

echo ""
echo "git diff --stat 으로 변경사항을 확인하세요."