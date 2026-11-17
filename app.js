// 모닝 브리핑 — 서버 없이 동작하는 정적 웹앱
const CITIES = [
  { name: "서울", lat: 37.5665, lon: 126.978 },
  { name: "당진", lat: 36.8936, lon: 126.6283 },
  { name: "김해", lat: 35.2285, lon: 128.8894 },
];

const FX = [
  { code: "USD", label: "🇺🇸 미국 달러", unit: 1 },
  { code: "JPY", label: "🇯🇵 일본 엔 (100엔)", unit: 100 },
  { code: "CNY", label: "🇨🇳 중국 위안", unit: 1 },
  { code: "EUR", label: "🇪🇺 유로", unit: 1 },
  { code: "HKD", label: "🇭🇰 홍콩 달러", unit: 1 },
];

const $ = (sel, el = document) => el.querySelector(sel);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// ---------- 날짜 (한국 시간 기준) ----------
function kstToday() {
  const q = new URLSearchParams(location.search).get("date"); // 테스트용 ?date=2026-11-18
  if (q && /^\d{4}-\d{2}-\d{2}$/.test(q)) return q;
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date());
}
const TODAY = kstToday();
const DAY_NUM = Math.floor(Date.parse(TODAY + "T00:00:00Z") / 86400000);

function renderHeader() {
  const d = new Date(TODAY + "T12:00:00+09:00");
  $("#today").textContent = new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul", year: "numeric", month: "long", day: "numeric", weekday: "long",
  }).format(d);
  const h = Number(new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Seoul", hour: "numeric", hourCycle: "h23" }).format(new Date()));
  $("#greeting").textContent = h < 11 ? "좋은 아침이에요 ☕" : h < 18 ? "좋은 오후예요" : "좋은 저녁이에요";
}

function fail(id, msg = "지금은 불러오지 못했어요. 잠시 후 다시 열어주세요.") {
  $(`#${id} .body`).innerHTML = `<p class="muted">${esc(msg)}</p>`;
}

async function getJSON(url, timeoutMs = 8000) {
  const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(timeoutMs) });
  if (!res.ok) throw new Error(res.status + " " + url);
  return res.json();
}

// ---------- 날씨 (Open-Meteo, 키 불필요) ----------
const WMO = (c) =>
  c === 0 ? ["☀️", "맑음"] : c <= 2 ? ["🌤️", "구름 조금"] : c === 3 ? ["☁️", "흐림"] :
  c <= 48 ? ["🌫️", "안개"] : c <= 57 ? ["🌦️", "이슬비"] : c <= 67 ? ["🌧️", "비"] :
  c <= 77 ? ["🌨️", "눈"] : c <= 82 ? ["🌧️", "소나기"] : c <= 86 ? ["🌨️", "눈 소나기"] : ["⛈️", "뇌우"];

// 예비: wttr.in (WWO 날씨 코드)
const WWO = (c) =>
  c === 113 ? ["☀️", "맑음"] : c === 116 ? ["🌤️", "구름 조금"] : c <= 122 ? ["☁️", "흐림"] :
  [143, 248, 260].includes(c) ? ["🌫️", "안개"] : [200, 386, 389, 392, 395].includes(c) ? ["⛈️", "뇌우"] :
  [179, 182, 185, 227, 230, 281, 284, 311, 314, 317, 320, 323, 326, 329, 332, 335, 338, 350, 362, 365, 368, 371, 374, 377].includes(c) ? ["🌨️", "눈/진눈깨비"] :
  ["🌧️", "비"];

async function weatherFromWttr() {
  return Promise.all(CITIES.map(async (c) => {
    const j = await getJSON(`https://wttr.in/${c.lat},${c.lon}?format=j1`, 12000);
    const cur = j.current_condition[0], day = j.weather[0];
    return {
      code: WWO(Number(cur.weatherCode)),
      temp: Number(cur.temp_C),
      min: Number(day.mintempC),
      max: Number(day.maxtempC),
      rain: Math.max(...day.hourly.map((h) => Number(h.chanceofrain))),
    };
  }));
}

async function weatherFromOpenMeteo() {
  const url = "https://api.open-meteo.com/v1/forecast?" + new URLSearchParams({
      latitude: CITIES.map((c) => c.lat).join(","),
      longitude: CITIES.map((c) => c.lon).join(","),
      current: "temperature_2m,weather_code",
      daily: "temperature_2m_max,temperature_2m_min,precipitation_probability_max",
      timezone: "Asia/Seoul",
      forecast_days: "1",
    });
  let data = await getJSON(url, 6000);
  if (!Array.isArray(data)) data = [data];
  return data.map((d) => ({
    code: WMO(d.current.weather_code),
    temp: d.current.temperature_2m,
    min: d.daily.temperature_2m_min[0],
    max: d.daily.temperature_2m_max[0],
    rain: d.daily.precipitation_probability_max?.[0],
  }));
}

async function loadWeather() {
  let list;
  try {
    list = await weatherFromOpenMeteo();
  } catch (e) {
    console.warn("Open-Meteo 실패, wttr.in 사용", e);
    try { list = await weatherFromWttr(); } catch (e2) { console.warn(e2); return fail("weather"); }
  }
  $("#weather .body").innerHTML = `<div class="cities">${list.map((w, i) => `<div class="city">
      <div class="name">${CITIES[i].name}</div>
      <div class="icon" title="${w.code[1]}">${w.code[0]}</div>
      <div class="temp">${Math.round(w.temp)}°</div>
      <div class="range">${Math.round(w.min)}° / ${Math.round(w.max)}°</div>
      <div class="rain">☂️ ${Number.isFinite(w.rain) ? w.rain : "-"}%</div>
    </div>`).join("")}</div>`;
}

