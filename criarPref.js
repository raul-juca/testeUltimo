const mercadopago = require('mercadopago');

// Cria o client de configuração
const client = new mercadopago.MercadoPagoConfig({
  accessToken: 'APP_USR-6599744255553570-042317-2990aa27931e63b75fb8da6f547db87e-276947219',
});

// Para criar uma preferência depois:
const preference = new mercadopago.Preference(client);

// Exemplo de criação de uma preferência
async function criarPreferencia() {
  try {
    const result = await preference.create({
      body: {
        items: [
          {
            title: 'Meu Produto',
            quantity: 1,
            unit_price: 100,
          },
        ],
      },
    });
    console.log('Preference criada:', result.id);
  } catch (error) {
    console.error('Erro ao criar preferência:', error);
  }
}

criarPreferencia();
