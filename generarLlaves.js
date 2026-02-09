const crypto = require('crypto');

// Generamos el par de llaves
const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: {
    type: 'spki',
    format: 'pem'
  },
  privateKeyEncoding: {
    type: 'pkcs8',
    format: 'pem'
  }
});

// Convertimos los saltos de línea reales a \n literal para que sea fácil de copiar al .env o Render
const privateKeyOneLine = privateKey.replace(/\n/g, '\\n');
const publicKeyOneLine = publicKey.replace(/\n/g, '\\n');

console.log("=== COPIA ESTO EN RENDER (PRIVATE_KEY) ===");
console.log(privateKeyOneLine);
console.log("\n");
console.log("=== COPIA ESTO EN RENDER (PUBLIC_KEY) ===");
console.log(publicKeyOneLine);