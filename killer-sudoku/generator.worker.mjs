import { generatePuzzle } from './core.mjs';
self.onmessage = ({ data }) => {
  try {
    const puzzle = generatePuzzle(data.difficulty, data.seed, progress => self.postMessage({ type: 'progress', progress }));
    self.postMessage({ type: 'puzzle', puzzle });
  } catch (error) { self.postMessage({ type: 'error', message: error.message }); }
};
