// Крупье v6: кадры нарезаны из непрерывных видеоклипов Kling, снятых на хромакее.
// Внутри клипа личность, свет и масштаб совпадают сами собой, а клип начинается
// и заканчивается одной позой — поэтому действия стыкуются без рывка.
//
// Рисуем в canvas по заранее раскодированным ImageBitmap. Смена background-image
// заставляла браузер декодировать картинку в момент показа, и кадр успевал
// мигнуть пустотой; с готовыми битмапами перерисовка стоит один drawImage.
const MANIFEST = './dealer-v6/manifest.json';

async function decodeFrame(source) {
  const response = await fetch(source);
  return createImageBitmap(await response.blob());
}

/**
 * Кадры раскодируются по очереди, а не все разом: первый готов почти сразу,
 * и крупье появляется, не дожидаясь остальных семидесяти девяти.
 */
async function decodeAll(sources, onFirst) {
  const bitmaps = [];
  for (const source of sources) {
    bitmaps.push(await decodeFrame(source));
    if (bitmaps.length === 1 && onFirst) onFirst(bitmaps);
  }
  return bitmaps;
}

export async function createDealer(root, { manifestUrl = MANIFEST, rail } = {}) {
  if (!root) throw new Error('Крупье негде показать: не передан контейнер');
  const manifest = await fetch(manifestUrl).then((response) => response.json());
  const names = Object.keys(manifest.sequences);
  if (!names.length) throw new Error('В манифесте крупье нет ни одной последовательности');

  const resting = names.includes('idle') ? 'idle' : names[0];
  const body = root.querySelector('[data-dealer-body]');
  const hands = root.querySelector('[data-dealer-hands]');
  const readRail = () => rail ?? Number(
    getComputedStyle(root).getPropertyValue('--dealer-rail').trim() || 0.7,
  );

  const { frameWidth, frameHeight } = manifest;
  const layers = [body, hands].filter(Boolean).map((element) => {
    const canvas = element.tagName === 'CANVAS' ? element : element.appendChild(document.createElement('canvas'));
    return { canvas, context: canvas.getContext('2d'), isBody: element === body };
  });

  const decoded = new Map();
  const decode = (name) => {
    if (decoded.has(name)) return decoded.get(name);
    const task = decodeAll(manifest.sequences[name].frames, (partial) => {
      if (!ready.has(name)) ready.set(name, partial);
    });
    decoded.set(name, task);
    return task;
  };

  let ready = new Map();
  let current = resting;
  let frame = 0;
  let queued = [];
  let last = 0;
  let raf = 0;

  const paint = () => {
    const bitmaps = ready.get(current);
    const bitmap = bitmaps?.[frame];
    if (!bitmap) return;
    const railY = Math.round(frameHeight * readRail());
    for (const layer of layers) {
      const sourceY = layer.isBody ? 0 : railY;
      const sourceHeight = layer.isBody ? railY : frameHeight - railY;
      const width = layer.canvas.width;
      const height = Math.round((sourceHeight / frameWidth) * width);
      if (layer.canvas.height !== height) layer.canvas.height = height;
      layer.context.clearRect(0, 0, width, height);
      layer.context.drawImage(bitmap, 0, sourceY, frameWidth, sourceHeight, 0, 0, width, height);
    }
  };

  const resize = () => {
    let ready_ = false;
    for (const layer of layers) {
      const box = layer.canvas.parentElement.getBoundingClientRect();
      if (box.width > 0) ready_ = true;
      const scale = Math.min(globalThis.devicePixelRatio || 1, 2);
      const width = Math.max(1, Math.round(box.width * scale));
      if (layer.canvas.width !== width) layer.canvas.width = width;
    }
    paint();
    return ready_;
  };

  const tick = (now) => {
    raf = requestAnimationFrame(tick);
    const sequence = manifest.sequences[current];
    if (now - last < 1000 / sequence.fps) return;
    last = now;
    frame += 1;
    if (frame < (ready.get(current)?.length ?? sequence.frames.length)) {
      paint();
      return;
    }
    // Конец клипа совпадает с началом, поэтому переход не даёт скачка.
    frame = 0;
    if (queued.length) current = queued.shift();
    else if (sequence.loop === false) current = resting;
    paint();
  };

  // Показываем крупье с первого же кадра, остальные догружаются в фоне.
  const first = [await decodeFrame(manifest.sequences[resting].frames[0])];
  ready.set(resting, first);
  resize();
  // Пока грузится картинка стола, контейнер может быть нулевой ширины —
  // тогда первый кадр рисовать некуда. Ждём, пока размер появится.
  if (globalThis.ResizeObserver) {
    const observer = new ResizeObserver(() => { if (resize()) paint(); });
    for (const layer of layers) observer.observe(layer.canvas.parentElement);
  }
  decode(resting).then((bitmaps) => ready.set(resting, bitmaps));
  globalThis.addEventListener('resize', resize);
  raf = requestAnimationFrame(tick);

  // Остальные действия раскодируем в простое: до первой раздачи они не нужны.
  const idle = globalThis.requestIdleCallback ?? ((fn) => setTimeout(fn, 1200));
  for (const name of names) {
    if (name === resting) continue;
    idle(() => decode(name).then((bitmaps) => ready.set(name, bitmaps)));
  }

  return {
    manifest,
    sequences: names,
    get playing() { return current; },
    play(name, { immediate = false } = {}) {
      if (!manifest.sequences[name]) return false;
      if (!ready.has(name)) { decode(name).then((bitmaps) => ready.set(name, bitmaps)); return false; }
      if (immediate || manifest.sequences[current].loop !== false) {
        current = name;
        frame = 0;
        queued = [];
        paint();
      } else if (queued.length < 2 && queued.at(-1) !== name) {
        queued.push(name);
      }
      return true;
    },
    stop() { cancelAnimationFrame(raf); globalThis.removeEventListener('resize', resize); },
  };
}
