import { setupWorker } from 'msw/browser';
import { e2eHandlers } from '../../../e2e/msw-handlers';

export async function startE2EMocks(): Promise<void> {
  const worker = setupWorker(...e2eHandlers);
  await worker.start({
    onUnhandledRequest: 'bypass',
    quiet: true,
    serviceWorker: {
      url: '/mockServiceWorker.js',
      options: { scope: '/' },
    },
  });
}
