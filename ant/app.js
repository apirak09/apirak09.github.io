import { createFeed, fresh } from "./feed.js";
import {
  UNIT, amounts, available, changeSettings, fillOrder, fillPending, parseDecimal,
  readPortfolio, validateOrder, valuePortfolio,
} from "./model.js";

const key = "ant-paper-portfolio-v1";
const lockName = "ant-paper-portfolio-update";
const ipo = 83;
const elements = Object.fromEntries(Array.from(document.querySelectorAll("[id]"), el => [el.id, el]));
const usdFormat = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const unitsFormat = new Intl.NumberFormat("en-US", { maximumFractionDigits: 6 });
const clock = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Bangkok", hour: "2-digit", minute: "2-digit", second: "2-digit",
});
const axisClock = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Bangkok", hour: "2-digit", minute: "2-digit",
});
const ticket = { side: "buy", kind: "market" };
const points = [];
const windowWidth = 120 * 60_000;
let range = 30;
let activeList = "fills";
let queued = false;
let checking = false;
let placing = false;
let storageReady = true;
let market = {};
let portfolio = readPortfolio(load());
let availableBook = { time: 0, bidUsed: 0, askUsed: 0 };
const feed = createFeed(schedule);

function load() {
  try {
    return localStorage.getItem(key);
  } catch {
    storageReady = false;
    return null;
  }
}

function transact(change) {
  const run = () => {
    if (storageReady) {
      const current = load();
      if (current) portfolio = readPortfolio(current);
    }
    const result = change(portfolio);
    if (result.changed && storageReady) {
      try {
        localStorage.setItem(key, JSON.stringify(portfolio));
      } catch {
        storageReady = false;
      }
    }
    if (result.changed) renderActivity();
    schedule();
    return result;
  };
  return navigator.locks?.request ? navigator.locks.request(lockName, run) : Promise.resolve(run());
}

const dollars = amount => amount == null ? "—" : usdFormat.format(amount);
const cents = amount => amount == null ? "—" : dollars(amount / 100);
const shares = units => unitsFormat.format(units / UNIT);
const signed = value => value == null ? "—" : (value > 0 ? "+" : "") + cents(value);
const percentage = value => (value > 0 ? "+" : "") + value.toFixed(2) + "%";

function setText(id, text) {
  if (elements[id].textContent !== text) elements[id].textContent = text;
}

function pnlText(id, value, text) {
  const element = elements[id];
  element.classList.toggle("up", value > 0);
  element.classList.toggle("down", value < 0);
  setText(id, text);
}

function bookLeft(quote) {
  if (availableBook.time !== quote.time) {
    availableBook = { time: quote.time, bidUsed: 0, askUsed: 0 };
  }
  return {
    bidSize: Math.max(0, quote.bidSize - availableBook.bidUsed / UNIT),
    askSize: Math.max(0, quote.askSize - availableBook.askUsed / UNIT),
  };
}

function useBook(fill) {
  if (fill.side === "buy") availableBook.askUsed += fill.units;
  else availableBook.bidUsed += fill.units;
}

function sideAllowed(snapshot, side) {
  return side === "buy" ? snapshot.canBuy : snapshot.canSell;
}

function bookPrice(snapshot, side) {
  if (!snapshot.quote) return null;
  return side === "buy" ? snapshot.quote.ask : snapshot.quote.bid;
}

function describeMarket(state) {
  if (state.halted) return ["paused", "พักการซื้อขาย", "รอข้อมูลเปิดซื้อขายจากตลาด"];
  if (!state.session) return ["closed", "นอกเวลาซื้อขาย", "คำสั่งจำลองจับคู่ในช่วงตลาดปกติของสหรัฐฯ"];
  if (state.connection === "disconnected") return ["error", "กำลังเชื่อมต่อใหม่", "ฟีดขาดการเชื่อมต่อ ระบบจะลองอีกครั้ง"];
  if (state.connection === "connecting") return ["waiting", "กำลังเชื่อมต่อ", "กำลังเชื่อมต่อ Binance Stocks"];
  if (!state.confirmedSession) return ["waiting", "รอเริ่มซื้อขาย", "กำลังรอราคาซื้อขาย ANT ที่มีเวลาจากตลาด"];
  if (!state.tradable) return ["stale", "รอ Bid / Ask สด", "ระบบพักการจับคู่จนกว่าจะได้รับราคาอัปเดต"];
  return ["live", "เรียลไทม์", "รับ Bid / Ask จาก Binance Stocks"];
}

