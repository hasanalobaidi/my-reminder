#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

if [ -d "/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home" ]; then
  export JAVA_HOME="/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home"
elif [ -d "/opt/homebrew/opt/openjdk/libexec/openjdk.jdk/Contents/Home" ]; then
  export JAVA_HOME="/opt/homebrew/opt/openjdk/libexec/openjdk.jdk/Contents/Home"
fi
export PATH="$JAVA_HOME/bin:/opt/homebrew/bin:$PATH"

export ANDROID_SDK_ROOT="${ANDROID_SDK_ROOT:-/opt/homebrew/share/android-commandlinetools}"
SDKMANAGER="/opt/homebrew/bin/sdkmanager"
if [ ! -x "$SDKMANAGER" ]; then
  SDKMANAGER="$ANDROID_SDK_ROOT/cmdline-tools/latest/bin/sdkmanager"
fi

if [ ! -f "$ANDROID_SDK_ROOT/platforms/android-34/android.jar" ] || [ ! -d "$ANDROID_SDK_ROOT/build-tools/34.0.0" ]; then
  echo "[MyReminder APK] Installing Android SDK Platform 34 & Build-Tools 34.0.0..."
  yes 2>/dev/null | "$SDKMANAGER" --sdk_root="$ANDROID_SDK_ROOT" --licenses >/dev/null 2>&1 || true
  "$SDKMANAGER" --sdk_root="$ANDROID_SDK_ROOT" "platforms;android-34" "build-tools;34.0.0" < /dev/null
fi

ANDROID_JAR="$ANDROID_SDK_ROOT/platforms/android-34/android.jar"
BUILD_TOOLS="$ANDROID_SDK_ROOT/build-tools/34.0.0"
AAPT2="$BUILD_TOOLS/aapt2"
D8="$BUILD_TOOLS/d8"
ZIPALIGN="$BUILD_TOOLS/zipalign"
APKSIGNER="$BUILD_TOOLS/apksigner"

APP_SRC="$ROOT_DIR/android-app/app/src/main"
BUILD_DIR="$ROOT_DIR/android-app/build"
rm -rf "$BUILD_DIR"
mkdir -p "$BUILD_DIR/gen" "$BUILD_DIR/classes" "$BUILD_DIR/dex" "$BUILD_DIR/res"

# 1. Sync latest web app assets & custom QNA icon into Android assets/res
mkdir -p "$APP_SRC/assets/www/css" "$APP_SRC/assets/www/js" "$APP_SRC/assets/www/icons"
cp "$ROOT_DIR/public/index.html" "$APP_SRC/assets/www/index.html"
cp "$ROOT_DIR/public/fullscreen.html" "$APP_SRC/assets/www/fullscreen.html"
cp "$ROOT_DIR/public/manifest.webmanifest" "$APP_SRC/assets/www/manifest.webmanifest"
cp "$ROOT_DIR/public/sw.js" "$APP_SRC/assets/www/sw.js"
cp "$ROOT_DIR/public/css/styles.css" "$APP_SRC/assets/www/css/styles.css"
cp "$ROOT_DIR/public/js/"*.js "$APP_SRC/assets/www/js/"
cp "$ROOT_DIR/public/icons/"*.png "$APP_SRC/assets/www/icons/"

mkdir -p "$APP_SRC/res/mipmap-xxxhdpi" "$APP_SRC/res/mipmap-hdpi"
cp "$ROOT_DIR/public/icons/icon-512.png" "$APP_SRC/res/mipmap-xxxhdpi/ic_launcher.png"
cp "$ROOT_DIR/public/icons/icon-192.png" "$APP_SRC/res/mipmap-hdpi/ic_launcher.png"

# 2. Compile resources & link base APK with aapt2
"$AAPT2" compile --dir "$APP_SRC/res" -o "$BUILD_DIR/res/compiled.flata"
"$AAPT2" link \
  -I "$ANDROID_JAR" \
  --manifest "$APP_SRC/AndroidManifest.xml" \
  -A "$APP_SRC/assets" \
  --java "$BUILD_DIR/gen" \
  -o "$BUILD_DIR/unaligned.apk" \
  "$BUILD_DIR/res/compiled.flata"

# 3. Compile Java sources against android-34
javac --release 11 \
  -classpath "$ANDROID_JAR" \
  -d "$BUILD_DIR/classes" \
  "$BUILD_DIR/gen/qa/org/qna/myreminder/R.java" \
  "$APP_SRC/java/qa/org/qna/myreminder/"*.java

# 4. Convert JVM bytecode to Dalvik DEX bytecode (classes.dex)
CLASS_FILES=()
while IFS= read -r -d '' file; do
  CLASS_FILES+=("$file")
done < <(find "$BUILD_DIR/classes" -name "*.class" -print0)

"$D8" --lib "$ANDROID_JAR" --min-api 26 --output "$BUILD_DIR/dex" "${CLASS_FILES[@]}"

# 5. Package classes.dex into APK, zipalign, and sign with apksigner
(cd "$BUILD_DIR/dex" && zip -q -u "$BUILD_DIR/unaligned.apk" classes.dex)
"$ZIPALIGN" -f -p 4 "$BUILD_DIR/unaligned.apk" "$BUILD_DIR/aligned.apk"

KEYSTORE="$ROOT_DIR/android-app/myreminder-release.keystore"
if [ ! -f "$KEYSTORE" ]; then
  keytool -genkeypair \
    -v \
    -keystore "$KEYSTORE" \
    -alias myreminder_qna \
    -keyalg RSA \
    -keysize 2048 \
    -validity 10000 \
    -storepass myreminderqna \
    -keypass myreminderqna \
    -dname "CN=MyReminder QNA, OU=QNA, O=Qatar News Agency, L=Doha, ST=Doha, C=QA" < /dev/null >/dev/null 2>&1
fi

mkdir -p "$ROOT_DIR/public/download"
OUT_APK="$ROOT_DIR/public/download/MyReminder.apk"
"$APKSIGNER" sign \
  --ks "$KEYSTORE" \
  --ks-key-alias myreminder_qna \
  --ks-pass pass:myreminderqna \
  --key-pass pass:myreminderqna \
  --out "$OUT_APK" \
  "$BUILD_DIR/aligned.apk"

"$APKSIGNER" verify "$OUT_APK"
cp "$OUT_APK" "/Users/Hasan/Desktop/MyReminder.apk" || true
echo "[MyReminder APK] Successfully built & signed: $OUT_APK ($(wc -c < "$OUT_APK" | tr -d ' ') bytes)"
