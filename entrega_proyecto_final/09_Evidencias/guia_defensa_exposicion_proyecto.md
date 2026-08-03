# 🎓 GUÍA DE DEFENSA Y EXPOSICIÓN EN VIVO - PROYECTO INTEGRADOR

---

## 👥 1. División Estratégica de Roles

Para mostrar una coordinación perfecta entre el equipo:

* **Integrante A (Presentador de Negocio y Arquitectura Web)**:
  * Explica el contexto de la empresa, el problema, los objetivos y demuestra el sistema web en producción en Vercel y la base de datos.
* **Integrante B (Científico de Datos y Explicación de Libretas)**:
  * Explica la preparación de datos, los algoritmos, las métricas exactas, la reproducibilidad y el análisis de errores.

*(Ambos integrantes deben conocer el flujo completo en caso de preguntas cruzadas).*

---

## ⏱️ 2. Guión de Exposición Paso a Paso (Los 4 Momentos de la Exposición)

### MOMENTO 1: Introducción y Contexto del Negocio (2 minutos)

> **Integrante A:**  
> *"Buenos días profesores. Nuestro proyecto integrador fue desarrollado para la empresa **Distribuidora Panamericana**, un e-commerce y comercializadora de productos de belleza, cosmética y herramientas profesionales de barbería.*  
>  
> *La empresa cuenta con 4 colaboradores (1 Administrador, 2 Cajeros y 1 Almacenista). Antes operaban con libretas manuales, lo que causaba descuadres y cancelaciones no gestionadas. Desarrollamos un sistema web completo en **Angular 17+ y Node.js con MongoDB**, e integramos **dos soluciones analíticas de Machine Learning distintas en producción** para resolver dos problemas clave del negocio."*

---

### MOMENTO 2: Demostración de Reproducibilidad (3 minutos)
*(Los profesores pedirán verificar cómo se generaron los datos y si el código es reproducible).*

> **Integrante B:**  
> *"Para garantizar la reproducibilidad total exigida por el proyecto, construimos el script `generar_dataset_optimo.js` en Node.js.  
>  
> Dado que la empresa no contaba con un histórico digitalizado de más de 2,000 ventas previas, el script genera **8,000 pedidos transaccionales en MongoDB** y **450 usuarios únicos** utilizando el algoritmo Mulberry32 inicializado con una **semilla fija (`SEMILLA = 20260801`)**.  
>  
> Esto garantiza que cualquier persona que ejecute `node generar_dataset_optimo.js` obtendrá exactamente los mismos datasets `.csv` y las mismas métricas en las libretas, sin datos inventados o escritos directamente en código."*

---

### MOMENTO 3: Solución 1 - Clasificación de Riesgo de Cancelación (5 minutos)

