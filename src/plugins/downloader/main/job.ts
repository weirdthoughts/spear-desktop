import createWorker from './worker?nodeWorker';

/** CPU-heavy verification and conversion never run on Electron's main thread. */
export function runDownloadJob<T>(
  data: Record<string, unknown>,
  fetcher: typeof fetch,
  progress: (ratio: number) => void = () => {},
): Promise<T> {
  return new Promise((resolve, reject) => {
    const worker = createWorker({ workerData: data });
    const controller = new AbortController();
    let settled = false;
    const finish = (error?: Error, result?: T) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      controller.abort();
      void worker.terminate();
      if (error) reject(error);
      else resolve(result!);
    };
    const timer = setTimeout(
      () =>
        finish(
          new Error(
            data.mode === 'token'
              ? 'YouTube verification timed out. Please try again.'
              : 'Audio conversion timed out. Try the Source format.',
          ),
        ),
      data.mode === 'token' ? 30000 : 180000,
    );
    worker.on('error', () =>
      finish(
        new Error('The download worker stopped unexpectedly. Please retry.'),
      ),
    );
    worker.on('exit', () => {
      if (!settled)
        finish(new Error('The download worker exited before finishing.'));
    });
    worker.on('message', async (message) => {
      if (settled) return;
      if (message.type === 'done') finish(undefined, message.result);
      else if (message.type === 'error') finish(new Error(message.error));
      else if (message.type === 'progress') progress(message.ratio);
      else if (message.type === 'fetch') {
        try {
          const url = new URL(message.url);
          if (
            url.protocol !== 'https:' ||
            !(
              url.hostname === 'www.youtube.com' ||
              url.hostname.endsWith('.googleapis.com')
            )
          )
            throw new Error('Unexpected verification address');
          const response = await fetcher(url, {
            method: message.method,
            headers: message.headers,
            body: message.body,
            signal: controller.signal,
          });
          const body = await response.text();
          if (!settled)
            worker.postMessage({
              id: message.id,
              status: response.status,
              headers: [...response.headers],
              body,
            });
        } catch {
          if (!settled)
            worker.postMessage({
              id: message.id,
              error: 'Verification request failed',
            });
        }
      }
    });
  });
}
