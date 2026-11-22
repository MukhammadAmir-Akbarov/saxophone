#!/usr/bin/env bash
# Собрать Android-приложение из текущего сайта одной командой.
#   ./build.sh        APK для установки на телефон
#   ./build.sh aab    AAB для загрузки в Google Play
#   ./build.sh both   оба файла
# Версия — в файле VERSION; поднимите её перед каждой загрузкой в Play.
set -euo pipefail
cd "$(dirname "$0")"
WHAT="${1:-apk}"
VER="$(tr -d '[:space:]' < VERSION)"
# Java 21 из brew: Java из Android Studio (25) Gradle Capacitor ещё не понимает
export JAVA_HOME="${JAVA_HOME:-$(brew --prefix openjdk@21)/libexec/openjdk.jdk/Contents/Home}"
export ANDROID_HOME="${ANDROID_HOME:-$HOME/Library/Android/sdk}"

(cd .. && npm run build >/dev/null)
rm -rf www && cp -R ../dist www
npx cap sync android >/dev/null

build_one() {
  echo "▸ сборка $3…"
  (cd android && ./gradlew "$1" -q 2>&1 | grep -viE "^note:|deprecat|warning-mode" || true)
  cp "android/$2" "../Saxophone-${VER}.$3"
  echo "  готово: Saxophone-${VER}.$3 ($(du -h "../Saxophone-${VER}.$3" | cut -f1 | tr -d ' '))"
}
case "$WHAT" in
  apk)  build_one assembleRelease app/build/outputs/apk/release/app-release.apk apk ;;
  aab)  build_one bundleRelease app/build/outputs/bundle/release/app-release.aab aab ;;
  both) build_one assembleRelease app/build/outputs/apk/release/app-release.apk apk
        build_one bundleRelease app/build/outputs/bundle/release/app-release.aab aab ;;
  *)    echo "не знаю «$WHAT»: apk | aab | both" >&2; exit 1 ;;
esac
