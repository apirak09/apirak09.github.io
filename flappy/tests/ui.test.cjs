'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { harness, flush } = require('./dom-harness.cjs');
const { SAVE_KEY, safeProfile } = require('../club.js');
const { VERSION } = require('../updates.js');
const NEXT_VERSION = `${VERSION.split('.')[0]}.${Number(VERSION.split('.')[1]) + 1}.0`;
const oldKey = 'flappy-bird-sky-club-v1';

test('real UI handlers bank points once after a crash and persist the death and result receipt', async () => {
  const values = new Map([[oldKey, JSON.stringify({ runs: { normal: 7 }, best: { normal: 9 } })]]), game = harness(values);
  await flush(); assert.equal(game.$('totalDeaths').textContent, '7'); game.$('playButton').click();
  for (let i = 0; i < 11; i++) game.flight.point(); game.step();
  assert.equal(game.$('walletCoins').textContent, '0', 'live points are not paid early');
  game.flight.crash('pipe'); game.flight.events.push({ type: 'crash' }); game.step(); await flush(); game.step(40);
  assert.equal(game.$('stage').dataset.state, 'result'); assert.equal(game.$('resultCoins').textContent, '+11 coins');
  assert.equal(game.$('walletCoins').textContent, '11'); assert.equal(game.$('totalDeaths').textContent, '8');
  assert.equal(game.profile().coins, 11); assert.equal(game.profile().deaths.normal, 8);
  game.$('retryButton').click(); game.flight.crash('ground'); game.step(); await flush(); game.step(40);
  assert.equal(game.$('resultCoins').textContent, '+0 coins'); assert.equal(game.profile().deaths.normal, 9);
  const reloaded = harness(values); await flush(); assert.equal(reloaded.$('walletCoins').textContent, '11'); assert.equal(reloaded.$('totalDeaths').textContent, '9');
  assert.equal(JSON.parse(values.get(oldKey)).best.normal, 11);
});

test('shop preview is free, buying charges once, owned skins re-equip for free and render at the original size', async () => {
  const values = new Map([[SAVE_KEY, JSON.stringify(safeProfile({ coins: 1250 }))]]), game = harness(values); await flush();
  game.$('shopButton').click(); assert.equal(game.$('app').inert, true);
  game.$('skinGrid').querySelectorAll('[data-skin]').find(button => button.dataset.skin === 'ironman').click();
  assert.equal(game.profile().coins, 1250); assert.equal(game.profile().equipped, 'classic');
  game.$('skinAction').click(); game.$('skinAction').click(); await flush();
  assert.equal(game.profile().coins, 250); assert.equal(game.profile().equipped, 'ironman'); assert.equal(game.$('skinAction').textContent, 'Equipped');
  game.$('skinGrid').querySelectorAll('[data-skin]').find(button => button.dataset.skin === 'strange').click();
  assert.equal(game.$('skinAction').disabled, true); assert.match(game.$('skinStatus').textContent, /750 more/);
  game.$('skinGrid').querySelectorAll('[data-skin]').find(button => button.dataset.skin === 'classic').click(); game.$('skinAction').click(); await flush();
  assert.equal(game.profile().coins, 250); assert.equal(game.profile().equipped, 'classic');
  game.$('skinGrid').querySelectorAll('[data-skin]').find(button => button.dataset.skin === 'ironman').click(); game.$('skinAction').click(); await flush();
  game.$('shopDialog').querySelector('.close-dialog').click(); game.$('playButton').click(); game.step();
  const bird = game.drawing.find(args => args[0].src === 'assets/skins/ironman.svg');
  assert.ok(bird); assert.deepEqual(bird.slice(1), [-28, -28, 56, 56]);
  const reload = harness(values); await flush(); assert.equal(reload.document.querySelector('.menu-bird').src, 'assets/skins/ironman.svg');
});

test('opening the shop pauses a flight; changing its costume never changes physics or the hit circle', async () => {
  const values = new Map([[SAVE_KEY, JSON.stringify(safeProfile({ coins: 1000 }))]]), game = harness(values); await flush();
  game.$('playButton').click(); game.step(4); game.$('shopButton').click();
  assert.equal(game.flight.state, 'paused'); const before = JSON.stringify({ y: game.flight.y, vy: game.flight.vy, score: game.flight.score, pipes: game.flight.pipes, config: game.flight.config });
  game.$('skinGrid').querySelectorAll('[data-skin]').find(button => button.dataset.skin === 'panther').click(); game.$('skinAction').click(); await flush(); game.step(20);
  assert.equal(JSON.stringify({ y: game.flight.y, vy: game.flight.vy, score: game.flight.score, pipes: game.flight.pipes, config: game.flight.config }), before);
  assert.equal(game.$('walletCoins').textContent, '0'); assert.equal(game.profile().deaths.normal, 0);
  game.$('shopDialog').querySelector('.close-dialog').click(); assert.equal(game.$('stage').dataset.state, 'paused');
});

test('update controls surface new versions, hide during play, and cannot reload a paused run', async () => {
  const game = harness(); await flush(); game.release.version = NEXT_VERSION; game.$('settingsButton').click(); game.$('updateButton').click(); await flush();
  assert.equal(game.$('updateButtonLabel').textContent, 'Update now'); game.$('settingsDialog').querySelector('.close-dialog').click();
  assert.equal(game.$('updateBanner').hidden, false); game.$('playButton').click(); assert.equal(game.$('updateBanner').hidden, true);
  game.$('settingsButton').click(); assert.equal(game.$('updateButton').disabled, true); assert.match(game.$('updateStatus').textContent, /Finish this flight/);
  assert.equal(game.context.navigated.length, 0);
});

test('unavailable localStorage leaves the actual game and the shop usable for the current session', async () => {
  const game = harness(new Map(), true); await flush(); game.$('playButton').click();
  for (let i = 0; i < 100; i++) game.flight.point(); game.flight.crash('pipe'); game.step(); await flush(); game.step(40);
  assert.equal(game.$('walletCoins').textContent, '100'); assert.match(game.$('saveNote').textContent, /session/);
  game.$('resultShopButton').click(); game.$('skinGrid').querySelectorAll('[data-skin]').find(button => button.dataset.skin === 'mint').click();
  game.$('skinAction').click(); await flush(); assert.equal(game.$('skinAction').textContent, 'Equipped'); assert.equal(game.$('walletCoins').textContent, '0');
});
