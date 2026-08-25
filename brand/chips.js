// Фишки Poker Island. Номиналы и цвета взяты по кассовому стандарту казино,
// чтобы стопка читалась по цвету без чтения цифр.
const NS = 'http://www.w3.org/2000/svg';

export const DENOMS = [
  { value: 1,     body: '#f2efe6', edge: '#0d150f', ink: '#12211a', label: '1' },
  { value: 5,     body: '#b3312c', edge: '#f2efe6', ink: '#fdf6ea', label: '5' },
  { value: 25,    body: '#1f6b3a', edge: '#f2efe6', ink: '#fdf6ea', label: '25' },
  { value: 100,   body: '#16202c', edge: '#c9a227', ink: '#f0d98a', label: '100' },
  { value: 500,   body: '#5b2a86', edge: '#f2efe6', ink: '#fdf6ea', label: '500' },
  { value: 1000,  body: '#c9a227', edge: '#16202c', ink: '#16202c', label: '1K' },
  { value: 5000,  body: '#0e6f7a', edge: '#c9a227', ink: '#f0d98a', label: '5K' },
];

const el = (name, attrs = {}) => {
  const node = document.createElementNS(NS, name);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
  return node;
};

const denomOf = (value) => DENOMS.find((item) => item.value === value) ?? DENOMS[0];

/** Одна фишка: тело, насечки по ободу, вставка и номинал. */
export function createChip(value) {
  const denom = denomOf(value);
  const chip = el('svg', { viewBox: '0 0 100 100', class: 'pi-chip', role: 'img' });
  chip.setAttribute('aria-label', `фишка ${denom.label}`);

  chip.append(el('circle', { cx: 50, cy: 50, r: 49, fill: denom.body }));

  // Насечки: шесть секторов по ободу — по ним фишка узнаётся боком в стопке.
  const notches = el('g', { fill: denom.edge });
  for (let index = 0; index < 6; index += 1) {
    notches.append(el('rect', {
      x: 42.5, y: 1, width: 15, height: 16, rx: 4,
      transform: `rotate(${index * 60} 50 50)`,
    }));
  }
  chip.append(notches);

  chip.append(el('circle', { cx: 50, cy: 50, r: 33, fill: denom.body }));
  chip.append(el('circle', { cx: 50, cy: 50, r: 33, fill: 'none', stroke: denom.edge, 'stroke-width': 2, 'stroke-opacity': '0.75' }));
  chip.append(el('circle', { cx: 50, cy: 50, r: 27, fill: 'none', stroke: denom.edge, 'stroke-width': 1, 'stroke-opacity': '0.4' }));

  const value_ = el('text', {
    x: 50, y: 61, 'text-anchor': 'middle',
    fill: denom.ink, 'font-size': denom.label.length > 2 ? 24 : 30, 'font-weight': '700',
    'font-family': 'Helvetica, Arial, sans-serif',
  });
  value_.textContent = denom.label;
  chip.append(value_);

  chip.append(el('circle', { cx: 50, cy: 50, r: 48.5, fill: 'none', stroke: '#000', 'stroke-opacity': '0.3', 'stroke-width': 2 }));
  return chip;
}

/** Разбивка суммы на фишки — от старших номиналов к младшим. */
export function breakdown(amount) {
  const result = [];
  let left = Math.max(0, Math.round(amount));
  for (const denom of [...DENOMS].reverse()) {
    const count = Math.floor(left / denom.value);
    if (count > 0) {
      result.push({ value: denom.value, count });
      left -= count * denom.value;
    }
  }
  return result;
}

/** Стопка фишек: свеча из кружков со смещением по высоте. */
export function createStack(value, count, { step = 4 } = {}) {
  const stack = document.createElement('div');
  stack.className = 'pi-stack';
  const shown = Math.min(count, 12);
  for (let index = 0; index < shown; index += 1) {
    const chip = createChip(value);
    chip.style.bottom = `${index * step}px`;
    chip.style.zIndex = String(index);
    stack.append(chip);
  }
  stack.style.height = `${28 + (shown - 1) * step}px`;
  if (count > shown) stack.dataset.more = `×${count}`;
  return stack;
}