function renderMarket() {
  const [state, label, detail] = describeMarket(market);
  elements["feed-state"].dataset.state = state;
  setText("feed-label", label);
  setText("chart-message", label);
  setText("chart-detail", detail);

  const price = market.mark?.price;
  setText("last-price", dollars(price));
  const change = price ? (price / ipo - 1) * 100 : 0;
  pnlText("ipo-change", change, price ? percentage(change) + " จาก IPO" : "");
  setText("bid", dollars(market.quote?.bid));
  setText("ask", dollars(market.quote?.ask));
  const time = market.quote?.time ?? market.mark?.time;
  const age = time ? Math.max(0, Math.floor((Date.now() - time) / 1000)) : 0;
  const clockText = time ? clock.format(time) + " น. · " + age + " วิที่แล้ว" : detail;
  setText("price-time", clockText);

  if (market.mark) {
    const point = market.mark;
    if (!points.length || point.time > points.at(-1).time) {
      points.push(point);
      while (points.length > 1 && points[0].time < point.time - windowWidth) points.shift();
      drawChart();
    }
  }
}

function currentOrder() {
  const units = Math.round(parseDecimal(elements.qty.value, 6) * UNIT);
  return {
    ...ticket, units, limit: parseDecimal(elements.limit.value, 2),
  };
}

function renderTicket() {
  const order = currentOrder();
  const buy = order.side === "buy";
  const isLimit = order.kind === "limit";
  const price = isLimit ? order.limit : bookPrice(market, order.side);
  const free = available(portfolio);
  const usable = price > 0 && Number.isFinite(price) && order.units > 0 && Number.isSafeInteger(order.units);
  const estimate = usable ? amounts(order.units, price, portfolio.feeRate) : null;
  setText("available-label", buy ? "เงินพร้อมซื้อ" : "หุ้นพร้อมขาย");
  setText("available", buy ? cents(free.cash) : shares(free.units) + " ANT");
  setText("reference", price > 0 ? dollars(price) + (isLimit ? "" : buy ? " · Ask" : " · Bid") : "—");
  setText("fee-estimate", cents(estimate?.fee));
  setText("estimate-label", buy ? "ยอดจ่ายประมาณ" : "ยอดรับประมาณ");
  setText("estimate", estimate ? cents(estimate.gross + (buy ? estimate.fee : -estimate.fee)) : "—");
  const canTrade = sideAllowed(market, order.side);
  const button = elements["submit-order"];
  button.dataset.side = order.side;
  button.disabled = placing || (!isLimit && !canTrade);
  setText("submit-order", (isLimit ? "ตั้ง" : "") + (buy ? "ซื้อ ANT" : "ขาย ANT"));
  setText("order-note", isLimit
    ? "ช่วงที่มีราคาสด ระบบซื้อเมื่อ Ask ถึงราคาที่ตั้ง หรือขายเมื่อ Bid ถึงราคาที่ตั้ง"
    : canTrade ? "จับคู่ด้วยราคา " + (buy ? "Ask (ราคาเสนอขาย)" : "Bid (ราคารับซื้อ)") + " ล่าสุด"
      : "คำสั่งราคาตลาดรอ Bid และ Ask ที่อัปเดต");
  elements["limit-field"].hidden = !isLimit;
  for (const button of document.querySelectorAll("[data-size]")) {
    button.disabled = buy ? !(price > 0 && free.cash > 0) : free.units <= 0;
  }
}

