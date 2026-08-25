// Витрина стола Poker Island. Ни одна анимация тут не нарисована заранее:
// карты, фишки и банк живут кодом, а крупье — единственное, что снято видео.
import { createCard } from './brand/cards.js';
import { createChip, createStack, breakdown } from './brand/chips.js';
import { createDealer } from './dealer-v6/dealer.js';

const $ = (id) => document.getElementById(id);
const stage = $('stage');
const layer = $('layer');
const fx = $('fx');
const board = $('board');
const potStacks = $('pot-stacks');
const potSum = $('pot-sum');
const state$ = $('state');

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const say = (text) => { state$.textContent = text; };

// Места по овалу стола: доли от холста, снятые с рендера.
// Места сняты с рендера стола: плашка у своего кресла, карты — на сукне
// перед игроком, ставка между картами и центром.
const SEATS = [
  { name: 'Марина',   plate: { x: 0.135, y: 0.42 }, cards: { x: 0.265, y: 0.40 }, bet: { x: 0.345, y: 0.42 } },
  { name: 'Дед Хэнк', plate: { x: 0.325, y: 0.135 }, cards: { x: 0.355, y: 0.275 }, bet: { x: 0.40, y: 0.335 } },
  { name: 'Вихрь',    plate: { x: 0.675, y: 0.135 }, cards: { x: 0.645, y: 0.275 }, bet: { x: 0.60, y: 0.335 } },
  { name: 'Клод',     plate: { x: 0.865, y: 0.42 }, cards: { x: 0.735, y: 0.40 }, bet: { x: 0.655, y: 0.42 } },
  { name: 'Ирис',     plate: { x: 0.675, y: 0.855 }, cards: { x: 0.645, y: 0.715 }, bet: { x: 0.60, y: 0.645 } },
  { name: 'Вы',       plate: { x: 0.325, y: 0.855 }, cards: { x: 0.355, y: 0.715 }, bet: { x: 0.40, y: 0.645 } },
];

const HAND = [
  ['As', 'Kd'], ['Qh', 'Qc'], ['7s', '2d'],
  ['Jd', 'Th'], ['9c', '9h'], ['Ah', 'Kh'],
];
const BOARD = ['Ac', '5h', 'Kc', '3d', 'Ks'];
const WINNER = 5;             // «Вы» собираете фулл-хаус
const WIN_CARDS = new Set([0, 2, 4]); // тузы и король на борде

let pot = 0;
const place = (node, point) => {
  node.style.left = `${point.x * 100}%`;
  node.style.top = `${point.y * 100}%`;
  node.style.transform = 'translate(-50%, -50%)';
};

const seats = SEATS.map((seat, index) => {
  const cards = document.createElement('div');
  cards.className = 'seat__cards';
  place(cards, seat.cards);
  layer.append(cards);

  const node = document.createElement('div');
  node.className = 'seat';
  place(node, seat.plate);

  const plate = document.createElement('div');
  plate.className = 'seat__plate';
  const name = document.createElement('div');
  name.className = 'seat__name';
  name.textContent = seat.name;
  const stack = document.createElement('div');
  stack.className = 'seat__stack';
  const timer = document.createElement('div');
  timer.className = 'seat__timer';
  timer.append(document.createElement('i'));
  plate.append(name, stack, timer);
  node.append(plate);
  layer.append(node);

  const bet = document.createElement('div');
  bet.className = 'seat__bet';
  place(bet, seat.bet);
  layer.append(bet);

  return { ...seat, index, node, cards, stackNode: stack, timer: timer.firstChild, bet, chips: 5000, wager: 0 };
});

const setStacks = () => seats.forEach((seat) => { seat.stackNode.textContent = seat.chips.toLocaleString('ru'); });
setStacks();

// ── крупье ──
let dealer = null;
createDealer(stage).then((sprite) => { dealer = sprite; }).catch(() => {});
const dealerPlays = (action) => dealer?.play(action);

// ── геометрия ──
const centreOf = (node) => {
  const box = node.getBoundingClientRect();
  const base = stage.getBoundingClientRect();
  return { x: box.left - base.left + box.width / 2, y: box.top - base.top + box.height / 2 };
};
const dealerHands = () => {
  const hands = stage.querySelector('.dealer-hands');
  const box = hands.getBoundingClientRect();
  const base = stage.getBoundingClientRect();
  return { x: box.left - base.left + box.width / 2, y: box.top - base.top + box.height * 0.75 };
};

