const id = valor => valor?._id?.toString?.() || valor?.toString?.() || '';

const calcularEdad = (fechaNacimiento, fechaReferencia = new Date()) => {
  if (!fechaNacimiento) return 0;
  const nacimiento = new Date(fechaNacimiento);
  const referencia = new Date(fechaReferencia);
  let edad = referencia.getFullYear() - nacimiento.getFullYear();
  const antesDelCumple = referencia.getMonth() < nacimiento.getMonth() ||
    (referencia.getMonth() === nacimiento.getMonth() && referencia.getDate() < nacimiento.getDate());
  if (antesDelCumple) edad--;
  return Number.isFinite(edad) && edad >= 0 ? edad : 0;
};

const crearAleatorio = (semilla = 20260722) => {
  let estado = semilla >>> 0;
  return () => {
    estado = (1664525 * estado + 1013904223) >>> 0;
    return estado / 4294967296;
  };
};

const mezclar = (valores, random) => {
  const copia = [...valores];
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia;
};

const gini = (positivos, total) => {
  if (!total) return 0;
  const p = positivos / total;
  return 1 - (p * p) - ((1 - p) * (1 - p));
};

const umbralesCandidatos = (valores, maximo = 10) => {
  const unicos = [...new Set(valores.filter(Number.isFinite))].sort((a, b) => a - b);
  if (unicos.length < 2) return [];
  if (unicos.length <= maximo + 1) {
    return unicos.slice(0, -1).map((valor, i) => (valor + unicos[i + 1]) / 2);
  }
  const umbrales = [];
  for (let i = 1; i <= maximo; i++) {
    const indice = Math.floor((i * (unicos.length - 1)) / (maximo + 1));
    const siguiente = Math.min(indice + 1, unicos.length - 1);
    umbrales.push((unicos[indice] + unicos[siguiente]) / 2);
  }
  return [...new Set(umbrales)];
};

const construirArbol = (X, y, indices, opciones, random, profundidad = 0) => {
  const positivos = indices.reduce((suma, indice) => suma + y[indice], 0);
  const probabilidad = (positivos + 1) / (indices.length + 2);
  if (
    profundidad >= opciones.profundidadMaxima ||
    indices.length < opciones.minimoDivision ||
    positivos === 0 || positivos === indices.length
  ) return { probabilidad, muestras: indices.length };

  const cantidadVariables = X[0]?.length || 0;
  const candidatas = mezclar(
    Array.from({ length: cantidadVariables }, (_, indice) => indice),
    random
  ).slice(0, Math.max(1, Math.ceil(Math.sqrt(cantidadVariables))));

  let mejor = null;
  for (const variable of candidatas) {
    const umbrales = umbralesCandidatos(indices.map(indice => X[indice][variable]));
    for (const umbral of umbrales) {
      const izquierda = [];
      const derecha = [];
      let positivosIzquierda = 0;
      let positivosDerecha = 0;
      for (const indice of indices) {
        if (X[indice][variable] <= umbral) {
          izquierda.push(indice);
          positivosIzquierda += y[indice];
        } else {
          derecha.push(indice);
          positivosDerecha += y[indice];
        }
      }
      if (izquierda.length < opciones.minimoHoja || derecha.length < opciones.minimoHoja) continue;
      const impureza = (izquierda.length / indices.length) * gini(positivosIzquierda, izquierda.length) +
        (derecha.length / indices.length) * gini(positivosDerecha, derecha.length);
      if (!mejor || impureza < mejor.impureza) {
        mejor = { variable, umbral, izquierda, derecha, impureza };
      }
    }
  }

  if (!mejor) return { probabilidad, muestras: indices.length };
  return {
    variable: mejor.variable,
    umbral: mejor.umbral,
    probabilidad,
    muestras: indices.length,
    izquierda: construirArbol(X, y, mejor.izquierda, opciones, random, profundidad + 1),
    derecha: construirArbol(X, y, mejor.derecha, opciones, random, profundidad + 1)
  };
};

const predecirArbol = (arbol, fila) => {
  let nodo = arbol;
  while (nodo.variable !== undefined) {
    nodo = fila[nodo.variable] <= nodo.umbral ? nodo.izquierda : nodo.derecha;
  }
  return nodo.probabilidad;
};

