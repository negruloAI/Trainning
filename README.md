# Mi Entrenamiento — PWA de registro

App instalable (PWA) para registrar comidas y entrenamientos diarios.
Los datos quedan en `datos/comidas.json` y `datos/entrenos.json` para
que el asistente los analice.

## Cómo usarla

### 1. Levantar el servidor (en el PC)
```
python server.py
```
Sirve la app en `http://<ip-del-pc>:8787` y recibe la sincronización.
En la consola verás la IP local del servidor.

### 2. Abrir / instalar en el celular
- Conecta el celular a la **misma red WiFi** que el PC.
- Abre en el navegador: `http://<ip-del-pc>:8787`
- Desde el menú del navegador: **"Agregar a pantalla de inicio"** → se instala como app.

### 3. Configurar la IP en la app
- En la app → pestaña **Ajustes** → escribe la IP del PC (ej. `192.168.1.10`) → Guardar.

### 4. Registrar y sincronizar
- Registra comidas y entrenamientos en cualquier momento (**funciona offline**).
- El botón de sincronizar (flecha circular arriba) envía los datos al PC.
  - Punto **naranja** = hay datos sin sincronizar.
  - Punto **verde** = todo sincronizado.
  - Al recuperar la conexión se sincroniza solo.

## Tipos de entrenamiento
- **Bici cerro / XCO / eléctrica:** distancia, desnivel, tiempo, FC media/máx.
- **Gym:** lista de ejercicios (nombre, series, reps).
- **Trote:** distancia, tiempo, ritmo, FC.
- **Futbolito:** duración.
- **Commuting:** un toque (ida y vuelta).

## Endpoints del servidor
| Método | Ruta | Descripción |
|---|---|---|
| GET | `/` | App (index.html) |
| GET | `/datos` | JSON consolidado `{comidas, entrenos}` |
| POST | `/sync` | Merge por id y guardado; devuelve consolidado |
| GET | `/health` | `{ok: true}` |

## Tests
- `test/harness.html` — suite funcional con IndexedDB mockeado.
  Servir con el servidor y abrir `http://127.0.0.1:8787/test/harness.html`.
  Resultado esperado: `RESULTADO: 18/18 PASS`.
