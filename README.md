# Mi Entrenamiento — PWA de registro

App instalable (PWA) para registrar comidas y entrenamientos diarios.
Los datos quedan en el navegador de cada dispositivo (IndexedDB, offline-first).

**Publicada en GitHub Pages:** https://negruloai.github.io/Trainning/

## Cómo usarla

### Opción A — En línea (recomendada)
1. Abre en el celular: `https://negruloai.github.io/Trainning/`
2. Instálala como app:
   - **Android (Chrome):** menú ⋮ → "Agregar a pantalla de inicio" → Instalar.
   - **iPhone (Safari):** botón compartir → "Agregar a pantalla de inicio".
3. Tus datos quedan guardados **en tu teléfono** (funciona sin internet).

### Opción B — Servidor local (para que el asistente lea los datos en el PC)
```
python server.py
```
Sirve la app en `http://<ip-del-pc>:8787` y recibe la sincronización vía `POST /sync`
hacia `datos/comidas.json` y `datos/entrenos.json`.

## Tipos de entrenamiento
- **Bici cerro / XCO / eléctrica:** distancia, desnivel, tiempo, FC media/máx.
- **Gym:** lista de ejercicios (nombre, series, reps).
- **Trote:** distancia, tiempo, ritmo, FC.
- **Futbolito:** duración.
- **Commuting:** un toque (ida y vuelta).

## Reconocimiento de comida por foto (Gemini)
- En **Ajustes** → pega tu **clave API de Gemini** (gratis en `aistudio.google.com/apikey`).
  La clave se guarda solo en tu dispositivo (localStorage), nunca en el código.
- En **Comida** → botón **📷 Foto** → saca la foto → la app detecta los alimentos y
  estima **calorías, proteínas, carbohidratos y grasas** (vía Gemini 1.5 Flash).
- Al **escribir** una comida a mano también se estiman los macros automáticamente.
- Los macros se guardan junto al registro de comida.
- ⚠️ La foto se envía a Google para su análisis.

## Progreso diario (cuánto falta)
- En **Hoy** → tarjeta **"Cuánto falta hoy"** con barras de progreso de
  proteína, carbs, grasas y calorías contra tus metas del día.
- Metas diarias **configurables** en Ajustes.
- Default según perfil: **2.200 kcal · 165 g proteína · 250 g carbs · 60 g grasas**.

## Exportar datos
- **Ajustes → "Exportar semana"**: JSON con la semana actual (lunes a domingo).
- **Ajustes → "Exportar todo"**: JSON completo.
- El asistente analiza el JSON exportado.

## Endpoints del servidor local
| Método | Ruta | Descripción |
|---|---|---|
| GET | `/` | App (index.html) |
| GET | `/datos` | JSON consolidado `{comidas, entrenos}` |
| POST | `/sync` | Merge por id y guardado; devuelve consolidado |
| GET | `/health` | `{ok: true}` |

## Tests
- `test/harness.html` — suite funcional con IndexedDB mockeado.
  Servir con el servidor y abrir `http://127.0.0.1:8787/test/harness.html`.
  Resultado esperado: `RESULTADO: 28/28 PASS`.
