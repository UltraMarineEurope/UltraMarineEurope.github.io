/*
 * Listovací brožura – prohlížeč.
 * Stránky, odkazy a animace čte z data.js (ten vytváří nastroje/sestavit.py).
 * Efekt listování obstarává knihovna StPageFlip (MIT) v page-flip.browser.js.
 */
(function () {
  'use strict';

  var data = window.BROZURA;

  function hlaska(text) {
    var p = document.createElement('p');
    p.className = 'hlaska';
    p.textContent = text;
    document.body.appendChild(p);
  }

  if (!data || !data.stranky || !data.stranky.length || !window.St) {
    hlaska('Brožuru se nepodařilo načíst.');
    return;
  }

  function $(id) { return document.getElementById(id); }

  var telo = document.body;
  var plocha = $('plocha');
  var obal = $('obal');
  var kniha = $('kniha');
  var nacitani = $('nacitani');
  var cisloStrany = $('cislo-strany');
  var tlZpet = $('tl-zpet');
  var tlVpred = $('tl-vpred');
  var sipkaZpet = $('sipka-zpet');
  var sipkaVpred = $('sipka-vpred');
  var tlLupa = $('tl-lupa');
  var tlCela = $('tl-cela');
  var tlStahnout = $('tl-stahnout');
  var lupa = $('lupa');
  var lupaPlocha = $('lupa-plocha');
  var lupaObsah = $('lupa-obsah');
  var lupaMene = $('lupa-mene');
  var lupaVice = $('lupa-vice');
  var lupaZavrit = $('lupa-zavrit');

  var pocet = data.stranky.length;
  var obalka = data.obalka_samostatne !== false;
  var pomer = data.sirka / data.vyska;
  var pripraveno = false;

  /* ---------- stavba stránek ---------- */

  // Na dvojstraně: s obálkou jsou vlevo liché indexy (1, 3, …), bez obálky sudé.
  function jeLeva(i) {
    return obalka ? i % 2 === 1 : i % 2 === 0;
  }

  function umisti(prvek, o) {
    prvek.style.left = o.x + '%';
    prvek.style.top = o.y + '%';
    prvek.style.width = o.w + '%';
    prvek.style.height = o.h + '%';
  }

  // Obrázky a animace se načítají, až když se k nim čtenář blíží.
  function zdroj(prvek, src, hned) {
    if (hned) prvek.src = src;
    else prvek.setAttribute('data-src', src);
  }

  var NAZVY_AKCI = {
    dalsi: 'Další strana',
    predchozi: 'Předchozí strana',
    prvni: 'První strana',
    posledni: 'Poslední strana'
  };

  function vytvorStranu(i, hned) {
    var s = data.stranky[i];
    var el = document.createElement('div');
    el.className = 'strana ' + (jeLeva(i) ? 'strana--leva' : 'strana--prava');

    var obr = document.createElement('img');
    obr.className = 'strana__obr';
    obr.alt = 'Strana ' + (i + 1);
    obr.draggable = false;
    zdroj(obr, s.obr, hned);
    el.appendChild(obr);

    (s.media || []).forEach(function (m) {
      var p;
      if (m.video) {
        p = document.createElement('video');
        p.muted = true;
        p.loop = true;
        p.autoplay = true;
        p.playsInline = true;
        // atributy kvůli kopiím stránek, které knihovna vytváří při listování
        p.setAttribute('muted', '');
        p.setAttribute('playsinline', '');
      } else {
        p = document.createElement('img');
        p.alt = '';
        p.draggable = false;
      }
      p.className = 'strana__media';
      umisti(p, m);
      zdroj(p, m.src, hned);
      el.appendChild(p);
    });

    // texty a grafika, které v PDF leží nad fotkou nahrazenou animací
    if (s.vrstva) {
      var vrstva = document.createElement('img');
      vrstva.className = 'strana__vrstva';
      vrstva.alt = '';
      vrstva.draggable = false;
      zdroj(vrstva, s.vrstva, hned);
      el.appendChild(vrstva);
    }

    (s.odkazy || []).forEach(function (o) {
      var a = document.createElement('a');
      a.className = 'strana__odkaz';
      umisti(a, o);
      if (o.url) {
        a.href = o.url;
        a.title = o.url.replace(/^(mailto|tel|sms):/i, '');
        if (/^https?:/i.test(o.url)) {
          a.target = '_blank';
          a.rel = 'noopener';
        }
      } else if (o.strana) {
        a.href = '#' + o.strana;
        a.title = 'Strana ' + o.strana;
        a.setAttribute('data-strana', o.strana);
      } else if (o.akce) {
        a.href = '#';
        a.title = NAZVY_AKCI[o.akce] || '';
        a.setAttribute('data-akce', o.akce);
      }
      a.setAttribute('aria-label', a.title || 'Odkaz');
      el.appendChild(a);
    });

    return el;
  }

  var strany = [];
  for (var i = 0; i < pocet; i++) strany.push(vytvorStranu(i, false));

  function prehraj(video) {
    try {
      var slib = video.play();
      if (slib && slib.catch) slib.catch(function () {});
    } catch (e) { /* prohlížeč přehrání nepovolil */ }
  }

  function nactiStranu(el, vcetneAnimaci) {
    var cekajici = el.querySelectorAll(vcetneAnimaci ? '[data-src]' : '.strana__obr[data-src], .strana__vrstva[data-src]');
    for (var j = 0; j < cekajici.length; j++) {
      var p = cekajici[j];
      p.src = p.getAttribute('data-src');
      p.removeAttribute('data-src');
      if (p.tagName === 'VIDEO') prehraj(p);
    }
  }

  // stránky načítáme s předstihem, velké GIFy jen pro aktuální a následující dvojstranu
  function nactiOkoli(index) {
    var od = Math.max(0, index - 2);
    var po = Math.min(pocet - 1, index + 5);
    for (var j = od; j <= po; j++) nactiStranu(strany[j], j <= index + 2);
  }

  /* ---------- kniha ---------- */

  function indexZAdresy() {
    var n = parseInt((location.hash || '').replace(/[^0-9]/g, ''), 10);
    return n >= 1 && n <= pocet ? n - 1 : 0;
  }

  var flip = new St.PageFlip(kniha, {
    width: data.sirka,
    height: data.vyska,
    size: 'stretch',
    minWidth: 1,
    maxWidth: 100000,
    minHeight: 1,
    maxHeight: 100000,
    showCover: obalka,
    usePortrait: true,
    autoSize: true,
    drawShadow: true,
    maxShadowOpacity: 0.4,
    flippingTime: 800,
    swipeDistance: 25,
    startPage: indexZAdresy()
  });

  function naVysku() {
    return flip.getOrientation() === 'portrait';
  }

  function viditelne() {
    var i = flip.getCurrentPageIndex();
    if (!naVysku() && jeLeva(i) && i + 1 < pocet) return [i, i + 1];
    return [i];
  }

  // Velikost knihy podle okna. Dvojstrany ukazujeme, když je plocha na šířku a stránky zůstanou čitelné,
  // jinak (mobil, tablet na výšku) po jedné stránce. Knihovna o orientaci rozhoduje podle minWidth, proto ho přepínáme.
  function rozvrhni() {
    var sirka = plocha.clientWidth;
    var vyska = plocha.clientHeight;
    if (!sirka || !vyska) return;

    // rozběhnuté listování dokončit ještě ve starém rozložení, jinak skončí na špatné straně
    if (pripraveno) flip.getRender().finishAnimation();

    var sirkaDvou = Math.min(sirka, vyska * 2 * pomer);
    var sirkaJedne = Math.min(sirka, vyska * pomer);
    var kratsiStranaVeDvojstrane = Math.min(sirkaDvou / 2, sirkaDvou / 2 / pomer);
    var jedna = pocet === 1 || sirka < vyska || kratsiStranaVeDvojstrane < 180;

    flip.getSettings().minWidth = jedna ? 1e7 : 1;
    obal.style.width = Math.floor(jedna ? sirkaJedne : sirkaDvou) + 'px';
    telo.classList.toggle('na-vysku', jedna);

    if (pripraveno) {
      flip.update();
      posunKnihu();
    }
  }

  // Samotnou obálku (nebo zadní stranu) posuneme doprostřed, aby kniha nebyla nakřivo.
  function posunKnihu() {
    var posun = 0;
    if (!naVysku() && viditelne().length === 1) {
      posun = flip.getCurrentPageIndex() === pocet - 1 ? 25 : -25;
    }
    obal.style.transform = posun ? 'translateX(' + posun + '%)' : '';
  }

  function aktualizujOvladani() {
    var v = viditelne();
    var text = v.length === 2 ? (v[0] + 1) + '–' + (v[1] + 1) : String(v[0] + 1);
    cisloStrany.textContent = text + ' / ' + pocet;
    tlZpet.disabled = sipkaZpet.disabled = v[0] === 0;
    tlVpred.disabled = sipkaVpred.disabled = v[v.length - 1] === pocet - 1;
  }

  function zapisDoAdresy(index) {
    var nova = index > 0 ? '#' + (index + 1) : location.pathname + location.search;
    try { history.replaceState(null, '', nova); } catch (e) { /* file:// v některých prohlížečích */ }
  }

  function prejdiNa(cil) {
    if (!pripraveno) return;
    cil = Math.max(0, Math.min(pocet - 1, cil));
    if (viditelne().indexOf(cil) !== -1) return;
    flip.flip(cil);
  }

  function dalsi() { flip.flipNext(); }
  function predchozi() { flip.flipPrev(); }

  function provedAkci(akce) {
    if (akce === 'dalsi') dalsi();
    else if (akce === 'predchozi') predchozi();
    else if (akce === 'prvni') prejdiNa(0);
    else if (akce === 'posledni') prejdiNa(pocet - 1);
  }

  flip.on('flip', function (e) {
    if (!pripraveno) return;
    nactiOkoli(e.data);
    aktualizujOvladani();
    zapisDoAdresy(e.data);
  });

  flip.on('changeState', function (e) {
    if (!pripraveno) return;
    if (e.data === 'read') {
      posunKnihu();
    } else {
      nactiOkoli(flip.getCurrentPageIndex());
      // ze samotné obálky vždy listujeme na dvojstranu – posun zrušíme hned
      if (e.data === 'flipping') obal.style.transform = '';
    }
  });

  flip.on('changeOrientation', function () {
    if (!pripraveno) return;
    // hustotu stránek (měkká/tvrdá) upravujeme jen na výšku – po změně orientace ji vrátíme
    flip.getPageCollection().getPages().forEach(function (s) { s.setDrawingDensity(s.getDensity()); });
    aktualizujOvladani();
    posunKnihu();
  });

  // Náš posluchač musí běžet před posluchačem knihovny, proto ho registrujeme dřív.
  window.addEventListener('resize', function () {
    rozvrhni();
    if (lupaOtevrena) nastavMeritko(meritko, false);
  });

  obal.classList.add('bez-prechodu');
  rozvrhni();
  flip.loadFromHTML(strany);
  // knihovna si z minWidth nastaví i minimální šířku bloku – při startu na mobilu by byla obří
  kniha.style.minWidth = '';

  // Na výšku (mobil) je vidět jen jedna stránka. Měkké listování zpět by předchozí stránku jen
  // vysunulo zleva, proto ji při listování zpět otočíme jako tuhý list kolem hřbetu.
  // Dopředu zůstává měkké zvlnění stránky.
  var kolekce = flip.getPageCollection();
  var puvodniOtacenaStrana = kolekce.getFlippingPage.bind(kolekce);
  kolekce.getFlippingPage = function (smer) {
    if (naVysku()) {
      var zpet = smer === 1; // FlipDirection.BACK
      var index = kolekce.getCurrentSpreadIndex() - (zpet ? 1 : 0);
      if (index >= 0 && index < pocet) kolekce.getPage(index).setDrawingDensity(zpet ? 'hard' : 'soft');
    }
    return puvodniOtacenaStrana(smer);
  };

  pripraveno = true;
  flip.update();

  var start = flip.getCurrentPageIndex();
  nactiOkoli(start);
  aktualizujOvladani();
  posunKnihu();
  setTimeout(function () { obal.classList.remove('bez-prechodu'); }, 150);

  // načítací kolečko zmizí po načtení první viditelné stránky
  (function () {
    var obr = strany[start].querySelector('.strana__obr');
    var hotovo = function () { nacitani.classList.add('skryt'); };
    if (obr.complete && obr.naturalWidth) hotovo();
    else {
      obr.addEventListener('load', hotovo);
      obr.addEventListener('error', hotovo);
      setTimeout(hotovo, 5000);
    }
  })();

  /* ---------- odkazy uvnitř brožury ---------- */

  function naKliknutiOdkazu(e) {
    var a = e.target.closest ? e.target.closest('.strana__odkaz') : null;
    if (!a) return;
    var strana = a.getAttribute('data-strana');
    var akce = a.getAttribute('data-akce');
    if (!strana && !akce) return; // běžný odkaz na web, e-mail či telefon
    e.preventDefault();
    if (lupaOtevrena) zavriLupu();
    if (strana) prejdiNa(parseInt(strana, 10) - 1);
    else provedAkci(akce);
  }

  kniha.addEventListener('click', naKliknutiOdkazu);
  lupaObsah.addEventListener('click', naKliknutiOdkazu);

  window.addEventListener('hashchange', function () {
    prejdiNa(indexZAdresy());
  });

  /* ---------- ovládání ---------- */

  tlZpet.addEventListener('click', predchozi);
  sipkaZpet.addEventListener('click', predchozi);
  tlVpred.addEventListener('click', dalsi);
  sipkaVpred.addEventListener('click', dalsi);

  document.addEventListener('keydown', function (e) {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    if (lupaOtevrena) {
      if (e.key === 'Escape') zavriLupu();
      else if (e.key === '+' || e.key === '=') nastavMeritko(meritko * 1.5, false);
      else if (e.key === '-') nastavMeritko(meritko / 1.5, false);
      return;
    }
    switch (e.key) {
      case 'ArrowRight': case 'PageDown': dalsi(); break;
      case 'ArrowLeft': case 'PageUp': predchozi(); break;
      case 'Home': prejdiNa(0); break;
      case 'End': prejdiNa(pocet - 1); break;
      default: return;
    }
    e.preventDefault();
  });

  var koren = document.documentElement;
  var pozadatCelou = koren.requestFullscreen || koren.webkitRequestFullscreen;
  if (!pozadatCelou) {
    tlCela.hidden = true;
  } else {
    tlCela.addEventListener('click', function () {
      var slib;
      if (document.fullscreenElement || document.webkitFullscreenElement) {
        slib = (document.exitFullscreen || document.webkitExitFullscreen).call(document);
      } else {
        slib = pozadatCelou.call(koren);
      }
      if (slib && slib.catch) slib.catch(function () {});
    });
  }

  if (data.pdf) {
    tlStahnout.href = data.pdf;
    tlStahnout.setAttribute('download', data.pdf.split('?')[0].split('/').pop());
    tlStahnout.hidden = false;
  }

  /* ---------- lupa ---------- */

  var lupaOtevrena = false;
  var meritko = 2;
  var LUPA_MIN = 1;
  var LUPA_MAX = 5;

  function nastavMeritko(nove, odZacatku) {
    meritko = Math.max(LUPA_MIN, Math.min(LUPA_MAX, nove));
    var rect = flip.getBoundsRect();
    var sirka = Math.round(rect.pageWidth * meritko);
    var vyska = Math.round(rect.height * meritko);

    // zachovat místo, na které se čtenář právě dívá
    var stredX = (lupaPlocha.scrollLeft + lupaPlocha.clientWidth / 2) / (lupaPlocha.scrollWidth || 1);
    var stredY = (lupaPlocha.scrollTop + lupaPlocha.clientHeight / 2) / (lupaPlocha.scrollHeight || 1);

    for (var j = 0; j < lupaObsah.children.length; j++) {
      lupaObsah.children[j].style.width = sirka + 'px';
      lupaObsah.children[j].style.height = vyska + 'px';
    }

    if (odZacatku) {
      lupaPlocha.scrollLeft = 0;
      lupaPlocha.scrollTop = 0;
    } else {
      lupaPlocha.scrollLeft = stredX * lupaPlocha.scrollWidth - lupaPlocha.clientWidth / 2;
      lupaPlocha.scrollTop = stredY * lupaPlocha.scrollHeight - lupaPlocha.clientHeight / 2;
    }

    lupaMene.disabled = meritko <= LUPA_MIN;
    lupaVice.disabled = meritko >= LUPA_MAX;
  }

  function otevriLupu() {
    lupaObsah.textContent = '';
    viditelne().forEach(function (index) {
      lupaObsah.appendChild(vytvorStranu(index, true));
    });
    lupa.hidden = false;
    lupaOtevrena = true;
    nastavMeritko(2, true);
    lupaZavrit.focus();
  }

  function zavriLupu() {
    lupa.hidden = true;
    lupaOtevrena = false;
    lupaObsah.textContent = '';
    tlLupa.focus();
  }

  tlLupa.addEventListener('click', otevriLupu);
  lupaZavrit.addEventListener('click', zavriLupu);
  lupaMene.addEventListener('click', function () { nastavMeritko(meritko / 1.5, false); });
  lupaVice.addEventListener('click', function () { nastavMeritko(meritko * 1.5, false); });

  // posouvání přiblížené stránky tažením myší (na dotykových zařízeních funguje prstem samo)
  var tah = null;
  lupaPlocha.addEventListener('mousedown', function (e) {
    if (e.button !== 0 || e.target.closest('a')) return;
    tah = { x: e.clientX, y: e.clientY, vlevo: lupaPlocha.scrollLeft, nahore: lupaPlocha.scrollTop };
    lupaPlocha.classList.add('tahne');
    e.preventDefault();
  });
  window.addEventListener('mousemove', function (e) {
    if (!tah) return;
    lupaPlocha.scrollLeft = tah.vlevo - (e.clientX - tah.x);
    lupaPlocha.scrollTop = tah.nahore - (e.clientY - tah.y);
  });
  window.addEventListener('mouseup', function () {
    if (!tah) return;
    tah = null;
    lupaPlocha.classList.remove('tahne');
  });
})();