const construirEsquema = historicos => {
  const metodos = [...new Set(historicos.map(p => p.metodoPago || 'Sin definir'))].sort();
  const productos = [...new Set(historicos.flatMap(p =>
    (p.productos || []).map(item => id(item.producto)).filter(Boolean)
  ))].sort();
  return { metodos, productos };
};

const valoresProductos = pedido => {
  const cantidades = new Map();
  const precios = new Map();
  for (const item of pedido.productos || []) {
    const productoId = id(item.producto);
    if (!productoId) continue;
    cantidades.set(productoId, (cantidades.get(productoId) || 0) + (Number(item.cantidad) || 0));
    precios.set(productoId, Number(item.precio) || 0);
  }
  return { cantidades, precios };
};

const vectorizar = (pedido, esquema, tasaCanceladosPrevios) => {
  const { cantidades, precios } = valoresProductos(pedido);
  const fila = [
    calcularEdad(pedido.usuario?.fechaNacimiento, pedido.createdAt),
    Number(pedido.total) || 0,
    Number(pedido.costoEnvio) || 0,
    tasaCanceladosPrevios * 100
  ];
  for (const metodo of esquema.metodos) fila.push((pedido.metodoPago || 'Sin definir') === metodo ? 1 : 0);
  for (const productoId of esquema.productos) {
    fila.push(cantidades.get(productoId) || 0);
    fila.push(precios.get(productoId) || 0);
  }
  return fila;
};

const prepararDataset = historicos => {
  const ordenados = [...historicos].sort(
    (a, b) => new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime()
  );
  const esquema = construirEsquema(ordenados);
  const historialUsuarios = new Map();
  const X = [];
  const y = [];

  for (const pedido of ordenados) {
    const usuarioId = id(pedido.usuario);
    const historial = historialUsuarios.get(usuarioId) || { total: 0, cancelados: 0 };
    const tasaPrevia = historial.total ? historial.cancelados / historial.total : 0;
    X.push(vectorizar(pedido, esquema, tasaPrevia));
    y.push(pedido.estado === 'Cancelado' ? 1 : 0);
    historialUsuarios.set(usuarioId, {
      total: historial.total + 1,
      cancelados: historial.cancelados + (pedido.estado === 'Cancelado' ? 1 : 0)
    });
  }
  return { X, y, esquema, historialUsuarios };
};

const entrenarRandomForest = (historicos, configuracion = {}) => {
  if (!historicos.length) throw new Error('No hay pedidos históricos para entrenar el Random Forest');
  const dataset = prepararDataset(historicos);
  const opciones = {
    arboles: configuracion.arboles || 31,
    profundidadMaxima: configuracion.profundidadMaxima || 9,
    minimoDivision: configuracion.minimoDivision || 24,
    minimoHoja: configuracion.minimoHoja || 10
  };
  const random = crearAleatorio(configuracion.semilla || 20260722);
  const indicesBase = Array.from({ length: dataset.X.length }, (_, indice) => indice);
  const arboles = [];
  for (let i = 0; i < opciones.arboles; i++) {
    const muestraBootstrap = Array.from(
      { length: indicesBase.length },
      () => indicesBase[Math.floor(random() * indicesBase.length)]
    );
    arboles.push(construirArbol(dataset.X, dataset.y, muestraBootstrap, opciones, random));
  }
  return { ...dataset, arboles, opciones, entrenadoCon: historicos.length };
};

const predecirRandomForest = (modelo, pedido) => {
  const historial = modelo.historialUsuarios.get(id(pedido.usuario)) || { total: 0, cancelados: 0 };
  const tasaPrevia = historial.total ? historial.cancelados / historial.total : 0;
  const fila = vectorizar(pedido, modelo.esquema, tasaPrevia);
  const probabilidad = modelo.arboles.reduce((suma, arbol) => suma + predecirArbol(arbol, fila), 0) /
    modelo.arboles.length;
  return {
    probabilidad,
    historial,
    tasaPrevia,
    tasaCancelacionPrevia: tasaPrevia,
    arbolesUsados: modelo.arboles.length
  };
};

module.exports = { entrenarRandomForest, predecirRandomForest };
