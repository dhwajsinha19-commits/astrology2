/* ============================================================
   JYOTISH — sidereal (Lahiri) planetary calculations
   Low-precision orbital elements (Paul Schlyter) — good to
   ~1° for the Moon and a few arc-minutes for the Sun, plenty
   to place a planet in its sign / nakshatra.
   ============================================================ */
'use strict';

const DEG = Math.PI / 180;
const rev = x => ((x % 360) + 360) % 360;
const sind = x => Math.sin(x * DEG);
const cosd = x => Math.cos(x * DEG);
const atan2d = (y, x) => Math.atan2(y, x) / DEG;

const SIGN_LORDS = ['Mars', 'Venus', 'Mercury', 'Moon', 'Sun', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Saturn', 'Jupiter'];
const EXALT_SIGN = { Sun: 0, Moon: 1, Mars: 9, Mercury: 5, Jupiter: 3, Venus: 11, Saturn: 6, Rahu: 1, Ketu: 7 };
const OWN_SIGNS = { Sun: [4], Moon: [3], Mars: [0, 7], Mercury: [2, 5], Jupiter: [8, 11], Venus: [1, 6], Saturn: [9, 10], Rahu: [], Ketu: [] };
const NAK_SPAN = 360 / 27;

function julian(y, m, d, hUT) {
  if (m <= 2) { y -= 1; m += 12; }
  const A = Math.floor(y / 100), B = 2 - A + Math.floor(A / 4);
  return Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + d + B - 1524.5 + hUT / 24;
}

function kepler(M, e) {
  let E = M + (e / DEG) * sind(M) * (1 + e * cosd(M));
  for (let i = 0; i < 10; i++) {
    const dE = (E - (e / DEG) * sind(E) - M) / (1 - e * cosd(E));
    E -= dE;
    if (Math.abs(dE) < 1e-8) break;
  }
  return E;
}

const ELEMENTS = {
  Sun:     d => ({ N: 0, i: 0, w: 282.9404 + 4.70935e-5 * d, a: 1, e: 0.016709 - 1.151e-9 * d, M: 356.0470 + 0.9856002585 * d }),
  Moon:    d => ({ N: 125.1228 - 0.0529538083 * d, i: 5.1454, w: 318.0634 + 0.1643573223 * d, a: 60.2666, e: 0.0549, M: 115.3654 + 13.0649929509 * d }),
  Mercury: d => ({ N: 48.3313 + 3.24587e-5 * d, i: 7.0047 + 5.00e-8 * d, w: 29.1241 + 1.01444e-5 * d, a: 0.387098, e: 0.205635 + 5.59e-10 * d, M: 168.6562 + 4.0923344368 * d }),
  Venus:   d => ({ N: 76.6799 + 2.46590e-5 * d, i: 3.3946 + 2.75e-8 * d, w: 54.8910 + 1.38374e-5 * d, a: 0.723330, e: 0.006773 - 1.302e-9 * d, M: 48.0052 + 1.6021302244 * d }),
  Mars:    d => ({ N: 49.5574 + 2.11081e-5 * d, i: 1.8497 - 1.78e-8 * d, w: 286.5016 + 2.92961e-5 * d, a: 1.523688, e: 0.093405 + 2.516e-9 * d, M: 18.6021 + 0.5240207766 * d }),
  Jupiter: d => ({ N: 100.4542 + 2.76854e-5 * d, i: 1.3030 - 1.557e-7 * d, w: 273.8777 + 1.64505e-5 * d, a: 5.20256, e: 0.048498 + 4.469e-9 * d, M: 19.8950 + 0.0830853001 * d }),
  Saturn:  d => ({ N: 113.6634 + 2.38980e-5 * d, i: 2.4886 - 1.081e-7 * d, w: 339.3939 + 2.97661e-5 * d, a: 9.55475, e: 0.055546 - 9.499e-9 * d, M: 316.9670 + 0.0334442282 * d }),
};

function orbit(el) {
  const M = rev(el.M), E = kepler(M, el.e);
  const xv = el.a * (cosd(E) - el.e), yv = el.a * Math.sqrt(1 - el.e * el.e) * sind(E);
  const v = atan2d(yv, xv), r = Math.hypot(xv, yv), vw = v + el.w;
  return {
    r, M,
    xh: r * (cosd(el.N) * cosd(vw) - sind(el.N) * sind(vw) * cosd(el.i)),
    yh: r * (sind(el.N) * cosd(vw) + cosd(el.N) * sind(vw) * cosd(el.i)),
    zh: r * sind(vw) * sind(el.i),
  };
}

/** Tropical geocentric ecliptic longitudes of all nine grahas for day-number d (days since 1999-12-31 00:00 UT). */
function tropicalPositions(d) {
  const out = {};
  const se = ELEMENTS.Sun(d), sun = orbit(se);
  const sunLon = rev(atan2d(sun.yh, sun.xh));
  out.Sun = sunLon;

  // Moon with the main perturbation terms
  const me = ELEMENTS.Moon(d), moon = orbit(me);
  const Ms = rev(se.M), Mm = rev(me.M);
  const Ls = rev(se.w + se.M), Lm = rev(me.N + me.w + me.M);
  const D = Lm - Ls, F = Lm - me.N;
  const pert = -1.274 * sind(Mm - 2 * D) + 0.658 * sind(2 * D) - 0.186 * sind(Ms) - 0.059 * sind(2 * Mm - 2 * D)
    - 0.057 * sind(Mm - 2 * D + Ms) + 0.053 * sind(Mm + 2 * D) + 0.046 * sind(2 * D - Ms) + 0.041 * sind(Mm - Ms)
    - 0.035 * sind(D) - 0.031 * sind(Mm + Ms) - 0.015 * sind(2 * F - 2 * D) + 0.011 * sind(Mm - 4 * D);
  out.Moon = rev(atan2d(moon.yh, moon.xh) + pert);

  // Planets: heliocentric + Sun's geocentric position
  const Mj = ELEMENTS.Jupiter(d).M, Msat = ELEMENTS.Saturn(d).M;
  for (const name of ['Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn']) {
    const p = orbit(ELEMENTS[name](d));
    let lon = atan2d(p.yh + sun.yh, p.xh + sun.xh);
    if (name === 'Jupiter') {
      lon += -0.332 * sind(2 * Mj - 5 * Msat - 67.6) - 0.056 * sind(2 * Mj - 2 * Msat + 21) + 0.042 * sind(3 * Mj - 5 * Msat + 21)
        - 0.036 * sind(Mj - 2 * Msat) + 0.022 * cosd(Mj - Msat) + 0.023 * sind(2 * Mj - 3 * Msat + 52) - 0.016 * sind(Mj - 5 * Msat - 69);
    } else if (name === 'Saturn') {
      lon += 0.812 * sind(2 * Mj - 5 * Msat - 67.6) - 0.229 * cosd(2 * Mj - 4 * Msat - 2) + 0.119 * sind(Mj - 2 * Msat - 3)
        + 0.046 * sind(2 * Mj - 6 * Msat - 69) + 0.014 * sind(Mj - 3 * Msat + 32);
    }
    out[name] = rev(lon);
  }
  // Mean lunar node = Rahu; Ketu opposite
  out.Rahu = rev(me.N);
  out.Ketu = rev(me.N + 180);
  return out;
}

/** Lahiri (Chitrapaksha) ayanamsa in degrees, accurate to ~1′ for 1900–2050. */
function ayanamsa(jd) { return 23.85306 + 0.01396 * ((jd - 2451545.0) / 365.2425); }

const reduceDigits = n => { while (n > 9) n = String(n).split('').reduce((a, c) => a + +c, 0); return n; };
const daysInMonth = (y, m) => new Date(y, m, 0).getDate();   // m is 1-based

function dignity(name, sign) {
  if (EXALT_SIGN[name] === sign) return 'Exalted';
  if ((EXALT_SIGN[name] + 6) % 12 === sign) return 'Debilitated';
  if (OWN_SIGNS[name].includes(sign)) return 'Own sign';
  return '';
}

/** Full Vedic reading for a calendar date (computed for 12:00 noon IST, since birth time isn't asked). */
function computeChart(y, m, dd) {
  const hUT = 6.5;                                // 12:00 IST
  const jd = julian(y, m, dd, hUT), d = jd - 2451543.5;
  const ayan = ayanamsa(jd);
  const t0 = tropicalPositions(d), tA = tropicalPositions(d - 0.5), tB = tropicalPositions(d + 0.5);

  const planets = GRAHA_ORDER.map(name => {
    const lon = rev(t0[name] - ayan);
    let retro = false;
    if (name === 'Rahu' || name === 'Ketu') retro = true;
    else if (name !== 'Sun' && name !== 'Moon') {
      let dl = tB[name] - tA[name]; if (dl > 180) dl -= 360; if (dl < -180) dl += 360;
      retro = dl < 0;
    }
    const sign = Math.floor(lon / 30), nak = Math.floor(lon / NAK_SPAN);
    return { name, lon, sign, deg: lon % 30, nak, pada: Math.floor((lon % NAK_SPAN) / (NAK_SPAN / 4)) + 1, retro, dignity: dignity(name, sign) };
  });
  const P = Object.fromEntries(planets.map(p => [p.name, p]));
  const moonSign = P.Moon.sign;
  planets.forEach(p => { p.house = ((p.sign - moonSign + 12) % 12) + 1; });   // Chandra-lagna house

  // Does the Moon sit close enough to a sign edge that the unknown birth time could change the answer?
  let moonEdge = null;
  if (P.Moon.deg < 6.6) moonEdge = (moonSign + 11) % 12;
  else if (P.Moon.deg > 23.4) moonEdge = (moonSign + 1) % 12;

  // Panchang
  const elong = rev(P.Moon.lon - P.Sun.lon);
  const tIdx = Math.floor(elong / 12);
  const tn = tIdx % 15;
  const tithi = {
    index: tIdx, paksha: tIdx < 15 ? 'Shukla (waxing)' : 'Krishna (waning)',
    name: tIdx === 14 ? 'Purnima' : tIdx === 29 ? 'Amavasya' : TITHI_NAMES[tn],
    nature: TITHI_NATURE[tn % 5], pct: (elong % 12) / 12,
  };
  const kIdx = Math.floor(elong / 6);
  const karana = kIdx === 0 ? 'Kimstughna' : kIdx >= 57 ? ['Shakuni', 'Chatushpada', 'Naga'][kIdx - 57] : KARANA_CYCLE[(kIdx - 1) % 7];
  const yogaIdx = Math.floor(rev(P.Sun.lon + P.Moon.lon) / NAK_SPAN);
  const weekday = new Date(Date.UTC(y, m - 1, dd)).getUTCDay();

  // Vimshottari dasha from the Moon's nakshatra
  const mn = P.Moon.nak, frac = (P.Moon.lon % NAK_SPAN) / NAK_SPAN;
  const firstLord = DASHA_ORDER[mn % 9], firstBalance = (1 - frac) * DASHA_YEARS[firstLord];
  const dashas = [];
  let age = 0, li = mn % 9;
  for (let i = 0; i < 9; i++) {
    const lord = DASHA_ORDER[li % 9];
    const len = i === 0 ? firstBalance : DASHA_YEARS[lord];
    dashas.push({ lord, from: age, to: age + len, yearFrom: y + age, yearTo: y + age + len, partial: i === 0 });
    age += len; li++;
  }

  // Simple Chandra-based yogas
  const yogas = [];
  const hs = n => P[n].house, same = (a, b) => P[a].sign === P[b].sign;
  if ([1, 4, 7, 10].includes(hs('Jupiter'))) yogas.push({ name: 'Gaja Kesari Yoga', text: 'Jupiter sits in a kendra (1st, 4th, 7th or 10th) from your Moon. Classically this gives wisdom, a good name, and the ability to recover from setbacks.' });
  if (same('Sun', 'Mercury')) yogas.push({ name: 'Budhaditya Yoga', text: 'The Sun and Mercury share a sign — a sharp, articulate mind with a gift for analysis and communication.' });
  if (same('Moon', 'Mars')) yogas.push({ name: 'Chandra-Mangala Yoga', text: 'Moon and Mars together give courage, drive and a talent for earning — with emotions that run hot.' });
  if (same('Jupiter', 'Rahu')) yogas.push({ name: 'Guru-Chandala Yoga', text: 'Jupiter conjoins Rahu — an unconventional thinker who questions tradition and learns best by breaking the rules.' });
  if (same('Venus', 'Mercury')) yogas.push({ name: 'Lakshmi-Saraswati touch', text: 'Venus and Mercury together bless you with artistry and eloquence — creativity that is also commercially clever.' });
  const around = n => ['Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn'].filter(p => P[p].house === n);
  const second = around(2), twelfth = around(12);
  if (second.length && twelfth.length) yogas.push({ name: 'Durudhara Yoga', text: 'Planets flank your Moon on both sides — support, comfort and resources come from several directions.' });
  else if (second.length) yogas.push({ name: 'Sunapha Yoga', text: 'A planet sits in the 2nd from your Moon — self-earned wealth and a resourceful, capable nature.' });
  else if (twelfth.length) yogas.push({ name: 'Anapha Yoga', text: 'A planet sits in the 12th from your Moon — a healthy, dignified, generous personality.' });
  const kendraMoon = [1, 4, 7, 10].some(h => planets.some(p => !['Sun', 'Rahu', 'Ketu', 'Moon'].includes(p.name) && p.house === h));
  if (!second.length && !twelfth.length && !kendraMoon) yogas.push({ name: 'Kemadruma tendency', text: 'Your Moon stands somewhat alone, which can feel like walking your own path. The remedy is simple: build a close circle, practice, and a creative outlet.' });
  if (!yogas.length) yogas.push({ name: 'Balanced Chandra chart', text: 'No single dramatic yoga dominates — your chart is steady and grows from consistent effort.' });

  // Numerology (Ank Jyotish)
  const digitSum = String(dd) + String(m) + String(y);
  const mulank = reduceDigits(dd);
  const bhagyank = reduceDigits(digitSum.split('').reduce((a, c) => a + +c, 0));

  return {
    y, m, d: dd, jd, ayan, planets, P, moonSign, sunSign: P.Sun.sign, tropicalSunSign: Math.floor(t0.Sun / 30),
    moonNak: P.Moon.nak, moonPada: P.Moon.pada, moonEdge,
    tithi, karana, yoga: YOGA_NAMES[yogaIdx], vara: VARA[weekday], weekday,
    firstLord, firstBalance, dashas, yogas,
    mulank, bhagyank, dayNumber: dd,
    dateLabel: new Date(Date.UTC(y, m - 1, dd)).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }),
  };
}
