# PROYECTO INTEGRADOR: DISTRIBUIDORA PANAMERICANA
## Sistema Web e-Commerce con Analítica Predictiva de Cancelaciones y Recomendación Colaborativa

### 🌐 URL del Sistema Web Publicado (Producción en la Nube)
**[https://pry-bina-front.vercel.app/](https://pry-bina-front.vercel.app/)**

---

### 👥 Integrantes
* **Oscar David Dela Cruz Hernández** (Desarrollo Web & Ciencia de Datos)

---

### 📋 Descripción General
Este proyecto integrador transforma la operación comercial de **Distribuidora Panamericana** mediante la implementación de un sistema e-commerce desacoplado (**Angular 17+** desplegado en Vercel + **Node.js/Express** + **MongoDB**) con dos soluciones analíticas de Machine Learning integradas en tiempo real:

1. **Solución 1 (Clasificación Supervisada)**: Modelo **Random Forest Classifier** que predice el riesgo de cancelación de pedidos (`Accuracy: 76.5%`, `Precisión: 88.1%`, `PR-AUC: 91.5%` con `K-Fold = 5`).
2. **Solución 2 (Filtrado Colaborativo Ítem-Ítem)**: Algoritmo de **Similitud Coseno por Coocurrencia** que recomienda los 6 productos con mayor afinidad en el carrito de compras en menos de 15 ms.

---

### 📂 Estructura del Entregable ZIP

```text
/
├── README.md                                # Guía principal e instrucciones de prueba
├── URL_Sistema.txt                          # Enlace oficial al sistema en producción
├── 01_Reporte/                              # Reporte escrito completo en formato Markdown
├── 02_Base_Datos/                           # Volcado completo JSON y respaldo de MongoDB
├── 03_Datos_Sinteticos/                     # Script de generación de datos reproducibles
├── 04_ETL/                                  # Scripts de extracción, transformación y limpieza
├── 05_Datasets/                             # CSVs finales (Clasificación, Recomendación y Productos)
├── 06_Notebooks/                            # Libretas Jupyter (.ipynb) ejecutadas sin errores
├── 07_Modelos/                              # Artefacto serializado (.joblib)
├── 08_Aplicacion_Web/                       # Código fuente Backend (Node.js) y Frontend (Angular)
└── 09_Evidencias/                           # Capturas y documentación de pruebas
```

---

### 🧪 Prueba de las Soluciones Analíticas en Producción (Vercel)

Acceda a **[https://pry-bina-front.vercel.app/](https://pry-bina-front.vercel.app/)**:

1. **Prueba de Recomendación de Productos (Venta Cruzada)**:
   * Navegue por la tienda y seleccione cualquier producto (ej. *"4X4 oferta combo barber de 5 pz"*).
   * Al final de la página observará el bloque **"Productos recomendados"** con las 6 sugerencias calculadas por Similitud Coseno.
   * Agregue productos al carrito e ingrese a `https://pry-bina-front.vercel.app/carrito` para visualizar la sección **"Completa tu compra"**.

2. **Prueba de Clasificación del Riesgo de Cancelación (Panel Admin)**:
   * Inicie sesión con credenciales administrativas (`admin@panamericana.com` / `admin123`).
   * Acceda al módulo de **Gestión de Pedidos (`/admin/pedidos`)**.
   * Verifique las insignias predictivas de riesgo (**Riesgo Alto 🔴**, **Riesgo Medio 🟡**, **Riesgo Bajo 🟢**) asignadas dinámicamente a cada pedido.

---

### 🚀 Ejecución y Prueba Local Alternativa

Si desea ejecutar el proyecto en un entorno local desacoplado:

#### 1. Restaurar Base de Datos MongoDB y Generar Datasets
```bash
# Instalar dependencias del backend
npm install

# Generar 8,000 pedidos y 450 usuarios sintéticos reproducibles en MongoDB
node generar_dataset_optimo.js

# Exportar volcado de respaldo en formato JSON
node exportar_respaldo_sintetico.js
```

#### 2. Ejecutar Libretas de Ciencia de Datos (Jupyter Notebooks)
Abra y ejecute las libretas en la carpeta `06_Notebooks/`:
* `01_clasificacion_riesgo_cancelacion.ipynb`: Entrena y exporta `modelo_random_forest_cancelacion.joblib`.
* `02_recomendacion_colaborativa_item_item.ipynb`: Construye y prueba la matriz de Similitud Coseno.

#### 3. Iniciar Servidores Locales
```bash
# Iniciar servidor Node.js API (Backend)
npm run dev

# Iniciar servidor Angular SPA (Frontend en pryBinaFront/)
ng serve
```
