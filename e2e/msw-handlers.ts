import { http, type HttpHandler } from 'msw';
import { DEFAULT_E2E_CREDENTIALS, E2E_STORAGE_KEYS } from './e2e-credentials';

export interface E2EExercise {
  id: string;
  name: string;
  muscle_group: string;
  user_id: string | null;
  is_public: boolean;
  is_bodyweight: boolean;
  load_type: 'external' | 'bodyweight' | 'machine';
  equipment: string | null;
  created_at: string;
}

interface E2EMuscle {
  exercise_id: string;
  muscle_group: string;
  role: 'primary' | 'secondary';
  weight: number;
}

const E2E_USER = {
  id: 'e2e-user-id',
  aud: 'authenticated',
  role: 'authenticated',
  email: DEFAULT_E2E_CREDENTIALS.email,
  email_confirmed_at: '2026-01-01T00:00:00.000Z',
  phone: '',
  confirmed_at: '2026-01-01T00:00:00.000Z',
  last_sign_in_at: '2026-01-01T00:00:00.000Z',
  app_metadata: { provider: 'email', providers: ['email'] },
  user_metadata: { full_name: 'Usuario E2E', username: 'e2e-user' },
  identities: [],
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
  is_anonymous: false,
} as const;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, apikey, content-type, x-client-info, prefer, range, x-supabase-api-version',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, PUT, DELETE, OPTIONS',
} as const;

const initialExercises: E2EExercise[] = [
  {
    id: 'exercise-bench-press',
    name: 'Press banca',
    muscle_group: 'Pecho',
    user_id: null,
    is_public: true,
    is_bodyweight: false,
    load_type: 'external',
    equipment: 'Barra',
    created_at: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'exercise-squat',
    name: 'Sentadilla',
    muscle_group: 'Pierna',
    user_id: null,
    is_public: true,
    is_bodyweight: false,
    load_type: 'external',
    equipment: 'Barra',
    created_at: '2026-01-01T00:00:00.000Z',
  },
];

let exercises = [...initialExercises];
let exerciseMuscles: E2EMuscle[] = [];
let nextExerciseId = 1;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...CORS_HEADERS,
      'Content-Type': 'application/json',
    },
  });
}

function expectedCredentials(): { email: string; password: string } {
  try {
    return {
      email: localStorage.getItem(E2E_STORAGE_KEYS.email) ?? DEFAULT_E2E_CREDENTIALS.email,
      password: localStorage.getItem(E2E_STORAGE_KEYS.password) ?? DEFAULT_E2E_CREDENTIALS.password,
    };
  } catch {
    return { ...DEFAULT_E2E_CREDENTIALS };
  }
}

