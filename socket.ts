import { Server } from 'socket.io';
import { createServer } from 'http';
import { parse } from 'url';
import next from 'next';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load environment variables
config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Get the project root directory (two levels up from the server directory)
const projectRoot = join(__dirname, '..');

const dev = process.env.NODE_ENV !== 'production';
const app = next({ 
  dev,
  dir: projectRoot,
  conf: {
    distDir: join(projectRoot, '.next'),
    experimental: {
      serverComponentsExternalPackages: ['socket.io']
    }
  }
});

const handle = app.getRequestHandler();

interface RoomParticipant {
  userId: string;
  isHost: boolean;
}

interface Room {
  id: string;
  hostId: string | null;
  participants: Set<string>;
  connections: Map<string, string>;
}

interface ChatMessage {
  id: string;
  content: string;
  timestamp: string;
  user: {
    id: string;
    username: string;
    avatar_url: string | null;
  };
}

// Initialize Next.js app
app.prepare().then(() => {
  const server = createServer((req, res) => {
    const parsedUrl = parse(req.url!, true);
    handle(req, res, parsedUrl);
  });

  const io = new Server(server, {
    cors: {
      origin: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
      methods: ['GET', 'POST']
    }
  });

  // Store active rooms and their participants
  const rooms = new Map<string, Room>();

  io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);
    const socketType = socket.handshake.query.type;

    // Join room
    socket.on('join-room', (roomId: string, userId: string, isHost: boolean) => {
      try {
        socket.join(roomId);
        
        if (!rooms.has(roomId)) {
          rooms.set(roomId, {
            id: roomId,
            hostId: isHost ? userId : null,
            participants: new Set(),
            connections: new Map()
          });
        }
        rooms.get(roomId)!.participants.add(userId);
        rooms.get(roomId)!.connections.set(userId, socket.id);

        // Notify others in the room
        socket.to(roomId).emit('user-joined', userId, isHost);

        // Send list of current participants to the new user
        const participants = Array.from(rooms.get(roomId)!.participants)
          .filter(p => p !== userId);
        socket.emit('room-participants', participants);

        console.log(`User ${userId} joined room ${roomId} as ${isHost ? 'host' : 'participant'} (${socketType})`);
      } catch (error) {
        console.error('Error joining room:', error);
        socket.emit('error', 'Failed to join room');
      }
    });

    // Chat message handling
    socket.on('chat-message', (roomId: string, message: ChatMessage) => {
      try {
        console.log('Received chat message:', message);
        // Broadcast the message to all users in the room including sender
        io.in(roomId).emit('chat-message', message);
      } catch (error) {
        console.error('Error handling chat message:', error);
        socket.emit('error', 'Failed to send chat message');
      }
    });

    // WebRTC signaling - only handle if not a chat socket
    if (socketType !== 'chat') {
      socket.on('offer', (roomId: string, userId: string, offer: any) => {
        try {
          const room = rooms.get(roomId);
          if (!room) {
            throw new Error('Room not found');
          }

          // Only send offer to other participants
          room.participants.forEach(participantId => {
            if (participantId !== userId) {
              const participantSocketId = room.connections.get(participantId);
              if (participantSocketId) {
                console.log(`Sending offer from ${userId} to ${participantId}`);
                io.to(participantSocketId).emit('offer', userId, offer);
              }
            }
          });
        } catch (error) {
          console.error('Error handling offer:', error);
          socket.emit('error', 'Failed to handle offer');
        }
      });

      socket.on('answer', (roomId: string, userId: string, answer: any) => {
        try {
          const room = rooms.get(roomId);
          if (!room) {
            throw new Error('Room not found');
          }

          // Send answer to the host
          if (room.hostId) {
            const hostSocketId = room.connections.get(room.hostId);
            if (hostSocketId) {
              console.log(`Sending answer from ${userId} to host ${room.hostId}`);
              io.to(hostSocketId).emit('answer', userId, answer);
            }
          }
        } catch (error) {
          console.error('Error handling answer:', error);
          socket.emit('error', 'Failed to handle answer');
        }
      });

      socket.on('ice-candidate', (roomId: string, userId: string, candidate: any) => {
        try {
          const room = rooms.get(roomId);
          if (!room) {
            throw new Error('Room not found');
          }

          // Only send ICE candidate to other participants
          room.participants.forEach(participantId => {
            if (participantId !== userId) {
              const participantSocketId = room.connections.get(participantId);
              if (participantSocketId) {
                console.log(`Sending ICE candidate from ${userId} to ${participantId}`);
                io.to(participantSocketId).emit('ice-candidate', userId, candidate);
              }
            }
          });
        } catch (error) {
          console.error('Error handling ICE candidate:', error);
          socket.emit('error', 'Failed to handle ICE candidate');
        }
      });
    }

    // Room synchronization
    socket.on('sync-time', (roomId: string, currentTime: number) => {
      socket.to(roomId).emit('sync-time', currentTime);
    });

    socket.on('sync-lyrics', (roomId: string, currentLyric: string) => {
      socket.to(roomId).emit('sync-lyrics', currentLyric);
    });

    // Leave room
    socket.on('leave-room', (roomId: string, userId: string) => {
      socket.leave(roomId);
      const roomParticipants = rooms.get(roomId);
      if (roomParticipants) {
        roomParticipants.participants.delete(userId);
        roomParticipants.connections.delete(userId);
        socket.to(roomId).emit('user-left', userId);
      }
    });

    // Disconnect
    socket.on('disconnect', () => {
      console.log('Client disconnected:', socket.id);
      // Clean up rooms
      rooms.forEach((room, roomId) => {
        room.participants.forEach(participant => {
          if (participant === socket.id) {
            room.participants.delete(participant);
            room.connections.delete(participant);
            socket.to(roomId).emit('user-left', socket.id);
          }
        });
      });
    });
  });

  const PORT = process.env.PORT || 3001;
  server.listen(PORT, () => {
    console.log(`> Ready on http://localhost:${PORT}`);
  });
}); 