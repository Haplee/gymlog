<div align="center">
  <img src="https://capsule-render.vercel.app/api?type=waving&color=3ECF8E&height=120&section=header&text=GymLog%20v2.0&fontSize=50&fontColor=ffffff&animation=fadeIn" alt="Header animated wave" />
  
  <br>

  <img src="./public/gimnasia.svg" alt="GymLog App Logo" width="130" />

  <br>

<a href="https://git.io/typing-svg"><img src="https://readme-typing-svg.demolab.com?font=Fira+Code&weight=600&size=20&duration=3000&pause=1000&color=3ECF8E&center=true&vCenter=true&width=600&lines=Hipertrofia+y+Sobrecarga+Progresiva;Arquitectura+Offline-First+Robusta;Anal%C3%ADticas+Avanzadas+de+Entrenamiento" alt="Typing SVG" /></a>

  <p>PWA integral para el registro y análisis de entrenamientos de hipertrofia y fuerza. Diseñada con un enfoque <b>offline-first</b>, arquitectura escalable y rendimiento premium.</p>

  <p align="center">
    <a href="https://pesos-wine.vercel.app"><img src="https://img.shields.io/badge/LIVE_DEMO-pesos--wine.vercel.app-3ECF8E?style=for-the-badge&logoColor=white" alt="Live Demo" /></a>
    <a href="https://github.com/Haplee/pesos/releases/latest"><img src="https://img.shields.io/badge/DOWNLOAD_APK-Native_Android-3ECF8E?style=for-the-badge&logo=android&logoColor=white" alt="Download APK" /></a>
  </p>
  
  <p align="center">
    <img src="https://img.shields.io/badge/React-19.2-61DAFB?style=flat-square&logo=react&logoColor=white" />
    <img src="https://img.shields.io/badge/TypeScript-5.7-3178C6?style=flat-square&logo=typescript&logoColor=white" />
    <img src="https://img.shields.io/badge/Vite-6.2-646CFF?style=flat-square&logo=vite&logoColor=white" />
    <img src="https://img.shields.io/badge/Supabase-DB-3ECF8E?style=flat-square&logo=supabase&logoColor=white" />
    <img src="https://img.shields.io/badge/Vercel-Deploy-000000?style=flat-square&logo=vercel&logoColor=white" />
  </p>
  <br>
  <img src="https://visitor-badge.laobi.icu/badge?page_id=Haplee.pesos&left_color=black&right_color=%233ECF8E&left_text=Visitantes" alt="Visitor Badge" />
</div>

<br>

## <img src="https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/Travel%20and%20places/High%20Voltage.png" width="35" align="center" /> Core Features

<table>
  <tr>
    <td align="center" width="50%">
      <img src="https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/Objects/Mobile%20Phone.png" alt="Mobile" width="50" />
      <br>
      <b>Experiencia PWA Nativa</b>
      <p>Modo offline puro. Sigue entrenando sin conexión a internet; caché local inteligente y resiliencia con TanStack Query.</p>
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
      <b>Seguridad ASIR</b>
      <p>Implementación CSP, Rate Limiting contra fuerza bruta, y control RLS absoluto a nivel base de datos.</p>
    </td>
    <td align="center" width="50%">
      <img src="https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/Travel%20and%20places/Rocket.png" alt="Rocket" width="50" />
      <br>
      <b>Rendimiento Extremo</b>
      <p>Delegación a RPCs en Postgres, code-splitting estratégico con Suspense y validación no-bloqueante con Zod.</p>
    </td>
  </tr>
</table>

---

## <img src="https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/Objects/Hammer%20and%20Wrench.png" width="35" align="center" /> Stack Detallado

| <img src="https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/Objects/Desktop%20Computer.png" width="20" align="center"/> Capa | Tecnología                     | Función                                                           |
| :------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :----------------------------- | :---------------------------------------------------------------- |
| **Frontend**                                                                                                                                                         | React 19, TypeScript           | Motor visual estricto y sin regresiones.                          |
| **Estilos**                                                                                                                                                          | CSS Custom Tokens, TailwindCSS | Flexibilidad al máximo y consistencia visual premium.             |
| **Data Fetching**                                                                                                                                                    | TanStack Query v5              | Server state, actualizaciones optimistas y <i>caching</i> nativo. |
| **Store Global**                                                                                                                                                     | Zustand                        | Estado de IU ligero y sincronizado offline.                       |
| **Backend & Auth**                                                                                                                                                   | Supabase (PostgreSQL)          | JWT Auth, Row Level Security y lógica RPC.                        |
| **Testing E2E**                                                                                                                                                      | Playwright, Vitest             | BDD/TDD multi-dispositivo (iPhone, Pixel simulado).               |

---

## <img src="https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/Travel%20and%20places/Construction.png" width="35" align="center" /> Topología del Repositorio

El proyecto emplea una estructuración vertical basada en <i>features</i> para reducir el sobreacoplamiento global.

```text
src/
├── app/              # Shell principal, providers y manifiesto service-worker
├── features/         # Verticales independientes de funcionalidad:
│   ├── auth/         # Onboarding, Guards y Seguridad
│   ├── routine/      # Macros semanales y generación estática
│   ├── stats/        # Analítica y Recharts (motor vectorial genérico)
│   └── workout/      # Núcleo de interacción en vivo del ejercicio
├── shared/           # Elementos agnósticos e infraestructura global:
│   ├── api/          # Capa de transporte y types CLI automáticos (Tables<T>)
│   ├── components/   # UI Kit modular
│   └── lib/          # Algoritmia pura y abstracción de Supabase
```

---

## <img src="https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/Objects/Laptop.png" width="35" align="center" /> Despliegue Local

Para administradores iterando en el ecosistema de la app de forma local:

### <img src="https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/Objects/Locked.png" width="25" align="center" /> 1. Variables de Entorno (`.env.local`)

```env
VITE_SUPABASE_URL=xxxx
VITE_SUPABASE_KEY=xxxx
```

### <img src="https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/Objects/Gear.png" width="25" align="center" /> 2. Arranque

```bash
# Preparar clúster local de dependencias
npm install

# Instanciar desarrollo con HMR
npm run dev

# Tests en terminal
npm run test:coverage
```

---

## <img src="https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/Objects/Mobile%20Phone.png" width="35" align="center" /> GymLog Mobile (Nativo)

GymLog v2.0 ha evolucionado a una aplicación nativa completa mediante **Capacitor 8**. Ofrecemos una experiencia superior a la PWA estándar:

- **Haptics**: Vibración táctil al completar series y batir récords.
- **Edge-to-Edge**: Diseño que aprovecha el 100% de la pantalla (detrás de la barra de estado).
- **Notificaciones**: Recordatorios nativos y avisos de récords directamente en el sistema.

### Instalación Directa (Android)
1. Descarga el archivo `.apk` desde la sección de **[Releases](https://github.com/Haplee/pesos/releases/latest)**.
2. Abre el archivo en tu dispositivo Android.
3. Si el sistema te lo pide, permite la "Instalación desde fuentes desconocidas".

---

<div align="center">
  <img src="https://capsule-render.vercel.app/api?type=waving&color=3ECF8E&height=100&section=footer" alt="Footer animated wave" />
</div>

## <img src="https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/Travel%20and%20places/Globe%20with%20Meridians.png" width="35" align="center" /> Conexión y Autoría

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
<b>GymLog v2.0</b> • Creado con precisión y fiabilidad técnica por <a href="https://github.com/Haplee">Fran Vidal Mateo (Haplee)</a>

</div>
