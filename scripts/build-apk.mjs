// Compila el APK release de GymLog. La tarea Gradle (android/app/build.gradle) lo
// copia a la raíz del repo como GymLog.apk. Detecta un JDK 17+ porque Gradle no
// arranca con el JDK 8 que suele ser el JAVA_HOME por defecto en esta máquina.
import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { platform } from 'node:os';

const isWin = platform() === 'win32';

function jdkMajor(home) {
  const javaBin = isWin ? `${home}/bin/java.exe` : `${home}/bin/java`;
  if (!existsSync(javaBin)) return null;
  try {
    const out = execSync(`"${javaBin}" -version 2>&1`).toString();
    const m = out.match(/version "(\d+)/);
    return m ? Number(m[1]) : null;
  } catch {
    return null;
  }
}

function findJdk17Plus() {
  const candidates = [
    process.env.JAVA_HOME,
    'C:/Program Files/Android/Android Studio/jbr',
    'C:/Program Files/Eclipse Adoptium/jdk-21.0.10.7-hotspot',
    'C:/Program Files/Eclipse Adoptium/jdk-17.0.18.8-hotspot',
    '/usr/lib/jvm/java-21-openjdk',
    '/usr/lib/jvm/java-17-openjdk',
  ].filter(Boolean);
  for (const home of candidates) {
    const major = jdkMajor(home);
    if (major && major >= 17) return home;
  }
  return null;
}

const jdk = findJdk17Plus();
if (!jdk) {
  console.error(
    'No se encontró un JDK 17+ (Gradle lo necesita). Instala uno o añade su ruta en scripts/build-apk.mjs.',
  );
  process.exit(1);
}
console.log(`Usando JDK: ${jdk}`);

// En Windows el dir actual no está en PATH: hay que invocar con .\
const gradlew = isWin ? '.\\gradlew.bat' : './gradlew';
execSync(`${gradlew} assembleRelease`, {
  cwd: 'android',
  stdio: 'inherit',
  env: { ...process.env, JAVA_HOME: jdk },
});
console.log('Listo: GymLog.apk actualizado en la raíz del repo.');
