/* ============================================================
   APP — picker → explosion → results sections → pairing chat
   ============================================================ */
'use strict';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const results = $('#results'), pickerEl = $('#picker');
const ordinal = n => n + (['th', 'st', 'nd', 'rd'][(n % 100 > 10 && n % 100 < 14) ? 0 : Math.min(n % 10, 4) % 4] || 'th');
const pcol = n => GRAHAS[n].hex;
let chart = null, liveViews = [], io = null, planetV = null, selectedPlanet = null;

/* ---------- picker wiring ---------- */
const pickLabel = $('#pickLabel');
Picker.onChange(s => {
  const dt = new Date(Date.UTC(s.year, s.month - 1, s.day));
  pickLabel.innerHTML = `${s.day} ${dt.toLocaleDateString('en-GB', { month: 'long', timeZone: 'UTC' })} ${s.year}<small>${VARA[dt.getUTCDay()].name.toUpperCase()}</small>`;
});
$('#revealBtn').addEventListener('click', () => {
  if (Picker.state !== 'idle') return;
  const d = Picker.getDate();
  pickerEl.classList.add('charging');
  Picker.explode(() => {
    chart = computeChart(d.year, d.month, d.day);
    render(chart);
    pickerEl.style.pointerEvents = 'none';
    document.body.classList.replace('phase-pick', 'phase-results');
    window.scrollTo(0, 0);
  }, () => { pickerEl.classList.add('out'); Picker.view.enabled = false; });
});
$('#againBtn').addEventListener('click', () => {
  liveViews.forEach(v => Stage.removeView(v)); liveViews = [];
  if (io) io.disconnect();
  results.innerHTML = ''; results.hidden = true;
  document.body.classList.replace('phase-results', 'phase-pick');
  pickerEl.classList.remove('out', 'charging'); pickerEl.style.pointerEvents = '';
  Picker.reset(); window.scrollTo(0, 0);
});

/* ---------- template helpers ---------- */
const kv = items => `<div class="kv">${items.map(([k, v]) => `<div><small>${k}</small><b>${v}</b></div>`).join('')}</div>`;
const tags = (arr, cls = '') => arr.map(t => `<span class="tag ${cls}">${t}</span>`).join('');

function keyPlanets(c) {
  const m = new Map(), ms = SIGNS[c.moonSign], ss = SIGNS[c.sunSign], nk = NAKSHATRAS[c.moonNak];
  const add = (n, why) => { if (!m.has(n)) m.set(n, []); m.get(n).push(why); };
  add(SIGN_LORDS[c.moonSign], `Lord of your Moon sign ${ms.name} — it steers your mind and emotions.`);
  add(SIGN_LORDS[c.sunSign], `Lord of your zodiac (Sun) sign ${ss.name} — it steers your outer identity.`);
  add(DASHA_ORDER[c.moonNak % 9], `Ruler of your birth nakshatra ${nk[0]} — it also rules the first dasha of your life.`);
  add(NUMBERS[c.mulank].planet, `Ruler of your birth number ${c.mulank} (you were born on the ${ordinal(c.d)}).`);
  return m;
}

function heroCard(href, glyph, key, value, sub, color) {
  return `<a class="gcard" href="${href}" style="--c:${color}"><div class="gl">${glyph}</div><div class="gk">${key}</div><div class="gv">${value}</div><div class="gs">${sub}</div></a>`;
}

function planetInfoHTML(name, c, why) {
  const g = GRAHAS[name], p = c.P[name], sg = SIGNS[p.sign];
  return `
    <p class="eyebrow">Graha · ${g.role}</p>
    <div class="big-name"><h2>${g.sk}</h2><span class="dev">${g.dev}</span></div>
    ${why && why.length ? `<div class="why"><b>Why this is yours:</b> ${why.join(' ')}</div>` : ''}
    <p class="lede">${g.blurb}</p>
    <div class="kv">
      <div><small>In your chart</small><b>${sg.name} ${p.deg.toFixed(1)}°${p.retro && name !== 'Rahu' && name !== 'Ketu' ? ' ℞' : ''}</b></div>
      <div><small>House from Moon</small><b>${ordinal(p.house)}</b></div>
      <div><small>Dignity</small><b>${p.dignity || 'Neutral'}</b></div>
      <div><small>Nakshatra</small><b>${NAKSHATRAS[p.nak][0]}</b></div>
    </div>
    ${kv([['Day', g.day], ['Gemstone', g.gem], ['Metal', g.metal], ['Colour', g.colorName], ['Direction', g.dir], ['Element', g.element], ['Body', g.body], ['Dasha', g.years + ' years']])}
    <div class="two">
      <div class="card"><h3>When strong</h3><p>${g.strong}</p></div>
      <div class="card"><h3>When strained</h3><p>${g.weak}</p></div>
    </div>
    <p class="mini" style="margin-top:14px"><b>Rules:</b> ${g.rules}. &nbsp;<b>Deity:</b> ${g.deity}.<br><b>Friends:</b> ${g.friends.join(', ') || '—'} · <b>Enemies:</b> ${g.enemies.join(', ') || '—'} · <b>Exalted:</b> ${g.exalt} · <b>Debilitated:</b> ${g.debil}<br><b>Mantra:</b> <i>${g.mantra}</i></p>`;
}

