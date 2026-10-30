# =====================================================================
#  CONFIGURACIÓN — editá solo este archivo
#  Rutas del SERVIDOR donde el WRF deja sus salidas.
# =====================================================================

# Carpeta donde se generan los CSV (wrfout_d01_AAAA-MM-DD_HHZ_data_<localidad>.csv)
RUTA_CSV="/home/meteo/meteo-web/csv"

# Carpeta donde se generan los mapas HTML
RUTA_MAPAS="/home/meteo/meteo-web/mapas"

# Cuántos mapas HTML publicar (se toman los más recientes de RUTA_MAPAS)
CANT_MAPAS=2

# Corridas a conservar por localidad en el repositorio (8 = 2 días)
CONSERVAR=8

# Historial en GitHub:
#   0 = cada envío REEMPLAZA al anterior (recomendado: los mapas pesan ~30 MB por corrida
#       y con historial el repositorio crecería ~130 MB por día)
#   1 = guardar todo el historial de envíos
GUARDAR_HISTORIAL=0
