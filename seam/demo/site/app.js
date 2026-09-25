// SEAM demo viewer. Reads window.SEAM_DEMO (built by seam/demo/build.mjs) and replays it bar by bar.
// Every line and label is drawn exactly as the indicator had it after that bar closed.
(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const D = window.SEAM_DEMO;
  if (!D || !Array.isArray(D.scenarios) || D.scenarios.length === 0) {
    $('chart').textContent = '데모 데이터(data.js)가 없습니다. 저장소 루트에서 node seam/demo/build.mjs 를 먼저 실행하세요.';
    return;
  }

  const EXT = 5; // the indicator extends active lines 5 bars to the right
  const FAMILIES = ['수축류', '평행류', '반전류', '무작위'];
  const EV_CODE = { lock: 'LOCK', break_up: 'UP', break_down: 'DOWN', retest: 'RETEST', fail: 'FAIL', expire: 'EXPIRE' };
  const EV_KO = { lock: '경계 고정', break_up: '상단 돌파', break_down: '하단 이탈', retest: '재시험', fail: '반대 경계 이탈', expire: '만료' };
  const EXPECT_KO = { break_up: '상단 돌파', break_down: '하단 이탈' };
  const SVGNS = 'http://www.w3.org/2000/svg';

  const state = { idx: 0, bar: 0, playing: false, timer: 0, selected: null };
  let geo = null; // geometry of the last render, for hover

  const px = (v) => (Math.abs(v) >= 1 ? v.toFixed(2) : Number(v.toPrecision(4)).toString());
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const current = () => D.scenarios[state.idx];

  // ── scenario navigation ───────────────────────────────────────
  function buildNav() {
    const nav = $('scenario-nav');
    const sel = $('scenario-select');
    for (const fam of FAMILIES) {
      const items = D.scenarios.map((s, i) => [s, i]).filter(([s]) => s.family === fam);
      if (!items.length) continue;
      const group = document.createElement('div');
      group.innerHTML = `<h3>${esc(fam)}</h3><ul>${items
        .map(([s, i]) => `<li><button type="button" data-i="${i}"><span>${esc(s.title)}</span><span class="k">${s.id.startsWith('RANDOM') ? '' : esc(s.id)}</span></button></li>`)
        .join('')}</ul>`;
      nav.appendChild(group);
      const og = document.createElement('optgroup');
      og.label = fam;
      for (const [s, i] of items) og.appendChild(new Option(s.id.startsWith('RANDOM') ? s.title : `${s.title} · ${s.id}`, String(i)));
      sel.appendChild(og);
    }
    nav.addEventListener('click', (e) => {
      const b = e.target.closest('button[data-i]');
      if (b) select(Number(b.dataset.i));
    });
    sel.addEventListener('change', () => select(Number(sel.value)));
  }

  function select(i) {
    stop();
    state.idx = i;
    const s = current();
    state.bar = s.bars.length - 1;
    state.selected = null;
    for (const b of document.querySelectorAll('#scenario-nav button')) b.setAttribute('aria-current', String(Number(b.dataset.i) === i));
    $('scenario-select').value = String(i);
    history.replaceState(null, '', `#${s.id}`);

    $('sc-title').textContent = s.title;
    const expect = s.expect ? `고전 기대 ${EXPECT_KO[s.expect]}` : '패턴을 넣지 않음';
    $('sc-meta').innerHTML = `${s.id.startsWith('RANDOM') ? '' : `<span class="k">${esc(s.id)}</span> · `}${esc(s.family)} · ${esc(expect)} · 합성 1시간봉 ${s.bars.length}개`;
    $('sc-note').textContent = s.note;
    const slider = $('slider');
    slider.max = String(s.bars.length - 1);
    update();
  }

  // ── state at a bar ─────────────────────────────────────────────
  function objectAt(o, bar) {
    if (o.born > bar || (o.died !== null && o.died <= bar)) return null;
    const p = {};
    for (const [b, f] of o.frames) {
      if (b > bar) break;
      Object.assign(p, f);
    }
    return p;
  }

  function eventsUpTo(bar) {
    return current().events.filter((e) => e.bar <= bar);
  }

  // ── chart ──────────────────────────────────────────────────────
  let measureCtx = null;
  function textWidth(t) {
    measureCtx ??= document.createElement('canvas').getContext('2d');
    measureCtx.font = `600 12px ${getComputedStyle(document.body).fontFamily}`;
    return measureCtx.measureText(t).width;
  }

  function niceStep(range, target) {
    const raw = range / target;
    const mag = 10 ** Math.floor(Math.log10(raw));
    return [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? 10 * mag;
  }

  function renderChart() {
    const s = current();
    const el = $('chart');
    const W = el.clientWidth;
    const H = el.clientHeight;
    const pad = { l: 8, r: 58, t: 14, b: 26 };
    const n = s.bars.length;
    const slots = n + EXT;
    const plotW = W - pad.l - pad.r;
    const plotH = H - pad.t - pad.b;
    const step = plotW / slots;
    const X = (i) => pad.l + (i + 0.5) * step;

    let lo = Infinity;
    let hi = -Infinity;
    for (const [, h, l] of s.bars) {
      lo = Math.min(lo, l);
      hi = Math.max(hi, h);
    }
    const span = hi - lo || 1;
    lo -= span * 0.09;
    hi += span * 0.09;
    const Y = (v) => pad.t + ((hi - v) / (hi - lo)) * plotH;
    geo = { pad, step, X, n, W, H };

    const out = [];
    out.push(`<defs><clipPath id="plot"><rect x="${pad.l}" y="${pad.t}" width="${plotW}" height="${plotH}"/></clipPath></defs>`);

    // grid + price axis
    const ys = niceStep(hi - lo, Math.max(3, Math.floor(plotH / 70)));
    for (let v = Math.ceil(lo / ys) * ys; v <= hi; v += ys) {
      const y = Y(v).toFixed(1);
      out.push(`<line x1="${pad.l}" x2="${pad.l + plotW}" y1="${y}" y2="${y}" stroke="var(--grid)"/>`);
      out.push(`<text x="${W - pad.r + 8}" y="${y}" dy="4" font-size="12" fill="var(--text-3)">${px(v)}</text>`);
    }
    // bar axis
    const xs = [5, 10, 20, 25, 50, 100, 200].find((k) => k * step >= 56) ?? 200;
    for (let i = 0; i < n; i += xs) {
      out.push(`<text x="${X(i).toFixed(1)}" y="${H - 8}" font-size="12" fill="var(--text-3)" text-anchor="middle">${i}</text>`);
    }

    // selected event: soft band
    const selEv = state.selected !== null ? s.events[state.selected] : null;
    if (selEv) out.push(`<rect x="${(X(selEv.bar) - step / 2).toFixed(1)}" y="${pad.t}" width="${Math.max(step, 2).toFixed(1)}" height="${plotH}" fill="var(--hover)"/>`);

    // candles (neutral ink: the structure lines carry the signal)
    const body = Math.max(1, Math.min(9, step * 0.62));
    const hollow = body >= 4;
    out.push('<g clip-path="url(#plot)">');
    for (let i = 0; i <= state.bar; i++) {
      const [o, h, l, c] = s.bars[i];
      const x = X(i);
      out.push(`<line x1="${x.toFixed(1)}" x2="${x.toFixed(1)}" y1="${Y(h).toFixed(1)}" y2="${Y(l).toFixed(1)}" stroke="var(--wick)"/>`);
      const top = Y(Math.max(o, c));
      const hgt = Math.max(1, Math.abs(Y(o) - Y(c)));
      const up = c >= o;
      if (up && hollow) {
        out.push(`<rect x="${(x - body / 2 + 0.5).toFixed(1)}" y="${top.toFixed(1)}" width="${(body - 1).toFixed(1)}" height="${hgt.toFixed(1)}" fill="var(--bg)" stroke="var(--candle)"/>`);
      } else {
        out.push(`<rect x="${(x - body / 2).toFixed(1)}" y="${top.toFixed(1)}" width="${body.toFixed(1)}" height="${hgt.toFixed(1)}" fill="var(--candle)"${up ? ' fill-opacity="0.45"' : ''}/>`);
      }
    }

    // structure lines, then markers and labels on top
    const labels = [];
    for (const o of s.objects) {
      const p = objectAt(o, state.bar);
      if (!p || p.r === 'hidden') continue;
      if (o.k === 'L') {
        const stroke = p.r === 'reference' ? 'var(--ref)' : p.r === 'forming' ? 'var(--forming)' : `var(--slot-${p.r.slice(-1)})`;
        const w = p.r === 'reference' ? 1.25 : p.d ? 1.25 : 2;
        out.push(`<line x1="${X(p.x1).toFixed(1)}" y1="${Y(p.y1).toFixed(1)}" x2="${X(p.x2).toFixed(1)}" y2="${Y(p.y2).toFixed(1)}" stroke="${stroke}" stroke-width="${w}"${p.d ? ' stroke-dasharray="2 3"' : ''} stroke-linecap="round"/>`);
      } else {
        labels.push(p);
      }
    }
    out.push('</g>');

    const placed = []; // label boxes already drawn, to push later ones clear of them
    const collides = (r) => placed.some((q) => r.x < q.x + q.w + 2 && q.x < r.x + r.w + 2 && r.y < q.y + q.h + 2 && q.y < r.y + r.h + 2);
    for (const p of labels) {
      const x = X(p.x);
      if (p.r.startsWith('lock')) {
        const y = Y(p.y);
        out.push(`<g><rect x="${(x - 4).toFixed(1)}" y="${(y - 4).toFixed(1)}" width="8" height="8" transform="rotate(45 ${x.toFixed(1)} ${y.toFixed(1)})" fill="var(--slot-${p.r.slice(-1)})" stroke="var(--bg)" stroke-width="1.5"/><title>${esc(p.tip)}</title></g>`);
        continue;
      }
      const bar = s.bars[p.x];
      if (!bar) continue;
      const above = p.at === 'abovebar';
      const w = Math.ceil(textWidth(p.t)) + 12;
      const h = 20;
      const lx = Math.min(Math.max(x - w / 2, pad.l), pad.l + plotW - w);
      // preferred side first (stacking away from the bar), then the other side, else accept an overlap
      const place = (y0, dir) => {
        for (let y = y0; y >= pad.t && y <= pad.t + plotH - h; y += dir * (h + 3)) if (!collides({ x: lx, y, w, h })) return y;
        return null;
      };
      const yAbove = Y(bar[1]) - 8 - h;
      const yBelow = Y(bar[2]) + 8;
      const y = (above ? place(yAbove, -1) ?? place(yBelow, 1) : place(yBelow, 1) ?? place(yAbove, -1))
        ?? Math.min(Math.max(above ? yAbove : yBelow, pad.t), pad.t + plotH - h);
      placed.push({ x: lx, y, w, h });
      const fill = p.r === 'up' ? 'var(--up)' : p.r === 'down' ? 'var(--down)' : 'var(--slot-1)';
      out.push(`<g><rect x="${lx.toFixed(1)}" y="${y.toFixed(1)}" width="${w}" height="${h}" rx="3" fill="${fill}"/><text x="${(lx + w / 2).toFixed(1)}" y="${(y + 14).toFixed(1)}" font-size="12" font-weight="600" fill="#fff" text-anchor="middle">${esc(p.t)}</text></g>`);
    }

    // replay head
    if (state.bar < n - 1) {
      const hx = (X(state.bar) + step / 2).toFixed(1);
      out.push(`<line x1="${hx}" x2="${hx}" y1="${pad.t}" y2="${pad.t + plotH}" stroke="var(--replay)" stroke-dasharray="3 3"/>`);
    }
    out.push(`<line id="crosshair" x1="0" x2="0" y1="${pad.t}" y2="${pad.t + plotH}" stroke="var(--text-3)" stroke-width="1" visibility="hidden"/>`);

    const evs = eventsUpTo(state.bar);
    el.innerHTML = `<svg xmlns="${SVGNS}" role="img" aria-label="${esc(`${s.title} 합성 차트, ${n}봉 중 ${state.bar}번 봉까지, 확정 이벤트 ${evs.length}개`)}">${out.join('')}</svg>`;
  }

  function readout(i) {
    const s = current();
    const b = s.bars[i];
    if (!b) return;
    $('readout').textContent = `봉 ${i} · 시가 ${px(b[0])} · 고가 ${px(b[1])} · 저가 ${px(b[2])} · 종가 ${px(b[3])}`;
  }

  function onHover(e) {
    if (!geo) return;
    const svg = $('chart').querySelector('svg');
    const r = svg.getBoundingClientRect();
    const i = Math.round((e.clientX - r.left - geo.pad.l) / geo.step - 0.5);
    const cross = svg.querySelector('#crosshair');
    if (i < 0 || i > state.bar) {
      cross.setAttribute('visibility', 'hidden');
      readout(state.bar);
      return;
    }
    const x = geo.X(i).toFixed(1);
    cross.setAttribute('x1', x);
    cross.setAttribute('x2', x);
    cross.setAttribute('visibility', 'visible');
    readout(i);
  }

  // ── side panel ─────────────────────────────────────────────────
  function detail(e) {
    if (e.event === 'lock') return `상 ${px(e.upper)} · 하 ${px(e.lower)}`;
    if (e.event === 'break_up') return `상단선 ${px(e.upperNow ?? e.upper)} · 종가 ${px(e.close)}`;
    if (e.event === 'break_down') return `하단선 ${px(e.lowerNow ?? e.lower)} · 종가 ${px(e.close)}`;
    return `종가 ${px(e.close)}`;
  }

  function renderSide() {
    const s = current();
    const shown = s.events.map((e, i) => [e, i]).filter(([e]) => e.bar <= state.bar).reverse();
    if (state.selected === null || s.events[state.selected].bar > state.bar) state.selected = shown.length ? shown[0][1] : null;
    const log = $('log');
    log.innerHTML = shown.length
      ? shown.map(([e, i]) => {
          const cls = e.event === 'break_up' ? ' up' : e.event === 'break_down' ? ' down' : '';
          return `<li><button type="button" data-e="${i}" aria-current="${i === state.selected}"><span class="ev${cls}">${EV_CODE[e.event]}</span><span class="bar">봉 ${e.bar}</span><span class="what"><span class="k">${esc(e.key)}</span> ${esc(EV_KO[e.event])} · ${esc(detail(e))}</span></button></li>`;
        }).join('')
      : '<li class="empty">아직 확정된 이벤트가 없습니다. 재생 위치를 오른쪽으로 옮겨 보세요.</li>';
    $('message').textContent = state.selected !== null ? s.events[state.selected].message : '표시할 메시지가 없습니다.';
  }

  // ── replay controls ────────────────────────────────────────────
  function update() {
    const s = current();
    $('slider').value = String(state.bar);
    $('position').textContent = `봉 ${state.bar} / ${s.bars.length - 1}`;
    const atEnd = state.bar >= s.bars.length - 1;
    const play = $('btn-play');
    play.textContent = state.playing ? '일시정지' : atEnd ? '처음부터 재생' : '재생';
    play.setAttribute('aria-pressed', String(state.playing));
    renderSide();
    renderChart();
    readout(state.bar);
  }

  function setBar(b) {
    const s = current();
    state.bar = Math.max(0, Math.min(s.bars.length - 1, b));
    update();
  }

  function stop() {
    state.playing = false;
    clearInterval(state.timer);
  }

  function togglePlay() {
    if (state.playing) {
      stop();
      update();
      return;
    }
    const s = current();
    if (state.bar >= s.bars.length - 1) state.bar = 0;
    state.playing = true;
    const ms = Math.max(25, Math.min(90, 9000 / s.bars.length));
    state.timer = setInterval(() => {
      if (state.bar >= current().bars.length - 1) {
        stop();
        update();
        return;
      }
      setBar(state.bar + 1);
    }, ms);
    update();
  }

  // ── wiring ─────────────────────────────────────────────────────
  buildNav();
  $('btn-play').addEventListener('click', togglePlay);
  $('btn-prev').addEventListener('click', () => { stop(); setBar(state.bar - 1); });
  $('btn-next').addEventListener('click', () => { stop(); setBar(state.bar + 1); });
  $('btn-end').addEventListener('click', () => { stop(); setBar(current().bars.length - 1); });
  $('slider').addEventListener('input', (e) => { stop(); setBar(Number(e.target.value)); });
  $('log').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-e]');
    if (!b) return;
    state.selected = Number(b.dataset.e);
    renderSide();
    renderChart();
    $('log').querySelector(`button[data-e="${state.selected}"]`)?.focus();
  });
  const chart = $('chart');
  chart.addEventListener('pointermove', onHover);
  chart.addEventListener('pointerleave', () => {
    const cross = chart.querySelector('#crosshair');
    if (cross) cross.setAttribute('visibility', 'hidden');
    readout(state.bar);
  });
  new ResizeObserver(() => renderChart()).observe(chart);
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => renderChart());

  const built = new Date(D.builtAt);
  $('build-info').textContent = `설정: ${D.settings} · 데이터 생성 ${built.toISOString().slice(0, 16).replace('T', ' ')} UTC`;

  const fromHash = D.scenarios.findIndex((s) => `#${s.id}` === location.hash);
  select(fromHash >= 0 ? fromHash : 0);
})();
