<div align="center">
  <img src="https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/People/People%20Lifting%20Weights.png" alt="Weight Lifting" width="120" />

# GymLog v2.0

<a href="https://git.io/typing-svg"><img src="https://readme-typing-svg.demolab.com?font=Fira+Code&weight=600&size=20&duration=3000&pause=1000&color=3ECF8E&center=true&vCenter=true&width=600&lines=Hipertrofia+y+Sobrecarga+Progresiva;Arquitectura+Offline-First+Robusta;Anal%C3%ADticas+Avanzadas+de+Entrenamiento" alt="Typing SVG" /></a>

  <p>PWA integral para el registro y análisis de entrenamientos de hipertrofia y fuerza. Diseñada con un enfoque <b>offline-first</b>, arquitectura escalable y rendimiento premium.</p>

  <p align="center">
    <a href="https://pesos-wine.vercel.app"><img src="https://img.shields.io/badge/LIVE_DEMO-pesos--wine.vercel.app-3ECF8E?style=for-the-badge&logoColor=white" alt="Live Demo" /></a>
  </p>
  
  <p align="center">
    <img src="https://img.shields.io/badge/React-19.2-61DAFB?style=flat-square&logo=react&logoColor=white" />
    <img src="https://img.shields.io/badge/TypeScript-5.7-3178C6?style=flat-square&logo=typescript&logoColor=white" />
    <img src="https://img.shields.io/badge/Vite-6.2-646CFF?style=flat-square&logo=vite&logoColor=white" />
    <img src="https://img.shields.io/badge/Supabase-DB-3ECF8E?style=flat-square&logo=supabase&logoColor=white" />
    <img src="https://img.shields.io/badge/Vercel-Deploy-000000?style=flat-square&logo=vercel&logoColor=white" />
  </p>
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

| Capa               | Tecnología                     | Función                                                           |
| :----------------- | :----------------------------- | :---------------------------------------------------------------- |
| **Frontend**       | React 19, TypeScript           | Motor visual estricto y sin regresiones.                          |
| **Estilos**        | CSS Custom Tokens, TailwindCSS | Flexibilidad al máximo y consistencia visual premium.             |
| **Data Fetching**  | TanStack Query v5              | Server state, actualizaciones optimistas y <i>caching</i> nativo. |
| **Store Global**   | Zustand                        | Estado de IU ligero y sincronizado offline.                       |
| **Backend & Auth** | Supabase (PostgreSQL)          | JWT Auth, Row Level Security y lógica RPC.                        |
| **Testing E2E**    | Playwright, Vitest             | BDD/TDD multi-dispositivo (iPhone, Pixel simulado).               |

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

### 1. Variables de Entorno (`.env.local`)

```env
VITE_SUPABASE_URL=xxxx
VITE_SUPABASE_KEY=xxxx
```

### 2. Arranque

```bash
# Preparar clúster local de dependencias
npm install

# Instanciar desarrollo con HMR
npm run dev

# Tests en terminal
npm run test:coverage
```

---

<div align="center">
  <img src="https://capsule-render.vercel.app/api?type=waving&color=3ECF8E&height=100&section=footer" alt="Footer animated wave" />
</div>

## <img src="https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/Travel%20and%20places/Globe%20with%20Meridians.png" width="35" align="center" /> Conexión y Autoría

<div align="center">

  <img src="https://github-readme-stats.vercel.app/api?username=Haplee&show_icons=true&theme=radical&hide_border=true&bg_color=0D1117&icon_color=3ECF8E&text_color=FFFFFF&title_color=3ECF8E" alt="Haplee's GitHub Stats" />
  
  <br><br>

<a href="https://github.com/Haplee"><img src="https://img.shields.io/badge/GitHub-100000?style=for-the-badge&logo=github&logoColor=white" /></a>
<a href="https://x.com/FranVidalMateo"><img src="https://img.shields.io/badge/Twitter-000000?style=for-the-badge&logo=x&logoColor=white" /></a>
<a href="https://www.instagram.com/franvidalmateo"><img src="https://img.shields.io/badge/Instagram-E4405F?style=for-the-badge&logo=instagram&logoColor=white" /></a>

<b>GymLog v2.0</b> • Creado con precisión y fiabilidad técnica por <a href="https://github.com/Haplee">Fran Vidal Mateo (Haplee)</a>

</div>
