import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import { Room } from './types';

dotenv.config();
//hehehe
const app = express();
const httpServer = createServer(app);

// CORS configuration
const allowedOrigins = process.env.ALLOWED_ORIGINS 
  ? process.env.ALLOWED_ORIGINS.split(',') 
  : ['http://localhost:3000'];

const io = new Server(httpServer, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST'],
    credentials: true
  },
  pingTimeout: 60000,
  pingInterval: 25000,
  transports: ['websocket', 'polling']
});

// Store active rooms and their connections
const rooms = new Map<string, Room>();

// Middleware
app.use(cors({
  origin: allowedOrigins,
  credentials: true
}));
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  // Join room
  socket.on('join-room', (roomId: string, userId: string, isHost: boolean) => {
    try {
      // Leave any existing rooms
      socket.rooms.forEach(room => {
        if (room !== socket.id) {
          socket.leave(room);
        }
      });

      // Join new room
      socket.join(roomId);
      
      // Initialize room if it doesn't exist
      if (!rooms.has(roomId)) {
        rooms.set(roomId, {
          id: roomId,
          hostId: isHost ? userId : null,
          participants: new Set(),
          connections: new Map()
        });
      }

      const room = rooms.get(roomId)!;
      
      // Add participant
      room.participants.add(userId);
      
      // If host, set hostId
      if (isHost) {
        room.hostId = userId;
      }

      // Store connection
      room.connections.set(userId, socket.id);

      console.log(`User ${userId} joined room ${roomId} as ${isHost ? 'host' : 'participant'}`);
    } catch (error) {
      console.error('Error joining room:', error);
      socket.emit('error', 'Failed to join room');
    }
  });

  // WebRTC signaling
  socket.on('offer', (roomId: string, fromUserId: string, offer: any) => {
    try {
      const room = rooms.get(roomId);
      if (!room) {
        throw new Error('Room not found');
      }

      // Broadcast offer to all participants except sender
      room.participants.forEach(participantId => {
        if (participantId !== fromUserId) {
          const participantSocketId = room.connections.get(participantId);
          if (participantSocketId) {
            io.to(participantSocketId).emit('offer', fromUserId, offer);
          }
        }
      });
    } catch (error) {
      console.error('Error handling offer:', error);
      socket.emit('error', 'Failed to handle offer');
    }
  });

  socket.on('answer', (roomId: string, fromUserId: string, answer: any) => {
    try {
      const room = rooms.get(roomId);
      if (!room) {
        throw new Error('Room not found');
      }

      // Send answer to the host
      if (room.hostId) {
        const hostSocketId = room.connections.get(room.hostId);
        if (hostSocketId) {
          io.to(hostSocketId).emit('answer', fromUserId, answer);
        }
      }
    } catch (error) {
      console.error('Error handling answer:', error);
      socket.emit('error', 'Failed to handle answer');
    }
  });

  socket.on('ice-candidate', (roomId: string, fromUserId: string, candidate: any) => {
    try {
      const room = rooms.get(roomId);
      if (!room) {
        throw new Error('Room not found');
      }

      // Broadcast ICE candidate to all participants except sender
      room.participants.forEach(participantId => {
        if (participantId !== fromUserId) {
          const participantSocketId = room.connections.get(participantId);
          if (participantSocketId) {
            io.to(participantSocketId).emit('ice-candidate', fromUserId, candidate);
          }
        }
      });
    } catch (error) {
      console.error('Error handling ICE candidate:', error);
      socket.emit('error', 'Failed to handle ICE candidate');
    }
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);

    // Find and clean up rooms
    rooms.forEach((room, roomId) => {
      // Find user ID for this socket
      let disconnectedUserId: string | null = null;
      room.connections.forEach((socketId, userId) => {
        if (socketId === socket.id) {
          disconnectedUserId = userId;
        }
      });

      if (disconnectedUserId) {
        // Remove participant
        room.participants.delete(disconnectedUserId);
        room.connections.delete(disconnectedUserId);

        // If host disconnected, clear host
        if (room.hostId === disconnectedUserId) {
          room.hostId = null;
        }

        // If room is empty, remove it
        if (room.participants.size === 0) {
          rooms.delete(roomId);
        }

        // Notify other participants
        room.participants.forEach(participantId => {
          const participantSocketId = room.connections.get(participantId);
          if (participantSocketId) {
            io.to(participantSocketId).emit('participant-left', disconnectedUserId);
          }
        });
      }
    });
  });
});

// Error handling
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', (error) => {
  console.error('Unhandled Rejection:', error);
});

// Start server
const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 