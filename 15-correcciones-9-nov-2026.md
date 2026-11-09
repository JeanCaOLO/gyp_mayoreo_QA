# 15 · Correcciones del 9 de noviembre de 2026

Tres defectos encontrados al intentar pasar el mes de trabajo de octubre a
noviembre en QA. Los tres estaban en la pantalla, no en los datos: **ningún
número del P&L cambia con esta tanda.**

| | Commit | Qué arregla |
|---|---|---|
| 1 | `6d248ed` | Un mes sin datos se puede elegir |
| 2 | `8f72ff9` | El globo de Alertas cuenta alertas, no avisos de reglas |
| 3 | `a590254` | El sello deja de decir «sin fecha» |

Base `f057a39` → cabeza `a590254`, rama `main` de
`JeanCaOLO/gyp_mayoreo_QA`. Desplegado en Render (QA). **No aplicado en
productivo.**

---

## 1 · Un mes sin datos se puede elegir — `6d248ed`

### El síntoma

En «Sobre qué mes trabajas», la tarjeta **nov 2026** salía en gris con la
leyenda «todavía sin datos» y **no se podía pulsar**. El mes de trabajo seguía
clavado en octubre, y no había forma de moverlo desde la pantalla.

### La causa

`src/pages/proyeccion-gyp/components/PestanaParametros.tsx`

```ts
const deshabilitado = m.fase === 'sin_datos';
```

Un mes sin datos quedaba deshabilitado. Pero **elegir el mes es justamente lo
que hace que tenga datos**: al elegirlo se arrastran las reglas del mes anterior
(`clonar_reglas`) y se habilita la extracción que le trae la historia.

> No se podía elegir noviembre porque no tenía datos,
> y no tenía datos porque nadie podía elegirlo.

El mes en curso quedaba inalcanzable. La única salida era editar
`proyeccion_config.periodo_trabajo` a mano en la base — que no es una opción
para Control.

Lo demás ya funcionaba y no se tocó: la lista **sí** ofrecía el mes en curso y
el anterior, y el manejador del cambio de mes ya estaba preparado para un mes
vacío. Solo faltaba poder hacer clic.

### El arreglo

La regla sale a una función pura en `src/pages/proyeccion-gyp/meses.ts`:

```ts
export function mesSeleccionable(opciones: {
  activo: boolean;
  puedeElegir: boolean;
}): boolean {
  return opciones.puedeElegir && !opciones.activo;
}
```

Lo único que impide pulsar es que ya sea el mes activo, o que la pantalla esté
en solo lectura (`onElegirMes` ausente). **Que no tenga datos ya no cuenta.**

La tarjeta vacía se muestra con borde punteado —se ve que está vacía— y añade
debajo: *«Elígelo y pulsa Actualizar para traer sus datos.»*

### Pruebas

Tres nuevas en `meses.test.ts`, una de ellas describe este fallo exacto:

- un mes **sin** datos se puede elegir
- el mes que ya es el activo no se vuelve a pulsar
- sin a quién avisar del cambio, no se puede elegir

---

## 2 · El globo de Alertas — `8f72ff9`

### El síntoma

La pestaña **Alertas** mostraba un globo naranja con **6**. Al entrar: las tres
cajas en cero y «Sin alertas por ahora. El catálogo reconoce todas las cuentas
con movimiento.» Nada que revisar, pero la pestaña insistía en que había seis
pendientes.

### La causa

`src/pages/proyeccion-gyp/page.tsx`

```ts
{esAlertas && avisos.length > 0 && ( … {avisos.length} … )}
```

`avisos` **no son** las alertas del catálogo. Son los avisos de las reglas
—Combinadas repetidas, empresas sin regla de ingreso— y se muestran en la
pestaña **Reglas**. Dos cosas distintas con el mismo globo.

Esto era **la mitad no corregida de P13**. En la auditoría de octubre se
arregló el contador de *dentro* de la pestaña (`contador={alertas.length}`),
pero el globo de la pestañita —que es lo que se ve sin entrar— se quedó con el
contador equivocado.

### El arreglo

```ts
{esAlertas && alertas.length > 0 && ( … {alertas.length} … )}
```

Con el catálogo limpio, **el globo desaparece**. Los 6 avisos de reglas siguen
donde siempre estuvieron, en la pestaña Reglas.

---

## 3 · El sello «Fabric · sin fecha» — `a590254`

### El síntoma

La cabecera decía:

```
Fabric · sin fecha · datos al 2026-10-29
```

Los datos tenían fecha de sobra; el sello no la encontraba.

### La causa

Son **dos** hechos encadenados, y el primero es el importante.

**a) La extracción del aplicativo nunca ha funcionado.** En
`proyeccion_corrida` solo existe un intento, y falló:

```
2026-10-27 · extraccion · error
AADSTS700016: Application with identifier '2b0e824f-…'
was not found in the directory 'e8f246eb-…'
```

El **service principal de Fabric no existe en el tenant**. Es el requisito del
documento 07 §2 que nunca se completó. Sin él, la Edge Function
`refrescar-proyeccion-fabric` no puede abrir la conexión TDS contra el almacén.