// ---------- 환율 ----------
async function loadFx() {
  let rates, when;
  try {
    const d = await getJSON("https://open.er-api.com/v6/latest/KRW");
    rates = d.rates;
    when = d.time_last_update_utc;
  } catch (e) {
    try {
      const d = await getJSON("https://api.frankfurter.app/latest?from=KRW&to=USD,JPY,CNY,EUR,HKD");
      rates = d.rates;
      when = d.date;
    } catch (e2) {
      console.warn(e, e2);
      return fail("fx");
    }
  }
  const fmt = new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 2, minimumFractionDigits: 2 });
  const stamp = when ? new Date(when).toLocaleString("ko-KR", { timeZone: "Asia/Seoul", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "";
  $("#fx .body").innerHTML = `<div class="fx-grid">${FX.map((f) => {
    const krw = rates[f.code] ? (1 / rates[f.code]) * f.unit : null;
    return `<div class="fx-item"><div class="cur">${f.label}</div><div class="val">${krw ? fmt.format(krw) + "원" : "-"}</div></div>`;
  }).join("")}</div>${stamp ? `<p class="stamp">기준: ${esc(stamp)}</p>` : ""}`;
}

// ---------- 전날 종가 (GitHub Actions가 매일 만드는 data/market.json) ----------
function fmtPrice(x) {
  const isStockKRW = x.currency === "KRW" && !x.symbol.startsWith("^");
  if (isStockKRW) return new Intl.NumberFormat("ko-KR").format(Math.round(x.close)) + "원";
  const n = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(x.close);
  return x.symbol.startsWith("^") ? n : "$" + n;
}

function marketGroup(title, list) {
  if (!list.length) return "";
  const date = list.find((x) => x.date)?.date;
  const md = date ? ` <span class="mdate">${Number(date.slice(5, 7))}/${Number(date.slice(8, 10))} 종가</span>` : "";
  return `<h3 class="mgroup">${title}${md}</h3><ul class="mlist">${list.map((x) => {
    if (x.close == null) return `<li><span class="mname">${esc(x.name)}</span><span class="mval muted">-</span></li>`;
    const cls = x.change > 0 ? "up" : x.change < 0 ? "down" : "";
    const arrow = x.change > 0 ? "▲" : x.change < 0 ? "▼" : "–";
    return `<li><span class="mname">${esc(x.name)}</span>
      <span class="mval">${fmtPrice(x)}</span>
      <span class="mchg ${cls}">${arrow} ${Math.abs(x.changePct).toFixed(2)}%</span></li>`;
  }).join("")}</ul>`;
}

async function loadMarket() {
  try {
    const d = await getJSON("data/market.json");
    if (!d.items?.length) return fail("market", "아직 수집된 시세가 없어요.");
    $("#market .body").innerHTML =
      marketGroup("🇰🇷 국내", d.items.filter((x) => x.group === "kr")) +
      marketGroup("🇺🇸 미국", d.items.filter((x) => x.group === "us"));
  } catch (e) {
    console.warn(e);
    fail("market");
  }
}

// ---------- 오늘의 단어 ----------
function speak(text, lang) {
  if (!("speechSynthesis" in window)) return alert("이 브라우저는 음성 읽기를 지원하지 않아요.");
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = lang;
  u.rate = 0.85;
  speechSynthesis.speak(u);
}

function renderWord(card, list, idx) {
  const w = list[((idx % list.length) + list.length) % list.length];
  const lang = card.dataset.lang;
  const body = $(".body", card);
  body.innerHTML = `
    <p class="term">${esc(w.word)}</p>
    ${w.reading ? `<p class="reading">${esc(w.reading)}</p>` : ""}
    <p class="meaning">${esc(w.meaning)}</p>
    ${w.example ? `<p class="example">${esc(w.example)}${w.exampleKo ? `<span class="ko">${esc(w.exampleKo)}</span>` : ""}</p>` : ""}
    <div class="actions">
      ${lang ? `<button data-act="speak">🔊 발음 듣기</button>` : ""}
      <button data-act="next">다른 단어 보기</button>
    </div>`;
  body.onclick = (e) => {
    const act = e.target.closest("button")?.dataset.act;
    if (act === "speak") speak(w.word, lang);
    if (act === "next") renderWord(card, list, idx + 1);
  };
}

async function loadWords() {
  await Promise.all([...document.querySelectorAll(".card.word")].map(async (card) => {
    try {
      const list = await getJSON(`data/${card.dataset.set}.json`);
      renderWord(card, list, DAY_NUM); // 같은 날엔 모두가 같은 단어
    } catch (e) {
      console.warn(e);
      fail(card.id);
    }
  }));
}

// ---------- 공유 / PWA ----------
function setupShare() {
  $("#share").onclick = async () => {
    const url = location.origin + location.pathname;
    try {
      if (navigator.share) await navigator.share({ title: "모닝 브리핑", text: "매일 아침 날씨·증시·환율·단어 한 번에!", url });
      else { await navigator.clipboard.writeText(url); alert("링크를 복사했어요!\n" + url); }
    } catch {}
  };
  if (window.matchMedia("(display-mode: standalone)").matches || navigator.standalone) {
    $("#install-hint").hidden = true;
  }
}

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(console.warn));
}

renderHeader();
setupShare();
loadWeather();
loadMarket();
loadFx();
loadWords();
