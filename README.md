<div align="center">
  <img src="https://capsule-render.vercel.app/api?type=waving&color=3ECF8E&height=120&section=header&text=GymLog%20v2.5.2&fontSize=50&fontColor=ffffff&animation=fadeIn" alt="Header animated wave" />
  
  <br>

  <img src="./public/gimnasia.svg" alt="GymLog App Logo" width="130" />

  <br>

<a href="https://git.io/typing-svg"><img src="https://readme-typing-svg.demolab.com?font=Fira+Code&weight=600&size=20&duration=3000&pause=1000&color=3ECF8E&center=true&vCenter=true&width=600&lines=Hipertrofia+y+Sobrecarga+Progresiva;Arquitectura+Offline-First+Robusta;Anal%C3%ADticas+Avanzadas+de+Entrenamiento" alt="Typing SVG" /></a>

  <p>PWA integral para el registro y análisis de entrenamientos de hipertrofia y fuerza. Diseñada con un enfoque <b>offline-first</b>, arquitectura escalable y rendimiento premium.</p>

  <p align="center">
    <a href="https://pesos-wine.vercel.app"><img src="https://img.shields.io/badge/APP_Vercel-LIVE_DEMO-3ECF8E?style=for-the-badge&logo=vercel&logoColor=white" alt="Live Demo" /></a>
    <a href="https://Haplee.github.io/pesos/"><img src="https://img.shields.io/badge/APK_Download-Landing_Page-3ECF8E?style=for-the-badge&logo=android&logoColor=white" alt="Download APK" /></a>
  </p>
  
  <p align="center">
    <img src="https://img.shields.io/github/actions/workflow/status/Haplee/pesos/android-build.yml?style=flat-square&label=Android%20Build" />
    <img src="https://img.shields.io/badge/React-19.2-61DAFB?style=flat-square&logo=react&logoColor=white" />
    <img src="https://img.shields.io/badge/TypeScript-5.7-3178C6?style=flat-square&logo=typescript&logoColor=white" />
    <img src="https://img.shields.io/badge/Vite-6.2-646CFF?style=flat-square&logo=vite&logoColor=white" />
    <img src="https://img.shields.io/badge/Capacitor-8.3-646CFF?style=flat-square&logo=capacitor&logoColor=white" />
    <img src="https://img.shields.io/badge/Supabase-DB-3ECF8E?style=flat-square&logo=supabase&logoColor=white" />
  </p>
  <br>
  <img src="https://visitor-badge.laobi.icu/badge?page_id=Haplee.pesos&left_color=black&right_color=%233ECF8E&left_text=Visitantes" alt="Visitor Badge" />
</div>

<br>

## <img src="https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/Travel%20and%20places/High%20Voltage.png" width="35" align="center" /> Core Features (v2.5.2)

<table>
  <tr>
    <td align="center" width="50%">
      <img src="https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/Objects/Mobile%20Phone.png" alt="Mobile" width="50" />
      <br>
      <b>Experiencia Nativa Pro</b>
      <p>Modo <b>Edge-to-Edge</b> real, haptics (vibración) y soporte multinguüe completo (ES/EN) con persistencia.</p>
    </td>
    <td align="center" width="50%">
      <img src="https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/Symbols/Chart%20Increasing.png" alt="Chart" width="50" />
      <br>
      <b>Analíticas Premium</b>
      <p>Gráficos <i>Radar</i> de volumen, proyecciones reales de RM con Brzycki y seguimiento continuo de fatiga neuromuscular.</p>
    </td>
  </tr>
  <tr>
    <td align="center" width="50%">
      <img src="https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/Objects/Shield.png" alt="Shield" width="50" />
      <br>
      <b>Seguridad & Transparencia</b>
      <p>Implementación CSP, Row Level Security (RLS) en Supabase y gestión robusta de permisos de usuario.</p>
    </td>
    <td align="center" width="50%">
      <img src="https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/Travel%20and%20places/Rocket.png" alt="Rocket" width="50" />
      <br>
      <b>Automatización ASIR</b>
      <p>Pipeline de CI/CD integral con <b>GitHub Actions</b> que compila, verifica el linter y genera el APK automáticamente en cada push.</p>
    </td>
  </tr>
</table>

---

## <img src="https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/Objects/Hammer%20and%20Wrench.png" width="35" align="center" /> Stack Tecnológico