/* ---------- main render ---------- */
function render(c) {
  const ms = SIGNS[c.moonSign], ss = SIGNS[c.sunSign], nk = NAKSHATRAS[c.moonNak], mp = c.P.Moon, sp = c.P.Sun;
  const kp = keyPlanets(c), mainPlanet = SIGN_LORDS[c.moonSign];
  const num = NUMBERS[c.mulank], bnum = NUMBERS[c.bhagyank];
  const trop = SIGNS[c.tropicalSunSign];
  const age = (Date.now() - Date.UTC(c.y, c.m - 1, c.d)) / 31556952000;
  const edge = c.moonEdge !== null ? `<p class="edge-note">⚠ On this date your Moon was close to the edge of ${ms.name}. Without a birth time I calculate for noon IST — if you were born ${c.moonEdge === (c.moonSign + 11) % 12 ? 'in the early hours' : 'late in the day'}, your Moon sign may be <b>${SIGNS[c.moonEdge].name}</b> instead.</p>` : '';

  results.innerHTML = `
  <section id="overview" class="sec hero reveal-in">
    <p class="eyebrow">Your Vedic cosmic signature</p>
    <h2>${c.dateLabel}</h2>
    <p class="hero-sub">${c.vara.en} · ${c.vara.name} &nbsp;·&nbsp; ${c.tithi.paksha.split(' ')[0]} ${c.tithi.name} &nbsp;·&nbsp; Ayanamsa ${c.ayan.toFixed(2)}°</p>
    <div class="hero-cards">
      ${heroCard('#moon', ms.sym + '︎', 'Moon sign · Rashi', `${ms.name}`, `${ms.en} · ${ms.animal}`, ms.hex)}
      ${heroCard('#sun', ss.sym + '︎', 'Zodiac · Sun sign', `${ss.name}`, `${ss.en} · ${ss.animal}`, ss.hex)}
      ${heroCard('#panchang', '✦', 'Nakshatra', nk[0], `Pada ${c.moonPada} · lord ${DASHA_ORDER[c.moonNak % 9]}`, '#a98bff')}
      ${heroCard('#numbers', String(c.d), 'Birth number (1–31)', `Mulank ${c.mulank}`, `Destiny ${c.bhagyank} · ${num.title}`, '#ffd36b')}
      ${heroCard('#planets', '☉', 'Your planet', GRAHAS[mainPlanet].sk.split(' ')[0], `Lord of your Moon sign · ${GRAHAS[mainPlanet].role.split('·')[0].trim()}`, pcol(mainPlanet))}
    </div>
    ${edge}
    <div class="cue">Scroll to explore ↓</div>
  </section>

  <section id="moon" class="sec split reveal-in">
    <div class="view3d" id="viewMoon"><div class="drag-hint">drag to turn the ${ms.animal.replace('The ', '').toLowerCase()}</div></div>
    <div>
      <p class="eyebrow">Chandra Rashi · your Moon sign</p>
      <div class="big-name"><h2>${ms.name}</h2><span class="dev">${ms.dev}</span></div>
      <div class="chips" style="margin-top:0"><span class="tag gold">${ms.animal}</span></div>
      <p class="lede">${ms.essence}</p>
      <div class="lens"><small>How your mind works</small>${ms.moon}</div>
      ${kv([['Moon at', `${mp.deg.toFixed(1)}° ${ms.name}`], ['Element', ms.element], ['Quality', ms.mode], ['Polarity', ms.polarity], ['Ruler', SIGN_LORDS[c.moonSign]], ['Body', ms.body], ['Colour', ms.color], ['Gemstone', ms.gem]])}
      <div class="chips">${tags(ms.gifts, 'good')}${tags(ms.shadows, 'warn')}</div>
      <div class="card"><h3>Your nakshatra · ${nk[0]}</h3><p>${nk[6]}</p>
        <p class="mini"><b>Pada</b> ${c.moonPada} · <b>Deity</b> ${nk[1]} · <b>Symbol</b> ${nk[2]} · <b>Gana</b> ${nk[3]} · <b>Yoni</b> ${nk[4]} · <b>Nadi</b> ${nk[5]}</p></div>
      <div class="two" style="margin-top:14px"><div class="card"><h3>Love</h3><p>${ms.love}</p></div><div class="card"><h3>Work</h3><p>${ms.career}</p></div></div>
    </div>
  </section>

  <section id="sun" class="sec split flip reveal-in">
    <div class="view3d" id="viewSun"><div class="drag-hint">drag to turn the ${ss.animal.replace('The ', '').toLowerCase()}</div></div>
    <div>
      <p class="eyebrow">Surya Rashi · your zodiac sign</p>
      <div class="big-name"><h2>${ss.name}</h2><span class="dev">${ss.dev}</span></div>
      <div class="chips" style="margin-top:0"><span class="tag gold">${ss.animal}</span></div>
      <p class="lede">${ss.essence}</p>
      <div class="lens"><small>Who you are outwardly</small>${ss.sun}</div>
      ${kv([['Sun at', `${sp.deg.toFixed(1)}° ${ss.name}`], ['Element', ss.element], ['Quality', ss.mode], ['Ruler', SIGN_LORDS[c.sunSign]], ['Lucky day', ss.day], ['Gemstone', ss.gem]])}
      <div class="chips">${tags(ss.gifts, 'good')}${tags(ss.shadows, 'warn')}</div>
      <div class="card"><h3>Why isn't this my Western sign?</h3>
        <p>Jyotish uses the <b>sidereal</b> zodiac, which is about ${c.ayan.toFixed(0)}° behind the tropical one used in Western astrology. ${trop.name === ss.name ? `For your date both systems happen to agree: ${ss.en}.` : `Your Western Sun sign would be <b>${trop.en}</b>, but the Sun was still in <b>${ss.name} (${ss.en})</b> in the real star-aligned sky.`}</p></div>
    </div>
  </section>

  <section id="numbers" class="sec reveal-in">
    <p class="eyebrow">Ank Jyotish · Vedic numerology</p>
    <h2>Your numbers, 1 to 31</h2>
    <p class="lede">Every birth day belongs to one of nine root numbers, and every root number belongs to a planet.</p>
    <div class="num-trio">
      <div class="card numcard"><div class="n">${c.d}</div><div class="k">Birth day</div><div class="t">${DAY_LINES[c.d]}</div></div>
      <div class="card numcard"><div class="n">${c.mulank}</div><div class="k">Mulank · root number</div><div class="t">${num.title} — ruled by ${num.planet}</div></div>
      <div class="card numcard"><div class="n">${c.bhagyank}</div><div class="k">Bhagyank · destiny number</div><div class="t">${bnum.title} — ruled by ${bnum.planet}</div></div>
    </div>
    <div class="num-grid">
      <div>
        <div class="cal">${Array.from({ length: 31 }, (_, i) => { const n = i + 1, r = reduceDigits(n); return `<div class="d ${n === c.d ? 'me' : r === c.mulank ? 'same' : ''}" title="${DAY_LINES[n]}">${n}<small>${r}</small></div>`; }).join('')}</div>
        <p class="mini" style="margin-top:12px">Small digit = root number. Days sharing your root number (${c.mulank}) are outlined in gold.</p>
      </div>
      <div>
        <div class="card"><h3>Mulank ${c.mulank} · ${num.planet}</h3><p>${num.text}</p>
          <div class="chips"><span class="tag good">Harmonious: ${num.harmony.join(', ')}</span><span class="tag warn">Stretching: ${num.stretch.join(', ')}</span><span class="tag gold">Lucky: ${num.lucky}</span></div></div>
        <div class="card" style="margin-top:14px"><h3>Bhagyank ${c.bhagyank} · ${bnum.planet}</h3><p>${bnum.text}</p><p class="mini">Your destiny number comes from adding every digit of ${c.d}/${c.m}/${c.y}. It describes the path you grow into.</p></div>
        ${c.d === 11 || c.d === 22 ? `<p class="why" style="margin-top:14px">✦ Day ${c.d} is a <b>master number</b>: it carries the energy of ${c.mulank} turned up high.</p>` : ''}
      </div>
    </div>
  </section>

  <section id="planets" class="sec reveal-in">
    <p class="eyebrow">Navagraha · the nine planets</p>
    <h2>Your planets</h2>
    <p class="lede">Tap any graha to spin it. Starred planets are the ones your Moon, Sun, star and number point to.</p>
    <div class="planet-chips" id="planetChips">${GRAHA_ORDER.map(n => `<button class="pchip" data-p="${n}" style="--pc:${pcol(n)}"><i></i>${GRAHAS[n].sk.split(' ')[0]}${kp.has(n) ? ' <em>★</em>' : ''}</button>`).join('')}</div>
    <div class="split" style="margin-top:6px">
      <div class="view3d" id="viewPlanet"><div class="drag-hint">drag to spin the planet</div></div>
      <div id="planetInfo"></div>
    </div>
  </section>

  <section id="sky" class="sec reveal-in">
    <p class="eyebrow">Birth sky · Chandra Kundali</p>
    <h2>The sky the day you arrived</h2>
    <p class="lede">The nine grahas on the sidereal zodiac wheel for ${c.dateLabel}. Drag to turn the sky; tap a planet to read about it. Your Moon sign is lit brightest.</p>
    <div class="view3d sky-view" id="viewSky"><div class="drag-hint">drag to rotate · tap a planet</div></div>
    <div class="table-wrap"><table class="pt"><thead><tr><th>Graha</th><th>Sign</th><th>Degree</th><th>Nakshatra</th><th>House from Moon</th><th>Status</th></tr></thead><tbody>
      ${c.planets.map(p => `<tr class="row" data-p="${p.name}" style="--pc:${pcol(p.name)}"><td><span class="dot"></span><b>${GRAHAS[p.name].sk.split(' ')[0]}</b> <span class="mini">${p.name}</span></td><td>${SIGNS[p.sign].name}</td><td>${p.deg.toFixed(1)}°</td><td>${NAKSHATRAS[p.nak][0]} · ${p.pada}</td><td>${ordinal(p.house)}</td><td>${[p.dignity, p.retro && p.name !== 'Rahu' && p.name !== 'Ketu' ? '<span class="rx">℞ retrograde</span>' : ''].filter(Boolean).join(' · ') || '—'}</td></tr>`).join('')}
    </tbody></table></div>
  </section>

  <section id="panchang" class="sec reveal-in">
    <p class="eyebrow">Panchang · the five limbs of your day</p>
    <h2>Your birth Panchang</h2>
    <p class="lede">Vedic astrology reads every day through five limbs: weekday, lunar day, star, yoga and karana.</p>
    <div class="pgrid">
      <div class="card pcard"><small>Vara · weekday</small><b>${c.vara.name}</b><span>${c.vara.en}, ruled by ${c.vara.lord}</span></div>
      <div class="card pcard"><small>Tithi · lunar day</small><b>${c.tithi.name}</b><span>${c.tithi.paksha}<br>${c.tithi.nature}</span><div class="bar"><i style="width:${Math.round(c.tithi.pct * 100)}%"></i></div></div>
      <div class="card pcard"><small>Nakshatra · star</small><b>${nk[0]}</b><span>Pada ${c.moonPada} · ${nk[1]}</span></div>
      <div class="card pcard"><small>Yoga</small><b>${c.yoga}</b><span>Sun + Moon combined motion</span></div>
      <div class="card pcard"><small>Karana · half-tithi</small><b>${c.karana}</b><span>The action-quality of the moment</span></div>
      <div class="card pcard"><small>Ayanamsa</small><b>${c.ayan.toFixed(2)}°</b><span>Lahiri — the gap between zodiacs</span></div>
    </div>
    <div class="num-grid">
      <div class="card"><h3>Vimshottari Dasha · planetary periods of life</h3>
        <p>Your Moon sits in ${nk[0]}, ruled by <b>${c.firstLord}</b>, so you were born in a <b>${c.firstLord} dasha</b> with ${c.firstBalance.toFixed(1)} years remaining.</p>
        <div class="timeline">${c.dashas.filter(d => d.from < 105).map(d => { const now = age >= d.from && age < d.to; return `<div class="dasha ${now ? 'now' : ''}" style="--pc:${pcol(d.lord)}"><span class="dn">${d.lord}</span><span class="db"><i style="left:${d.from / 1.2}%;width:${Math.min(d.to, 120) / 1.2 - d.from / 1.2}%"></i></span><span class="dy">${Math.round(d.yearFrom)}–${Math.round(d.yearTo)}</span></div>`; }).join('')}</div>
        <p class="mini">Bars run from age 0 to 120.</p></div>
      <div class="card"><h3>Yogas in your Chandra chart</h3>${c.yogas.map(y => `<div class="yoga"><b>${y.name}</b><span>${y.text}</span></div>`).join('')}</div>
    </div>
  </section>

  <section id="pairing" class="sec reveal-in">
    <p class="eyebrow">Pairing oracle</p>
    <h2>Who fits your stars?</h2>
    <p class="lede">I'll search every Moon-sign and nakshatra against yours and explain the best match for the kind of bond you want.</p>
    <div class="chat">
      <div class="chat-head"><div class="av">🪐</div><div><b>Jyotish Oracle</b><small>● ready to read your chart</small></div></div>
      <div class="chat-body" id="chatBody"></div>
      <div class="chat-chips" id="chatChips">${Object.entries(Pairing.TYPES).map(([k, t]) => `<button class="cchip" data-t="${k}">${t.emoji} ${t.label}</button>`).join('')}</div>
      <form class="chat-form" id="chatForm" autocomplete="off"><input id="chatInput" placeholder="Ask: “who is my best marriage match?”" aria-label="Ask the pairing oracle"><button type="submit">Send</button></form>
    </div>
  </section>

  <footer class="foot"><span class="dev">ॐ</span>Calculated with the sidereal zodiac (Lahiri ayanamsa) for noon IST on your birth date, since no birth time or place was given — your Moon sign can differ if the Moon changed signs that day. Ashtakoota tables are simplified. For learning and reflection, not for decisions about your life.</footer>`;
  results.hidden = false;
  setup3D(c, kp, mainPlanet);
  setupChat(c);
  observe();
}

