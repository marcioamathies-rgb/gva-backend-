require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const { Server } = require('socket.io');

const { errorHandler, notFound } = require('./middleware/errorHandler');
const { initChatSocket } = require('./sockets/chat');

const app    = express();
const server = http.createServer(app);
const origin = process.env.CORS_ORIGIN || '*';

app.set('trust proxy', 1);
app.use(helmet());
app.use(cors({ origin, credentials: true }));

// Stripe webhook needs raw body — register before json parser
app.use('/api/stripe/webhook', express.raw({ type: 'application/json' }));
app.use(express.json({ limit: '10mb' }));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

app.get('/health', (req, res) =>
  res.json({ status: 'ok', service: 'GVA API v3', time: new Date().toISOString() })
);

app.use('/api/auth',    require('./routes/authRoutes'));
app.use('/api/members', require('./routes/memberRoutes'));
app.use('/api/chat',    require('./routes/chatRoutes'));
app.use('/api',         require('./routes/featureRoutes'));
app.use('/api',         require('./routes/extendedRoutes'));
app.use('/api/scholarships', require('./routes/scholarshipRoutes'));

app.use(notFound);
app.use(errorHandler);

const io = new Server(server, { cors: { origin, credentials: true } });
initChatSocket(io);

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => console.log(`GVA backend v3 on port ${PORT}`));