function base64Url(value: object): string {
  return btoa(JSON.stringify(value)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function sessionResponse(): Record<string, unknown> {
  const expiresAt = Math.floor(Date.now() / 1000) + 3600;
  const header = base64Url({ alg: 'HS256', typ: 'JWT' });
  const payload = base64Url({
    sub: E2E_USER.id,
    aud: 'authenticated',
    role: 'authenticated',
    exp: expiresAt,
  });
  const accessToken = `${header}.${payload}.e2e-signature`;

  return {
    access_token: accessToken,
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: expiresAt,
    refresh_token: 'e2e-refresh-token',
    user: E2E_USER,
  };
}

const preflightHandler = http.options(
  '*',
  () => new Response(null, { status: 204, headers: CORS_HEADERS }),
);

const authTokenHandler = http.post('*/auth/v1/token', async ({ request }) => {
  const url = new URL(request.url);
  const grantType = url.searchParams.get('grant_type');

  if (grantType === 'refresh_token') {
    return json(sessionResponse());
  }

  const credentials = (await request.json()) as { email?: string; password?: string };
  const expected = expectedCredentials();
  if (credentials.email !== expected.email || credentials.password !== expected.password) {
    return json(
      {
        error: 'invalid_grant',
        error_description: 'Invalid login credentials',
      },
      400,
    );
  }

  return json(sessionResponse());
});

const authUserHandler = http.get('*/auth/v1/user', () => json(E2E_USER));
const authLogoutHandler = http.post('*/auth/v1/logout', () => new Response(null, { status: 204 }));

const exercisesListHandler = http.get('*/rest/v1/exercises', () => json(exercises));

const exercisesCreateHandler = http.post('*/rest/v1/exercises', async ({ request }) => {
  const payload = (await request.json()) as Partial<E2EExercise>;
  const exercise: E2EExercise = {
    id: `e2e-custom-exercise-${nextExerciseId++}`,
    name: payload.name ?? 'Ejercicio E2E',
    muscle_group: payload.muscle_group ?? 'Otro',
    user_id: payload.user_id ?? E2E_USER.id,
    is_public: false,
    is_bodyweight: payload.is_bodyweight ?? false,
    load_type: payload.load_type ?? 'external',
    equipment: payload.equipment ?? null,
    created_at: new Date().toISOString(),
  };
  exercises = [...exercises, exercise];
  return json(exercise, 201);
});

const exercisesUpdateHandler = http.patch('*/rest/v1/exercises', async ({ request }) => {
  const payload = (await request.json()) as Partial<E2EExercise>;
  const id = new URL(request.url).searchParams.get('id')?.replace('eq.', '');
  const existing = exercises.find((exercise) => exercise.id === id);
  const updated = existing ? { ...existing, ...payload } : (payload as E2EExercise);
  exercises = existing
    ? exercises.map((exercise) => (exercise.id === id ? updated : exercise))
    : [...exercises, updated];
  return json(updated);
});

const exercisesDeleteHandler = http.delete('*/rest/v1/exercises', ({ request }) => {
  const id = new URL(request.url).searchParams.get('id')?.replace('eq.', '');
  exercises = exercises.filter((exercise) => exercise.id !== id);
  return new Response(null, { status: 204 });
});

const musclesListHandler = http.get('*/rest/v1/exercise_muscles', ({ request }) => {
  const exerciseId = new URL(request.url).searchParams.get('exercise_id')?.replace('eq.', '');
  const rows = exerciseId
    ? exerciseMuscles.filter((row) => row.exercise_id === exerciseId)
    : exerciseMuscles;
  return json(rows);
});

const musclesCreateHandler = http.post('*/rest/v1/exercise_muscles', async ({ request }) => {
  const payload = (await request.json()) as E2EMuscle | E2EMuscle[];
  const rows = Array.isArray(payload) ? payload : [payload];
  exerciseMuscles = [...exerciseMuscles, ...rows];
  return json(rows, 201);
});

const musclesUpdateHandler = http.patch('*/rest/v1/exercise_muscles', async ({ request }) => {
  const payload = (await request.json()) as Partial<E2EMuscle>;
  exerciseMuscles = exerciseMuscles.map((row) =>
    row.exercise_id === payload.exercise_id ? { ...row, ...payload } : row,
  );
  return json(payload);
});

const musclesDeleteHandler = http.delete('*/rest/v1/exercise_muscles', ({ request }) => {
  const exerciseId = new URL(request.url).searchParams.get('exercise_id')?.replace('eq.', '');
  exerciseMuscles = exerciseMuscles.filter((row) => row.exercise_id !== exerciseId);
  return new Response(null, { status: 204 });
});

const profilesListHandler = http.get('*/rest/v1/profiles', ({ request }) => {
  const url = new URL(request.url);
  const selectsGoal = url.searchParams.get('select')?.includes('goal') ?? false;
  const targetsE2eUser = url.searchParams.get('id') === 'eq.e2e-user-id';

  return selectsGoal && targetsE2eUser ? json([{ goal: 'strength' }]) : json([]);
});

const exercisesRpcHandler = http.post('*/rest/v1/rpc/get_exercises_with_usage', () =>
  json(exercises),
);

const saveWorkoutRpcHandler = http.post('*/rest/v1/rpc/save_workout_with_sets', () => json(null));

const safeRestHandler = http.all('*/rest/v1/:resource', () => json([]));

export const e2eHandlers: HttpHandler[] = [
  preflightHandler,
  authTokenHandler,
  authUserHandler,
  authLogoutHandler,
  exercisesListHandler,
  exercisesCreateHandler,
  exercisesUpdateHandler,
  exercisesDeleteHandler,
  musclesListHandler,
  musclesCreateHandler,
  musclesUpdateHandler,
  musclesDeleteHandler,
  profilesListHandler,
  exercisesRpcHandler,
  saveWorkoutRpcHandler,
  safeRestHandler,
];