function renderPortfolio() {
  const { bid } = market.quote ?? {};
  const { equity, pnl, unrealized } = valuePortfolio(portfolio, bid);
  setText("equity", cents(equity));
  pnlText("total-pnl", pnl, signed(pnl));
  const percent = pnl != null && portfolio.capital > 0 ? 100 * pnl / portfolio.capital : null;
  pnlText("total-pct", pnl, percent == null ? "" : percentage(percent));
  setText("capital", cents(portfolio.capital));
  setText("cash", cents(portfolio.cash));
  setText("position", shares(portfolio.units) + " ANT");
  setText("average", portfolio.units ? cents(portfolio.cost * UNIT / portfolio.units) : "—");
  pnlText("realized", portfolio.realized, signed(portfolio.realized));
  pnlText("unrealized", unrealized, signed(unrealized));
  let note = "หุ้นที่ยังถือประเมินด้วยราคา Bid";
  if (portfolio.units && !bid) note = "รอราคา Bid เพื่อประเมินหุ้นที่ยังถือ";
  if (portfolio.units && bid && (!market.tradable || !fresh(market.quote.time, Date.now()))) {
    note = "ประเมินด้วยราคา Bid ล่าสุดที่ได้รับ · ราคาอาจเปลี่ยนแล้ว";
  }
  if (!storageReady) note += " · พอร์ตจะอยู่แค่ระหว่างเปิดแท็บนี้";
  setText("valuation-note", note);
}

function itemNode(tag, label, cls) {
  const node = document.createElement(tag);
  if (label) node.textContent = label;
  if (cls) node.className = cls;
  return node;
}

function renderActivity() {
  const activity = elements.activity;
  const isFills = activeList === "fills";
  const orders = isFills ? portfolio.fills : portfolio.orders;
  setText("fill-count", String(portfolio.fills.length));
  setText("order-count", String(portfolio.orders.length));
  if (!orders.length) {
    activity.replaceChildren(itemNode("p", isFills ? "ยังไม่มีรายการที่จับคู่แล้ว" : "ไม่มีคำสั่งค้าง", "empty-list"));
    return;
  }
  const list = itemNode("ul", "", "activity-list");
  for (const order of orders.slice(-60).reverse()) {
    const row = itemNode("li");
    const left = itemNode("div");
    const verb = order.side === "buy" ? "ซื้อ" : "ขาย";
    left.append(itemNode("strong", verb + " " + shares(order.units) + " ANT",
      order.side === "buy" ? "up" : "down"));
    const time = itemNode("time", clock.format(order.time) + " น. · " + (order.kind === "market" ? "ราคาตลาด" : "ตั้งราคา"));
    time.dateTime = new Date(order.time).toISOString();
    left.append(time);
    const right = itemNode("div", "", "trade-detail");
    const price = isFills ? order.price : order.limit;
    right.append(itemNode("strong", dollars(price)));
    if (isFills) {
      const label = order.side === "sell" ? "กำไร/ขาดทุน " + signed(order.realized) : "ค่าคอมฯ " + cents(order.fee);
      right.append(itemNode("small", label, order.side === "sell" && order.realized !== 0
        ? order.realized > 0 ? "up" : "down" : ""));
    } else {
      const cancel = itemNode("button", "ยกเลิก", "button cancel");
      cancel.type = "button";
      cancel.addEventListener("click", async () => {
        const result = await transact(current => {
          const index = current.orders.findIndex(item => item.id === order.id);
          if (index < 0) return { changed: false };
          current.orders.splice(index, 1);
          return { changed: true };
        });
        showNotice(result.changed ? "ยกเลิกคำสั่งแล้ว" : "คำสั่งได้รับการอัปเดตแล้ว", true);
        renderActivity();
      });
      right.append(document.createElement("br"), cancel);
    }
    row.append(left, right);
    list.append(row);
  }
  activity.replaceChildren(list);
}

