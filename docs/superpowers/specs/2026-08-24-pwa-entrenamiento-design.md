# PWA "Mi Entrenamiento" — Design Doc

**Fecha:** 2026-08-24
**Usuario:** Carlos Venegas (48 años, 86 kg, 170 cm — IMC 29.8)
**Objetivo:** herramienta de registro diario de comidas y entrenamientos para
acompañar el plan de composición corporal (bajar grasa, mantener firmeza) y
mejora de rendimiento (MTB, trote, futbolito).

## Contexto

- Carlos reporta lo que come y entrena; el asistente (IA) analiza y sugiere.
- Entrenamiento real: commuting en bici Lu-Vie (22 km, 80 m desnivel), bici de
  cerro (XCO/eléctrica) según disponibilidad, gym 2x/semana orientado a
  "ágil pero firme" (sin hipertrofia), trote 1x/semana, futbolito 1x/semana.
- Garmin Fenix 7: los datos de entrenamiento se escriben a mano en la app.
- Sin calendario rígido: el registro es el pilar, no la planificación semanal.

## Decisiones clave

| Tema | Decisión |
|---|---|
| Tipo de app | PWA instalable (HTML/CSS/JS vanilla, sin frameworks) |
| Almacenamiento local | IndexedDB en el dispositivo (offline-first) |
| Servidor | Python 3 stdlib (`http.server`), sin dependencias externas |
| Sincronización | PUSH desde el celular al PC en la misma red WiFi (endpoint `/sync`) |
| Datos en PC | `datos/comidas.json` y `datos/entrenos.json` |
| Iconos | Generados con Pillow |
| Servicio Worker | `sw.js` para uso offline de la app |
| Registro comidas | Texto libre + notas |
| Registro entrenos | Tipo + campos específicos (bici cerro, gym, trote, futbolito, commuting) |

## Pantallas (SPA con pestañas)

1. **Hoy** — resumen del día: comidas registradas, entrenos del día, recordatorios
   suaves, estado de sincronización.
2. **Comida** — texto libre + hora + notas. Lista del día.
3. **Entrenamiento** — selector de tipo:
   - *Bici cerro:* distancia (km), desnivel (m), tiempo, FC media/máx.
   - *Gym:* lista editable de ejercicios (nombre, series, reps).
   - *Trote:* distancia, tiempo, ritmo, FC.
   - *Futbolito:* duración.
   - *Commuting:* botón sí/no (ida/vuelta).
4. **Semana** — resumen: nº entrenos, horas, km en bici, días con registro.
5. **Ajustes** — editar/borrar registros, IP del servidor, sincronizar ahora,
   exportar datos.

## Formato de datos

### `comidas.json`
```json
{ "id": "uuid", "fecha": "YYYY-MM-DD", "hora": "HH:MM", "texto": "almuerzo: pollo, arroz, ensalada", "notas": "", "sync": true }
```

### `entrenos.json`
```json
{ "id": "uuid", "fecha": "YYYY-MM-DD", "tipo": "bici-cerro", "datos": { "distancia": 25.4, "desnivel": 800, "tiempo_min": 95, "fc_media": 142, "fc_max": 178 }, "sync": true }
```

## API del servidor local

- `GET /` → sirve la SPA (index.html, css, js, manifest, sw, iconos).
- `POST /sync` → recibe `{ comidas: [...], entrenos: [...] }`, hace merge por `id`
  con los JSON del PC, devuelve `{ comidas: [...], entrenos: [...] }` completos.
- `GET /datos` → devuelve los JSON actuales (para verificación).
- `GET /health` → responde `{ ok: true }`.

## Criterios de éxito

- Carlos puede registrar una comida en <15 seg y un entreno en <30 seg.
- La app funciona sin internet (IndexedDB + Service Worker).
- La sincronización al PC es un toque (botón) o automática al detectar red.
- La IA puede leer `datos/*.json` y analizar la semana.
- Cero dependencias externas: `python server.py` y listo.