function setup3D(c, kp, mainPlanet) {
  const mv = Creatures.createView($('#viewMoon')); mv.setSign(c.moonSign);
  const sv = Creatures.createView($('#viewSun')); sv.setSign(c.sunSign);
  planetV = Planets.createView($('#viewPlanet'));
  const sky = Planets.createSky($('#viewSky'), n => selectPlanet(n, true)); sky.setChart(c);
  liveViews.push(mv.view, sv.view, planetV.view, sky.view);

  function selectPlanet(n, scroll) {
    selectedPlanet = n; planetV.setPlanet(n);
    $('#planetInfo').innerHTML = planetInfoHTML(n, c, kp.get(n));
    $$('.pchip').forEach(b => b.classList.toggle('on', b.dataset.p === n));
    if (scroll) $('#planets').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  $$('.pchip').forEach(b => b.addEventListener('click', () => selectPlanet(b.dataset.p)));
  $$('tr.row').forEach(r => r.addEventListener('click', () => selectPlanet(r.dataset.p, true)));
  selectPlanet(mainPlanet);
}

function observe() {
  io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) e.target.classList.add('seen'); }), { threshold: 0.08 });
  $$('.reveal-in').forEach(el => io.observe(el));
  const links = $$('#topnav .links a'), secs = links.map(a => $(a.getAttribute('href')));
  const nav = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) links.forEach((a, i) => a.classList.toggle('on', secs[i] === e.target)); }), { rootMargin: '-45% 0px -50% 0px' });
  secs.forEach(s => s && nav.observe(s));
  const prev = io.disconnect.bind(io); io.disconnect = () => { prev(); nav.disconnect(); };
}

