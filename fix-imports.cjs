const fs = require('fs');
const path = require('path');

function walk(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    isDirectory ? walk(dirPath, callback) : callback(path.join(dir, f));
  });
}

function fixImports(filePath) {
  if (!filePath.endsWith('.ts') && !filePath.endsWith('.tsx')) return;
  
  let content = fs.readFileSync(filePath, 'utf8');
  let original = content;

  // Reemplazos de ../../ y ../ por alias en src/features
  // En lugar de regex locas, para los patrones clave en GymLog:

  const replacements = {
    // Stores
    "'../stores/authStore'": "'@features/auth/stores/authStore'",
    "'../../stores/authStore'": "'@features/auth/stores/authStore'",
    "'../../../stores/authStore'": "'@features/auth/stores/authStore'",
    "'../stores/workoutStore'": "'@features/workout/stores/workoutStore'",
    "'../../stores/workoutStore'": "'@features/workout/stores/workoutStore'",
    "'../stores/routineStore'": "'@features/routine/stores/routineStore'",
    "'../../stores/routineStore'": "'@features/routine/stores/routineStore'",
    "'../stores/settingsStore'": "'@shared/stores/settingsStore'",
    "'../../stores/settingsStore'": "'@shared/stores/settingsStore'",
    
    // Lib & DB
    "'../lib/supabase'": "'@shared/lib/supabase'",
    "'../../lib/supabase'": "'@shared/lib/supabase'",
    "'../../../lib/supabase'": "'@shared/lib/supabase'",
    "'../lib/types'": "'@shared/lib/types'",
    "'../../lib/types'": "'@shared/lib/types'",
    "'../../../lib/types'": "'@shared/lib/types'",
    "'../api/queries'": "'@shared/api/queries'",
    "'../../api/queries'": "'@shared/api/queries'",
    "'../lib/share'": "'@shared/lib/share'",
    "'../../lib/share'": "'@shared/lib/share'",
    "'../lib/brzycki'": "'@shared/lib/brzycki'",
    "'../../lib/brzycki'": "'@shared/lib/brzycki'",

    // Components
    "'../components/Layout'": "'@app/components/Layout'",
    "'../../components/Layout'": "'@app/components/Layout'",
    "'../components/RestTimer'": "'@app/components/RestTimer'",
    "'../../components/RestTimer'": "'@app/components/RestTimer'",
    "'../components/InstallPWA'": "'@app/components/InstallPWA'",
    "'../../components/InstallPWA'": "'@app/components/InstallPWA'",
    "'../components/PermissionRequests'": "'@app/components/PermissionRequests'",
    "'../../components/PermissionRequests'": "'@app/components/PermissionRequests'",
    
    // Nuevos componentes shared UI
    "'../shared/components/EmptyStates'": "'@shared/components/EmptyStates'",
    "'../../shared/components/EmptyStates'": "'@shared/components/EmptyStates'",
    "'../shared/components/ui'": "'@shared/components/ui'",
    "'../../shared/components/ui'": "'@shared/components/ui'",
    "'../shared/hooks/useRateLimit'": "'@shared/hooks/useRateLimit'",
    "'../../shared/hooks/useRateLimit'": "'@shared/hooks/useRateLimit'",
    "'../hooks/useWakeLock'": "'@shared/hooks/useWakeLock'",
    "'../../hooks/useWakeLock'": "'@shared/hooks/useWakeLock'",

    // Y arreglar HistoryPage a sus tipos
    "exercises.map((ex) =>": "exercises.map((ex: any) =>",
    "exercises.forEach((ex) =>": "exercises.forEach((ex: any) =>",
    "wo.sets.map((s" : "wo.sets.map((s: any",
    "groups[date][exercise].push(s)" : "grouped[date][exercise].push(s)",
    "filteredSets.map(s =>" : "filteredSets.map((s: any) =>",
    "filteredSets.forEach(s =>" : "filteredSets.forEach((s: any) =>"
  };

  Object.keys(replacements).forEach(key => {
    content = content.replaceAll(key, replacements[key]);
  });

  if (content !== original) {
    fs.writeFileSync(filePath, content);
    console.log(`Updated ${filePath}`);
  }
}

walk('./src', fixImports);
