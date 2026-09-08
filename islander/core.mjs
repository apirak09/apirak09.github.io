/** Pure, DOM-free puzzle rules. No hidden impostor is ever chosen. */
export const PEOPLE = Object.freeze([
  { id: 'A', name: 'Noon', description: 'Chinese-Thai · straight black hair, glasses, elegant cream outfit' },
  { id: 'B', name: 'Nene', description: 'Black bardot evening gown, stiletto heels, thin glasses' },
  { id: 'C', name: 'Nam', description: 'Lavender cardigan, cream skirt, sunglasses, white sneakers' },
  { id: 'D', name: 'Pang', description: 'Green-wave and red-sun T-shirt, wide-leg jeans, necklace' },
  { id: 'E', name: 'Ploi', description: 'Dark academic layers, round glasses, pendant necklace' },
  { id: 'F', name: 'May', description: 'White V-notch top, heart choker, red bracelet, blue jeans' },
  { id: 'G', name: 'Koun', description: 'White formal shirt, navy emblem tie, fit academic style' },
  { id: 'H', name: 'Sor', description: 'Muslim · Chemical Engineering jersey, green wristband, knee bandage' },
  { id: 'I', name: 'Pok', description: 'FINNICK fox sweatshirt and reindeer antler headband' },
  { id: 'J', name: 'Audi', description: 'Rose-print shirt, graphic tee, watch and bracelet' },
  { id: 'K', name: 'Nine', description: 'Blue Pepsi shirt, khaki shorts, gray crossbody bag' },
  { id: 'L', name: 'Non G', description: 'Dark blazer, white graphic tee, round glasses' },
].map(Object.freeze));

export const MAX_WEIGHINGS = 3;
export const OUTCOMES = Object.freeze(['L', '-', 'R']);
export const OUTCOME_LABELS = Object.freeze({ L: 'Left heavier', R: 'Right heavier', '-': 'Balanced' });
export const REFERENCE = Object.freeze([
  'LLLLRRRR----',
  'LLRRR---LRL-',
  'LRR--LR-LL-R',
]);
const ids = new Set(PEOPLE.map(p => p.id));
export const emptyPositions = () => Object.fromEntries(PEOPLE.map(p => [p.id, '-']));
export const initialTruths = () => PEOPLE.flatMap(p => ['heavy', 'light'].map(kind => ({ id: p.id, kind })));
export const createGame = () => ({ positions: emptyPositions(), truths: initialTruths(), history: [], phase: 'arranging' });

export function validatePositions(positions) {
  if (!positions || Object.keys(positions).length !== 12 || Object.keys(positions).some(id => !ids.has(id))) {
    return 'Every islander needs exactly one position.';
  }
  if (PEOPLE.some(p => !['L', 'R', '-'].includes(positions[p.id]))) return 'Unknown platform.';
  const left = PEOPLE.filter(p => positions[p.id] === 'L').length;
  const right = PEOPLE.filter(p => positions[p.id] === 'R').length;
  if (!left && !right) return 'Place the same number of islanders on each side.';
  if (left !== right) return 'Both sides need the same number of islanders.';
  return null;
}

export function movePerson(game, id, position) {
  if (game.phase !== 'arranging') throw new Error('This round is locked.');
  if (!ids.has(id) || !['L', 'R', '-'].includes(position)) throw new Error('Unknown islander or position.');
  return { ...game, positions: { ...game.positions, [id]: position } };
}

/** Equal headcounts make ordinary weight cancel. A light impostor reverses the tilt. */
export function simulate(truth, positions) {
  const side = positions[truth.id];
  if (side === '-') return '-';
  return truth.kind === 'heavy' ? side : side === 'L' ? 'R' : 'L';
}

export function partition(truths, positions) {
  const error = validatePositions(positions);
  if (error) throw new Error(error);
  const groups = { L: [], '-': [], R: [] };
  for (const truth of truths) groups[simulate(truth, positions)].push(truth);
  return groups;
}

/** tieIndex only selects among equally largest groups. It never picks an impostor. */
export function worstCase(truths, positions, tieIndex = 0) {
  if (!truths.length) throw new Error('There must be at least one possible truth.');
  const groups = partition(truths, positions);
  const largest = Math.max(...OUTCOMES.map(result => groups[result].length));
  const ties = OUTCOMES.filter(result => groups[result].length === largest);
  const index = ((Math.trunc(tieIndex) % ties.length) + ties.length) % ties.length;
  const result = ties[index];
  return { result, truths: groups[result].map(t => ({ ...t })), counts: Object.fromEntries(OUTCOMES.map(r => [r, groups[r].length])), ties };
}

export function weigh(game, tieIndex = 0) {
  if (game.phase !== 'arranging' || game.history.length >= MAX_WEIGHINGS) throw new Error('The seesaw cannot be used again.');
  const outcome = worstCase(game.truths, game.positions, tieIndex);
  const history = [...game.history, {
    round: game.history.length + 1,
    positions: { ...game.positions },
    result: outcome.result,
    before: game.truths.length,
    after: outcome.truths.length,
    counts: outcome.counts,
    truths: outcome.truths.map(t => ({ ...t })),
  }];
  const phase = history.length === MAX_WEIGHINGS ? (outcome.truths.length === 1 ? 'accusing' : 'lost') : 'arranging';
  return { ...game, truths: outcome.truths, history, phase };
}

export function accuse(game, id, kind) {
  if (game.phase !== 'accusing' || game.truths.length !== 1) throw new Error('A single truth must be proved before an accusation.');
  const correct = game.truths[0].id === id && game.truths[0].kind === kind;
  return { ...game, phase: correct ? 'won' : 'lost', accusation: { id, kind, correct } };
}

export function possibilitiesFor(truths, id) {
  return { heavy: truths.some(t => t.id === id && t.kind === 'heavy'), light: truths.some(t => t.id === id && t.kind === 'light') };
}
export function referencePositions(round) {
  if (!REFERENCE[round]) throw new Error('Unknown reference round.');
  return Object.fromEntries(PEOPLE.map((p, i) => [p.id, REFERENCE[round][i]]));
}
export function signature(id, kind = 'heavy') {
  return REFERENCE.map((_, round) => simulate({ id, kind }, referencePositions(round))).join('');
}
export function decodeReference(pattern) {
  return initialTruths().find(truth => signature(truth.id, truth.kind) === pattern) ?? null;
}