| Capa               | Tecnología        | Función                                                            |
| :----------------- | :---------------- | :----------------------------------------------------------------- |
| **Mobile Runtime** | Capacitor 8       | Puente nativo para acceso a hardware (Haptics, Insets).            |
| **Frontend**       | React 19, TS      | UI reactiva de alto rendimiento.                                   |
| **Data Flow**      | TanStack Query v5 | Gestión de estado de servidor, caché y sincronización offline.     |
| **Global Store**   | Zustand           | Estado local ligero y persistencia de ajustes (idioma, tema).      |
| **Backend**        | Supabase          | Base de datos PostgreSQL, Auth embebido y motor de almacenamiento. |
| **CI/CD**          | GitHub Actions    | Automatización de builds de Android con contenedores Linux.        |

---

## <img src="https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/Travel%20and%20places/Construction.png" width="35" align="center" /> Topología del Repositorio

El proyecto emplea una estructuración vertical basada en <i>features</i> para reducir el sobreacoplamiento global.

```text
src/
├── app/              # Shell principal, providers y configuración del sistema
├── features/         # Verticales independientes de funcionalidad:
│   ├── auth/         # Login, registro y perfiles de usuario
│   ├── routine/      # Gestión de entrenamientos y rutinas personalizadas
│   ├── stats/        # Analítica avanzada, Recharts y gráficos dinámicos
│   └── workout/      # Registro en vivo de ejercicios y cronómetros
├── shared/           # Infraestructura agnóstica compartido:
│   ├── lib/          # Algoritmia pura (1RM), i18n y lógica de Haptics
│   └── api/          # Capa de transporte de datos y tipos de Supabase
```

---

## <img src="https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/Objects/Laptop.png" width="35" align="center" /> Despliegue & DevOps

### 1. Entorno de Desarrollo

Para administradores iterando en el ecosistema local:

```bash
npm install        # Clúster de dependencias
npm run dev        # Hot Module Replacement
npm run lint       # Validación de código estricta
```

### 2. Pipeline de Producción (Android)

El repositorio incluye una configuración de **Jenkins-style** vía GitHub Actions en `.github/workflows/android-build.yml`:

- Compilación del bundle Web optimizado.
- Sincronización nativa con Capacitor.
- Generación de APK firmado para testeo.

---

## <img src="https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/Objects/Mobile%20Phone.png" width="35" align="center" /> GymLog Mobile Native Experience

GymLog v2.5.2 ha evolucionado a una aplicación nativa completa. Ventajas exclusivas del binario:

- **Haptic Feedback**: Micro-vibraciones táctiles al completar ejercicios exitosamente.
- **True Full-Screen**: Eliminación de barras negras mediante implementación nativa de `WindowInsets`.
- **Iconos Adaptativos**: Iconografía de alta resolución optimizada para Android 14+.
- **Persistencia**: Preferencias de idioma y sesión sincronizadas a nivel de dispositivo.

### Descargar Versión de Android

Puedes obtener el último APK directamente desde **[GitHub Releases](https://github.com/Haplee/pesos/releases/latest)**.

---

<div align="center">
  <img src="https://capsule-render.vercel.app/api?type=waving&color=3ECF8E&height=100&section=footer" alt="Footer animated wave" />
</div>

## <img src="https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/Travel%20and%20places/Globe%20with%20Meridians.png" width="35" align="center" /> Autoría y Conexión

<div align="center">
  <br>

  <img src="https://github-readme-stats.vercel.app/api?username=Haplee&show_icons=true&theme=radical&hide_border=true&bg_color=0D1117&icon_color=3ECF8E&text_color=FFFFFF&title_color=3ECF8E" alt="Haplee's GitHub Stats" />
  
  <br>

  <img src="https://github-readme-streak-stats.herokuapp.com/?user=Haplee&theme=radical&hide_border=true&background=0D1117&ring=3ECF8E&fire=3ECF8E&currStreakNum=FFFFFF" alt="GitHub Streaks" />
  
  <br><br>

<a href="https://github.com/Haplee"><img src="https://img.shields.io/badge/GitHub-100000?style=for-the-badge&logo=github&logoColor=white" /></a>
<a href="https://x.com/FranVidalMateo"><img src="https://img.shields.io/badge/Twitter-000000?style=for-the-badge&logo=x&logoColor=white" /></a>
<a href="https://www.instagram.com/franvidalmateo"><img src="https://img.shields.io/badge/Instagram-E4405F?style=for-the-badge&logo=instagram&logoColor=white" /></a>

<br><br>
<b>GymLog v2.5.2</b> • Diseñado por <a href="https://github.com/Haplee">Haplee</a>

</div>
