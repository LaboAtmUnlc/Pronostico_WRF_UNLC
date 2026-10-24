#!/usr/bin/env bash
# Publica en GitHub lo que genera el servidor (CSV y mapas) con un push.
# Corre en el servidor del WRF (a mano o con cron). El servidor es el único que escribe en GitHub:
# con GUARDAR_HISTORIAL=0 cada envío reemplaza al anterior (lo editado en la web de GitHub se pierde).
# Las rutas se configuran en scripts/config.sh
#
# Uso:   ./scripts/publicar.sh
set -euo pipefail

REPO="$(cd "$(dirname "$0")/.." && pwd)"
source "$REPO/scripts/config.sh"
cd "$REPO"

[ -d "$RUTA_CSV" ]   || { echo "No existe RUTA_CSV: $RUTA_CSV (editá scripts/config.sh)"; exit 1; }
[ -d "$RUTA_MAPAS" ] || { echo "No existe RUTA_MAPAS: $RUTA_MAPAS (editá scripts/config.sh)"; exit 1; }

# 1) CSV: copiar solo los de la corrida más reciente que haya en RUTA_CSV
ULTIMA=$(ls "$RUTA_CSV" | grep -E '^wrfout_d[0-9]+_[0-9]{4}-[0-9]{2}-[0-9]{2}_[0-9]{2}Z_data_.+\.csv$' \
         | sed -E 's/^wrfout_d[0-9]+_([0-9-]+_[0-9]{2}Z)_data_.*/\1/' | sort | tail -1 || true)
[ -n "$ULTIMA" ] || { echo "No hay CSV con el formato esperado en $RUTA_CSV"; exit 1; }
cp "$RUTA_CSV"/wrfout_d*_"${ULTIMA}"_data_*.csv data/pronosticos/
echo "Corrida $ULTIMA: $(ls data/pronosticos/*_"${ULTIMA}"_data_*.csv | wc -l) CSV copiados"

# 2) Mapas: reemplazar los publicados por los CANT_MAPAS HTML más recientes
NUEVOS=$(ls -t "$RUTA_MAPAS"/*.html 2>/dev/null | head -n "$CANT_MAPAS" || true)
if [ -n "$NUEVOS" ]; then
  rm -f data/mapas/*.html
  echo "$NUEVOS" | while read -r f; do cp "$f" data/mapas/; done
  echo "Mapas: $(echo "$NUEVOS" | wc -l) HTML copiados"
else
  echo "Aviso: no hay HTML en $RUTA_MAPAS, se dejan los mapas anteriores"
fi

# 3) armar el índice y borrar corridas viejas
python3 scripts/generar_manifest.py --conservar "$CONSERVAR"

# 4) push a GitHub
RAMA=$(git rev-parse --abbrev-ref HEAD)
git add -A
if git diff --cached --quiet; then
  echo "No hay cambios para publicar."
  exit 0
fi
MENSAJE="Actualización del sitio · corrida $ULTIMA"

if [ "${GUARDAR_HISTORIAL:-0}" = "1" ]; then
  git commit --quiet -m "$MENSAJE"
  if ! git push --quiet origin "$RAMA"; then
    echo "ERROR: GitHub rechazó el envío. Probablemente hay cambios hechos en la web de GitHub."
    echo "Solución: entrá a $REPO y corré una vez:  git pull --rebase   y después volvé a ejecutar este script."
    exit 1
  fi
else
  # un único commit con el estado actual: el repositorio no acumula los mapas viejos
  git checkout --quiet --orphan _publicacion
  git commit --quiet -m "$MENSAJE"
  git branch -D "$RAMA" >/dev/null
  git branch -m "$RAMA"
  git push --quiet --force -u origin "$RAMA"
  git reflog expire --expire=now --all && git gc --prune=now --quiet   # libera espacio local
fi
echo "Publicado."
