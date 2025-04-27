const express = require('express');
const nodemailer = require('nodemailer');
const path = require('path');
require('dotenv').config();

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

const mercadopago = require('mercadopago');

mercadopago.configure({
  access_token: process.env.MERCADO_PAGO_ACCESS_TOKEN,
});

const app = express();
const PORT = process.env.PORT || 3000;

// --- Webhook do Stripe ---
app.post('/stripe-webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  console.log("📩 Webhook Stripe foi chamado!");

  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
  } catch (err) {
    console.error(`❌ Verificação do webhook Stripe falhou: ${err.message}`);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    console.log('✅ Stripe checkout session completed:', session.id);

    const customerEmail = session.customer_details?.email;
    const customerName = session.customer_details?.name || 'Cliente';

    if (!customerEmail) {
      console.error('❗ Email do cliente não encontrado na sessão Stripe:', session.id);
      return res.status(200).send('Customer email not found, cannot send ebook.');
    }

    console.log(`📧 Enviando eBook para: ${customerName} <${customerEmail}>`);

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      }
    });

    const mailOptions = {
      from: `"Sua Loja" <${process.env.EMAIL_USER}>`,
      to: customerEmail,
      subject: 'Seu eBook - Desperte Sua Melhor Versão',
      text: `Olá ${customerName},\n\nObrigado pela sua compra! Em anexo está o seu guia completo de emagrecimento.\n\nBoa leitura!`,
      attachments: [
        {
          filename: 'ebook.pdf',
          path: path.join(__dirname, 'public', 'ebook.pdf')
        }
      ]
    };

    try {
      await transporter.sendMail(mailOptions);
      console.log(`✅ Email enviado com sucesso para ${customerEmail}`);
    } catch (error) {
      console.error(`❌ Erro ao enviar e-mail para ${customerEmail}:`, error);
      return res.status(200).send('Webhook received, but failed to send email.');
    }
  } else {
    console.log(`⚠️ Evento Stripe não tratado: ${event.type}`);
  }

  res.status(200).send('Webhook Stripe recebido com sucesso.');
});

// --- Webhook do Mercado Pago ---
app.post('/mercado-webhook', express.json(), async (req, res) => {
  console.log("📩 Webhook Mercado Pago foi chamado!");

  const payment = req.body;

  if (payment.type === 'payment') {
    try {
      const data = await mercadopago.payment.findById(payment.data.id);

      if (data.body.status === 'approved') {
        const payerEmail = data.body.payer.email;
        const payerName = data.body.payer.first_name || 'Cliente';

        console.log(`📧 Enviando eBook para: ${payerName} <${payerEmail}>`);

        const transporter = nodemailer.createTransport({
          service: 'gmail',
          auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS,
          }
        });

        const mailOptions = {
          from: `"Sua Loja" <${process.env.EMAIL_USER}>`,
          to: payerEmail,
          subject: 'Seu eBook - Desperte Sua Melhor Versão',
          text: `Olá ${payerName},\n\nObrigado pela sua compra! Em anexo está o seu guia completo de emagrecimento.\n\nBoa leitura!`,
          attachments: [
            {
              filename: 'ebook.pdf',
              path: path.join(__dirname, 'public', 'ebook.pdf')
            }
          ]
        };

        await transporter.sendMail(mailOptions);
        console.log(`✅ Email enviado com sucesso para ${payerEmail}`);
      } else {
        console.log(`⚠️ Pagamento ainda não aprovado: Status ${data.body.status}`);
      }
    } catch (error) {
      console.error('❌ Erro ao processar pagamento Mercado Pago:', error);
    }
  }

  res.status(200).send('Webhook Mercado Pago recebido com sucesso.');
});

// --- Outros middlewares ---
app.use(express.static(path.join(__dirname)));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// --- Rotas principais ---
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/checkout', (req, res) => {
  res.sendFile(path.join(__dirname, 'checkout.html'));
});

app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando em http://localhost:${PORT}`);
  console.log('📌 Lembre-se de configurar as variáveis de ambiente:');
  console.log('EMAIL_USER, EMAIL_PASS, STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, MERCADO_PAGO_ACCESS_TOKEN');
});

module.exports = app;