#### Explicación de Negocio e Integración Web
> **Integrante A (mostrando el sistema web en https://pry-bina-front.vercel.app/):**  
> *"La Solución 1 atiende la **Clasificación del Riesgo de Cancelación** antes de empaquetar o enviar un pedido.  
>  
> En el módulo de administración (`/admin/pedidos`), el sistema no le pide variables codificadas al usuario; calcula automáticamente la edad del cliente, su porcentaje de cancelaciones previas y proporciones de flete.  
>  
> **Caso de Prueba 1**: En este pedido (`ID: 9d0c4d`), el cliente seleccionó PayPal pero el pago quedó en estado 'Pendiente'. El modelo ejecutó la predicción en tiempo real y asignó una insignia visual **`51% - Riesgo Medio`**.  
>  
> **Caso de Prueba 2**: En un pedido mayorista pagado en efectivo de un cliente con historial previo de cancelación >40%, el modelo asigna **`82% - Riesgo Alto`**. Esto permite al administrador solicitar un anticipo del flete antes de inmovilizar inventario en almacén."*

#### Justificación Técnica y Métricas Exactas
> **Integrante B (mostrando la libreta `01_clasificacion_riesgo_cancelacion.ipynb`):**  
> *"La unidad de análisis es **un pedido de compra individual**. La variable objetivo es `clase_y` ($1 = \text{Cancelado}, 0 = \text{Entregado}$).  
>  
> **Prevención de Fuga de Datos (*Data Leakage*)**: Eliminamos variables posteriores como `fechaCancelacion` o `pago.estado`. El porcentaje de cancelaciones previas se calcula de forma estrictamente cronológica (`createdAt < fecha_actual`).  
>  
> Entrenamos un algoritmo **Random Forest Classifier** (300 árboles, `class_weight='balanced'`) evaluado mediante **Validación Cruzada Estratificada (K-Fold = 5)**. Obtuvimos las siguientes métricas promedio:
> * **Accuracy**: **76.5% ± 0.5%** (Superando el requisito del 75%).
> * **Precisión**: **88.1%** (De cada 100 alertas de cancelación, 88 son reales).
> * **Recall**: **74.7%** (Capturamos el 74.7% de todas las cancelaciones).
> * **PR-AUC**: **91.5%** (Área bajo la curva Precisión-Recall cercana al óptimo).  
>  
> **Costo del Error**: En nuestro negocio, un **Falso Negativo** (no detectar una cancelación) es el error más costoso (\$150 a \$300 MXN en flete y empaque fallido), mientras que un **Falso Positivo** solo implica una llamada de confirmación de \$5 MXN. Por ello optimizamos para maximizar el PR-AUC y la Precisión."*

---

### MOMENTO 4: Solución 2 - Recomendación Ítem-Ítem (4 minutos)

#### Explicación de Negocio e Integración Web
> **Integrante A (mostrando la tienda web en Vercel):**  
> *"La Solución 2 aborda la **Venta Cruzada (*Cross-Selling*)** para elevar el ticket promedio de compra.  
>  
> **Caso de Prueba 1 (Detalle de Producto)**: Al consultar la ficha del *'Combo Barber 4x4'*, el backend consulta el endpoint `/api/productos/recomendaciones` y despliega 6 tarjetas en la sección 'Productos recomendados' (Gel de afeitar 4x4, Tijera Aashta, Máquina Platino, etc.).  
>  
> **Caso de Prueba 2 (Carrito de Compras)**: Al tener 4 productos en la cesta, el sistema analiza las 4 semillas en conjunto y muestra en la sección 'Completa tu compra' 6 sugerencias variadas (Pomada 4x4, Alicate Manicure, Tintes Alfaparf) respondiendo en menos de **15 milisegundos**."*

#### Justificación Técnica y Métricas
> **Integrante B (mostrando la libreta `02_recomendacion_colaborativa_item_item.ipynb`):**  
> *"La unidad de análisis es **una interacción de presencia de un producto en un pedido entregado**. Evaluamos **2,696 canastas de compra entregadas** y **6,382 pares de coocurrencia**.  
>  
> No utilizamos Accuracy porque no es un problema de clasificación supervisada. Aplicamos **Filtrado Colaborativo Ítem-Ítem con Similitud Coseno por Coocurrencia**:  
>  
> $$\text{Similitud}(A, B) = \frac{\text{Coocurrencias}(A, B)}{\sqrt{\text{Frecuencia}(A) \times \text{Frecuencia}(B)}}$$  
>  
> **Mecanismo de Respaldo (*Cold-Start*)**: Si un carrito está vacío o un producto es nuevo sin compras registradas, el sistema aplica un fallback jerárquico sugiriendo productos de la misma **Familia**, luego de la misma **Marca** y finalmente por **Popularidad Global**.  
>  
> Devuelve exactamente 6 productos porque es la cantidad óptima para el diseño de carrusel visual en la tienda web sin saturar al usuario."*

---

## ❓ 3. Preguntas Trampa de los Evaluadores y Respuestas Exactas

### ❓ Pregunta 1: *"¿Cómo sé que el sistema web no tiene las respuestas 'escritas a mano' (hardcodeadas) en el código?"*
* **Respuesta Exacta**:  
  *"Profesor, el artefacto del modelo se guarda como un archivo binario `.joblib` en `pryBinaBack/modelo_random_forest_cancelacion.joblib`. El servicio de Node.js `randomForestCancelacionService.js` carga ese archivo y ejecuta la función `predict_proba` dinámicamente con las entradas enviadas por la base de datos de MongoDB. No hay ningún valor fijo en el código; si cambia los datos del pedido en MongoDB, la probabilidad calculada cambia instantáneamente."*

---

### ❓ Pregunta 2: *"¿Por qué usaron datos sintéticos y cómo demuestran que no son datos inventados sin sentido?"*
* **Respuesta Exacta**:  
  *"Utilizamos datos sintéticos porque la empresa operaba en libretas físicas y no contaba con 2,000 registros digitales previos. No son datos inventados porque se generaron mediante el script `generar_dataset_optimo.js` con reglas de negocio reales (mayor tasa de cancelación en pagos en efectivo de madrugada, sensibilidad al costo de envío y tasa de arrepentimiento según la antigüedad de la cuenta) e inicializado con una semilla fija (`SEMILLA = 20260801`) que garantiza la reproducibilidad exacta del 100% del dataset."*

---

### ❓ Pregunta 3: *"¿Cómo evitan la Fuga de Datos (Data Leakage) en la clasificación?"*
* **Respuesta Exacta**:  
  *"Garantizamos la prevención de fuga de datos en dos niveles:  
  1. Excluimos todas las columnas posteriores a la compra como `fechaCancelacion`, `motivoCancelacion` o `pago.estado`.  
  2. En las variables calculadas como `porcentaje_cancelados_previos`, ordenamos las transacciones cronológicamente (`createdAt 1`) para asegurar que el historial del cliente solo consulte compras pasadas y nunca información del futuro."*

---

### ❓ Pregunta 4: *"¿Por qué en la Solución 2 de recomendación no presentan una Matriz de Confusión ni Accuracy?"*
* **Respuesta Exacta**:  
  *"Porque el Filtrado Colaborativo Ítem-Ítem es una técnica no supervisada basada en canastas de compra, no una clasificación supervisada con etiquetas verdaderas/falsas. Medir Accuracy no es matemáticamente pertinente. En su lugar, evaluamos la calidad mediante la **Cobertura del Catálogo (300 SKUs)**, la **Matriz Coseno de 6,382 pares**, el **Mapa de Calor** y la **validación cualitativa de coherencia comercial** (ej. comprobar que a un tinte le recomiende peróxido/brocha y a una trimmer le sugiera enfriador/cuchillas)."*

---

### ❓ Pregunta 5: *"¿Qué sucede si llega un usuario nuevo que nunca ha comprado nada? (Problema de Cold-Start)"*
* **Respuesta Exacta**:  
  *"En la clasificación, el backend imputa automáticamente valores neutros de cliente nuevo (`porcentaje_cancelados_previos = 0.0%`, `dias_desde_ultimo_pedido = 999`). En la recomendación, se activa un fallback jerárquico: se sugieren productos más vendidos de la misma **Familia**, luego de la misma **Marca**, o por **Popularidad Global** si la cesta está totalmente vacía."*

---

## 📊 4. Tarjeta de Repaso Rápido (Cheat Sheet de Números Clave)

```text
┌─────────────────────────────────────────────────────────────────────────┐
│                      DATOS CLAVE DEL PROYECTO                           │
├─────────────────────────────────────────────────────────────────────────┤
│ • Base de Datos: 8,000 pedidos, 450 usuarios, 300 productos en MongoDB  │
│ • Datasets Finales: 3,000 pedidos en Clasificación / 2,696 en Recomendación│
│ • Semilla Fija Script Sintético: SEMILLA = 20260801                     │
│ • Semilla Fija en Python: random_state = 42                             │
│ • URL Pública Web: https://pry-bina-front.vercel.app/                   │
├─────────────────────────────────────────────────────────────────────────┤
│                MÉTRICAS EXACTAS SOLUCIÓN 1 (Random Forest)              │
├─────────────────────────────────────────────────────────────────────────┤
│ • Accuracy Promedio (K-Fold = 5): 76.5% ± 0.5% (Requisito >75% CUMPLIDO) │
│ • Balanced Accuracy: 77.4%                                              │
│ • Precisión: 88.1%                                                      │
│ • Recall: 74.7%                                                         │
│ • F1-Score: 80.8%                                                       │
│ • PR-AUC: 91.5%                                                         │
├─────────────────────────────────────────────────────────────────────────┤
│                MÉTRICAS EXACTAS SOLUCIÓN 2 (Recomendación)              │
├─────────────────────────────────────────────────────────────────────────┤
│ • Técnica: Similitud Coseno por Coocurrencia (Ítem-Ítem)                │
│ • Pares con Coocurrencia: 6,382 relaciones                              │
│ • Recomendaciones Devueltas: 6 productos por carrusel                   │
│ • Tiempo de Respuesta API: < 15 milisegundos                            │
└─────────────────────────────────────────────────────────────────────────┘
```
