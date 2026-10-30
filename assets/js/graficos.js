/* =========================================================================
   Gráficos SVG minimalistas, sin dependencias.
   Grafico.dibujar(contenedor, {
     etiquetas: [...],                       // eje X
     tipo: 'linea' | 'barras',
     series: [{ datos, color, nombre, relleno, guiones, fmt }],
     ymin, ymax, minRango, flechas: [grados...]  // flechas = dir. de viento (opcional)
   })
   ========================================================================= */
const Grafico = (() => {
  const NS = 'http://www.w3.org/2000/svg';
  const el = (t, a = {}) => { const e = document.createElementNS(NS, t); for (const k in a) e.setAttribute(k, a[k]); return e; };
  let uid = 0;

  function escala(min, max, n = 5) {
    const paso0 = (max - min) / n || 1, mag = 10 ** Math.floor(Math.log10(paso0));
    const paso = [1, 2, 2.5, 5, 10].map(x => x * mag).find(x => x >= paso0);
    const a = Math.floor(min / paso) * paso, b = Math.ceil(max / paso) * paso, ticks = [];
    for (let v = a; v <= b + paso / 2; v += paso) ticks.push(+v.toFixed(6));
    return { min: a, max: b, ticks };
  }

  function dibujar(cont, op) {
    cont._op = op;
    if (!cont._ro) { cont._ro = new ResizeObserver(() => render(cont)); cont._ro.observe(cont); }
    render(cont);
  }

  function render(cont) {
    const op = cont._op; if (!op) return;
    const W = cont.clientWidth, H = cont.clientHeight; if (!W || !H) return;
    cont.innerHTML = ''; cont.style.position = 'relative';
    const n = op.etiquetas.length, barras = op.tipo === 'barras';
    const todos = op.series.flatMap(s => s.datos);
    let lo = op.ymin ?? Math.min(...todos), hi = op.ymax ?? Math.max(...todos);
    if (op.minRango && hi - lo < op.minRango) hi = lo + op.minRango;
    const e = escala(lo, hi);
    if (op.ymin != null) e.min = op.ymin; if (op.ymax != null) e.max = op.ymax;
    e.ticks = e.ticks.filter(t => t >= e.min - 1e-9 && t <= e.max + 1e-9);

    const m = { l: 38, r: 10, t: op.flechas ? 26 : 10, b: op.horas ? 40 : 24 };
    const iw = W - m.l - m.r, ih = H - m.t - m.b;
    const X = barras ? (i => m.l + (i + .5) * iw / n) : (i => m.l + (n > 1 ? i * iw / (n - 1) : iw / 2));
    const Y = v => m.t + ih - (v - e.min) / (e.max - e.min) * ih;

    const svg = el('svg', { width: W, height: H, viewBox: `0 0 ${W} ${H}` });
    svg.style.display = 'block'; svg.style.overflow = 'visible';
    const defs = el('defs'); svg.appendChild(defs);

    // grilla y eje Y
    for (const t of e.ticks) {
      svg.appendChild(el('line', { x1: m.l, x2: W - m.r, y1: Y(t), y2: Y(t), stroke: 'var(--line)', 'stroke-width': 1 }));
      const tx = el('text', { x: m.l - 8, y: Y(t) + 4, 'text-anchor': 'end', fill: 'var(--muted)', 'font-size': 11, 'font-family': 'var(--mono)' });
      tx.textContent = +t.toFixed(2); svg.appendChild(tx);
    }
    // eje X: horas ("06:00 hs") cada 3/6/12/24 h según el ancho, y debajo el día
    if (op.horas && op.fechas) {
      const porEtiqueta = n / Math.max(1, Math.floor(iw / 64));
      const cada = [3, 6, 12, 24].find(x => x >= porEtiqueta) || 24;
      const yBase = m.t + ih;
      op.horas.forEach((h, i) => {
        if (+h.slice(0, 2) % cada) return;
        svg.appendChild(el('line', { x1: X(i), x2: X(i), y1: yBase, y2: yBase + 4, stroke: 'var(--muted)', 'stroke-width': 1 }));
        const tx = el('text', { x: X(i), y: yBase + 16, 'text-anchor': 'middle', fill: 'var(--muted)', 'font-size': 11 });
        tx.textContent = h + ' hs'; svg.appendChild(tx);
      });
      // un rótulo por día, centrado en su tramo, y una línea suave en cada 00:00
      const paso = barras ? iw / n : (n > 1 ? iw / (n - 1) : iw);
      let ini = 0;
      for (let i = 1; i <= n; i++) {
        if (i < n && op.fechas[i] === op.fechas[ini]) continue;
        const x0 = Math.max(m.l, X(ini) - (barras ? paso / 2 : 0)), x1 = Math.min(W - m.r, X(i - 1) + (barras ? paso / 2 : 0));
        if (ini > 0) svg.appendChild(el('line', { x1: x0, x2: x0, y1: m.t, y2: yBase + 30, stroke: 'var(--line)', 'stroke-width': 1, 'stroke-dasharray': '3 3' }));
        const etiqueta = op.dias ? op.dias[ini] : op.fechas[ini];
        if (x1 - x0 >= etiqueta.length * 6) {
          const tx = el('text', { x: (x0 + x1) / 2, y: yBase + 32, 'text-anchor': 'middle', fill: 'var(--ink)', 'font-size': 11.5, 'font-weight': 700 });
          tx.textContent = etiqueta; svg.appendChild(tx);
        }
        ini = i;
      }
    } else {
      const cada = Math.max(1, Math.ceil(n / Math.max(2, Math.floor(iw / 70))));
      op.etiquetas.forEach((lab, i) => {
        if (i % cada) return;
        const tx = el('text', { x: X(i), y: H - 6, 'text-anchor': 'middle', fill: 'var(--muted)', 'font-size': 11 });
        tx.textContent = lab; svg.appendChild(tx);
      });
    }

    // series
    for (const s of op.series) {
      if (barras) {
        const bw = Math.max(2, Math.min(14, iw / n * .65));
        s.datos.forEach((v, i) => {
          if (!(v > 0)) return;
          svg.appendChild(el('rect', { x: X(i) - bw / 2, y: Y(v), width: bw, height: Y(e.min) - Y(v), rx: 2, fill: s.color }));
        });
        continue;
      }
      const pts = s.datos.map((v, i) => [X(i), Y(v)]);
      const d = curva(pts);
      if (s.relleno) {
        const id = 'g' + (++uid);
        const g = el('linearGradient', { id, x1: 0, x2: 0, y1: 0, y2: 1 });
        g.appendChild(el('stop', { offset: '0%', 'stop-color': s.color, 'stop-opacity': .28 }));
        g.appendChild(el('stop', { offset: '100%', 'stop-color': s.color, 'stop-opacity': 0 }));
        defs.appendChild(g);
        svg.appendChild(el('path', { d: `${d}L${X(n - 1)},${Y(e.min)}L${X(0)},${Y(e.min)}Z`, fill: `url(#${id})` }));
      }
      svg.appendChild(el('path', { d, fill: 'none', stroke: s.color, 'stroke-width': s.guiones ? 1.5 : 2.2,
        'stroke-dasharray': s.guiones ? '5 4' : 'none', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }));
    }

    // flechas de dirección (hacia dónde sopla)
    if (op.flechas) {
      const paso = Math.max(1, Math.ceil(n / Math.floor(iw / 26)));
      op.flechas.forEach((g, i) => {
        if (i % paso) return;
        const gr = el('g', { transform: `translate(${X(i)},12) rotate(${(g + 180) % 360})`, stroke: op.series[0].color, 'stroke-width': 1.6, fill: 'none', 'stroke-linecap': 'round' });
        gr.appendChild(el('path', { d: 'M0,6 L0,-6 M-3.5,-2.5 L0,-6 L3.5,-2.5' }));
        svg.appendChild(gr);
      });
    }

    // interacción: línea guía + tooltip
    const guia = el('line', { y1: m.t, y2: m.t + ih, stroke: 'var(--muted)', 'stroke-width': 1, 'stroke-dasharray': '3 3', opacity: 0 });
    svg.appendChild(guia);
    const puntos = barras ? [] : op.series.map(s => { const c = el('circle', { r: 4, fill: 'var(--panel)', stroke: s.color, 'stroke-width': 2, opacity: 0 }); svg.appendChild(c); return c; });
    cont.appendChild(svg);

    const tip = document.createElement('div');
    tip.style.cssText = 'position:absolute;pointer-events:none;opacity:0;transition:opacity .1s;background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:8px 10px;font-size:12px;box-shadow:0 4px 14px rgba(0,0,0,.08);white-space:nowrap;z-index:2';
    cont.appendChild(tip);

    const mover = (ev) => {
      const r = svg.getBoundingClientRect(), x = (ev.touches ? ev.touches[0].clientX : ev.clientX) - r.left;
      let i = barras ? Math.floor((x - m.l) / (iw / n)) : Math.round((x - m.l) / (iw / Math.max(1, n - 1)));
      i = Math.max(0, Math.min(n - 1, i));
      guia.setAttribute('x1', X(i)); guia.setAttribute('x2', X(i)); guia.setAttribute('opacity', .6);
      puntos.forEach((c, k) => { c.setAttribute('cx', X(i)); c.setAttribute('cy', Y(op.series[k].datos[i])); c.setAttribute('opacity', 1); });
      tip.innerHTML = `<div style="color:var(--muted);margin-bottom:4px">${op.titulos ? op.titulos[i] : op.etiquetas[i]}</div>` +
        op.series.map(s => `<div><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${s.color};margin-right:6px"></span>${s.nombre ? s.nombre + ': ' : ''}<b style="font-family:var(--mono)">${s.fmt ? s.fmt(s.datos[i], i) : s.datos[i]}</b></div>`).join('');
      tip.style.opacity = 1;
      const tw = tip.offsetWidth;
      tip.style.left = Math.min(W - tw, Math.max(0, X(i) + (X(i) + tw + 16 > W ? -tw - 12 : 12))) + 'px';
      tip.style.top = m.t + 'px';
    };
    const salir = () => { tip.style.opacity = 0; guia.setAttribute('opacity', 0); puntos.forEach(c => c.setAttribute('opacity', 0)); };
    svg.addEventListener('pointermove', mover); svg.addEventListener('pointerleave', salir);
    svg.addEventListener('touchstart', mover, { passive: true });
  }

  // curva suave monótona (evita "pasarse" de los valores reales)
  function curva(p) {
    if (p.length < 3) return p.map((q, i) => (i ? 'L' : 'M') + q.join(',')).join('');
    const n = p.length, dx = [], s = [], t = [];
    for (let i = 0; i < n - 1; i++) { dx[i] = p[i + 1][0] - p[i][0]; s[i] = (p[i + 1][1] - p[i][1]) / dx[i]; }
    t[0] = s[0]; t[n - 1] = s[n - 2];
    for (let i = 1; i < n - 1; i++) t[i] = s[i - 1] * s[i] <= 0 ? 0 : (s[i - 1] + s[i]) / 2;
    let d = `M${p[0][0].toFixed(1)},${p[0][1].toFixed(1)}`;
    for (let i = 0; i < n - 1; i++) {
      const h = dx[i] / 3;
      d += `C${(p[i][0] + h).toFixed(1)},${(p[i][1] + t[i] * h).toFixed(1)} ${(p[i + 1][0] - h).toFixed(1)},${(p[i + 1][1] - t[i + 1] * h).toFixed(1)} ${p[i + 1][0].toFixed(1)},${p[i + 1][1].toFixed(1)}`;
    }
    return d;
  }

  return { dibujar };
})();
