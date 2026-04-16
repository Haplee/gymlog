import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

const resources = {
  es: {
    translation: {
      common: {
        save: 'Guardar',
        cancel: 'Cancelar',
        delete: 'Eliminar',
        loading: 'Cargando...',
        back: 'Volver',
        next: 'Siguiente',
        ready: 'Listo',
      },
      onboarding: {
        title: '¡Bienvenido a GymLog v2!',
        subtitle: 'Configuremos tu perfil para darte una mejor experiencia.',
        goal: '¿Cuál es tu objetivo?',
        goal_volume: 'Ganar volumen',
        goal_strength: 'Ganar fuerza',
        goal_endurance: 'Resistencia',
        goal_fat_loss: 'Perder grasa',
        days: '¿Cuántos días entrenas por semana?',
        equipment: '¿De qué equipo dispones?',
        finish: 'Empezar a entrenar',
      },
      settings: {
        title: 'Ajustes',
        theme: 'Tema',
        language: 'Idioma',
        notifications: 'Notificaciones',
        notifications_desc: 'Permisos para recordatorios',
        sound: 'Sonido',
        sound_desc: 'Sonido al completar series',
        logout: 'Cerrar sesión',
        version: 'GymLog v2.0',
        about: 'Acerca de',
      },
      workout: {
        title: 'Entrenar',
        select_exercise: '- Ejercicio -',
        custom_exercise: '+ Personalizado',
        notes: 'Notas',
        no_notes: 'Anotaciones',
        new_note: 'Nueva nota...',
        recent_pr: 'PR reciente',
        sets: 'Series',
        reps: 'Reps',
        weight: 'Kg',
        add_set: '+ Serie',
        remove_all: '× Todas',
        save_workout: 'Guardar',
        saving: 'Guardando...',
        empty_sets: 'Añade una serie',
        new_pr_title: '🏆 ¡Nuevo récord personal!',
        new_pr_body: '{{exercise}}: {{weight}} kg estimado de 1RM',
        resume_banner: 'Entrenamiento en curso detectado',
        resume_desc: 'Tienes una sesión iniciada. ¿Quieres continuar?',
        continue: 'Continuar',
        discard: 'Descartar',
      },
      stats: {
        title: 'Estadísticas',
        muscle_dist: 'Distribución Muscular',
        progression: 'Progresión de Fuerza',
        total_volume: 'Volumen Total',
        workouts_done: 'Entrenamientos',
        records: 'Récords',
        no_data: 'Sin datos registrados',
      },
      history: {
        title: 'Historial',
        no_workouts: 'Aún no has registrado entrenamientos',
        start_first: 'Empezar primero',
        delete_confirm: '¿Eliminar este registro?',
        sets_view: 'Series',
        workouts_view: 'Entrenos',
        filter_all: 'Todos',
        export_btn: 'Exportar',
        import_btn: 'Importar',
        repeat: 'Repetir',
        share: 'Compartir',
        shared_msg: 'Workout compartido',
        import_error: 'Error al importar datos',
        import_success: 'Importados: {{count}}',
        series_plural: 'series',
      },
      auth: {
        login: 'Entrar',
        signup: 'Crear cuenta',
        email: 'Email',
        password: 'Contraseña',
        name: 'Nombre completo',
        username: 'Nombre de usuario',
        signin_google: 'Continuar con Google',
        switch_signup: '¿Sin cuenta? Crea una',
        switch_login: '¿Ya tienes cuenta? Inicia sesión',
        loading: 'Cargando...',
        verification: '¡Verifica tu email!',
      },
    },
  },
  en: {
    translation: {
      common: {
        save: 'Save',
        cancel: 'Cancel',
        delete: 'Delete',
        loading: 'Loading...',
        back: 'Back',
        next: 'Next',
        ready: 'Ready',
      },
      onboarding: {
        title: 'Welcome to GymLog v2!',
        subtitle: 'Set up your profile to optimize your experience.',
        goal: 'What is your goal?',
        goal_volume: 'Build muscle',
        goal_strength: 'Gain strength',
        goal_endurance: 'Endurance',
        goal_fat_loss: 'Fat loss',
        days: 'How many days per week?',
        equipment: 'What equipment do you have?',
        finish: 'Start training',
      },
      settings: {
        title: 'Settings',
        theme: 'Theme',
        language: 'Language',
        notifications: 'Notifications',
        notifications_desc: 'Permission for reminders',
        sound: 'Sound',
        sound_desc: 'Sound on set completion',
        logout: 'Sign out',
        version: 'GymLog v2.0',
        about: 'About',
      },
      workout: {
        title: 'Train',
        select_exercise: '- Exercise -',
        custom_exercise: '+ Custom',
        notes: 'Notes',
        no_notes: 'Annotations',
        new_note: 'New note...',
        recent_pr: 'Recent PR',
        sets: 'Sets',
        reps: 'Reps',
        weight: 'Kg',
        add_set: '+ Set',
        remove_all: '× All',
        save_workout: 'Save',
        saving: 'Saving...',
        empty_sets: 'Add a set',
        new_pr_title: '🏆 New Personal Record!',
        new_pr_body: '{{exercise}}: {{weight}} kg estimated 1RM',
        resume_banner: 'Workout in progress detected',
        resume_desc: 'You have an active session. Want to continue?',
        continue: 'Continue',
        discard: 'Discard',
      },
      stats: {
        title: 'Statistics',
        muscle_dist: 'Muscle Distribution',
        progression: 'Strength Progression',
        total_volume: 'Total Volume',
        workouts_done: 'Workouts',
        records: 'Records',
        no_data: 'No data recorded',
      },
      history: {
        title: 'History',
        no_workouts: 'No workouts recorded yet',
        start_first: 'Start first',
        delete_confirm: 'Delete this record?',
        sets_view: 'Sets',
        workouts_view: 'Workouts',
        filter_all: 'All',
        export_btn: 'Export',
        import_btn: 'Import',
        repeat: 'Repeat',
        share: 'Share',
        shared_msg: 'Workout shared',
        import_error: 'Error importing data',
        import_success: 'Imported: {{count}}',
        series_plural: 'sets',
      },
      auth: {
        login: 'Login',
        signup: 'Sign up',
        email: 'Email',
        password: 'Password',
        name: 'Full Name',
        username: 'Username',
        signin_google: 'Continue with Google',
        switch_signup: 'No account? Create one',
        switch_login: 'Already have an account? Login',
        loading: 'Loading...',
        verification: 'Check your email!',
      },
    },
  },
};

// Detectar idioma inicial desde localStorage de Zustand
const getInitialLanguage = () => {
  try {
    const settings = localStorage.getItem('gymlog-settings');
    if (settings) {
      const parsed = JSON.parse(settings);
      return parsed.state?.language || 'es';
    }
  } catch {
    return 'es';
  }
  return 'es';
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    lng: getInitialLanguage(),
    fallbackLng: 'es',
    interpolation: {
      escapeValue: false,
    },
  });

export default i18n;
