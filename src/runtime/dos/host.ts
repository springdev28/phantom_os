import type { CommandInterface, Emulators, InitFs } from 'emulators';
import type { LaunchProfile } from '../../domain/contracts';

export interface HostStart {
  assets: Record<string, ArrayBuffer>;
  files: { path: string; contents: Uint8Array<ArrayBuffer> }[];
  config: string;
  controls: LaunchProfile['controls'];
  keys: Readonly<Record<string, number>>;
}

/** Runs in an opaque-origin sandbox. MUST remain self-contained: embedded in hash-bound host HTML.
 * All vendor requests resolve from audited in-memory assets. CSP denies connections.
 * No parent globals, storage, external URLs, runtime-supplied configuration or logs.
 */
export function dosHost() {
  let ci: CommandInterface | undefined;
  let port: MessagePort;
  let stopped = false;
  let frames = 0, audioSamples = 0, audioPeak = 0, keyEvents = 0, mouseEvents = 0;
  const canvas = document.querySelector('canvas')!;
  const context = canvas.getContext('2d', { alpha: false })!;
  const audioButton = document.querySelector<HTMLButtonElement>('#audio')!;
  const releaseButton = document.querySelector<HTMLButtonElement>('#release')!;
  const inputStatus = document.querySelector<HTMLElement>('#input-status')!;
  const held = new Set<number>(), buttons = new Set<number>();
  const urls: string[] = [], workers: Worker[] = [];
  let audio: AudioContext | undefined, audioCursor = 0;
  let timer: ReturnType<typeof setInterval> | undefined;
  let health: ReturnType<typeof setInterval> | undefined, healthTimeout: ReturnType<typeof setTimeout> | undefined;
  let checkingHealth = false;
  let image: ImageData;
  const reply = (message: unknown) => port?.postMessage(message);
  const inputFocus = (focused: boolean) => { inputStatus.textContent = focused ? 'Keyboard: program' : 'Keyboard: browser'; reply({ type: 'input', focused }); };
  const blobUrl = (value: BlobPart) => { const url = URL.createObjectURL(new Blob([value], { type: 'text/javascript' })); urls.push(url); return url; };
  const deny = () => { throw new Error('External services are disabled.'); };
  const release = () => {
    for (const code of held) ci?.sendKeyEvent(code, false);
    for (const button of buttons) ci?.sendMouseButton(button, false);
    held.clear(); buttons.clear();
    if (document.pointerLockElement) document.exitPointerLock();
    inputFocus(false);
  };
  async function cleanup() {
    if (stopped) return;
    stopped = true; clearInterval(timer); clearInterval(health); clearTimeout(healthTimeout); release();
    for (const worker of workers) worker.terminate();
    if (audio && audio.state !== 'closed') await audio.close();
    for (const url of urls) URL.revokeObjectURL(url);
  }
  function resize(width: number, height: number) {
    if (width < 1 || height < 1 || width > 2048 || height > 2048) throw new Error('Invalid frame size');
    canvas.width = width; canvas.height = height; image = context.createImageData(width, height);
  }
  async function start(data: HostStart) {
    // An asset-only request facade. It cannot reach the network, even if a URL is
    // passed by a future vendor code path. No file data is ever used as a URL.
    const asset = (url: string): ArrayBuffer => {
      if (url !== 'wdosbox.js' && url !== 'wdosbox.wasm') return deny();
      const value = data.assets[url]; if (!value) return deny(); return value;
    };
    class LocalXHR {
      responseType = ''; readyState = 0; status = 200; response: string | ArrayBuffer = '';
      onreadystatechange: (() => void) | null = null;
      url = '';
      open(method: string, url: string) { if (method !== 'GET') deny(); asset(url); this.url = url; }
      overrideMimeType() { /* Local bytes only. */ }
      addEventListener() { /* No network events. */ }
      send() { const bytes = asset(this.url); this.response = this.responseType === 'arraybuffer' ? bytes : new TextDecoder().decode(bytes); this.readyState = 4; queueMicrotask(() => this.onreadystatechange?.()); }
    }
    Object.defineProperty(window, 'XMLHttpRequest', { value: LocalXHR });
    // Worker inherits connect-src 'none' from this frame; remove networking,
    // persistence and raw console output before the vendor worker initializes.
    const guard = `
      const no=()=>{throw Error('External services disabled')};
      for(const k of ['fetch','XMLHttpRequest','WebSocket','EventSource','RTCPeerConnection','webkitRTCPeerConnection','mozRTCPeerConnection','WebTransport','importScripts'])Object.defineProperty(self,k,{value:no});
      for(const k of ['indexedDB','caches'])Object.defineProperty(self,k,{value:undefined});
      if(self.navigator){Object.defineProperty(self.navigator,'storage',{value:undefined});Object.defineProperty(self.navigator,'sendBeacon',{value:no})}
      for(const k of ['log','warn','error','info','debug'])console[k]=()=>{};
      const NativeMemory=WebAssembly.Memory;
      WebAssembly.Memory=class extends NativeMemory {
        constructor(options){super({...options,maximum:Math.min(options.maximum??4096,4096)})}
      };
      let installedModule;
      Object.defineProperty(self,'Module',{get:()=>installedModule,set:value=>{
        installedModule=value;
        const initialized=value.onRuntimeInitialized;
        value.onRuntimeInitialized=()=>{
          const fs=value.FS,write=fs.write,createNode=fs.createNode;
          let growth=0,nodes=0;
          fs.createNode=function(...args){if(++nodes>4096)throw new fs.ErrnoError(51);return createNode.apply(this,args)};
          fs.write=function(stream,buffer,offset,length,position,...rest){
            const end=(position??stream.position)+length;
            const increase=Math.max(0,end-(stream.node.usedBytes??0));
            if(end>33554432||growth+increase>67108864)throw new fs.ErrnoError(51);
            const count=write.call(this,stream,buffer,offset,length,position,...rest);
            growth+=increase;return count;
          };
          initialized();
        };
      }});
    `;
    window.fetch = async input => {
      if (typeof input !== 'string' || input !== 'wdosbox.js') return deny();
      return new Response(new Blob([guard, asset(input)], { type: 'text/javascript' }), { status: 200 });
    };
    const NativeWorker = window.Worker;
    window.Worker = class extends NativeWorker {
      constructor(url: string | URL, options?: WorkerOptions) {
        if (!String(url).startsWith('blob:')) deny();
        super(url, options); workers.push(this);
        this.addEventListener('error', event => { event.preventDefault(); reply({ type: 'error' }); void cleanup(); });
        this.addEventListener('messageerror', () => { reply({ type: 'error' }); void cleanup(); });
      }
    };
    for (const name of ['WebSocket', 'EventSource', 'RTCPeerConnection', 'webkitRTCPeerConnection', 'mozRTCPeerConnection', 'WebTransport', 'showOpenFilePicker', 'showDirectoryPicker', 'showSaveFilePicker']) Object.defineProperty(window, name, { value: deny });
    for (const name of ['clipboard', 'storage', 'serviceWorker']) Object.defineProperty(navigator, name, { value: undefined });
    Object.defineProperty(navigator, 'sendBeacon', { value: deny });
    // eslint-disable-next-line no-console -- Suppress vendor logging; no user metadata enters application logs.
    for (const name of ['log', 'warn', 'error', 'info', 'debug'] as const) console[name] = () => { /* Never forward guest logs. */ };
    const script = document.createElement('script'); script.src = blobUrl(data.assets['emulators.js']!);
    await new Promise<void>((resolve, reject) => { script.onload = () => resolve(); script.onerror = () => reject(new Error('Asset load')); document.head.append(script); });
    const emulators = (window as unknown as { emulators: Emulators }).emulators;
    if (emulators.version !== '8.5.3 (aeecd448025fcd8fc2843a780660a8f7)') throw new Error('Build mismatch');
    emulators.pathPrefix = '';
    const init: InitFs = [{ dosboxConf: data.config, jsdosConf: { version: '8.5.3' } }, ...data.files];
    ci = await emulators.dosboxWorker(init, { audioWorklet: false, sockdrivePreload: 'none' });
    if (stopped) { await ci.exit(); return; }
    if (ci.net() !== null) throw new Error('Network must be disabled');
    if (ci.width() > 0 && ci.height() > 0) resize(ci.width(), ci.height());
    let receivedFrame: () => void;
    const firstFrame = new Promise<void>(resolve => { receivedFrame = resolve; });
    const events = ci.events();
    events.onFrameSize(resize);
    events.onFrame((rgb, rgba) => {
      if (stopped || !image) return;
      if (rgba?.length === image.data.length) image.data.set(rgba);
      else if (rgb?.length === canvas.width * canvas.height * 3) {
        for (let i = 0, j = 0; i < rgb.length; i += 3, j += 4) {
          image.data[j] = rgb[i]!; image.data[j + 1] = rgb[i + 1]!; image.data[j + 2] = rgb[i + 2]!; image.data[j + 3] = 255;
        }
      } else return;
      context.putImageData(image, 0, 0); frames++; receivedFrame();
    });
    // The documented classic DOSBox sound stream is mono Float32 at soundFrequency().
    events.onSoundPush(samples => {
      audioSamples += samples.length;
      for (const sample of samples) if (Number.isFinite(sample)) audioPeak = Math.max(audioPeak, Math.abs(sample));
      if (!audio || audio.state !== 'running' || !samples.length || samples.length > 131072) return;
      if (audioCursor > audio.currentTime + 0.25) return; // bounded playback queue
      const buffer = audio.createBuffer(1, samples.length, ci!.soundFrequency());
      buffer.getChannelData(0).set(samples);
      const source = audio.createBufferSource(); source.buffer = buffer; source.connect(audio.destination);
      audioCursor = Math.max(audioCursor, audio.currentTime + 0.015); source.start(audioCursor); audioCursor += buffer.duration;
      source.onended = () => source.disconnect();
    });
    events.onExit(() => { void cleanup().then(() => reply({ type: 'stopped' })); });
    events.onStdout(() => { /* Drain vendor buffering without retaining user output. */ });
    events.onMessage((type, message: unknown) => {
      // 8.5.3 also labels ordinary DOSBox hardware logs (e.g. DSP reset) "error".
      // Fatal backend/worker tags are defined by its protocol, not guest output.
      if (type === 'error' && typeof message === 'string' && /^\[(panic|worker)\]/.test(message)) {
        reply({ type: 'error' }); void cleanup();
      }
    });
    audioButton.hidden = !data.controls.audio;
    audioButton.onclick = async () => {
      try {
        if (!audio) { audio = new AudioContext(); await audio.resume(); audioCursor = audio.currentTime; audioButton.textContent = 'Mute audio'; }
        else if (audio.state === 'running') { await audio.suspend(); audioButton.textContent = 'Enable audio'; }
        else { await audio.resume(); audioCursor = audio.currentTime; audioButton.textContent = 'Mute audio'; }
      } catch { audioButton.textContent = 'Audio unavailable — retry'; }
    };
    function keyboard(event: KeyboardEvent, pressed: boolean) {
      if (event.ctrlKey && event.altKey && event.code === 'Escape') { event.preventDefault(); release(); releaseButton.focus(); return; }
      if (event.metaKey || (event.code === 'Tab' && !document.pointerLockElement)) return;
      if (event.ctrlKey && !event.altKey && ['KeyR', 'KeyL', 'KeyT', 'KeyW', 'KeyN', 'KeyF', 'KeyP', 'KeyI', 'KeyJ', 'KeyU', 'Equal', 'Minus', 'Digit0'].includes(event.code)) return;
      const code = data.keys[event.code]; if (code === undefined || stopped) return;
      event.preventDefault();
      if (pressed && held.has(code)) return;
      if (pressed) held.add(code); else held.delete(code);
      ci!.sendKeyEvent(code, pressed); keyEvents++;
    }
    canvas.addEventListener('keydown', event => keyboard(event, true));
    canvas.addEventListener('keyup', event => keyboard(event, false));
    canvas.addEventListener('focus', () => inputFocus(true));
    canvas.addEventListener('blur', release); window.addEventListener('blur', release);
    window.addEventListener('focus', () => inputFocus(document.activeElement === canvas));
    document.addEventListener('visibilitychange', () => { if (document.hidden) { release(); void audio?.suspend(); } });
    document.addEventListener('pointerlockchange', () => { if (!document.pointerLockElement) { for (const button of buttons) ci?.sendMouseButton(button, false); buttons.clear(); } });
    canvas.addEventListener('click', () => { canvas.focus(); if (data.controls.mouse === 'captured') void canvas.requestPointerLock()?.catch(() => { /* Browser may refuse capture. */ }); });
    canvas.addEventListener('mousemove', event => {
      if (data.controls.mouse === 'off') return;
      const rect = canvas.getBoundingClientRect();
      // object-fit: contain letterboxes the real frame inside this element.
      // Normalize against the displayed guest pixels, not the surrounding bars.
      const scale = Math.min(rect.width / canvas.width, rect.height / canvas.height);
      const width = canvas.width * scale, height = canvas.height * scale;
      if (width <= 0 || height <= 0) return;
      const left = rect.left + (rect.width - width) / 2, top = rect.top + (rect.height - height) / 2;
      if (document.pointerLockElement === canvas) ci!.sendMouseRelativeMotion(event.movementX / width, event.movementY / height);
      else if (data.controls.mouse === 'absolute') ci!.sendMouseMotion(Math.max(0, Math.min(1, (event.clientX - left) / width)), Math.max(0, Math.min(1, (event.clientY - top) / height)));
      else return;
      mouseEvents++;
    });
    canvas.addEventListener('mousedown', event => {
      canvas.focus(); if (data.controls.mouse === 'off' || event.button > 2) return;
      event.preventDefault(); const button = event.button === 1 ? 2 : event.button === 2 ? 1 : 0;
      buttons.add(button); ci!.sendMouseButton(button, true); mouseEvents++;
    });
    window.addEventListener('mouseup', () => { for (const button of buttons) ci?.sendMouseButton(button, false); buttons.clear(); });
    canvas.addEventListener('contextmenu', event => event.preventDefault());
    releaseButton.onclick = () => { release(); releaseButton.focus(); };
    for (const button of document.querySelectorAll<HTMLButtonElement>('[data-key]')) button.onclick = () => {
      const key = Number(button.dataset.key); ci!.simulateKeyPress(key); keyEvents += 2;
    };
    timer = setInterval(() => reply({ type: 'metrics', frames, audioSamples, audioPeak, keyEvents, mouseEvents }), 500);
    // The API resolves before a video mode exists. Running requires a real frame.
    await firstFrame;
    // A dead worker may never emit onExit. This documented request/response API
    // detects silent termination without treating a static framebuffer as a crash.
    health = setInterval(() => {
      if (stopped || checkingHealth || document.hidden) return;
      checkingHealth = true;
      healthTimeout = setTimeout(() => { if (!stopped) { reply({ type: 'error' }); void cleanup(); } }, 5000);
      void ci!.asyncifyStats().then(() => { checkingHealth = false; clearTimeout(healthTimeout); }, () => { reply({ type: 'error' }); void cleanup(); });
    }, 2000);
    reply({ type: 'running' });
  }
  async function guestFiles() {
    const tree = await ci!.fsTree(), files: { path: string; size: number }[] = [];
    let nodes = 0;
    const walk = (node: { name: string; size?: number | null; nodes?: unknown[] | null }, prefix: string, depth: number) => {
      if (depth > 32 || files.length >= 2048 || ++nodes > 4096) throw new Error('File limit');
      const path = depth === 0 && node.name === '.' ? '' : `${prefix}${node.name}`.replace(/^\//, '');
      if (node.nodes) for (const child of node.nodes) walk(child as typeof node, path ? `${path}/` : '', depth + 1);
      else if (path.startsWith('package/')) files.push({ path: path.slice(8), size: node.size ?? 0 });
    };
    walk(tree, '', 0); return files;
  }
  let fileQueue = Promise.resolve();
  window.addEventListener('message', event => {
    if (port || event.source !== parent || event.data !== 'phantom-dos-connect' || !event.ports[0]) return;
    port = event.ports[0];
    const handle = async (data: { type: string; id?: number; payload?: HostStart; path?: string; bytes?: Uint8Array }) => {
      try {
        if (data.type === 'start' && data.payload) await start(data.payload);
        else if (data.type === 'focus' && ci) { canvas.focus(); inputFocus(document.activeElement === canvas); }
        else if (data.type === 'release' && ci) { release(); releaseButton.focus(); }
        else if (data.type === 'stop') { release(); await ci?.exit(); await cleanup(); reply({ type: 'stopped' }); }
        else if (data.type === 'files' && ci) {
          reply({ type: 'reply', id: data.id, value: await guestFiles() });
        } else if (data.type === 'write' && ci) {
          if (!data.path || !/^[A-Za-z0-9_~!-]{1,8}(?:\.[A-Za-z0-9_~!-]{1,3})?$/.test(data.path)
            || !(data.bytes instanceof Uint8Array) || data.bytes.length > 8 * 1024 * 1024) throw new Error('Import limit');
          const files = await guestFiles();
          if (files.length >= 2048 || files.some(f => f.path.split('/')[0]?.toLowerCase() === data.path!.toLowerCase())
            || files.reduce((sum, f) => sum + f.size, 0) + data.bytes.length > 32 * 1024 * 1024) throw new Error('Import limit');
          await ci.fsWriteFile(`package/${data.path}`, data.bytes);
          reply({ type: 'reply', id: data.id, value: true });
        } else if (data.type === 'read' && ci && data.path && data.path.length < 1024 && !/[\\:]/.test(data.path) && !Array.from(data.path).some(char => char.charCodeAt(0) < 32) && !data.path.split('/').some(part => part === '..' || part === '.' || !part)) {
          const bytes = await ci.fsReadFile(`package/${data.path}`);
          if (bytes.length > 32 * 1024 * 1024) throw new Error('File limit');
          reply({ type: 'reply', id: data.id, value: bytes });
        } else throw new Error('Invalid operation');
      } catch {
        if (data.id) reply({ type: 'reply', id: data.id, error: true });
        else { reply({ type: 'error' }); await cleanup(); }
      }
    };
    port.onmessage = ({ data }: MessageEvent<Parameters<typeof handle>[0]>) => {
      // The supported API has single pending fsTree promises. Serialize transfers.
      if (['files', 'read', 'write'].includes(data.type)) fileQueue = fileQueue.then(() => handle(data));
      else void handle(data);
    }; port.start(); reply({ type: 'connected' });
  });
  window.addEventListener('error', event => { event.preventDefault(); reply({ type: 'error' }); void cleanup(); });
  window.addEventListener('unhandledrejection', event => { event.preventDefault(); reply({ type: 'error' }); void cleanup(); });
}
