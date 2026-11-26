/* ============================================================
   PAIRING — Ashtakoota (8-fold) compatibility, re-weighted for
   different kinds of relationship. Searches every Moon sign /
   nakshatra combination and ranks the best partners for you.
   ============================================================ */
'use strict';

const Pairing = (() => {
  const REL = (x, y) => { if (x === y) return 'S'; const g = GRAHAS[x]; return g.friends.includes(y) ? 'F' : g.enemies.includes(y) ? 'E' : 'N'; };
  const ELEMENT_HARMONY = { 'Fire-Fire': 0.8, 'Earth-Earth': 0.8, 'Air-Air': 0.8, 'Water-Water': 0.8, 'Fire-Air': 1, 'Earth-Water': 1, 'Fire-Earth': 0.4, 'Air-Water': 0.4, 'Fire-Water': 0.1, 'Earth-Air': 0.1 };
  const harmony = (a, b) => ELEMENT_HARMONY[a + '-' + b] ?? ELEMENT_HARMONY[b + '-' + a] ?? 0.5;

  const TYPES = {
    marriage: { label: 'Marriage', emoji: '💍', w: { varna: 1, vashya: 2, tara: 3, yoni: 4, maitri: 5, gana: 6, bhakoot: 7, nadi: 8 }, scale36: true, lens: 'love',
      intro: 'For a lifelong marriage, Jyotish runs the full 36-point Ashtakoota (Guna Milan) — eight tests of mind, body, temperament, family and health.' },
    romance: { label: 'Romance', emoji: '❤️', w: { varna: 2, vashya: 12, tara: 10, yoni: 20, maitri: 15, gana: 12, bhakoot: 15, nadi: 6 }, lens: 'love',
      intro: 'For romance I weigh the chemistry kootas more heavily — yoni (instinct and attraction), bhakoot (emotional flow) and gana (temperament).' },
    friendship: { label: 'Friendship', emoji: '🤝', w: { varna: 3, vashya: 12, tara: 15, yoni: 8, maitri: 28, gana: 20, bhakoot: 10, nadi: 4 }, lens: 'gifts',
      intro: 'Friendship runs on mental wavelength, so graha maitri (do your Moon-lords like each other?) and gana (temperament) count most.' },
    business: { label: 'Business partner', emoji: '💼', w: { varna: 10, vashya: 5, tara: 20, yoni: 5, maitri: 25, gana: 10, bhakoot: 20, nadi: 5 }, lens: 'career', bonus: ['Mercury', 'Jupiter', 'Saturn'],
      intro: 'For a business partnership I look at trust (graha maitri), good fortune together (tara), money flow (bhakoot) and working roles (varna).' },
    mentor: { label: 'Mentor / Guru', emoji: '🧙', w: { varna: 15, vashya: 5, tara: 25, yoni: 5, maitri: 25, gana: 10, bhakoot: 10, nadi: 5 }, lens: 'essence', bonus: ['Jupiter', 'Sun', 'Saturn'],
      intro: 'A good guide supports your growth: favourable tara (fortunate stars), friendly lords, and a lord like Jupiter, Sun or Saturn who teaches.' },
  };

  function vashyaGroup(sign, deg) {
    const v = VASHYA_OF_SIGN[sign];
    if (v === 'Split-Dhanu') return deg < 15 ? 'Manava' : 'Chatushpada';
    if (v === 'Split-Makara') return deg < 15 ? 'Chatushpada' : 'Jalachara';
    return v;
  }
  const yoniOf = nak => NAKSHATRAS[nak][4];
  const isEnemy = (a, b) => YONI_ENEMIES.some(([x, y]) => (x === a && y === b) || (x === b && y === a));
  const nadiOf = nak => NAKSHATRAS[nak][5];
  const ganaOf = nak => NAKSHATRAS[nak][3];

  /** Returns the eight koota scores for two Moon placements {sign, deg, nak}. */
  function kootas(A, B) {
    const out = {}, la = SIGN_LORDS[A.sign], lb = SIGN_LORDS[B.sign];
    // 1 Varna
    const va = VARNA_RANK[VARNA_OF_SIGN[A.sign]], vb = VARNA_RANK[VARNA_OF_SIGN[B.sign]], vd = Math.abs(va - vb);
    out.varna = { s: vd === 0 ? 1 : vd === 1 ? 0.5 : 0, max: 1, a: VARNA_OF_SIGN[A.sign], b: VARNA_OF_SIGN[B.sign] };
    // 2 Vashya
    const ga = vashyaGroup(A.sign, A.deg), gb = vashyaGroup(B.sign, B.deg);
    out.vashya = { s: (VASHYA_TABLE[ga][gb] + VASHYA_TABLE[gb][ga]) / 2, max: 2, a: ga, b: gb };
    // 3 Tara
    const bad = n => [3, 5, 7].includes(n % 9), c1 = ((B.nak - A.nak + 27) % 27) + 1, c2 = ((A.nak - B.nak + 27) % 27) + 1;
    const good = (bad(c1) ? 0 : 1) + (bad(c2) ? 0 : 1);
    out.tara = { s: good === 2 ? 3 : good === 1 ? 1.5 : 0, max: 3, good };
    // 4 Yoni
    const ya = yoniOf(A.nak), yb = yoniOf(B.nak);
    let ys = ya === yb ? 4 : isEnemy(ya, yb) ? 0 : (YONI_GENTLE.includes(ya) === YONI_GENTLE.includes(yb) ? 3 : 2);
    out.yoni = { s: ys, max: 4, a: ya, b: yb, same: ya === yb, enemy: ys === 0 };
    // 5 Graha maitri
    const r1 = REL(la, lb), r2 = REL(lb, la);
    let ms;
    if (r1 === 'S' || (r1 === 'F' && r2 === 'F')) ms = 5; else if ((r1 === 'F' && r2 === 'N') || (r1 === 'N' && r2 === 'F')) ms = 4;
    else if (r1 === 'N' && r2 === 'N') ms = 3; else if ((r1 === 'F' && r2 === 'E') || (r1 === 'E' && r2 === 'F')) ms = 1;
    else if ((r1 === 'N' && r2 === 'E') || (r1 === 'E' && r2 === 'N')) ms = 0.5; else ms = 0;
    out.maitri = { s: ms, max: 5, la, lb, same: r1 === 'S', rel: r1 === 'S' ? 'same' : ms >= 4 ? 'friends' : ms >= 3 ? 'neutral' : 'tense' };
    // 6 Gana
    const na = ganaOf(A.nak), nb = ganaOf(B.nak);
    const gs = na === nb ? 6 : (na !== 'Rakshasa' && nb !== 'Rakshasa') ? 5 : ((na === 'Deva' || nb === 'Deva') ? 1 : 0);
    out.gana = { s: gs, max: 6, a: na, b: nb };
    // 7 Bhakoot
    const dist = ((B.sign - A.sign + 12) % 12) + 1, dosha = [2, 12, 5, 9, 6, 8].includes(dist);
    const cancel = dosha && (r1 === 'S' || (r1 === 'F' && r2 === 'F'));
    out.bhakoot = { s: !dosha || cancel ? 7 : 0, max: 7, dist, dosha, cancel };
    // 8 Nadi
    const da = nadiOf(A.nak), db = nadiOf(B.nak);
    out.nadi = { s: da === db ? 0 : 8, max: 8, a: da, b: db, same: da === db };
    out.total = Object.values(out).reduce((a, k) => a + k.s, 0);
    return out;
  }

  /** All Moon-sign × nakshatra combinations (≈36), each at the centre of its span. */
  const CANDIDATES = (() => {
    const map = new Map();
    for (let p = 0; p < 108; p++) {
      const lon = p * (360 / 108) + 360 / 216, sign = Math.floor(lon / 30), nak = Math.floor(lon / (360 / 27)), key = sign + '-' + nak;
      const c = map.get(key) || { sign, nak, lons: [] }; c.lons.push(lon); map.set(key, c);
    }
    return [...map.values()].map(c => ({ sign: c.sign, nak: c.nak, deg: (c.lons.reduce((a, b) => a + b, 0) / c.lons.length) % 30, pada: Math.floor((c.lons[0] % (360 / 27)) / (360 / 108)) + 1 }));
  })();

  function score(type, k, me, cand) {
    const T = TYPES[type]; let wsum = 0, acc = 0;
    for (const key of Object.keys(T.w)) { wsum += T.w[key]; acc += T.w[key] * (k[key].s / k[key].max); }
    let pct = 92 * (acc / wsum) + 8 * harmony(SIGNS[me.sign].element, SIGNS[cand.sign].element);
    if (T.bonus && T.bonus.includes(SIGN_LORDS[cand.sign])) pct += 4;
    if (type === 'mentor' && VARNA_RANK[VARNA_OF_SIGN[cand.sign]] > VARNA_RANK[VARNA_OF_SIGN[me.sign]]) pct += 3;
    return Math.min(99, Math.round(pct));
  }

  /* ---------- explanations ---------- */
  const GANA_TEXT = { Deva: 'gentle, idealistic and light-hearted', Manushya: 'practical, social and balanced', Rakshasa: 'bold, intense and strong-willed' };
  function explain(me, cand, k, type) {
    const pts = [];
    const sn = SIGNS[cand.sign], mine = SIGNS[me.sign];
    const mt = k.maitri;
    pts.push({ key: 'maitri', f: mt.s / mt.max, text: mt.same
      ? `Your Moon-signs share the same ruler, ${mt.la} — you think, react and recover in the same rhythm, which is the single best sign of mental closeness.`
      : mt.rel === 'friends' ? `Your Moon-lords are ${mt.la} (yours) and ${mt.lb} (theirs), and they are natural friends in Jyotish. Your minds meet easily, and you tend to understand each other without long explanations.`
        : mt.rel === 'neutral' ? `Your Moon-lords, ${mt.la} and ${mt.lb}, are neutral toward each other. There is no natural friction — the bond is built by choice and effort, which makes it stable.`
          : `Your Moon-lords, ${mt.la} and ${mt.lb}, sit uneasily together, so your mental styles differ. This partner would stretch you, but it takes patience and clear communication.` });
    const gn = k.gana;
    pts.push({ key: 'gana', f: gn.s / gn.max, text: gn.a === gn.b
      ? `You share the ${gn.a} gana — both ${GANA_TEXT[gn.a]}. Your temperaments match, so your daily habits and reactions feel familiar.`
      : gn.s >= 5 ? `Your temperaments (${gn.a} and ${gn.b}) balance each other: yours is ${GANA_TEXT[gn.a]}, theirs ${GANA_TEXT[gn.b]} — complementary, not clashing.`
        : `Your temperaments differ (${gn.a} vs ${gn.b}): yours is ${GANA_TEXT[gn.a]}, theirs ${GANA_TEXT[gn.b]}. Expect different instincts about pace and intensity.` });
    const yo = k.yoni;
    pts.push({ key: 'yoni', f: yo.s / yo.max, text: yo.same
      ? `Both your birth stars carry the ${yo.a} yoni — a deep instinctive and physical rapport, like recognising your own kind.`
      : yo.enemy ? `Your nakshatra animals — ${yo.a} and ${yo.b} — are classical rivals, so your instincts can pull in opposite directions. Awareness smooths this.`
        : `Your nakshatra animals are the ${yo.a} (you) and the ${yo.b} (them): ${yo.s >= 3 ? 'a comfortable, compatible instinct and attraction' : 'different instincts that keep things interesting'}.` });
    const bh = k.bhakoot;
    pts.push({ key: 'bhakoot', f: bh.s / bh.max, text: !bh.dosha ? `Your Moon-signs sit in a harmonious relationship (${mine.name} → ${sn.name}, ${bh.dist === 1 ? 'the same sign' : bh.dist + ' signs apart'}) — good for emotional flow, shared finances and family life.`
      : bh.cancel ? `Your signs fall in a ${bh.dist}-sign relationship, which classically raises a bhakoot dosha — but your friendly/shared Moon-lord cancels it.`
        : `Your signs (${mine.name} and ${sn.name}) fall in a ${bh.dist}-sign relationship (a bhakoot dosha), which can bring uneven emotional or money cycles. Open conversations about both help.` });
    const nd = k.nadi;
    pts.push({ key: 'nadi', f: nd.s / nd.max, text: nd.same ? `You share the same nadi (${nd.a}), a classical caution about similar constitutions. It matters most in marriage and is balanced by healthy habits.`
      : `Your nadis differ (${nd.a} and ${nd.b}) — the full 8 points, indicating complementary constitutions and healthy energy together.` });
    const tr = k.tara;
    pts.push({ key: 'tara', f: tr.s / tr.max, text: tr.good === 2 ? 'Counted both ways, your birth stars fall on favourable positions (tara) — luck, health and good timing tend to flow in both directions.'
      : tr.good === 1 ? 'Your birth stars are favourable in one direction (tara), so one of you tends to be the lucky charm for the other.' : 'Your birth stars land on challenging tara counts, so timing may need more intention and patience.' });
    const vs = k.vashya, vn = k.varna;
    pts.push({ key: 'vashya', f: vs.s / vs.max, text: vs.s >= 1.5 ? `Vashya (mutual attraction and influence) is strong: ${vs.a} meets ${vs.b}.` : `Vashya is moderate (${vs.a} with ${vs.b}) — attraction grows through understanding, not instant pull.` });
    pts.push({ key: 'varna', f: vn.s / vn.max, text: vn.s >= 1 ? `Your varnas (${vn.a} and ${vn.b}) are in line — similar ego-levels and life values.` : `Your varnas (${vn.a} and ${vn.b}) differ, which suggests complementary roles rather than the same ambitions.` });

    const L = TYPES[type].lens;
    const third = s => s.replace(/\bYou\b/g, 'They').replace(/\byou\b/g, 'them').replace(/\byour\b/g, 'their');
    const flavour = L === 'love' ? `In love: ${third(sn.love)}` : L === 'career' ? `At work this Moon suits ${sn.career.replace(/^[A-Z]/, c => c.toLowerCase())}` : L === 'gifts' ? `As a friend they bring ${sn.gifts.join(', ').toLowerCase()}.` : sn.essence;
    pts.sort((a, b) => b.f - a.f);
    const strong = pts.filter(p => p.f >= 0.7 && !['varna', 'vashya'].includes(p.key) || p.f >= 0.7).slice(0, 4);
    if (strong.length < 3) pts.slice(0, 3).forEach(p => { if (!strong.includes(p)) strong.push(p); });
    const weak = pts.slice().reverse().find(p => p.f < 0.5 && !strong.includes(p));
    return { strong, weak, flavour };
  }

  function find(chart, type = 'marriage') {
    const me = { sign: chart.moonSign, deg: chart.P.Moon.deg, nak: chart.moonNak };
    const all = CANDIDATES.map(c => { const k = kootas(me, c); return { ...c, k, pct: score(type, k, me, c), guna: k.total }; });
    all.sort((a, b) => b.pct - a.pct || b.guna - a.guna);
    const picked = [], seenSign = new Set();
    for (const c of all) { if (seenSign.has(c.sign)) continue; seenSign.add(c.sign); picked.push(c); if (picked.length === 3) break; }
    const top = picked[0], ex = explain(me, top, top.k, type);
    return { type, meta: TYPES[type], me, top, others: picked.slice(1), why: ex.strong, caution: ex.weak, flavour: ex.flavour };
  }

  const KEYWORDS = [
    ['marriage', /marri|wife|husband|spouse|wedding|life ?partner|wed\b/i], ['romance', /romanc|love|date|dating|boyfriend|girlfriend|crush|soul ?mate|relationship/i],
    ['friendship', /friend|bff|buddy|companion|pal\b/i], ['business', /business|work|co-?founder|colleague|startup|investor|partner/i], ['mentor', /mentor|guru|teacher|guide|coach|master/i],
  ];
  const detect = text => { for (const [t, re] of KEYWORDS) if (re.test(text)) return t; return null; };

  return { TYPES, find, detect, CANDIDATES, kootas };
})();
