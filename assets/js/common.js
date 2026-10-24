/* =========================================================================
   Funciones compartidas: lectura del manifest, elección del último CSV,
   parseo, cálculos (humedad relativa, dirección) y barra lateral.
   ========================================================================= */
const Meteo = (() => {
  // wrfout_d01_2026-10-23_06Z_data_merlo.csv
  const PATRON = /^wrfout_(d\d+)_(\d{4}-\d{2}-\d{2})_(\d{2})Z_data_(.+)\.csv$/i;
  let _manifest = null;
  const _cache = {};

  function parseNombre(ruta) {
    const archivo = ruta.split('/').pop();
    const m = archivo.match(PATRON);
    if (!m) return null;
    return { ruta, archivo, dominio: m[1], corrida: `${m[2]}T${m[3]}:00Z`, slug: m[4].toLowerCase() };
  }

  /* Recalcula en el navegador el CSV más reciente por localidad a partir de
     la lista completa de archivos (doble control además del script). */
  function ultimosPorLocalidad(archivos) {
    const out = {};
    for (const r of archivos) {
      const p = parseNombre(r);
      if (!p) continue;
      if (!out[p.slug] || p.corrida > out[p.slug].corrida) out[p.slug] = p;
    }
    return out;
  }

  async function manifest() {
    if (_manifest) return _manifest;
    const r = await fetch('data/manifest.json', { cache: 'no-store' });
    if (!r.ok) throw new Error('No se encontró data/manifest.json. Ejecutá scripts/generar_manifest.py');
    const m = await r.json();
    const ult = ultimosPorLocalidad(m.archivos || []);
    m.localidades = (m.localidades || []).map(l => {
      const u = ult[l.slug];
      return u && u.corrida > l.corrida ? { ...l, archivo: u.ruta, corrida: u.corrida, dominio: u.dominio } : l;
    });
    _manifest = m;
    return m;
  }

  function parseCSV(txt) {
    const lineas = txt.trim().split(/\r?\n/);
    const cab = lineas.shift().split(',').map(s => s.trim());
    return lineas.filter(Boolean).map(l => {
      const v = l.split(',');
      const o = {};
      cab.forEach((c, i) => (o[c] = c === 'Time' ? v[i].trim() : parseFloat(v[i])));
      o.RH = humedad(o.Temperature, o.DewPoint);
      o.fecha = o.Time.slice(0, 10);
      o.hora = o.Time.slice(11, 16);
      const [y, mo, d] = o.fecha.split('-').map(Number);
      o.date = new Date(y, mo - 1, d, +o.Time.slice(11, 13));
      return o;
    });
  }

  async function cargar(ruta) {
    if (!_cache[ruta]) {
      _cache[ruta] = fetch(ruta, { cache: 'no-store' }).then(r => {
        if (!r.ok) throw new Error('No se pudo leer ' + ruta);
        return r.text();
      }).then(parseCSV);
    }
    return _cache[ruta];
  }

  // Humedad relativa (Magnus) a partir de T y Td en °C
  function humedad(t, td) {
    const e = (x) => Math.exp((17.625 * x) / (243.04 + x));
    return Math.max(0, Math.min(100, 100 * e(td) / e(t)));
  }

  const PUNTOS = ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSO','SO','OSO','O','ONO','NO','NNO'];
  const dirTexto = (g) => PUNTOS[Math.round(((g % 360) / 22.5)) % 16];
  // flecha hacia donde SOPLA el viento (dirección meteorológica = de dónde viene)
  const flecha = (g) => `<span class="arrow" style="transform:rotate(${(g + 180) % 360}deg)">↑</span>`;

  /* La velocidad del CSV se asume en m/s (salida estándar del WRF). */
  const UNIDAD_VIENTO = 'km/h';
  const viento = (ms) => ms * 3.6;

  function filaActual(filas) {
    const ahora = Date.now();
    let mejor = filas[0];
    for (const f of filas) if (Math.abs(f.date - ahora) < Math.abs(mejor.date - ahora)) mejor = f;
    return mejor;
  }

  const fmtDia = (f) => new Date(f + 'T12:00:00').toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'short' });
  const fmtDiaCorto = (f) => new Date(f + 'T12:00:00').toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric' });
  function fmtCorrida(iso, dom) {
    return `WRF ${dom || ''} · corrida ${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)} ${iso.slice(11, 13)}Z`;
  }

  function resumen(filas) {
    const T = filas.map(f => f.Temperature);
    return {
      tmin: Math.min(...T), tmax: Math.max(...T),
      pp: filas.reduce((s, f) => s + (f.PrecipAccum1hour || 0), 0),
      vmax: Math.max(...filas.map(f => viento(f.WindSpeed))),
    };
  }

  /* ---------- barra lateral de localidades (se usa en las 3 páginas) ---------- */
  async function barraLateral(activa, alElegir) {
    const side = document.querySelector('.side');
    const lista = side.querySelector('.lista');
    const m = await manifest();
    lista.innerHTML = '';
    for (const l of m.localidades) {
      const a = document.createElement('a');
      a.className = 'loc' + (l.slug === activa ? ' on' : '');
      a.href = `index.html#${encodeURIComponent(l.slug)}`;
      a.dataset.nombre = l.nombre.toLowerCase();
      a.dataset.slug = l.slug;
      if (alElegir) a.addEventListener('click', e => { e.preventDefault(); alElegir(l.slug); });
      a.innerHTML = `<b>${l.nombre}</b><span class="t">–</span><small>cargando…</small>`;
      lista.appendChild(a);
      cargar(l.archivo).then(filas => {
        const f = filaActual(filas), r = resumen(filas.slice(0, 24));
        a.querySelector('.t').textContent = f.Temperature.toFixed(0) + '°';
        a.querySelector('small').innerHTML =
          `<span>${r.tmin.toFixed(0)}° / ${r.tmax.toFixed(0)}°</span><span>${flecha(f.Winddir)} ${viento(f.WindSpeed).toFixed(0)} km/h</span><span>${r.pp.toFixed(1)} mm</span>`;
      }).catch(() => { a.querySelector('small').textContent = 'sin datos'; });
    }
    side.querySelector('input').addEventListener('input', e => {
      const q = e.target.value.toLowerCase();
      lista.querySelectorAll('.loc').forEach(x => (x.style.display = x.dataset.nombre.includes(q) ? '' : 'none'));
    });
    side.querySelector('.foot').textContent = `Índice actualizado: ${new Date(m.generado).toLocaleString('es-AR')}`;
    document.querySelector('.menu-btn')?.addEventListener('click', () => side.classList.toggle('open'));
  }

  function error(el, e) {
    el.innerHTML = `<div class="err"><b>No se pudieron cargar los datos.</b><br>${e.message}<br>
      <small>Si abriste el archivo con doble clic, serví la carpeta: <code>python -m http.server</code></small></div>`;
  }

  /* colores desde las variables CSS (para los gráficos) */
  const css = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();

  return { manifest, cargar, humedad, dirTexto, flecha, viento, UNIDAD_VIENTO, filaActual, fmtDia, fmtDiaCorto,
           fmtCorrida, resumen, barraLateral, error, css, parseNombre };
})();
