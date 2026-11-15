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
`data/sistemas_riego.json`; no se usa un catálogo alternativo.

## Clima NASA y uso sin conexión

En el formulario, selecciona el modo NASA, introduce la latitud y longitud de
la parcela y el mes, y consulta NASA POWER con conexión a internet. También
puedes usar «Usar mi ubicación actual» si estás en la parcela; el navegador
pedirá permiso y la ubicación puede ser aproximada. Esta función requiere HTTPS
o localhost y depende de la disponibilidad de ubicación del dispositivo.
Las coordenadas se pueden corregir manualmente y se envían a NASA solo al
consultar el clima. Se aplican
automáticamente los promedios
climatológicos históricos de temperatura, precipitación, humedad y radiación
solar; no son observaciones actuales ni un pronóstico. La temperatura mensual
se compara con las referencias existentes. Para la caña de azúcar también se
compara la precipitación anual estimada (promedio diario anual multiplicado por
365,25), con un peso adicional de 20 puntos cuando el dato está disponible.
Esta estimación no incluye riego ni indica la distribución de la lluvia. Las
referencias de lluvia del maíz y frijol son por ciclo, por lo que no se
comparan con promedios mensuales o anuales. La humedad y radiación se muestran
sin puntaje porque las fichas no contienen rangos numéricos comparables. Si
falla la consulta, selecciona el modo manual.

La versión compilada guarda los recursos necesarios para abrir la aplicación y
usar el formulario manual sin conexión. Es necesario visitarla primero con
internet y esperar a que el navegador termine de guardar los recursos. Se
requiere HTTPS o localhost y un navegador compatible con service workers; el
modo de desarrollo no prepara el acceso sin conexión. Las consultas a NASA
requieren conexión. Los datos temporales siguen ligados a la sesión de la pestaña.

## Estacionalidad y alertas

El panel consulta los promedios históricos mensuales de NASA POWER por zona,
no condiciones actuales ni pronósticos. Al consultar una zona con conexión se
guarda una copia en el almacenamiento local del navegador, que se usa sin
conexión o si falla NASA. Una zona no consultada previamente no tendrá datos
offline; borrar los datos del navegador también elimina las copias. Para abrir
la aplicación offline primero hay que preparar la versión compilada como se
explica arriba.

Selecciona un mes para ver lluvia, temperatura y humedad. Las alertas son
orientativas y no sustituyen la medición del suelo ni el pronóstico. El estado
verde requiere además elegir un cultivo: compara el promedio mensual con el
rango de temperatura de su ficha (para arroz y caña, germinación). Un promedio
mensual no verifica las condiciones reales de cada etapa; confirma la
conveniencia de la siembra para la parcela y el cultivo.

## Criterios para los datos

- Los datos agrícolas y meteorológicos se almacenarán en archivos JSON.
- Los valores desconocidos se representarán con `null`.
- Los registros observados y los pronósticos se identificarán por separado.
- Cada conjunto de datos indicará su fuente, ubicación, período y unidades.
- No se inventarán cifras ni se presentarán ejemplos como datos reales.
- No se emitirán recomendaciones definitivas cuando la información sea insuficiente.