function drawChart() {
  const canvas = elements.chart;
  const bounds = canvas.getBoundingClientRect();
  if (!bounds.width || !bounds.height) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = bounds.width * dpr;
  canvas.height = bounds.height * dpr;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.scale(dpr, dpr);
  const latest = points.at(-1);
  elements["chart-empty"].hidden = Boolean(latest);
  if (!latest) return;
  const end = latest.time;
  const values = points.filter(point => point.time >= end - range * 60_000);
  const first = Math.max(end - range * 60_000, Math.min(end - 30_000, values[0].time));
  const low = Math.min(...values.map(point => point.price));
  const high = Math.max(...values.map(point => point.price));
  const padding = Math.max(.1, latest.price * .0025, (high - low) * .12);
  const floor = low - padding;
  const ceiling = high + padding;
  const width = bounds.width - 64;
  const height = bounds.height - 39;
  const x = time => 10 + width * (time - first) / (end - first);
  const y = price => 11 + height * (ceiling - price) / (ceiling - floor);
  ctx.font = "11px DM Sans, sans-serif";
  ctx.textBaseline = "middle";
  ctx.strokeStyle = "#223248";
  ctx.fillStyle = "#9bacc1";
  ctx.lineWidth = 1;
  for (let i = 0; i < 5; i += 1) {
    const price = floor + (ceiling - floor) * i / 4;
    const row = y(price);
    ctx.beginPath();
    ctx.moveTo(10, row);
    ctx.lineTo(width + 10, row);
    ctx.stroke();
    ctx.fillText(price.toFixed(2), width + 17, row);
  }
  ctx.fillText(axisClock.format(first), 10, bounds.height - 12);
  ctx.fillText(axisClock.format(end), width - 14, bounds.height - 12);
  ctx.strokeStyle = "#77b0ff";
  ctx.lineWidth = 2;
  ctx.lineJoin = "round";
  ctx.beginPath();
  let last;
  for (const point of values) {
    const px = x(point.time);
    const py = y(point.price);
    if (!last || point.time - last.time > 20_000) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
    last = point;
  }
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(x(end), y(latest.price), 4, 0, Math.PI * 2);
  ctx.fillStyle = "#9bc4ff";
  ctx.fill();
}

function showNotice(label, ok = false) {
  elements.notice.hidden = !label;
  elements.notice.dataset.tone = ok ? "ok" : "error";
  setText("notice", label);
}

function checkPending() {
  if (checking || !market.tradable || !portfolio.orders.length
    || !portfolio.orders.some(order => market.quote.time >= order.time && sideAllowed(market, order.side)
      && (order.side === "buy" ? market.quote.ask <= order.limit : market.quote.bid >= order.limit))) return;
  checking = true;
  transact(current => {
    const snapshot = feed.snapshot();
    if (!snapshot.tradable) return { changed: false };
    const fills = fillPending(current, snapshot.quote, side => sideAllowed(snapshot, side), Date.now(), bookLeft(snapshot.quote));
    fills.forEach(useBook);
    return { changed: fills.length > 0, fills };
  }).then(result => {
    if (result.changed) showNotice("จับคู่คำสั่งตั้งราคาแล้ว " + result.fills.length + " รายการ", true);
  }).finally(() => { checking = false; });
}

function schedule() {
  if (queued) return;
  queued = true;
  requestAnimationFrame(() => {
    queued = false;
    market = feed.snapshot();
    renderMarket();
    renderTicket();
    renderPortfolio();
    checkPending();
  });
}

function useShortcut(fraction) {
  const order = currentOrder();
  const free = available(portfolio);
  let units = Math.floor(free.units * fraction);
  if (order.side === "buy") {
    const price = order.kind === "limit" ? order.limit : bookPrice(market, order.side);
    if (!(price > 0)) return;
    const budget = Math.floor(free.cash * fraction);
    units = Math.min(10_000_000 * UNIT, Math.floor(budget * UNIT / (price * 100 * (1 + portfolio.feeRate / 100))));
    const { fee, gross } = amounts(units, price, portfolio.feeRate);
    if (gross + fee > budget) units = Math.max(0, units - Math.ceil(UNIT / (price * 100)));
  }
  if (order.kind === "market" && market.quote) {
    const liquidity = bookLeft(market.quote);
    const limit = (order.side === "buy" ? liquidity.askSize : liquidity.bidSize) * UNIT;
    units = Math.min(units, Math.round(limit));
  }
  elements.qty.value = (units / UNIT).toFixed(6).replace(/\.?0+$/, "");
  if (!units) elements.qty.value = "0";
  showNotice("");
  renderTicket();
}