// ── карты ──
function cardSlot(code, className) {
  const slot = document.createElement('div');
  slot.className = `${className} flip`;
  const inner = document.createElement('div');
  inner.className = 'flip__inner';
  const front = createCard(null);
  front.classList.add('flip__side');
  const back = createCard(code);
  back.classList.add('flip__side', 'flip__side--back');
  inner.append(front, back);
  slot.append(inner);
  slot.dataset.code = code;
  return slot;
}

/** Карта уходит из-под руки крупье и скользит по сукну к месту. */
function slide(node, from, { duration = 460, delay = 0, spin = 12 } = {}) {
  const to = centreOf(node);
  const dx = from.x - to.x;
  const dy = from.y - to.y;
  const bend = Math.max(-30, Math.min(30, dx * 0.12));
  node.animate([
    { transform: `translate(${dx}px, ${dy}px) scale(0.55) rotate(${spin * 1.6}deg)`, opacity: 0, offset: 0 },
    { transform: `translate(${dx}px, ${dy}px) scale(0.55) rotate(${spin * 1.6}deg)`, opacity: 1, offset: 0.1 },
    { transform: `translate(${dx * 0.45 + bend}px, ${dy * 0.45}px) scale(0.8) rotate(${spin}deg)`, offset: 0.62 },
    { transform: 'none', opacity: 1, offset: 1 },
  ], { duration, delay, easing: 'cubic-bezier(.22,.7,.24,1)', fill: 'backwards' });
}

// ── фишки ──
function chipsFly(from, to, amount, { delay = 0, duration = 540 } = {}) {
  for (const [index, part] of breakdown(amount).entries()) {
    const flying = createStack(part.value, Math.min(part.count, 6));
    flying.style.left = `${from.x - 20}px`;
    flying.style.top = `${from.y - 18}px`;
    fx.append(flying);
    const dx = to.x - from.x + (index - 1) * 7;
    const dy = to.y - from.y;
    const lift = Math.min(52, Math.hypot(dx, dy) * 0.2);
    const move = flying.animate([
      { transform: 'none', offset: 0 },
      { transform: `translate(${dx * 0.5}px, ${dy * 0.5 - lift}px) scale(0.95)`, offset: 0.55 },
      { transform: `translate(${dx}px, ${dy}px) scale(0.88)`, offset: 1 },
    ], { duration, delay: delay + index * 55, easing: 'cubic-bezier(.3,.05,.25,1)', fill: 'both' });
    move.finished.then(() => flying.remove(), () => flying.remove());
  }
}

function renderPot() {
  potStacks.textContent = '';
  for (const part of breakdown(pot)) potStacks.append(createStack(part.value, part.count));
  potSum.textContent = pot ? `Банк ${pot.toLocaleString('ru')}` : 'Банк пуст';
}

function bet(seat, amount) {
  const value = Math.min(amount, seat.chips);
  seat.chips -= value;
  seat.wager += value;
  seat.bet.textContent = '';
  for (const part of breakdown(seat.wager)) seat.bet.append(createStack(part.value, part.count));
  setStacks();
}

async function collect() {
  const target = centreOf(potStacks);
  let index = 0;
  for (const seat of seats) {
    if (!seat.wager) continue;
    chipsFly(centreOf(seat.bet), target, seat.wager, { delay: index * 75 });
    seat.bet.textContent = '';
    pot += seat.wager;
    seat.wager = 0;
    index += 1;
  }
  await wait(index * 75 + 420);
  renderPot();
}

// ── ход игрока ──
async function turn(seat, action, amount = 0) {
  seats.forEach((item) => item.node.classList.toggle('seat--turn', item === seat));
  const bar = seat.timer;
  bar.style.transform = 'scaleX(1)';
  const clock = bar.animate([{ transform: 'scaleX(1)' }, { transform: 'scaleX(0)' }],
    { duration: 900, easing: 'linear', fill: 'forwards' });
  await wait(620);
  clock.cancel();
  bar.style.transform = 'scaleX(1)';
  if (action === 'fold') {
    seat.node.classList.add('seat--out');
    seat.cards.textContent = '';
    say(`${seat.name} — фолд`);
  } else if (action === 'call') {
    bet(seat, amount);
    say(`${seat.name} — колл ${amount}`);
  } else {
    bet(seat, amount);
    say(`${seat.name} — рейз до ${amount}`);
  }
  seat.node.classList.remove('seat--turn');
}

