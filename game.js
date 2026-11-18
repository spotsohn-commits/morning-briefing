// 영어 단어 빈칸 게임: 한글 뜻 + 빈칸 예문 + 4지선다
const START_DATE = "2026-11-17"; // 앱을 시작한 날 (이날부터 나온 단어가 '기출')
const ROUND_SIZE = 10;
const MIN_POOL = 10; // 기출 단어가 이보다 적으면 전체 단어에서 출제
const BEST_KEY = "wordgame-best";

const $ = (sel, el = document) => el.querySelector(sel);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const escRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// ---------- 날짜 (메인 화면과 같은 규칙) ----------
function kstToday() {
  const q = new URLSearchParams(location.search).get("date"); // 테스트용 ?date=2026-12-01
  if (q && /^\d{4}-\d{2}-\d{2}$/.test(q)) return q;
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date());
}
const dayNum = (ymd) => Math.floor(Date.parse(ymd + "T00:00:00Z") / 86400000);
const pick = (list, n) => list[((n % list.length) + list.length) % list.length];

function seenWords(list) {
  const seen = new Map();
  for (let d = dayNum(START_DATE); d <= dayNum(kstToday()); d++) {
    const w = pick(list, d);
    seen.set(w.word, w);
  }
  return [...seen.values()];
}

function shuffle(a) {
  a = [...a];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// 예문에서 정답 단어를 찾는 정규식 (예: surge → "surged")
const blankRe = (w) => new RegExp(`(^|[^A-Za-z])(${escRe(w.answer ?? w.word)})(?![A-Za-z])`, "i");

// ---------- 저장 (실패해도 게임은 동작) ----------
function getBest() { try { return Number(localStorage.getItem(BEST_KEY)) || 0; } catch { return 0; } }
function setBest(v) { try { localStorage.setItem(BEST_KEY, String(v)); } catch {} }

function speak(text) {
  if (!("speechSynthesis" in window)) return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = "en-US";
  u.rate = 0.85;
  speechSynthesis.speak(u);
}

// ---------- 게임 ----------
let ALL = [], POOL = [], round = [], idx = 0, score = 0, wrong = [];
const body = () => $("#game .body");

function startRound() {
  round = shuffle(POOL).slice(0, Math.min(ROUND_SIZE, POOL.length));
  idx = 0; score = 0; wrong = [];
  showQuestion();
}

function showQuestion() {
  const w = round[idx];
  const others = shuffle(ALL.filter((x) => x.word !== w.word)).slice(0, 3);
  const choices = shuffle([w, ...others]);
  const sentence = esc(w.example).replace(blankRe(w), (_, pre) => `${pre}<span class="blank">______</span>`);

  body().innerHTML = `
    <div class="g-progress"><span>${idx + 1} / ${round.length}</span><span>점수 ${score}</span></div>
    <div class="g-bar"><i style="width:${(idx / round.length) * 100}%"></i></div>
    <p class="g-label">뜻</p>
    <p class="g-meaning">${esc(w.meaning)}</p>
    <p class="g-label">빈칸에 들어갈 단어는?</p>
    <p class="g-sentence">${sentence}</p>
    <div class="g-choices">${choices.map((c) =>
      `<button class="g-choice" data-word="${esc(c.word)}">${esc(c.word)}</button>`).join("")}</div>
    <div class="g-feedback" hidden></div>`;

  body().onclick = (e) => {
    const btn = e.target.closest(".g-choice");
    if (!btn || body().dataset.answered === "1") return;
    answer(w, btn);
  };
  body().dataset.answered = "0";
}

function answer(w, btn) {
  body().dataset.answered = "1";
  const ok = btn.dataset.word === w.word;
  if (ok) score++; else wrong.push(w);

  body().querySelectorAll(".g-choice").forEach((b) => {
    b.disabled = true;
    if (b.dataset.word === w.word) b.classList.add("correct");
    else if (b === btn) b.classList.add("wrong");
  });

  const full = esc(w.example).replace(blankRe(w), (_, pre, word) => `${pre}<b class="hl">${word}</b>`);
  const fb = $(".g-feedback", body());
  fb.hidden = false;
  fb.innerHTML = `
    <p class="g-result ${ok ? "ok" : "no"}">${ok ? "정답이에요! 🎉" : `아쉬워요. 정답은 <b>${esc(w.word)}</b>`}</p>
    <p class="g-full">${full}</p>
    <p class="muted">${esc(w.exampleKo)}</p>
    <div class="actions">
      ${"speechSynthesis" in window ? `<button data-act="speak">🔊 문장 듣기</button>` : ""}
      <button data-act="next" class="primary">${idx + 1 < round.length ? "다음 문제 →" : "결과 보기"}</button>
    </div>`;
  $(".g-progress span:last-child", body()).textContent = `점수 ${score}`;

  fb.onclick = (e) => {
    const act = e.target.closest("button")?.dataset.act;
    if (act === "speak") speak(w.example);
    if (act === "next") { idx++; idx < round.length ? showQuestion() : showResult(); }
  };
  $("[data-act=next]", fb).focus({ preventScroll: true });
  fb.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function showResult() {
  const best = Math.max(getBest(), score);
  const isNew = score > getBest();
  setBest(best);
  const pct = score / round.length;
  const msg = pct === 1 ? "완벽해요! 💯" : pct >= 0.7 ? "잘했어요! 👏" : pct >= 0.4 ? "조금만 더! 💪" : "다시 도전해봐요 🙂";

  body().innerHTML = `
    <div class="g-score">
      <p class="g-big">${score} <span>/ ${round.length}</span></p>
      <p>${msg}</p>
      <p class="muted">최고 기록 ${best}점${isNew ? " · 새 기록!" : ""}</p>
    </div>
    ${wrong.length ? `<p class="g-label">틀린 단어 다시 보기</p>
      <ul class="g-wrong">${wrong.map((w) =>
        `<li><b>${esc(w.word)}</b> <span class="muted">${esc(w.reading ?? "")}</span><br>${esc(w.meaning)}</li>`).join("")}</ul>` : ""}
    <div class="actions">
      <button class="primary" data-act="again">다시 하기</button>
      <a class="btn-link" href="./">브리핑으로</a>
    </div>`;
  body().onclick = (e) => { if (e.target.closest("[data-act=again]")) startRound(); };
  window.scrollTo({ top: 0, behavior: "smooth" });
}

(async function init() {
  try {
    const res = await fetch("data/en.json", { cache: "no-store" });
    ALL = await res.json();
  } catch (e) {
    console.warn(e);
    body().innerHTML = `<p class="muted">단어를 불러오지 못했어요. 잠시 후 다시 열어주세요.</p>`;
    return;
  }
  const seen = seenWords(ALL);
  POOL = seen.length >= MIN_POOL ? seen : ALL;
  $("#pool-note").textContent = seen.length >= MIN_POOL
    ? `지금까지 나온 영어 단어 ${seen.length}개에서 출제해요.`
    : `지금까지 나온 단어가 ${seen.length}개뿐이라, 전체 ${ALL.length}개 단어에서 출제해요.`;
  startRound();
})();
