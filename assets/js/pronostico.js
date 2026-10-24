/* Página principal: pronóstico horario de la localidad elegida (?loc=slug o #slug) */
(async () => {
  const app = document.getElementById('app');
  let filas = [], diaSel = 'todo';

  let manifest;
  const seg = document.getElementById('dias');
  seg.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    diaSel = b.dataset.v;
    seg.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b));
    render();
  });

  try {
    manifest = await Meteo.manifest();
    // localidad pedida: ?loc=slug o #slug ; si no, la principal
    const pedido = new URLSearchParams(location.search).get('loc') || decodeURIComponent(location.hash.slice(1));
    const loc = manifest.localidades.find(l => l.slug === pedido)
             || manifest.localidades.find(l => l.slug === manifest.principal)
             || manifest.localidades[0];
    if (!loc) throw new Error('El manifest no tiene localidades.');

    // en esta página, tocar una localidad la cambia sin recargar
    Meteo.barraLateral(loc.slug, slug => mostrar(slug));
    await mostrar(loc.slug);
  } catch (e) {
    Meteo.error(app, e);
  }

  async function mostrar(slug) {
    const loc = manifest.localidades.find(l => l.slug === slug);
    if (!loc) return;
    filas = await Meteo.cargar(loc.archivo);
    try { history.replaceState(null, '', '#' + slug); } catch (_) {}
    document.querySelectorAll('.side .loc').forEach(a => a.classList.toggle('on', a.dataset.slug === slug));
    document.querySelector('.side')?.classList.remove('open');

    document.title = `${loc.nombre} · Pronóstico WRF`;
    document.getElementById('nombre').textContent = loc.nombre;
    document.getElementById('corrida').textContent = Meteo.fmtCorrida(loc.corrida, loc.dominio);
    document.getElementById('archivo').innerHTML = `<span class="chip">${loc.archivo.split('/').pop()}</span>`;

    const f = Meteo.filaActual(filas);
    document.getElementById('tnow').textContent = f.Temperature.toFixed(1) + '°';
    document.getElementById('nowlbl').innerHTML =
      `${Meteo.fmtDia(f.fecha)} · ${f.hora} h<br>Humedad ${f.RH.toFixed(0)}% · ${Meteo.flecha(f.Winddir)} ${Meteo.viento(f.WindSpeed).toFixed(0)} km/h ${Meteo.dirTexto(f.Winddir)}`;

    // selector de días (se rehace por si la corrida cubre otros días)
    const dias = [...new Set(filas.map(x => x.fecha))];
    if (diaSel !== 'todo' && !dias.includes(diaSel)) diaSel = 'todo';
    const opciones = [['todo', `Todo (${filas.length} h)`], ...dias.map(d => [d, Meteo.fmtDiaCorto(d)])];
    seg.innerHTML = opciones.map(([v, t]) => `<button data-v="${v}" class="${v === diaSel ? 'on' : ''}">${t}</button>`).join('');
    render();
  }

  function datos() { return diaSel === 'todo' ? filas : filas.filter(f => f.fecha === diaSel); }

  function render() {
    const d = datos();
    stats(d);
    graficos(d);
    tabla(d);
  }

  function stats(d) {
    const r = Meteo.resumen(d);
    const rh = d.map(x => x.RH);
    const c = (v) => `<span class="dot" style="background:var(${v})"></span>`;
    document.getElementById('stats').innerHTML = `
      <div class="stat"><span>${c('--temp')}Temperatura</span><div>${r.tmin.toFixed(1)}° / ${r.tmax.toFixed(1)}°</div><small>mínima / máxima</small></div>
      <div class="stat"><span>${c('--hum')}Humedad</span><div>${Math.min(...rh).toFixed(0)}–${Math.max(...rh).toFixed(0)}%</div><small>rango</small></div>
      <div class="stat"><span>${c('--wind')}Viento máx.</span><div>${r.vmax.toFixed(0)} km/h</div><small>velocidad media horaria</small></div>
      <div class="stat"><span>${c('--rain')}Precipitación</span><div>${r.pp.toFixed(1)} mm</div><small>${d.filter(x => x.PrecipAccum1hour >= 0.1).length} h con ≥ 0,1 mm</small></div>`;
    document.getElementById('ppTotal').textContent = `total ${r.pp.toFixed(1)} mm`;
  }

  function graficos(d) {
    const etiquetas = d.map(x => diaSel === 'todo' && x.hora === '00:00' ? Meteo.fmtDiaCorto(x.fecha) : x.hora);
    const titulos = d.map(x => `${Meteo.fmtDiaCorto(x.fecha)} · ${x.hora} h`);
    const etiquetasDia = d.map(x => `${Meteo.fmtDiaCorto(x.fecha)} ${x.hora.slice(0, 2)}h`);
    const G = (id, op) => Grafico.dibujar(document.getElementById(id), { etiquetas, etiquetasDia, titulos, ...op });

    G('cTemp', { series: [
      { datos: d.map(x => x.Temperature), color: 'var(--temp)', nombre: 'Temperatura', relleno: true, fmt: v => v.toFixed(1) + ' °C' },
      { datos: d.map(x => x.DewPoint), color: 'var(--dew)', nombre: 'Rocío', guiones: true, fmt: v => v.toFixed(1) + ' °C' },
    ] });
    G('cHum', { ymin: 0, ymax: 100, series: [
      { datos: d.map(x => x.RH), color: 'var(--hum)', nombre: 'Humedad', relleno: true, fmt: v => v.toFixed(0) + ' %' } ] });
    G('cWind', { ymin: 0, flechas: d.map(x => x.Winddir), series: [
      { datos: d.map(x => Meteo.viento(x.WindSpeed)), color: 'var(--wind)', nombre: 'Viento', relleno: true,
        fmt: (v, i) => `${v.toFixed(0)} km/h del ${Meteo.dirTexto(d[i].Winddir)}` } ] });
    G('cPP', { tipo: 'barras', ymin: 0, minRango: 1, series: [
      { datos: d.map(x => x.PrecipAccum1hour), color: 'var(--rain)', nombre: 'Precipitación', fmt: v => v.toFixed(2) + ' mm' } ] });
  }

  function tabla(d) {
    const actual = Meteo.filaActual(filas);
    const maxPP = Math.max(1, ...d.map(x => x.PrecipAccum1hour));
    let html = '', dia = '';
    for (const x of d) {
      if (x.fecha !== dia) { dia = x.fecha; html += `<tr class="day"><td colspan="8">${Meteo.fmtDia(dia)}</td></tr>`; }
      const pp = x.PrecipAccum1hour;
      html += `<tr class="${x === actual ? 'cur' : ''}">
        <td>${x.hora}</td>
        <td style="color:var(--temp)">${x.Temperature.toFixed(1)}°</td>
        <td>${x.DewPoint.toFixed(1)}°</td>
        <td>${x.RH.toFixed(0)}%</td>
        <td>${Meteo.viento(x.WindSpeed).toFixed(0)} km/h</td>
        <td>${Meteo.flecha(x.Winddir)} ${Meteo.dirTexto(x.Winddir)}</td>
        <td>${x.SeaLevelPressure.toFixed(1)}</td>
        <td>${pp > 0 ? `<span class="rainbar" style="width:${Math.max(3, pp / maxPP * 40)}px"></span>` : ''}${pp.toFixed(2)}</td>
      </tr>`;
    }
    document.getElementById('tabla').innerHTML = html;
  }
})();
