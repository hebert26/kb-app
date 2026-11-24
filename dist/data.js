// Datos de prueba: cada entrada es un fichero Markdown tal como estaría en tu carpeta.
// Las fechas son relativas al momento de carga para que "hoy" y "ayer" tengan sentido.
function ago(hours) {
    const d = new Date(Date.now() - hours * 3600 * 1000);
    d.setSeconds(0, 0);
    return d.toISOString();
}
export const MOCK_FILES = [
    {
        path: 'prod/tickets/pay-1482.md',
        content: `---
id: pay-1482
tipo: ticket
entorno: prod
etiquetas: [pagos, sqs]
fijado: true
url: https://jira.example.com/browse/PAY-1482
actualizado: ${ago(1)}
---

# PAY-1482 · Pagos duplicados tras timeout

> Si el proceso tarda más que el [[timeout-visibilidad]], la cola da el mensaje por perdido y lo vuelve a entregar.

La cola reenvía el mensaje de pago antes de que el proceso termine, y el cliente ve dos cargos pendientes. Lo vi primero en el [[panel-alarmas]].

- [x] Confirmar que el timeout es menor que el tiempo de proceso.
- [ ] Probar con un timeout mayor en desarrollo antes de tocar producción.
- [ ] Hacer el consumidor idempotente: ver [[idempotencia]].
- [ ] Revisar qué acabó en la [[dlq]].
`,
    },
    {
        path: 'dev/tickets/frd-311.md',
        content: `---
id: frd-311
tipo: ticket
entorno: dev
etiquetas: [fraude, reglas]
fijado: true
url: https://jira.example.com/browse/FRD-311
actualizado: ${ago(26)}
---

# FRD-311 · Regla de velocidad por tarjeta

> La regla cuenta intentos por tarjeta en una ventana corta. El umbral se decide con el equipo de riesgo.

Nueva regla para frenar las pruebas de tarjetas robadas. Corre en el lambda de fraude: ver [[vars-lambda-fraude]].

Complementa a [[3ds]], no lo sustituye.

- [ ] Umbral inicial: [N] intentos en [M] minutos.
- [ ] Validarla con el equipo de riesgo antes de activarla.
`,
    },
    {
        path: 'prod/enlaces/panel-alarmas.md',
        content: `---
id: panel-alarmas
tipo: link
entorno: prod
etiquetas: [alarmas, guardia, pagos]
fijado: true
url: https://dashboards.example.com/pagos/alarmas
actualizado: ${ago(72)}
---

# Panel de alarmas de pagos

> Empieza siempre la guardia por aquí. Si todo está en verde, no toques nada.

Lo primero que miro al empezar la guardia. Forma parte del [[checklist-guardia]].

Si salta la alarma de latencia, revisar primero la cola de reintentos, como en [[pay-1482]].
`,
    },
    {
        path: 'dev/config/vars-lambda-fraude.md',
        content: `---
id: vars-lambda-fraude
tipo: config
entorno: dev
etiquetas: [fraude, lambda]
actualizado: ${ago(150)}
---

# Variables del lambda de fraude

> Estos valores son solo de desarrollo. Nunca los copies a producción.

Valores para ejecutar el lambda en local y en el entorno de pruebas. Para producción, mira [[regiones-prod]].

\`\`\`env
FRAUD_RULES_TABLE=fraud-rules-dev
SCORE_THRESHOLD=[VALOR]
LOG_LEVEL=debug
\`\`\`
`,
    },
    {
        path: 'prod/config/regiones-prod.md',
        content: `---
id: regiones-prod
tipo: config
entorno: prod
etiquetas: [aws]
actualizado: ${ago(290)}
---

# Cuentas y regiones de producción

> Comprueba la región antes de ejecutar cualquier comando en producción.

Dónde vive cada cosa en producción. Si vas a cambiar secretos, sigue [[rotar-secretos]].

\`\`\`text
Región principal:   eu-west-1
Región secundaria:  [REGIÓN]
Cuenta AWS:         [ID DE CUENTA]
\`\`\`
`,
    },
    {
        path: 'dev/enlaces/api-pagos-dev.md',
        content: `---
id: api-pagos-dev
tipo: link
entorno: dev
etiquetas: [api, pagos]
url: https://api-dev.example.com/pagos/docs
actualizado: ${ago(500)}
---

# API de pagos en desarrollo

> Sirve para probar a mano sin tocar el entorno real.

Documentación de la API en el entorno de desarrollo, útil para probar peticiones a mano. Los códigos de error vienen del [[psp]].
`,
    },
    {
        path: 'general/glosario/3ds.md',
        content: `---
id: 3ds
tipo: glossary
entorno: gen
etiquetas: [pagos]
actualizado: ${ago(640)}
---

# 3DS

> Añade un paso más al pago, pero reduce el fraude con tarjetas robadas.

Protocolo que pide al titular de la tarjeta una verificación adicional, normalmente en la app de su banco, antes de autorizar el pago. Lo gestiona el [[psp]].
`,
    },
    {
        path: 'general/glosario/psp.md',
        content: `---
id: psp
tipo: glossary
entorno: gen
etiquetas: [pagos]
actualizado: ${ago(640)}
---

# PSP

> Cuando falla un pago, mira primero la respuesta del PSP.

Proveedor de servicios de pago: la empresa externa que procesa las transacciones con tarjeta en nuestro nombre.
`,
    },
    {
        path: 'general/glosario/dlq.md',
        content: `---
id: dlq
tipo: glossary
entorno: gen
etiquetas: [sqs]
actualizado: ${ago(410)}
---

# DLQ

> Si un mensaje falla demasiadas veces, acaba aquí en lugar de perderse.

Cola de mensajes muertos. Guarda los mensajes que el consumidor no pudo procesar tras varios intentos, para revisarlos a mano. Se revisa en el [[checklist-guardia]].
`,
    },
    {
        path: 'general/glosario/timeout-visibilidad.md',
        content: `---
id: timeout-visibilidad
tipo: glossary
entorno: gen
etiquetas: [sqs]
actualizado: ${ago(30)}
---

# Timeout de visibilidad

> Tiempo que un mensaje queda oculto mientras un consumidor lo procesa.

Si el consumidor no borra el mensaje antes de que venza, la cola lo vuelve a mostrar y otro consumidor puede procesarlo. Por eso hace falta [[idempotencia]].
`,
    },
    {
        path: 'general/conocimiento/rotar-secretos.md',
        content: `---
id: rotar-secretos
tipo: knowledge
entorno: gen
etiquetas: [aws, secretos]
actualizado: ${ago(860)}
---

# Rotar un secreto sin cortar el servicio

> No borres la versión antigua hasta comprobar que el servicio ya usa la nueva.

Los pasos que funcionaron la última vez:

1. Comprobar la región en [[regiones-prod]].
2. Crear la nueva versión del secreto sin borrar la anterior.
3. Desplegar el servicio para que lea la nueva versión.
4. Vigilar los logs un rato antes de seguir.
5. Retirar la versión antigua.
`,
    },
    {
        path: 'general/conocimiento/idempotencia.md',
        content: `---
id: idempotencia
tipo: knowledge
entorno: gen
etiquetas: [sqs, pagos]
actualizado: ${ago(2)}
---

# Idempotencia en consumidores de colas

> Si la cola puede entregar dos veces, el consumidor tiene que aguantarlo.

Procesar dos veces el mismo mensaje debe dejar el mismo resultado que procesarlo una vez.

- Guardar el identificador del mensaje ya procesado.
- Comprobarlo antes de llamar al [[psp]].
- Origen: [[pay-1482]].
`,
    },
    {
        path: 'general/conocimiento/checklist-guardia.md',
        content: `---
id: checklist-guardia
tipo: knowledge
entorno: gen
etiquetas: [guardia]
fijado: true
actualizado: ${ago(48)}
---

# Checklist de inicio de guardia

> Diez minutos al empezar ahorran una noche entera.

- [ ] Abrir el [[panel-alarmas]].
- [ ] Mirar si hay mensajes en la [[dlq]].
- [ ] Confirmar la región activa en [[regiones-prod]].
- [ ] Leer las notas de la guardia anterior.
`,
    },
    {
        path: 'general/notas/ventana-despliegue.md',
        content: `---
id: ventana-despliegue
tipo: quick
entorno: gen
etiquetas: [despliegues]
actualizado: ${ago(20)}
---

# Preguntar por la nueva ventana de despliegue

> Pendiente de confirmar con el equipo.

Confirmar si el viernes sigue bloqueado para desplegar en producción, antes de activar [[frd-311]].
`,
    },
    {
        path: 'prod/tickets/pay-1390.md',
        content: `---
id: pay-1390
tipo: ticket
entorno: prod
etiquetas: [pagos]
archivado: true
url: https://jira.example.com/browse/PAY-1390
actualizado: ${ago(1800)}
---

# PAY-1390 · Reembolsos parciales con importe cero

> Validar en la API sale más barato que limpiar datos después.

Resuelto añadiendo una validación en la API que rechaza reembolsos de importe cero. Para probarlo, usa la [[api-pagos-dev]].
`,
    },
];
