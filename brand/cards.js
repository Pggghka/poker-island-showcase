// Колода Poker Island: карты рисуются вектором, а не картинками, — они
// одинаково чисты и в панели ставок, и на борде, и в руке крупье.
//
// Главное требование: карта должна читаться размером 40×56. Поэтому в центре
// одна крупная масть, а не рассыпь пипсов, и жирный угловой индекс.
const NS = 'http://www.w3.org/2000/svg';

const SUITS = {
  s: { glyph: '♠', ink: '#14231a', name: 'пики' },
  c: { glyph: '♣', ink: '#14231a', name: 'трефы' },
  h: { glyph: '♥', ink: '#a32b28', name: 'черви' },
  d: { glyph: '♦', ink: '#a32b28', name: 'бубны' },
};

const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A'];
const LABEL = { T: '10', J: 'J', Q: 'Q', K: 'K', A: 'A' };

const el = (name, attrs = {}) => {
  const node = document.createElementNS(NS, name);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
  return node;
};

/** Вензель для фигурных карт: корона над знаком масти. */
function courtMark(suit, ink) {
  const group = el('g', { fill: ink });
  group.append(el('path', {
    d: 'M -13 -2 L -9 -11 L -4 -5 L 0 -14 L 4 -5 L 9 -11 L 13 -2 Z',
    opacity: '0.9',
  }));
  group.append(el('rect', { x: -13, y: 0, width: 26, height: 3, rx: 1.5, opacity: '0.9' }));
  const glyph = el('text', {
    x: 0, y: 17, 'text-anchor': 'middle', fill: ink,
    'font-size': 16, 'font-family': 'Georgia, serif',
  });
  glyph.textContent = suit.glyph;
  group.append(glyph);
  return group;
}

/** Лицевая сторона. */
function face(code) {
  const suit = SUITS[code[1]];
  const rank = LABEL[code[0]] ?? code[0];
  const card = el('svg', { viewBox: '0 0 100 140', class: 'pi-card', role: 'img' });
  card.setAttribute('aria-label', `${rank} ${suit.name}`);

  card.append(el('rect', { x: 1, y: 1, width: 98, height: 138, rx: 9, fill: '#f5f2e9' }));
  card.append(el('rect', { x: 1, y: 1, width: 98, height: 138, rx: 9, fill: 'none', stroke: '#0d150f', 'stroke-opacity': '0.35', 'stroke-width': 1.6 }));
  card.append(el('rect', { x: 5.5, y: 5.5, width: 89, height: 129, rx: 6, fill: 'none', stroke: suit.ink, 'stroke-opacity': '0.14', 'stroke-width': 1 }));

  // Угловой индекс: ранг и под ним масть — читается даже мельком.
  for (const corner of [0, 1]) {
    const group = el('g', corner
      ? { transform: 'rotate(180 50 70)' }
      : {});
    const value = el('text', {
      x: 13, y: 30, 'text-anchor': 'middle', fill: suit.ink,
      'font-size': rank === '10' ? 22 : 26, 'font-weight': '700',
      'font-family': 'Helvetica, Arial, sans-serif',
    });
    value.textContent = rank;
    const mark = el('text', {
      x: 13, y: 48, 'text-anchor': 'middle', fill: suit.ink, 'font-size': 18,
      'font-family': 'Georgia, serif',
    });
    mark.textContent = suit.glyph;
    group.append(value, mark);
    card.append(group);
  }

  // Центр: у фигур вензель, у остальных крупная масть.
  if ('JQKA'.includes(code[0])) {
    const centre = el('g', { transform: 'translate(50 70)' });
    centre.append(courtMark(suit, suit.ink));
    card.append(centre);
  } else {
    const big = el('text', {
      x: 50, y: 88, 'text-anchor': 'middle',
      fill: suit.ink, 'font-size': 52, 'font-family': 'Georgia, serif', opacity: '0.92',
    });
    big.textContent = suit.glyph;
    card.append(big);
  }
  return card;
}

/** Рубашка: остров и пика — знак заведения. */
function back() {
  const card = el('svg', { viewBox: '0 0 100 140', class: 'pi-card pi-card--back', 'aria-label': 'рубашка' });
  card.append(el('rect', { x: 1, y: 1, width: 98, height: 138, rx: 9, fill: '#123a26' }));
  card.append(el('rect', { x: 1, y: 1, width: 98, height: 138, rx: 9, fill: 'none', stroke: '#08130d', 'stroke-width': 1.6 }));
  card.append(el('rect', { x: 6, y: 6, width: 88, height: 128, rx: 6, fill: 'none', stroke: '#c9a227', 'stroke-opacity': '0.55', 'stroke-width': 1.2 }));

  // Волны — вода вокруг острова.
  const waves = el('g', { stroke: '#c9a227', 'stroke-opacity': '0.22', 'stroke-width': 1.1, fill: 'none' });
  for (let row = 0; row < 7; row += 1) {
    const y = 24 + row * 15;
    waves.append(el('path', { d: `M 12 ${y} q 9 -6 18 0 t 18 0 t 18 0 t 12 0` }));
  }
  card.append(waves);

  card.append(el('circle', { cx: 50, cy: 70, r: 26, fill: '#0d2a1b', stroke: '#c9a227', 'stroke-opacity': '0.7', 'stroke-width': 1.4 }));
  const spade = el('text', {
    x: 50, y: 81, 'text-anchor': 'middle',
    fill: '#c9a227', 'font-size': 30, 'font-family': 'Georgia, serif',
  });
  spade.textContent = '♠';
  card.append(spade);
  return card;
}

export function createCard(code) {
  const node = code ? face(code) : back();
  return node;
}

export function deck() {
  const cards = [];
  for (const suit of Object.keys(SUITS)) {
    for (const rank of RANKS) cards.push(`${rank}${suit}`);
  }
  return cards;
}

export { SUITS, RANKS };
