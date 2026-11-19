export const STREAM_URL = "wss://nbstream.binance.com/equity/stream?streams=ANT@quote/price/ANT@tradingStatus/ANT@tradability";
export const QUOTE_MAX_AGE = 12_000;
export const IPO_SESSION = Date.parse("2026-11-19T14:30:00Z");
const symbol = "ANT";
const clock = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/New_York",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  weekday: "short",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});
const interruptions = new Set([
  "TRADING_HALTED", "TRADING_PAUSED", "TRADING_SUSPENDED", "QUOTATION_RESUMED", "UNAVAILABLE",
]);

function nyTime(time) {
  return Object.fromEntries(clock.formatToParts(time).map(part => [part.type, part.value]));
}

export function regularSession(time) {
  const p = nyTime(time);
  const minute = Number(p.hour) * 60 + Number(p.minute);
  return p.weekday !== "Sat" && p.weekday !== "Sun" && minute >= 570 && minute < 960;
}

function sameMarketDay(a, b) {
  const first = nyTime(a);
  const second = nyTime(b);
  return first.year === second.year && first.month === second.month && first.day === second.day;
}

function timestamp(value) {
  const number = Number(value);
  return Number.isSafeInteger(number) && number >= 1_000_000_000_000 && number < 4_102_444_800_000
    ? number : null;
}

export function fresh(time, now, maxAge = QUOTE_MAX_AGE) {
  return Number.isFinite(time) && time <= now + 2_000 && now - time <= maxAge;
}

export function decode(packet) {
  const event = packet?.data ?? packet;
  if (event?.e === "price" && Array.isArray(event.rates)) {
    const rate = event.rates.find(item => item.s === symbol);
    if (!rate) return null;
    const price = Number(rate.p);
    const time = timestamp(rate.t);
    return {
      type: "price",
      phase: rate.mp,
      mark: price > 0 && Number.isFinite(price) && time ? { price, time } : null,
    };
  }
  if (event?.e === "quote" && event.s === symbol) {
    const bid = Number(event.bp);
    const ask = Number(event.ap);
    const time = timestamp(event.T);
    const bidSize = Number(event.bs);
    const askSize = Number(event.as);
    if (!time || !(bid > 0 && ask >= bid) || ![bid, ask, bidSize, askSize].every(Number.isFinite)
      || bidSize <= 0 || askSize <= 0) return { type: "quote", quote: null };
    return { type: "quote", quote: { bid, ask, bidSize, askSize, time } };
  }
  if (event?.symbol !== symbol) return null;
  if (event.e === "tradingStatus") {
    return {
      type: "status",
      status: event.status,
      tradability: event.tradability,
      effective: timestamp(event.time),
    };
  }
  if (event.e === "tradability") {
    return { type: "tradability", tradability: event.tradability };
  }
  return null;
}

export function createFeed(onUpdate, Socket = globalThis.WebSocket) {
  let socket;
  let retryId;
  let connectTimer;
  let packetTimer;
  let attempts = 0;
  let status = "connecting";
  let phase;
  let mark;
  let quote;
  let confirmedSession = false;
  let halt;
  let resumeAt = 0;
  let tradability;

  function snapshot(now = Date.now()) {
    const session = regularSession(now);
    const halted = Boolean(halt) || now < resumeAt
      || tradability === "NONE" || tradability === "DELISTING" || tradability === "OFFMARKET";
    const tradable = status === "connected" && session && confirmedSession && phase === "O"
      && !halted && fresh(quote?.time, now) && quote.time >= resumeAt && sameMarketDay(quote.time, now);
    return {
      connection: status, mark, quote, session, confirmedSession, halted, tradable,
      canBuy: tradable && tradability !== "SELL",
      canSell: tradable && tradability !== "BUY",
    };
  }

  function accept(update, now) {
    if (!update) return;
    switch (update.type) {
      case "price":
        phase = update.phase;
        if (update.mark && (!mark || update.mark.time >= mark.time)) mark = update.mark;
        if (phase === "O" && update.mark?.time >= IPO_SESSION && fresh(update.mark.time, now, 30_000)
          && sameMarketDay(update.mark.time, now) && regularSession(update.mark.time)) confirmedSession = true;
        if (phase && phase !== "O") confirmedSession = false;
        break;
      case "quote":
        if (!update.quote || !quote || update.quote.time >= quote.time) quote = update.quote;
        break;
      case "status":
        if (interruptions.has(update.status)) halt = update.status;
        if (update.status === "TRADING_RESUMED") {
          halt = null;
          resumeAt = update.effective || now;
          quote = undefined;
        }
        if (update.tradability) tradability = update.tradability;
        break;
      case "tradability":
        tradability = update.tradability;
        break;
    }
    onUpdate();
  }

  function connect() {
    clearTimeout(retryId);
    clearTimeout(connectTimer);
    clearTimeout(packetTimer);
    const previous = socket;
    socket = undefined;
    previous?.close();
    status = "connecting";
    phase = undefined;
    confirmedSession = false;
    quote = undefined;
    onUpdate();

    function retry() {
      clearTimeout(connectTimer);
      clearTimeout(packetTimer);
      status = "disconnected";
      onUpdate();
      retryId = setTimeout(connect, Math.min(20_000, 1_500 * 2 ** attempts));
      attempts += 1;
    }

    let connection;
    try {
      connection = new Socket(STREAM_URL);
      socket = connection;
    } catch {
      retry();
      return;
    }
    connectTimer = setTimeout(() => connection.close(), 10_000);
    connection.onopen = () => {
      if (socket !== connection) return;
      clearTimeout(connectTimer);
      status = "connected";
      packetTimer = setTimeout(() => connection.close(), 15_000);
      onUpdate();
    };
    connection.onmessage = message => {
      if (socket !== connection) return;
      let parsed;
      try {
        parsed = JSON.parse(message.data);
      } catch {
        return;
      }
      attempts = 0;
      clearTimeout(packetTimer);
      packetTimer = setTimeout(() => connection.close(), 15_000);
      accept(decode(parsed), Date.now());
    };
    connection.onclose = () => {
      if (socket === connection) retry();
    };
    connection.onerror = () => {
      if (socket === connection) connection.close();
    };
  }
  return { connect, snapshot };
}
