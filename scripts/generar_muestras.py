"""Genera datos de MUESTRA para probar el sitio (no hace falta en producción).

- 2 mapas HTML de ejemplo y un GIF animado
"""
import csv, math, random
from datetime import datetime, timedelta
from pathlib import Path
from PIL import Image, ImageDraw

RAIZ = Path(__file__).resolve().parent.parent
PRON = RAIZ / "data" / "pronosticos"
BASE = PRON / "wrfout_d01_2026-10-23_06Z_data_merlo.csv"

with BASE.open() as f:
    filas = list(csv.DictReader(f))
campos = list(filas[0].keys())


def derivar(nombre, dt=0.0, dtd=0.0, kv=1.0, pp=1.0, seed=1, run="2026-10-23_06Z", shift_h=0):
    rnd = random.Random(seed)
    out = []
    for r in filas:
        t = datetime.strptime(r["Time"], "%Y-%m-%d %H:%M:%S") - timedelta(hours=shift_h)
        T = float(r["Temperature"]) + dt + rnd.uniform(-0.6, 0.6)
        Td = min(T - 0.3, float(r["DewPoint"]) + dtd + rnd.uniform(-0.5, 0.5))
        out.append({
            "Time": t.strftime("%Y-%m-%d %H:%M:%S"),
            "Temperature": round(T, 2),
            "DewPoint": round(Td, 2),
            "SeaLevelPressure": round(float(r["SeaLevelPressure"]) + rnd.uniform(-0.8, 0.8), 2),
            "WindSpeed": round(max(0.2, float(r["WindSpeed"]) * kv + rnd.uniform(-1, 1)), 2),
            "Winddir": round((float(r["Winddir"]) + rnd.uniform(-20, 20)) % 360, 1),
            "PrecipAccum1hour": round(max(0, float(r["PrecipAccum1hour"]) * pp), 2),
        })
    ruta = PRON / f"wrfout_d01_{run}_data_{nombre}.csv"
    with ruta.open("w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=campos)
        w.writeheader(); w.writerows(out)
    print("  ", ruta.name)


# ---------- mapas HTML de muestra ----------
PLANTILLA = """<!doctype html><html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>{titulo}</title>
<style>html,body{{margin:0;height:100%;background:#0f1419;font-family:system-ui,sans-serif;color:#e6e9ee}}
.w{{position:relative;height:100%;display:flex;flex-direction:column}}h1{{font-size:14px;font-weight:600;margin:0;padding:12px 14px;letter-spacing:.02em}}
small{{opacity:.6;font-weight:400}}canvas{{flex:1;width:100%;min-height:0}}
.cb{{display:flex;align-items:center;gap:8px;padding:10px 14px;font-size:11px}}.bar{{flex:1;height:8px;border-radius:4px;background:linear-gradient(90deg,{grad})}}</style></head>
<body><div class="w"><h1>{titulo} <small>· WRF d01 · corrida 2026-10-23 06Z · MUESTRA</small></h1><canvas id="c"></canvas>
<div class="cb"><span>{vmin}</span><div class="bar"></div><span>{vmax} {unidad}</span></div></div>
<script>
const cols={colores};const tipo="{tipo}";
const c=document.getElementById('c'),x=c.getContext('2d');
function f(u,v){{let s=0;{campo};return Math.max(0,Math.min(1,s));}}
function col(s){{const n=cols.length-1,i=Math.min(n-1,Math.floor(s*n)),t=s*n-i,a=cols[i],b=cols[i+1];
return `rgb(${{a[0]+(b[0]-a[0])*t|0}},${{a[1]+(b[1]-a[1])*t|0}},${{a[2]+(b[2]-a[2])*t|0}})`;}}
const pts=[["Merlo",.72,.38],["San Luis",.38,.42],["V. Mercedes",.62,.7],["La Toma",.5,.3],["Tilisarao",.66,.22]];
function draw(){{const d=devicePixelRatio||1,W=c.clientWidth,H=c.clientHeight;c.width=W*d;c.height=H*d;x.scale(d,d);
const st=6;for(let i=0;i<W;i+=st)for(let j=0;j<H;j+=st){{const s=f(i/W,j/H);x.fillStyle=tipo==='pp'&&s<.08?'#1a2129':col(s);x.fillRect(i,j,st,st);}}
if(tipo==='viento'){{x.strokeStyle='rgba(255,255,255,.75)';x.lineWidth=1.2;for(let i=20;i<W;i+=38)for(let j=20;j<H;j+=38){{
const a=Math.sin(i/W*3)+Math.cos(j/H*2)+.8,L=8+f(i/W,j/H)*12;x.beginPath();x.moveTo(i,j);const ex=i+Math.cos(a)*L,ey=j+Math.sin(a)*L;x.lineTo(ex,ey);
x.lineTo(ex-Math.cos(a-.5)*5,ey-Math.sin(a-.5)*5);x.moveTo(ex,ey);x.lineTo(ex-Math.cos(a+.5)*5,ey-Math.sin(a+.5)*5);x.stroke();}}}}
x.font='11px system-ui';for(const[n,u,v]of pts){{const px=u*W,py=v*H;x.fillStyle='#fff';x.beginPath();x.arc(px,py,3,0,7);x.fill();
x.fillStyle='rgba(0,0,0,.55)';const tw=x.measureText(n).width;x.fillRect(px+6,py-8,tw+8,16);x.fillStyle='#fff';x.fillText(n,px+10,py+4);}}}}
draw();addEventListener('resize',()=>{{x.setTransform(1,0,0,1,0,0);draw();}});
</script></body></html>"""

mapas = {
    "temperatura": dict(titulo="Temperatura a 2 m", unidad="°C", vmin=4, vmax=28, tipo="t",
        colores=[[49,54,149],[69,117,180],[116,173,209],[254,224,144],[253,174,97],[244,109,67],[165,0,38]],
        campo="s=.25+.5*(1-v)+.25*Math.sin(u*5)*Math.cos(v*3)-.3*Math.exp(-((u-.72)**2+(v-.38)**2)/.01)"),
    "precipitacion": dict(titulo="Precipitación acumulada 24 h", unidad="mm", vmin=0, vmax=25, tipo="pp",
        colores=[[200,230,255],[120,190,250],[40,120,230],[20,60,180],[120,40,170],[220,40,140]],
        campo="s=.9*Math.exp(-((u-.62)**2/.02+(v-.6)**2/.05))+.6*Math.exp(-((u-.3)**2/.01+(v-.2)**2/.02))"),
}
import json
for k, m in mapas.items():
    grad = ",".join(f"rgb({a},{b},{c})" for a, b, c in m["colores"])
    html = PLANTILLA.format(grad=grad, **{**m, "colores": json.dumps(m["colores"])})
    (RAIZ / "data" / "mapas" / f"{k}.html").write_text(html, encoding="utf-8")
print("Mapas HTML de muestra generados")

# ---------- GIF de muestra (eco de radar que se desplaza) ----------
W, H, frames = 480, 320, 16
imgs = []
for n in range(frames):
    im = Image.new("RGB", (W, H), (16, 21, 27))
    d = ImageDraw.Draw(im)
    for r in range(40, 420, 60):
        d.ellipse([W/2-r, H/2-r, W/2+r, H/2+r], outline=(40, 50, 60))
    cx, cy = 60 + n * 22, 90 + n * 8
    for rr, colr in [(70, (40, 120, 230)), (48, (30, 190, 120)), (30, (240, 200, 60)), (14, (230, 70, 60))]:
        d.ellipse([cx-rr*1.4, cy-rr, cx+rr*1.4, cy+rr], fill=colr)
    hh = 6 + n // 2
    d.text((12, 10), f"Radar MUESTRA  23/10 {hh:02d}:00", fill=(220, 225, 230))
    imgs.append(im)
imgs[0].save(RAIZ / "assets" / "img" / "animacion.gif", save_all=True, append_images=imgs[1:], duration=180, loop=0)
print("GIF de muestra generado")
