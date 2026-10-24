"""Escanea data/pronosticos y data/mapas y escribe data/manifest.json.

GitHub Pages es un hosting estático: el navegador NO puede listar una carpeta.
Por eso este script (lo corre publicar.sh en el servidor, o a mano) arma un
índice con los archivos disponibles. La página lee ese índice y elige, por
cada localidad, el CSV de la corrida más reciente según el nombre:

    wrfout_<dominio>_<AAAA-MM-DD>_<HH>Z_data_<localidad>.csv

Uso:  python scripts/generar_manifest.py              (solo arma el índice)
      python scripts/generar_manifest.py --conservar 8 (además borra corridas viejas,
                                                         dejando las 8 últimas por localidad)
"""
import argparse, json, re
from datetime import datetime, timezone
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
PRON = RAIZ / "data" / "pronosticos"
MAPAS = RAIZ / "data" / "mapas"
NOMBRES = RAIZ / "data" / "localidades.json"   # opcional: {"slug": "Nombre lindo"}
VARIABLES = RAIZ / "data" / "variables.json"   # opcional: {"mdBZ": "Reflectividad máxima (dBZ)"}
PATRON_MAPA = re.compile(r"_(\d{4}-\d{2}-\d{2})_(\d{2})Z_(.+)\.html$", re.I)
PATRON = re.compile(r"^wrfout_(d\d+)_(\d{4}-\d{2}-\d{2})_(\d{2})Z_data_(.+)\.csv$", re.I)


def limpiar(conservar):
    """Borra los CSV de corridas viejas, dejando las N más recientes por localidad."""
    grupos = {}
    for p in PRON.glob("*.csv"):
        m = PATRON.match(p.name)
        if m:
            dom, fecha, hora, slug = m.groups()
            grupos.setdefault(slug.lower(), []).append((f"{fecha}T{hora}", p))
    borrados = 0
    for lista in grupos.values():
        for _, p in sorted(lista, reverse=True)[conservar:]:
            p.unlink(); borrados += 1
    print(f"Limpieza: {borrados} CSV viejos borrados (se conservan {conservar} corridas por localidad)")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--conservar", type=int, default=0,
                    help="corridas a conservar por localidad (0 = no borrar nada)")
    args = ap.parse_args()
    if args.conservar > 0:
        limpiar(args.conservar)

    nombres = json.loads(NOMBRES.read_text(encoding="utf-8")) if NOMBRES.exists() else {}
    archivos, ultimos = [], {}
    for p in sorted(PRON.glob("*.csv")):
        m = PATRON.match(p.name)
        if not m:
            print("  ignorado (nombre no válido):", p.name)
            continue
        dom, fecha, hora, slug = m.groups()
        slug = slug.lower()
        corrida = f"{fecha}T{hora}:00Z"
        archivos.append(p.relative_to(RAIZ).as_posix())
        # se queda con la corrida más reciente (y, si empatan, el archivo más nuevo)
        clave = (corrida, p.stat().st_mtime)
        if slug not in ultimos or clave > ultimos[slug]["_k"]:
            ultimos[slug] = {"_k": clave, "archivo": p.relative_to(RAIZ).as_posix(),
                             "corrida": corrida, "dominio": dom}

    localidades = []
    for slug, d in sorted(ultimos.items()):
        localidades.append({
            "slug": slug,
            "nombre": nombres.get(slug, slug.replace("_", " ").title()),
            "archivo": d["archivo"], "corrida": d["corrida"], "dominio": d["dominio"],
        })

    variables = json.loads(VARIABLES.read_text(encoding="utf-8")) if VARIABLES.exists() else {}
    mapas = []
    for p in sorted(MAPAS.glob("*.html")):
        # título: <title> del HTML; si no tiene, el nombre de la variable (variables.json o el sufijo del archivo)
        t = re.search(r"<title>(.*?)</title>", p.read_text(encoding="utf-8", errors="ignore")[:20000], re.I | re.S)
        m = PATRON_MAPA.search(p.name)
        var = m.group(3) if m else p.stem
        titulo = t.group(1).strip() if t else variables.get(var, var.replace("_", " "))
        mapas.append({"id": var.lower(), "archivo": p.relative_to(RAIZ).as_posix(), "titulo": titulo,
                      "corrida": f"{m.group(1)}T{m.group(2)}:00Z" if m else None})

    manifest = {
        "generado": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "principal": "merlo",          # localidad de la página principal
        "localidades": localidades,    # ya resuelto: último CSV por localidad
        "archivos": archivos,          # todos los CSV (por si el JS quiere recalcular)
        "mapas": mapas,
    }
    (RAIZ / "data" / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"manifest.json: {len(localidades)} localidades, {len(archivos)} CSV, {len(mapas)} mapas")
    for l in localidades:
        print(f"  {l['nombre']:<24} → {Path(l['archivo']).name}")


if __name__ == "__main__":
    main()
