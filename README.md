# R-cultivos

Aplicación web inicial para consultar información de suelo y clima de cultivos en Los Santos, Panamá.

## Desarrollo

```bash
npm install
npm run dev
```

La aplicación estará disponible en la dirección local que indique Vite.

## Formulario de parcela

Los datos temporales se guardan en la sesión de la pestaña con la clave
`parcela_temporal_v1`. Las opciones de riego deben estar definidas en
`data/sistemas_riego.json`; no se usa un catálogo alternativo. La comparación
agrícola aún no está implementada.

## Criterios para los datos

- Los datos agrícolas y meteorológicos se almacenarán en archivos JSON.
- Los valores desconocidos se representarán con `null`.
- Los registros observados y los pronósticos se identificarán por separado.
- Cada conjunto de datos indicará su fuente, ubicación, período y unidades.
- No se inventarán cifras ni se presentarán ejemplos como datos reales.
- No se emitirán recomendaciones definitivas cuando la información sea insuficiente.