/* ---------- pairing chat ---------- */
const KOOTA_NAMES = [['varna', 'Varna'], ['vashya', 'Vashya'], ['tara', 'Tara'], ['yoni', 'Yoni'], ['maitri', 'Graha Maitri'], ['gana', 'Gana'], ['bhakoot', 'Bhakoot'], ['nadi', 'Nadi']];
let matchN = 0;

function setupChat(c) {
  const body = $('#chatBody'), chips = $('#chatChips'), form = $('#chatForm'), input = $('#chatInput');
  const ms = SIGNS[c.moonSign], ss = SIGNS[c.sunSign], nk = NAKSHATRAS[c.moonNak];
  let busy = false;
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const add = (html, cls = 'bot', isText = false) => { const d = document.createElement('div'); d.className = 'msg ' + cls; if (isText) d.textContent = html; else d.innerHTML = html; body.appendChild(d); return d; };
  const typing = () => add('<span class="typing"><i></i><i></i><i></i></span>');

  async function bot(html, wait = 800) { const t = typing(); await sleep(wait); t.remove(); return add(html); }
  async function ask(type, userText) {
    if (busy) return; busy = true; chips.style.opacity = '.5';
    add(userText || `${Pairing.TYPES[type].emoji} ${Pairing.TYPES[type].label}`, 'user', true);
    const r = Pairing.find(c, type), T = r.meta, top = r.top, sg = SIGNS[top.sign], nm = NAKSHATRAS[top.nak];
    await bot(`${T.intro}<br><br>Your anchor: <b>Moon in ${ms.name}</b>, nakshatra <b>${nk[0]}</b>, Sun in ${ss.name}. Searching all ${Pairing.CANDIDATES.length} Moon-sign × nakshatra combinations…`, 900);
    await sleep(500);
    const verdict = g => g >= 28 ? 'Excellent' : g >= 21 ? 'Good' : g >= 18 ? 'Average' : 'Needs effort';
    const id = 'mv' + (++matchN);
    const card = `<div class="match"><div class="match-top"><div class="match-view" id="${id}"></div>
      <div class="match-info"><p class="eyebrow">${T.emoji} Best ${T.label.toLowerCase()} match</p>
        <h4>Moon in ${sg.name} <span class="dev" style="color:var(--gold)">${sg.dev}</span></h4>
        <p class="mini">${sg.en} · ${sg.animal} · nakshatra ${nm[0]} (${nm[4]} yoni) · ruled by ${SIGN_LORDS[top.sign]}</p>
        <div class="score"><div class="ring" style="--p:${top.pct}"><b>${top.pct}%</b></div>
          <div><b>${verdict(top.guna)}</b><br><span class="mini">${top.guna} / 36 gunas (classical)</span></div></div></div></div>
      <div class="match-body">
        <div class="kbars">${KOOTA_NAMES.map(([k, n]) => `<div class="kb"><span>${n}</span><span class="t"><i style="width:${Math.round(top.k[k].s / top.k[k].max * 100)}%"></i></span><b>${top.k[k].s}/${top.k[k].max}</b></div>`).join('')}</div>
        <p><b>Why this is a good ${T.label.toLowerCase()} pairing</b></p>
        <ul class="why-list">${r.why.map(w => `<li>${w.text}</li>`).join('')}${r.caution ? `<li class="low"><b>Worth knowing:</b> ${r.caution.text}</li>` : ''}</ul>
        <p style="margin-top:12px">${sg.name === ms.name ? 'Same Moon sign: you feel each other’s moods from across the room.' : `A ${sg.name} Moon brings ${sg.gifts.join(', ').toLowerCase()}.`} ${r.flavour}</p>
        <div class="runners"><span class="mini" style="align-self:center">Also strong:</span>${r.others.map(o => `<span class="tag gold">${SIGNS[o.sign].sym}︎ ${SIGNS[o.sign].name} · ${NAKSHATRAS[o.nak][0]} · ${o.pct}%</span>`).join('')}</div>
      </div></div>`;
    const wrap = add(card, 'bot wide');
    const mv = Creatures.createView($('#' + id, wrap), { dist: 9 }); mv.setSign(top.sign); liveViews.push(mv.view);
    wrap.scrollIntoView({ behavior: 'smooth', block: 'center' });
    await sleep(1200);
    await bot('Want to try another kind of bond? Tap a chip below, or type it — marriage, romance, friendship, business partner, or mentor.', 700);
    chips.style.opacity = ''; busy = false;
  }

  (async () => {
    await sleep(300);
    add(`Namaste 🙏 I have read your chart: <b>Moon in ${ms.name}</b> (${nk[0]}), <b>Sun in ${ss.name}</b>, birth number <b>${c.mulank}</b>.`);
    await sleep(500);
    add('What kind of pairing are you looking for? Choose one below — or just type it.');
  })();
  chips.addEventListener('click', e => { const b = e.target.closest('.cchip'); if (b) ask(b.dataset.t); });
  form.addEventListener('submit', async e => {
    e.preventDefault(); const text = input.value.trim(); if (!text || busy) return; input.value = '';
    const t = Pairing.detect(text);
    if (t) ask(t, text);
    else { add(text, 'user', true); busy = true; await bot('I can find a <b>marriage</b>, <b>romance</b>, <b>friendship</b>, <b>business partner</b> or <b>mentor</b> match for you. Which one would you like?', 700); busy = false; }
  });
}
