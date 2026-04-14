// SVG Empty States inline — sin dependencias externas
// Todos los estados vacíos con ilustraciones consistentes

// ── Sin entrenamientos ─────────────────────────
export function EmptyWorkout() {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
      <svg
        width="120"
        height="120"
        viewBox="0 0 120 120"
        fill="none"
        aria-hidden="true"
        className="mb-5 opacity-80"
      >
        <circle cx="60" cy="60" r="56" fill="var(--bg-elevated)" />
        {/* Mancuerna */}
        <rect x="30" y="53" width="60" height="14" rx="7" fill="var(--border-strong)" />
        <rect
          x="18"
          y="44"
          width="16"
          height="32"
          rx="6"
          fill="var(--color-primary)"
          opacity="0.7"
        />
        <rect
          x="86"
          y="44"
          width="16"
          height="32"
          rx="6"
          fill="var(--color-primary)"
          opacity="0.7"
        />
        <rect x="22" y="38" width="8" height="44" rx="4" fill="var(--color-primary)" />
        <rect x="90" y="38" width="8" height="44" rx="4" fill="var(--color-primary)" />
        {/* Estrella */}
        <circle cx="82" cy="30" r="12" fill="var(--bg-elevated)" />
        <text x="82" y="35" textAnchor="middle" fontSize="14">
          💪
        </text>
      </svg>
      <h3 className="text-[--text-xl] font-bold text-[--text-primary] mb-2">
        ¡Empieza a entrenar!
      </h3>
      <p className="text-[--text-secondary] text-[--text-sm] max-w-xs">
        Selecciona un ejercicio, añade tus series y guarda tu primer entrenamiento.
      </p>
    </div>
  );
}

// ── Sin historial ───────────────────────────────
export function EmptyHistory() {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
      <svg
        width="120"
        height="120"
        viewBox="0 0 120 120"
        fill="none"
        aria-hidden="true"
        className="mb-5 opacity-80"
      >
        <circle cx="60" cy="60" r="56" fill="var(--bg-elevated)" />
        {/* Calendario */}
        <rect x="28" y="35" width="64" height="54" rx="8" fill="var(--border-strong)" />
        <rect
          x="28"
          y="35"
          width="64"
          height="18"
          rx="8"
          fill="var(--color-primary)"
          opacity="0.6"
        />
        <rect
          x="32"
          y="39"
          width="56"
          height="10"
          rx="4"
          fill="var(--color-primary)"
          opacity="0.4"
        />
        {/* Cuadraditos */}
        {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((i) => (
          <rect
            key={i}
            x={36 + (i % 4) * 15}
            y={62 + Math.floor(i / 4) * 14}
            width="10"
            height="10"
            rx="3"
            fill="var(--color-primary)"
            opacity={0.15 + i * 0.07}
          />
        ))}
        <text x="60" y="78" textAnchor="middle" fontSize="14">
          📅
        </text>
      </svg>
      <h3 className="text-[--text-xl] font-bold text-[--text-primary] mb-2">Sin historial aún</h3>
      <p className="text-[--text-secondary] text-[--text-sm] max-w-xs">
        Guarda entrenamientos y aparecerán aquí para que puedas revisarlos.
      </p>
    </div>
  );
}

// ── Sin estadísticas ────────────────────────────
export function EmptyStats() {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
      <svg
        width="120"
        height="120"
        viewBox="0 0 120 120"
        fill="none"
        aria-hidden="true"
        className="mb-5 opacity-80"
      >
        <circle cx="60" cy="60" r="56" fill="var(--bg-elevated)" />
        {/* Gráfico de barras */}
        <rect x="30" y="80" width="60" height="3" rx="1.5" fill="var(--border-strong)" />
        <rect
          x="38"
          y="65"
          width="12"
          height="15"
          rx="3"
          fill="var(--color-primary)"
          opacity="0.3"
        />
        <rect
          x="54"
          y="50"
          width="12"
          height="30"
          rx="3"
          fill="var(--color-primary)"
          opacity="0.55"
        />
        <rect
          x="70"
          y="42"
          width="12"
          height="38"
          rx="3"
          fill="var(--color-primary)"
          opacity="0.85"
        />
        {/* Flecha arriba */}
        <path
          d="M76 36 L76 44 M72 40 L76 36 L80 40"
          stroke="var(--color-primary)"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
      <h3 className="text-[--text-xl] font-bold text-[--text-primary] mb-2">Sin estadísticas</h3>
      <p className="text-[--text-secondary] text-[--text-sm] max-w-xs">
        Completa entrenamientos para ver tu progreso y tendencias aquí.
      </p>
    </div>
  );
}

// ── Sin rutina ──────────────────────────────────
export function EmptyRoutine() {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
      <svg
        width="120"
        height="120"
        viewBox="0 0 120 120"
        fill="none"
        aria-hidden="true"
        className="mb-5 opacity-80"
      >
        <circle cx="60" cy="60" r="56" fill="var(--bg-elevated)" />
        {/* Lista con check */}
        <rect x="32" y="38" width="56" height="44" rx="8" fill="var(--border-strong)" />
        {[0, 1, 2].map((i) => (
          <g key={i}>
            <rect x="38" y={50 + i * 14} width="8" height="8" rx="2" fill="var(--bg-elevated)" />
            <rect
              x="50"
              y={52 + i * 14}
              width="28"
              height="4"
              rx="2"
              fill="var(--bg-elevated)"
              opacity="0.5"
            />
          </g>
        ))}
        <text x="60" y="50" textAnchor="middle" fontSize="16">
          📋
        </text>
      </svg>
      <h3 className="text-[--text-xl] font-bold text-[--text-primary] mb-2">
        Sin rutina configurada
      </h3>
      <p className="text-[--text-secondary] text-[--text-sm] max-w-xs">
        Planifica tu semana asignando ejercicios a cada día.
      </p>
    </div>
  );
}
