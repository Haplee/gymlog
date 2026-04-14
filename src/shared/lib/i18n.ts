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
    },
  },
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'es',
    interpolation: {
      escapeValue: false,
    },
  });

export default i18n;
