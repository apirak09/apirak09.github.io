export const UNIT = 1_000_000;
export const DEFAULT_FEE = 0.1605;
export const MAX_DOLLARS = 1_000_000_000;

export function newPortfolio() {
  return {
    version: 1,
    capital: 100_000,
    cash: 100_000,
    units: 0,
    cost: 0,
    realized: 0,
    feeRate: DEFAULT_FEE,
    fills: [],
    orders: [],
  };
}

export function readPortfolio(value) {
  try {
    const portfolio = JSON.parse(value);
    const centFields = ["capital", "cash", "units", "cost", "realized"];
    if (portfolio?.version === 1 && centFields.every(key => Number.isSafeInteger(portfolio[key]))
      && Number.isFinite(portfolio.feeRate) && Array.isArray(portfolio.fills) && Array.isArray(portfolio.orders)) {
      return portfolio;
    }
  } catch {
    // A new portfolio is safe if local data is unavailable or invalid.
  }
  return newPortfolio();
}

export function parseDecimal(input, places) {
  const value = input.trim().replace(/,/g, "");
  if (!new RegExp("^(?:[0-9]+(?:\\.[0-9]{0," + places + "})?|\\.[0-9]{1," + places + "})$").test(value)) {
    return NaN;
  }
  return Number(value);
}

export function amounts(units, price, rate) {
  const gross = Math.round(units * price * 100 / UNIT);
  const fee = Math.round(gross * rate / 100);
  return { gross, fee };
}

export function available(portfolio) {
  let cash = portfolio.cash;
  let units = portfolio.units;
  for (const order of portfolio.orders) {
    if (order.side === "buy") {
      const { gross, fee } = amounts(order.units, order.limit, order.feeRate);
      cash -= gross + fee;
    } else {
      units -= order.units;
    }
  }
  return { cash, units };
}

export function validateOrder(portfolio, order, price) {
  if (!Number.isSafeInteger(order.units) || order.units <= 0 || order.units > 10_000_000 * UNIT) {
    return "กรอกจำนวนหุ้นให้ถูกต้อง (ทศนิยมได้ 6 ตำแหน่ง)";
  }
  if (!Number.isFinite(price) || price <= 0 || price > MAX_DOLLARS) {
    return "กรอกราคาที่มากกว่า 0";
  }
  const { gross, fee } = amounts(order.units, price, order.feeRate);
  if (!Number.isSafeInteger(gross) || gross < 1) return "มูลค่าคำสั่งต้องอย่างน้อย $0.01";

  const free = available(portfolio);
  if (order.side === "buy" && gross + fee > free.cash) return "เงินพร้อมซื้อไม่พอ";
  if (order.side === "sell" && order.units > free.units) return "หุ้นพร้อมขายไม่พอ";
  return "";
}

export function fillOrder(portfolio, order, price, quoteTime, executionTime) {
  const { gross, fee } = amounts(order.units, price, order.feeRate);
  let realized = 0;
  if (order.side === "buy") {
    portfolio.cash -= gross + fee;
    portfolio.units += order.units;
    portfolio.cost += gross + fee;
  } else {
    const basis = Math.round(portfolio.cost * order.units / portfolio.units);
    portfolio.cash += gross - fee;
    portfolio.units -= order.units;
    portfolio.cost -= basis;
    realized = gross - fee - basis;
    portfolio.realized += realized;
  }
  const fill = {
    id: order.id,
    side: order.side,
    kind: order.kind,
    units: order.units,
    price,
    gross,
    fee,
    realized,
    quoteTime,
    time: executionTime,
  };
  portfolio.fills.push(fill);
  return fill;
}

export function fillPending(portfolio, quote, allowSide, time, liquidity = quote) {
  let bidRemaining = liquidity.bidSize * UNIT;
  let askRemaining = liquidity.askSize * UNIT;
  const fills = [];
  portfolio.orders = portfolio.orders.filter(order => {
    if (quote.time < order.time || !allowSide(order.side)) return true;
    const isBuy = order.side === "buy";
    const price = isBuy ? quote.ask : quote.bid;
    const canFill = isBuy
      ? price <= order.limit && order.units <= askRemaining
      : price >= order.limit && order.units <= bidRemaining;
    if (!canFill || amounts(order.units, price, order.feeRate).gross < 1) return true;
    const fill = fillOrder(portfolio, order, price, quote.time, time);
    if (isBuy) askRemaining -= order.units;
    else bidRemaining -= order.units;
    fills.push(fill);
    return false;
  });
  return fills;
}

export function valuePortfolio(portfolio, bid) {
  if (portfolio.units && !bid) return { equity: null, pnl: null, unrealized: null };
  const stockValue = Math.round(portfolio.units * (bid || 0) * 100 / UNIT);
  const unrealized = stockValue - portfolio.cost;
  return { equity: portfolio.cash + stockValue, pnl: portfolio.realized + unrealized, unrealized };
}

export function changeSettings(portfolio, dollars, feeRate) {
  if (!Number.isFinite(dollars) || dollars < 0 || dollars > MAX_DOLLARS) {
    return "กรอกเงินทุนระหว่าง $0 ถึง $1,000,000,000";
  }
  if (!Number.isFinite(feeRate) || feeRate < 0 || feeRate > 5) {
    return "กรอกค่าคอมมิชชันระหว่าง 0% ถึง 5%";
  }
  const capital = Math.round(dollars * 100);
  const delta = capital - portfolio.capital;
  if (available(portfolio).cash + delta < 0) return "เงินสดพร้อมใช้ไม่พอสำหรับลดทุนตามที่ระบุ";
  portfolio.cash += delta;
  portfolio.capital = capital;
  portfolio.feeRate = feeRate;
  return "";
}
