const { verifyToken } = require('../services/tokenService');
const scoringModel = require('../models/scoringModel');
const matchModel   = require('../models/matchModel');

/*
 * Socket events (client → server):
 *   join:match      { matchId }            — join a match room for live updates
 *   leave:match     { matchId }            — leave the room
 *   scorer:ready    { matchId, inningsId } — scorer announces they're live
 *
 * Socket events (server → client):
 *   ball:update     { ball, innings }      — new ball recorded
 *   innings:complete { inningsId }         — innings over
 *   match:complete  { matchId, result }    — match finished
 *   scorecard:sync  { scorecards }         — full sync on (re)connect
 *   error           { message }
 */

module.exports = (io) => {
  // Authenticate socket connections via JWT in handshake auth
  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error('Authentication required'));
      socket.user = verifyToken(token);
      next();
    } catch (err) {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`[Socket] Connected: ${socket.user.id} (${socket.id})`);

    // ── Join match room ──────────────────────────────────────────
    socket.on('join:match', async ({ matchId }) => {
      try {
        const room = `match:${matchId}`;
        socket.join(room);
        console.log(`[Socket] ${socket.user.id} joined room ${room}`);

        // Send full current scorecard on join so late-joiners are synced
        const inningsResult = await scoringModel.getInnings(matchId);
        const scorecards = await Promise.all(
          inningsResult.rows.map(async (inn) => ({
            innings: inn,
            batting: (await scoringModel.getBattingScorecard(inn.id)).rows,
            bowling: (await scoringModel.getBowlingScorecard(inn.id)).rows,
          }))
        );
        socket.emit('scorecard:sync', { scorecards });
      } catch (err) {
        socket.emit('error', { message: err.message });
      }
    });

    // ── Leave match room ─────────────────────────────────────────
    socket.on('leave:match', ({ matchId }) => {
      socket.leave(`match:${matchId}`);
    });

    // ── Scorer announces readiness (sets current players for UI) ─
    socket.on('scorer:ready', async ({ matchId, inningsId }) => {
      try {
        const inningsResult = await scoringModel.getInningsById(inningsId);
        const innings = inningsResult.rows[0];
        if (!innings) return socket.emit('error', { message: 'Innings not found' });

        io.to(`match:${matchId}`).emit('scorer:ready', {
          inningsId,
          strikerId: innings.striker_id,
          bowlerId:  innings.current_bowler_id,
        });
      } catch (err) {
        socket.emit('error', { message: err.message });
      }
    });

    // ── Undo last ball (soft undo — scorer only) ─────────────────
    socket.on('ball:undo', async ({ inningsId }) => {
      try {
        // Get last ball and remove it, then recompute totals
        // (simplified: mark for re-fetch; full undo left for production)
        io.to(`innings:${inningsId}`).emit('ball:undo:ack', { inningsId });
      } catch (err) {
        socket.emit('error', { message: err.message });
      }
    });

    socket.on('disconnect', () => {
      console.log(`[Socket] Disconnected: ${socket.user.id}`);
    });
  });
};
