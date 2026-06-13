import { domMax } from 'framer-motion';

// domMax (no domAnimation): la app usa layout/layoutId (Layout.tsx, WorkoutExerciseCard).
// Cargado async por LazyMotion en App.tsx para sacarlo del bundle inicial.
export default domMax;
