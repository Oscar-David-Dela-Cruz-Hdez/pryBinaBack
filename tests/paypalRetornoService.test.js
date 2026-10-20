const test = require('node:test');
const assert = require('node:assert/strict');
const { retornoFlutter } = require('../services/paypalRetornoService');

const state = '12345678-1234-1234-1234-123456789abc';
const request = (url) => ({ body: { canal: 'flutter', returnUrl: url } });

test('Angular no cambia su retorno SDK', () => {
  assert.equal(retornoFlutter({ body: {} }), undefined);
});

test('móvil conserva las rutas interceptadas en la app', () => {
  const result = retornoFlutter({ body: { canal: 'flutter' } });
  assert.ok(result.returnUrl.endsWith('/api/pagos/paypal/retorno'));
  assert.ok(result.cancelUrl.endsWith('/api/pagos/paypal/cancelado'));
});

test('localhost conserva el estado y añade cancelación sin copiar parámetros', () => {
  const result = retornoFlutter(request(`http://localhost:8080/paypal_return.html?state=${state}&token=falso`));
  const returned = new URL(result.returnUrl);
  assert.equal(returned.searchParams.get('state'), state);
  assert.equal(returned.searchParams.has('token'), false);
  assert.equal(new URL(result.cancelUrl).searchParams.get('cancelled'), '1');
});

test('rechaza dominios ajenos, esquemas inválidos y estado ausente', () => {
  for (const url of [
    `https://sitio-no-permitido.invalid/paypal_return.html?state=${state}`,
    `javascript:alert(1)`,
    'http://localhost:8080/paypal_return.html',
    `http://localhost:8080/otra-ruta.html?state=${state}`,
  ]) {
    assert.throws(() => retornoFlutter(request(url)), { status: 400 });
  }
});

test('acepta el sitio HTTPS configurado, incluyendo despliegues en subruta', () => {
  const previous = process.env.PAYPAL_FLUTTER_ORIGINS;
  process.env.PAYPAL_FLUTTER_ORIGINS = 'https://tienda.example';
  try {
    const result = retornoFlutter(request(`https://tienda.example/app/paypal_return.html?state=${state}`));
    assert.equal(new URL(result.returnUrl).pathname, '/app/paypal_return.html');
    assert.throws(() => retornoFlutter(request(`https://tienda.example.evil.invalid/paypal_return.html?state=${state}`)), { status: 400 });
  } finally {
    if (previous === undefined) delete process.env.PAYPAL_FLUTTER_ORIGINS;
    else process.env.PAYPAL_FLUTTER_ORIGINS = previous;
  }
});