document.querySelectorAll("[data-side], [data-kind], [data-range], [data-list], [data-size]").forEach(button => {
  button.addEventListener("click", () => {
    const [field, val] = Object.entries(button.dataset)[0];
    if (field === "size") {
      useShortcut(Number(val));
      return;
    }
    document.querySelectorAll("[data-" + field + "]").forEach(item => {
      if (item.tagName === "BUTTON" && item.hasAttribute("aria-pressed")) {
        item.setAttribute("aria-pressed", String(item === button));
      }
    });
    if (field === "range") {
      range = Number(val);
      drawChart();
    } else if (field === "list") {
      activeList = val;
      renderActivity();
    } else {
      ticket[field] = val;
      if (field === "kind" && val === "limit" && !elements.limit.value && bookPrice(market, ticket.side)) {
        elements.limit.value = bookPrice(market, ticket.side).toFixed(2);
      }
      showNotice("");
      renderTicket();
    }
  });
});

elements.ticket.addEventListener("input", () => {
  showNotice("");
  renderTicket();
});

elements.ticket.addEventListener("submit", async event => {
  event.preventDefault();
  if (placing) return;
  const fields = currentOrder();
  placing = true;
  renderTicket();
  try {
    const result = await transact(current => {
      const order = {
        ...fields, id: crypto.randomUUID(), feeRate: current.feeRate, time: Date.now(),
      };
      const limit = order.kind === "limit";
      const snapshot = feed.snapshot();
      if (!limit && !sideAllowed(snapshot, order.side)) {
        return { message: "รอราคาอัปเดตจากตลาดก่อนส่งคำสั่ง" };
      }
      const price = limit ? order.limit : bookPrice(snapshot, order.side);
      const error = validateOrder(current, order, price);
      if (error) return { message: error };
      if (limit) {
        current.orders.push(order);
        return { changed: true, message: "ตั้งคำสั่งไว้ที่ " + dollars(order.limit) };
      }
      const liquidity = bookLeft(snapshot.quote);
      const size = order.side === "buy" ? liquidity.askSize : liquidity.bidSize;
      if (order.units > size * UNIT) return { message: "จำนวนหุ้นมากกว่าปริมาณที่ราคา Bid / Ask ล่าสุด" };
      const fill = fillOrder(current, order, price, snapshot.quote.time, Date.now());
      useBook(fill);
      return { changed: true, message: "จับคู่ " + shares(order.units) + " ANT ที่ " + dollars(price) };
    });
    showNotice(result.message, Boolean(result.changed));
  } finally {
    placing = false;
    renderTicket();
  }
});

elements["open-settings"].addEventListener("click", () => {
  elements["new-capital"].value = (portfolio.capital / 100).toFixed(2);
  elements["new-fee"].value = String(portfolio.feeRate);
  elements["settings-error"].hidden = true;
  elements.settings.showModal();
});

elements["close-settings"].addEventListener("click", () => elements.settings.close());
elements["settings-form"].addEventListener("submit", async event => {
  event.preventDefault();
  const capital = parseDecimal(elements["new-capital"].value, 2);
  const rate = parseDecimal(elements["new-fee"].value, 4);
  const result = await transact(current => {
    const message = changeSettings(current, capital, rate);
    return { message, changed: !message };
  });
  if (result.changed) elements.settings.close();
  else {
    elements["settings-error"].hidden = false;
    setText("settings-error", result.message);
  }
});

window.addEventListener("storage", event => {
  if (event.key !== key) return;
  portfolio = readPortfolio(event.newValue);
  renderActivity();
  schedule();
});
window.addEventListener("online", feed.connect);
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) schedule();
});
new ResizeObserver(drawChart).observe(elements.chart.parentElement);
renderActivity();
feed.connect();
setInterval(schedule, 1_000);
