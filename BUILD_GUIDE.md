# Build Guide for KnotQuite

This guide explains how to build KnotQuite for desktop (Electron) and Android.

## Prerequisites

### For Both Platforms
- **Node.js** 16+ (check: `node --version`)
- **npm** 8+ (check: `npm --version`)

### For Desktop (Electron)
- Pre-installed with dependencies (no additional setup needed)

### For Android
- **Java Development Kit (JDK)** 11 or higher
  - **Mac**: `brew install openjdk@17`
  - **Windows**: Download from https://adoptium.net/
  - **Linux**: `sudo apt install openjdk-17-jdk` (Debian/Ubuntu) or `sudo pacman -S jdk17-openjdk` (Arch)
  
- **Android SDK** (via Android Studio)
  - Download from https://developer.android.com/studio
  - Install and set `ANDROID_HOME` environment variable
  - Install API level 30+ via SDK Manager

- **Gradle** (usually comes with Android Studio)

## Building for Desktop (Electron)

### 1. Build the App

```bash
npm run build
```

This creates:
- `dist/renderer/` — compiled React app
- `dist/main/` — compiled Electron main process

### 2. Package for Desktop

```bash
npm run package
```

This creates installer files in the `release/` directory:
- **Windows**: `.exe` installer
- **Mac**: `.dmg` image
- **Linux**: `.AppImage` or `.deb` package

### 3. Run in Development Mode

```bash
npm run dev
```

This:
- Starts Vite dev server at http://localhost:5173
- Opens Electron window with hot reload
- Great for testing changes

### 4. Run the Packaged App

```bash
npm start
```

Runs the already-built Electron app (no dev server needed).

---

## Building for Android

### 1. Set Up Environment Variables

```bash
# macOS / Linux
export ANDROID_HOME=$HOME/Library/Android/sdk  # macOS
export ANDROID_HOME=$HOME/Android/Sdk          # Linux
export PATH=$PATH:$ANDROID_HOME/tools:$ANDROID_HOME/platform-tools

# Windows (set in System Properties or command prompt)
set ANDROID_HOME=C:\Users\YourUsername\AppData\Local\Android\sdk
set PATH=%PATH%;%ANDROID_HOME%\tools;%ANDROID_HOME%\platform-tools
```

Verify:
```bash
which adb  # should show path to Android Debug Bridge
```

### 2. Build and Sync

```bash
npm run build
npx capacitor sync android
```

### 3. Build APK

Navigate to the android folder and build:

```bash
cd android
./gradlew build        # Debug APK
./gradlew assembleRelease  # Release APK (requires signing config)
```

Output files:
- **Debug**: `android/app/build/outputs/apk/debug/app-debug.apk`
- **Release**: `android/app/build/outputs/apk/release/app-release.apk`

### 4. Install on Device/Emulator

```bash
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
```

Or open Android Studio:
```bash
npx capacitor open android
# Then: Build > Build Bundle(s) / APK(s) > Build APK(s)
```

### 5. Run on Device

```bash
adb shell am start -n com.urlxl.knotquite/.MainActivity
```

Or in Android Studio: **Run > Run 'app'**

---

## Quick Reference

### Desktop
```bash
npm run dev        # Dev mode (hot reload)
npm run build      # Build for distribution
npm run package    # Create installer
npm start          # Run built app
```

### Android
```bash
npm run build                    # Build web assets
npx capacitor sync android       # Sync to Android project
cd android && ./gradlew build    # Build APK
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
```

---

## Troubleshooting

### Desktop Build Fails
- Clear cache: `rm -rf dist node_modules && npm install`
- Check Node version: `node --version` (should be 16+)
- Try: `npm run build:renderer` then `npm run build:main` separately

### Android Build Fails

**"JAVA_HOME is not set"**
```bash
export JAVA_HOME=/usr/libexec/java_home -v 17  # macOS
export JAVA_HOME=/usr/lib/jvm/java-17-openjdk  # Linux
# Windows: set JAVA_HOME=C:\Program Files\Eclipse Adoptium\jdk-17.X.X
```

**"Android SDK not found"**
- Download Android Studio
- Open SDK Manager (Tools > SDK Manager)
- Install API 30+ and build tools
- Set `ANDROID_HOME` environment variable

**"Gradle build failed"**
```bash
cd android
./gradlew clean build  # Clean build
```

**APK installation fails**
```bash
adb uninstall com.urlxl.knotquite  # Remove old version first
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
```

---

## Testing the Build

### Desktop
1. Run `npm run dev`
2. Play a Daily puzzle (should be same every day)
3. Play a Random puzzle (should be different)
4. Switch between modes (puzzles should not overlap)

### Android
1. Install APK: `adb install -r android/app/build/outputs/apk/debug/app-debug.apk`
2. Launch app on device
3. Run same tests as desktop

---

## Release Build

For production release, use:

```bash
# Desktop
npm run package

# Android (requires signing key)
cd android
./gradlew assembleRelease
# Then sign the APK with your release keystore
```

See Android's [app signing guide](https://developer.android.com/studio/publish/app-signing) for details.

---

## Notes

- **Puzzle data** is bundled into both builds from `src/data/puzzles.json`
- **Daily order** is deterministic (based on epoch date), so same date = same puzzle
- **Random mode** tracks played puzzles in device storage (iOS localStorage or Android SharedPreferences)
- Both builds are fully offline after initial install

---

## Support

If builds fail, check:
1. `npm run build` succeeds
2. TypeScript compiles: `npx tsc --noEmit`
3. For Android: Java, Android SDK, and Gradle are properly installed
4. All environment variables are set correctly
