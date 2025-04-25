const express = require('express');
const nodemailer = require('nodemailer');
const path = require('path');
require('dotenv').config();

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY); 
const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

const app = express();
const PORT = process.env.PORT || 3000;

// --- Webhook precisa vir antes dos middlewares que processam JSON ---
app.post('/stripe-webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  console.log("📩 Webhook foi chamado!");

  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
  } catch (err) {
    console.error(`❌ Verificação do webhook falhou: ${err.message}`);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    console.log('✅ Checkout session completed:', session.id);

    const customerEmail = session.customer_details?.email;
    const customerName = session.customer_details?.name || 'Cliente';

    //const customerEmail = 'raulsampaiocouto@gmail.com'; // <- seu email real
    //const customerName = 'Raul (Teste)';//
     

    if (!customerEmail) {
      console.error('❗ Email do cliente não encontrado na sessão:', session.id);
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
    console.log(`⚠️ Evento não tratado: ${event.type}`);
  }

  res.status(200).send('Webhook received successfully.');
});

// --- Outros middlewares (devem vir depois do webhook) ---
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
  console.log('EMAIL_USER, EMAIL_PASS, STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET');
});

module.exports = app;
