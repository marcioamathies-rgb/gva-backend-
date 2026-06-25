const { verifyAccessToken } = require('../utils/jwt');
const pool = require('../config/db');

const ROOM = 'gva-community';

function initChatSocket(io) {
  // Authenticate the socket connection using the same JWT issued at login.
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error('Authentication required.'));

      const payload = verifyAccessToken(token);
      const { rows } = await pool.query(
        `SELECT u.id, u.role, u.status, mem.full_name, mem.profile_photo_url
         FROM users u LEFT JOIN members mem ON mem.user_id = u.id
         WHERE u.id = $1`,
        [payload.sub]
      );
      if (!rows.length) return next(new Error('Account no longer exists.'));

      const user = rows[0];
      if (user.role === 'member' && user.status !== 'active') {
        return next(new Error('Your membership is not active.'));
      }

      socket.user = user;
      next();
    } catch (err) {
      next(new Error('Invalid or expired session.'));
    }
  });

  io.on('connection', (socket) => {
    socket.join(ROOM);
    io.to(ROOM).emit('presence:online', { userId: socket.user.id, name: socket.user.full_name });

    socket.on('message:send', async (payload, ack) => {
      try {
        const { content, attachmentUrl, replyToId } = payload || {};
        if (!content || !content.trim()) {
          return ack && ack({ error: 'Message cannot be empty.' });
        }
        if (content.length > 2000) {
          return ack && ack({ error: 'Message is too long.' });
        }

        const [{ rows: roomRows }, { rows: muteRows }] = await Promise.all([
          pool.query('SELECT locked FROM chat_room_state WHERE room = $1', [ROOM]),
          pool.query(
            `SELECT 1 FROM chat_mutes
             WHERE user_id = $1 AND (muted_until IS NULL OR muted_until > now())
             ORDER BY created_at DESC LIMIT 1`,
            [socket.user.id]
          ),
        ]);

        const isStaff = socket.user.role === 'super_admin' || socket.user.role === 'moderator';
        if (roomRows[0]?.locked && !isStaff) {
          return ack && ack({ error: 'Chat is currently locked by a moderator.' });
        }
        if (muteRows.length && !isStaff) {
          return ack && ack({ error: 'You are currently muted.' });
        }

        const { rows } = await pool.query(
          `INSERT INTO chat_messages (room, user_id, content, attachment_url, reply_to_id)
           VALUES ($1, $2, $3, $4, $5)
           RETURNING id, content, attachment_url, reply_to_id, pinned, created_at`,
          [ROOM, socket.user.id, content.trim(), attachmentUrl || null, replyToId || null]
        );

        const message = {
          ...rows[0],
          user_id: socket.user.id,
          role: socket.user.role,
          full_name: socket.user.full_name,
          profile_photo_url: socket.user.profile_photo_url,
        };

        io.to(ROOM).emit('message:new', message);
        ack && ack({ success: true, message });
      } catch (err) {
        console.error('chat send error:', err);
        ack && ack({ error: 'Could not send message. Please try again.' });
      }
    });

    socket.on('message:pin', async ({ messageId, pinned }, ack) => {
      try {
        const isStaff = socket.user.role === 'super_admin' || socket.user.role === 'moderator';
        if (!isStaff) return ack && ack({ error: 'Only staff can pin messages.' });

        await pool.query('UPDATE chat_messages SET pinned = $1 WHERE id = $2', [!!pinned, messageId]);
        io.to(ROOM).emit('message:pinned', { messageId, pinned: !!pinned });
        ack && ack({ success: true });
      } catch (err) {
        ack && ack({ error: 'Could not update pin.' });
      }
    });

    socket.on('typing', () => {
      socket.to(ROOM).emit('typing', { userId: socket.user.id, name: socket.user.full_name });
    });

    socket.on('disconnect', () => {
      io.to(ROOM).emit('presence:offline', { userId: socket.user.id });
    });
  });
}

module.exports = { initChatSocket };
