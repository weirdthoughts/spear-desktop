import { parentPort, workerData } from 'node:worker_threads';
import { BG } from 'bgutils-js';
import { Window } from 'happy-dom';

const port = parentPort!;
let serial = 0;
const pending = new Map<
  number,
  { resolve: (r: Response) => void; reject: (e: Error) => void }
>();
port.on('message', (m) => {
  const request = pending.get(m.id);
  if (!request) return;
  pending.delete(m.id);
  if (m.error) request.reject(new Error(m.error));
  else
    request.resolve(
      new Response(m.body, { status: m.status, headers: m.headers }),
    );
});
const network: typeof fetch = async (input, init) => {
  const request = new Request(input, init);
  const id = ++serial;
  const body =
    request.method === 'GET' || request.method === 'HEAD'
      ? undefined
      : await request.text();
  return new Promise<Response>((resolve, reject) => {
    pending.set(id, { resolve, reject });
    port.postMessage({
      type: 'fetch',
      id,
      url: request.url,
      method: request.method,
      headers: [...request.headers],
      body,
    });
  });
};
async function run() {
  if (workerData.mode === 'token') {
    const window = new Window();
    Object.assign(globalThis, { window, document: window.document });
    const bgConfig = {
      fetch: network,
      globalObj: globalThis,
      identifier: workerData.visitor,
      requestKey: 'O43z0dpjhgX20SCx4KAo',
    };
    const challenge = await BG.Challenge.create(bgConfig);
    const script =
      challenge?.interpreterJavascript
        .privateDoNotAccessOrElseSafeScriptWrappedValue;
    if (!script)
      throw new Error(
        'YouTube verification is unavailable. Please try again later.',
      );
    new Function(script)();
    const result = await BG.PoToken.generate({
      program: challenge.program,
      globalName: challenge.globalName,
      bgConfig,
    });
    return result.poToken;
  }
  const ffmpeg = (await import('@ffmpeg.wasm/main')).createFFmpeg({
    log: false,
  });
  await ffmpeg.load();
  ffmpeg.setProgress(({ ratio }) =>
    port.postMessage({ type: 'progress', ratio }),
  );
  ffmpeg.FS('writeFile', 'input', workerData.bytes);
  await ffmpeg.run(
    '-i',
    'input',
    ...workerData.args,
    `output.${workerData.extension}`,
  );
  return ffmpeg.FS('readFile', `output.${workerData.extension}`);
}
run()
  .then((result) => port.postMessage({ type: 'done', result }))
  .catch(() => {
    port.postMessage({
      type: 'error',
      error:
        workerData.mode === 'token'
          ? 'YouTube verification failed. Please retry or sign in again.'
          : 'Audio conversion failed. Try the Source format.',
    });
  });
