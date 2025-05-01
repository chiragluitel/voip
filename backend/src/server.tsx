
import express from 'express';
import http from 'http';
import cors from 'cors'; // Import the cors package
import WebSocket, { WebSocketServer } from 'ws';
import { Server as SocketIOServer, Socket } from 'socket.io';
import path from 'path';



const app = express();
const port = process.env.PORT || 8080;
const server = http.createServer(app);
const wss = new WebSocketServer({ server });
// --- Basic Express Route ---
app.get('/', (req, res) => {
  res.send('VOIP Signaling Server is running!');
});


// Configure CORS for Express
app.use(cors({
    origin: '*', // Allow requests from your frontend origin
    methods: ['GET', 'POST'] // Allowed HTTP methods
}));

// Configure CORS for Socket.IO
const io = new SocketIOServer(server, {
    cors: {
        origin: '*', // Allow Socket.IO connections from your frontend origin
        methods: ['GET', 'POST'] // Allowed methods for Socket.IO handshake
    }
});

// ... your existing Express middleware and routes
const callNamespace = io.of('/call'); // Create a namespace for call-related events
let connectedUsers: Socket[] = []; // Simple array to track connected users on /call
callNamespace.on('connection', (socket: Socket) => {
    console.log('User connected to /call namespace:', socket.id);
    if (connectedUsers.length < 2) {
        connectedUsers.push(socket);
        // Notify the newly connected user if they are the first
        if (connectedUsers.length === 1) {
            socket.emit('waiting');
        } else if (connectedUsers.length === 2) {
            // If two users are connected, signal them to start the call
            callNamespace.emit('ready');
            console.log('Two users connected, call is ready.');
        }
    } else {
        // If more than two users try to connect, you might want to send a "room full" message
        socket.emit('room_full');
        socket.disconnect();
        console.log('Room full, disconnecting user:', socket.id);
    }
    socket.on('offer', (offer: RTCSessionDescriptionInit) => {
        console.log('Received offer from', socket.id);
        // Forward the offer to the other connected user
        const otherUser = connectedUsers.find(user => user.id !== socket.id);
        if (otherUser) {
            otherUser.emit('offer', offer);
            console.log('Forwarding offer to', otherUser.id);
        }
    });
    socket.on('answer', (answer: RTCSessionDescriptionInit) => {
        console.log('Received answer from', socket.id);
        // Forward the answer to the other connected user
        const otherUser = connectedUsers.find(user => user.id !== socket.id);
        if (otherUser) {
            otherUser.emit('answer', answer);
            console.log('Forwarding answer to', otherUser.id);
        }
    });
    socket.on('candidate', (candidate: RTCIceCandidateInit) => {
        console.log('Received ICE candidate from', socket.id);
        // Forward the ICE candidate to the other connected user
        const otherUser = connectedUsers.find(user => user.id !== socket.id);
        if (otherUser) {
            otherUser.emit('candidate', candidate);
            console.log('Forwarding ICE candidate to', otherUser.id);
        }
    });
    socket.on('disconnect', () => {
        console.log('User disconnected from /call namespace:', socket.id);
        connectedUsers = connectedUsers.filter(user => user.id !== socket.id);
        // You might want to signal the other user that the peer disconnected
        callNamespace.emit('peer_disconnected');
    });
});

const PORT = 8080; // Or your preferred port
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