**b) Los datos entran por otra vía.** El notebook
`Gold_a_Supabase_proyeccion` (el espejo de Gold a Supabase, ejecutado en
Fabric) escribe `gyp_historico_mensual`, `gyp_historico_cuenta` y
`proyeccion_parametro` —días hábiles, transcurridos, tasa y corte—, pero **no
deja fila en `proyeccion_corrida`**.

El sello buscaba la fecha en una bitácora que nadie llena. De ahí «sin fecha».

### Qué hace «Actualizar» en realidad

Conviene dejarlo claro, porque se presta a confusión:

```
1. Llama a la Edge Function → intenta ir a Fabric → FALLA (AADSTS700016)
                              aviso: «Fabric no actualizó…»
2. Lee Supabase             → trae lo que escribió el notebook   ✅
```

El paso 2 corre **siempre**, falle o no el paso 1. Por eso la pantalla se
actualiza bien aunque el aviso rojo diga lo contrario.

### El arreglo

`src/pages/proyeccion-gyp/data.ts`. Sin fila de extracción en la bitácora, el
sello cae al `updated_at` más reciente de los parámetros del periodo:

```ts
} else if (escrituraParametros) {
  data.generado = escrituraParametros.slice(0, 16).replace('T', ' ');
} else {
  data.generado = null;   // sin bitácora Y sin parámetros: no se sabe
}
```

**No se inventa ninguna fecha.** Es cuándo se escribieron de verdad los días y
el corte que la pantalla está mostrando. Y si no hay ni bitácora ni parámetros,
sigue diciendo que no se sabe — un sello falso es peor que ninguno.

**No afecta a la publicación.** La guarda de datos frescos vive en el servidor
(`corrida-programada`) y mira el `corte`, no este campo.

---

## Sobre los días hábiles

Pregunta recurrente: *«dice 24 de 26 días hábiles, debería actualizar al día que
estamos».*

**«Transcurridos» no son los días que van del mes: son los días con datos
completos**, y el proyectado divide entre ese número. Ponerlos al día de hoy sin
que los datos hayan llegado **inflaría la proyección**.

El número lo calcula la extracción contra el corte, y se mueve cuando llegan los
datos. Que llevara desde el 19-oct sin moverse no era un defecto de la etiqueta:
era que nadie había vuelto a correr el notebook.

Tras la corrida manual del 9-nov, noviembre quedó así:

| Empresa | Transcurridos / hábiles |
|---|---|
| Beval, Febeca, Sillaca, Prisma | 5 / 25 |
| Cofersa | 5 / 21 |
| Mundial | 4 / 19 |

Corte **2026-11-06**, parámetros escritos el **9-nov 14:34** (Caracas).

---

## La cadena diaria

El notebook y el aplicativo se programan **por separado**; el aplicativo no
dispara el notebook ni lo espera.

```
  (Medallion de la mañana)
     Bronze → Silver → Gold

  (Fabric, programado aparte)
  06:10  El notebook escribe Supabase: historia, detalle por cuenta, parámetros

  (el aplicativo, CP-56)
  06:50  Recálculo de los dos escenarios + publicación a v_proyeccion_final
            └─▶ el copyjob lo lleva a Fabric y al reporte
```

Horas en **America/Caracas** (UTC−4 todo el año, sin horario de verano: 06:10
Caracas = 10:10 UTC siempre).

La programación del aplicativo está en la base, no en el código:

```
proyeccion_programacion → activa, diaria, 06:50, America/Caracas
```

**Hay que verificar que Gold cierre antes de las 06:10.** Si cierra después, el
notebook copiaría los datos del día anterior sin avisar. Se comprueba con
`python herramientas/fabric-horarios.py` en el repo de Fabric.

---

## Verificación hecha

| | |
|---|---|
| Pruebas | **118 pasan** (eran 115; +3 nuevas) |
| Build | limpio |
| Árbol de trabajo | vacío tras los tres commits |
| Tipado | 18 errores — **idéntico al baseline**, todos en `cuentas-ajustadas` |
| Lint | 17 avisos — **idéntico al baseline**, ninguno en lo tocado |
| Validado en localhost | sí, antes de subir |

Para ser exactos: `npm run lint` ya fallaba antes de esta tanda por
`--max-warnings 0`. No se arregló ni se empeoró.

---

## Lo que queda pendiente

**1 · El service principal de Fabric.** Mientras no exista en el tenant, el
botón Actualizar seguirá mostrando el aviso rojo aunque la pantalla se
actualice bien con lo del notebook. Es ruido que confunde a Control. Vale la
pena que el aviso distinga «Fabric no disponible, se usan los datos del
notebook» de un fallo de verdad.

**2 · Programar el notebook a las 06:10 (Caracas).** Se había perdido la
programación; por eso los datos llevaban desde el 19-oct sin moverse.

**3 · `exige_datos_frescos` sigue en `false`.** El aplicativo publica aunque
los datos sean viejos — que es lo que pasó: publicó octubre todos los días de
noviembre con datos del 29-oct. Con el notebook corriendo a diario, ponerlo en
`true` lo frenaría solo cuando el notebook no entregue. Es un cambio en la base,
no en código.

**4 · Esta tanda no está en productivo.** Los tres defectos existen allí igual,
porque es el mismo código. Van junto con el resto del paquete descrito en
[12 · Cambios para producción](12-cambios-para-produccion.md).
