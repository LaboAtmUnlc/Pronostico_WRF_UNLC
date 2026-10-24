# Pronóstico WRF — sitio web estático

Sitio minimalista para publicar en **GitHub Pages** la salida del modelo WRF:
pronóstico horario por localidad y mapas HTML animados.

## Páginas

| Página | Qué muestra |
|---|---|
| `index.html` | Pronóstico horario (temperatura, punto de rocío, humedad, viento, precipitación horaria): selector de días, 4 gráficos y tabla. Localidad por URL: `index.html?loc=merlo` |
| `mapas.html` | Muestra los mapas HTML de `data/mapas/` tal cual, uno debajo del otro (hoy: precipitación acumulada y reflectividad máxima) |
| `localidades.html` | Tarjetas comparativas de todas las localidades con selector de variable |

Las tres páginas tienen la **lista lateral de localidades** (con buscador), y cada una muestra la temperatura actual, mín/máx, viento y lluvia de su último CSV.

## Estructura

```
├── index.html  mapas.html  localidades.html
├── assets/
│   ├── css/style.css
│   ├── js/common.js        ← lectura del manifest, último CSV, cálculos, lateral
│   └── js/pronostico.js    ← página principal
├── data/
│   ├── pronosticos/        ← acá van los CSV del modelo
│   ├── mapas/              ← los mapas HTML (se publican tal cual)
│   ├── localidades.json    ← nombres con acentos: {"sta_rosa_co": "Santa Rosa del Conlara"}
│   ├── variables.json      ← títulos de los mapas: {"mdBZ": "Reflectividad máxima (dBZ)"}
│   └── manifest.json       ← se genera solo
├── scripts/
│   ├── generar_manifest.py
│   ├── config.sh           ← RUTAS de los CSV y mapas en el servidor
│   └── publicar.sh         ← lo corre el servidor del WRF cada 6 h
```

## Cómo se lee "el último CSV generado"

GitHub Pages es estático: el navegador **no puede listar una carpeta**. Por eso:

1. Los CSV se nombran `wrfout_<dominio>_<AAAA-MM-DD>_<HH>Z_data_<localidad>.csv`
   (ej. `wrfout_d01_2026-10-23_06Z_data_merlo.csv`).
2. `scripts/generar_manifest.py` escanea `data/pronosticos/`, agrupa por localidad y
   elige la corrida más reciente **según la fecha y hora del nombre** → `data/manifest.json`.
3. `scripts/publicar.sh` corre ese script en el servidor antes de cada push.
4. En el navegador, `common.js` vuelve a verificar la lista completa y toma la corrida más nueva.

Una localidad nueva aparece sola: basta subir su CSV.

### Corridas cada 6 horas

Cada corrida (00Z, 06Z, 12Z, 18Z) trae archivos con un nombre distinto porque incluye la fecha y la hora.
No hay que borrar ni renombrar nada: se suben los CSV nuevos y el sitio muestra siempre la corrida más reciente.
`publicar.sh` además borra las corridas viejas y deja las **8 últimas por localidad** (2 días), para que el
repositorio no crezca sin fin. Ese número se cambia con `CONSERVAR` en `scripts/config.sh` (0 = no borrar nada).

## Publicar

```bash
git init && git add . && git commit -m "Sitio pronóstico"
git branch -M main
git remote add origin https://github.com/<usuario>/<repo>.git
git push -u origin main
```
En GitHub: **Settings → Pages → Deploy from a branch → main / (root)**.

## Publicar automáticamente desde el servidor del WRF

**1. Configurar las rutas** en `scripts/config.sh` (es lo único que hay que editar):

```bash
RUTA_CSV="/ruta/de/salida/csv"      # donde el WRF deja los CSV
RUTA_MAPAS="/ruta/de/salida/mapas"  # donde el WRF deja los mapas HTML
CANT_MAPAS=2                        # cuántos mapas publicar
CONSERVAR=8                         # corridas a guardar por localidad
GUARDAR_HISTORIAL=0                 # 0 = cada envío reemplaza al anterior
```

**2. Correr** `scripts/publicar.sh`. En cada ejecución:
- copia solo los CSV de la **corrida más reciente** que haya en `RUTA_CSV` (aunque la carpeta guarde corridas viejas),
- reemplaza los mapas publicados por los **`CANT_MAPAS` HTML más recientes** de `RUTA_MAPAS`,
- arma el índice y borra las corridas viejas,
- hace **push** a GitHub (solo viajan los archivos que cambiaron).

El servidor es el **único que escribe** en GitHub: no hace `pull`. Con `GUARDAR_HISTORIAL=0`, cada
envío reemplaza lo que haya en GitHub, así que cualquier cambio hecho directamente en la web de GitHub
se pierde: hacé los cambios en la carpeta del servidor.

```bash
./scripts/publicar.sh
```

**3. Programarlo cada 6 horas** con cron (`crontab -e`), ajustando la hora a cuando termina el WRF:

```
30 2,8,14,20 * * *  /ruta/meteo-web/scripts/publicar.sh >> /ruta/publicar.log 2>&1
```

El servidor necesita permiso para hacer `git push`. Lo más seguro es una **clave de despliegue**
(sirve solo para este repositorio):

```bash
ssh-keygen -t ed25519 -f ~/.ssh/meteo_deploy -N ""
cat ~/.ssh/meteo_deploy.pub
```
Copiá esa clave pública en GitHub → repositorio → **Settings → Deploy keys → Add deploy key**
y marcá **Allow write access**. Después cloná el repositorio en el servidor con esa clave:

```bash
GIT_SSH_COMMAND="ssh -i ~/.ssh/meteo_deploy" git clone git@github.com:<usuario>/<repo>.git meteo-web
cd meteo-web && git config core.sshCommand "ssh -i ~/.ssh/meteo_deploy"
```

## Probar en local

Desde la carpeta del proyecto:

```bash
python3 -m http.server 8000 --bind 127.0.0.1
```

y abrí http://127.0.0.1:8000. (Con doble clic sobre `index.html` no funciona: el navegador bloquea la lectura de los CSV desde archivos locales.)

## Supuestos a revisar

- **Viento**: se asume `WindSpeed` en m/s y se muestra en km/h (`Meteo.viento` en `common.js`).
- **Hora**: la columna `Time` se muestra tal cual, como hora local.
- **Humedad relativa**: se calcula a partir de `Temperature` y `DewPoint` (fórmula de Magnus).
- **Localidad principal**: `"principal": "merlo"` en `generar_manifest.py`.
- **Nombres de localidades**: `data/localidades.json` traduce el nombre del archivo al nombre que se muestra (ej. `c_rdoba` → Córdoba). Si aparece una localidad nueva que no está en la lista, se muestra con el nombre del archivo; agregala ahí para corregir acentos.
- **Mapas**: son las animaciones HTML del WRF (`wrfout_d01_<fecha>_<HH>Z_<VARIABLE>.html`) y se publican tal cual. El texto de cada botón sale de `data/variables.json` según la variable del nombre (`mdBZ` → Reflectividad máxima). Si agregás una variable nueva, sumala ahí.
- **Tamaño**: cada corrida suma ~33 MB de mapas. Con `GUARDAR_HISTORIAL=0` (en `config.sh`) cada envío reemplaza al anterior y el repositorio no crece; con `1` se guarda todo el historial y crece ~130 MB por día.
- Para borrar corridas viejas y no inflar el repo, podés conservar solo las últimas N por localidad.
# Pronostico_WRF_UNLC