// ── раздача ──
async function dealHands() {
  board.textContent = '';
  pot = 0; renderPot();
  for (const seat of seats) {
    seat.cards.textContent = '';
    seat.bet.textContent = '';
    seat.wager = 0;
    seat.node.classList.remove('seat--out', 'seat--turn');
  }
  say('раздача');
  dealerPlays('deal');

  for (let round = 0; round < 2; round += 1) {
    for (const [index, seat] of seats.entries()) {
      const slot = cardSlot(HAND[index][round], 'seat__card');
      seat.cards.append(slot);
      const from = dealerHands();
      slide(slot, from, { delay: 0, spin: from.x > centreOf(slot).x ? -12 : 12 });
      if (seat.index === WINNER) setTimeout(() => slot.classList.add('flip--open'), 380);
      await wait(150);
    }
  }
}

async function street(count, label) {
  say(label);
  dealerPlays('deal');
  for (let index = 0; index < count; index += 1) {
    const code = BOARD[board.children.length];
    if (!code) break;
    const slot = cardSlot(code, 'board__card');
    board.append(slot);
    slide(slot, dealerHands(), { duration: 520, spin: 8 });
    await wait(120);
    slot.classList.add('flip--open');
    await wait(180);
  }
}

async function showdown() {
  say('вскрытие');
  for (const seat of seats) {
    if (seat.node.classList.contains('seat--out')) continue;
    for (const slot of seat.cards.children) slot.classList.add('flip--open');
    await wait(140);
  }
  await wait(320);
  [...board.children].forEach((slot, index) => {
    if (WIN_CARDS.has(index)) slot.classList.add('board__card--win');
  });
  const winner = seats[WINNER];
  for (const slot of winner.cards.children) slot.classList.add('board__card--win');
  dealerPlays('celebrate');
  say(`${winner.name} — фулл-хаус, короли и тузы`);
  await wait(900);

  const from = centreOf(potStacks);
  chipsFly(from, centreOf(winner.bet), pot, { duration: 680 });
  winner.chips += pot;
  pot = 0;
  renderPot();
  await wait(680);
  setStacks();
  say(`${winner.name} забирает банк`);
}

async function fullHand() {
  await dealHands();
  await wait(300);
  await turn(seats[1], 'call', 50);
  await turn(seats[2], 'fold');
  await turn(seats[3], 'call', 50);
  await turn(seats[4], 'fold');
  await turn(seats[5], 'raise', 150);
  await turn(seats[0], 'call', 150);
  await turn(seats[1], 'call', 100);
  await turn(seats[3], 'fold');
  await collect();
  await street(3, 'флоп');
  await turn(seats[5], 'raise', 300);
  await turn(seats[0], 'call', 300);
  await turn(seats[1], 'fold');
  await collect();
  await street(1, 'тёрн');
  await turn(seats[5], 'raise', 600);
  await turn(seats[0], 'call', 600);
  await collect();
  await street(1, 'ривер');
  await turn(seats[5], 'raise', 900);
  await turn(seats[0], 'call', 900);
  await collect();
  await showdown();
}

$('play').addEventListener('click', () => { $('play').disabled = true; fullHand().finally(() => { $('play').disabled = false; }); });
$('deal').addEventListener('click', dealHands);
$('flop').addEventListener('click', () => street(3, 'флоп'));
$('bets').addEventListener('click', async () => {
  for (const seat of seats) if (!seat.node.classList.contains('seat--out')) bet(seat, 150);
  say('ставки сделаны');
});
$('collect').addEventListener('click', collect);
$('show').addEventListener('click', showdown);

renderPot();
say('нажмите «Сыграть раздачу»');
if (new URLSearchParams(location.search).has('run')) setTimeout(() => $('play').click(), 700);
