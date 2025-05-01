import express from 'express';
import http from 'http';
import WebSocket, { WebSocketServer } from 'ws';
import path from 'path';

// Define interfaces for your signaling messages (using simpler JSON structures for backend)
interface SimpleOfferMessage {
    type: 'offer';
    sdp: {
        type: string; // 'offer'
        sdp: string; // The SDP string
    };
    // Add a targetUserId property later for targeted messaging
    targetUserId?: string;
}

interface SimpleAnswerMessage {
    type: 'answer';
    sdp: {
        type: string; // 'answer'
        sdp: string; // The SDP string
    };
     // Add a targetUserId property later for targeted messaging
    targetUserId?: string;
}

interface SimpleCandidateMessage {
    type: 'candidate';
    candidate: {
        candidate: string; // The candidate string
        sdpMid: string | null;
        sdpMLineIndex: number | null;
        usernameFragment?: string; // Optional
    };
     // Add a targetUserId property later for targeted messaging
    targetUserId?: string;
}

interface CallRequestMessage {
    type: 'call';
    targetUserId: string; // Who are you trying to call?
    callerUserId: string; // Who is calling?
}

interface HangUpMessage {
    type: 'hangup';
    targetUserId: string; // Who are you hanging up on?
    senderUserId: string;
}

// A base type for messages we might receive, allowing for unknown types initially
interface BaseIncomingMessage {
    type?: string; // Make type optional initially for checking
    [key: string]: any; // Allow any other properties
}


// A union type for the messages we specifically expect to handle
type KnownSignalingMessage = SimpleOfferMessage | SimpleAnswerMessage | SimpleCandidateMessage | CallRequestMessage | HangUpMessage;


const app = express();
const port = process.env.PORT || 8080;

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

// --- Basic Express Route ---
app.get('/', (req, res) => {
  res.send('VOIP Signaling Server is running!');
});

// --- WebSocket Signaling Logic ---

// Store connected clients, perhaps mapped by a user ID later
interface ConnectedClient {
    ws: WebSocket;
    userId?: string; // Add a property to store the user ID
}
// Use a Map from userId (or temporary ID) to the client object
const clients = new Map<string, ConnectedClient>(); // Map client ID (string) to client object
let nextClientId = 0; // Simple temporary ID counter

wss.on('connection', (ws: WebSocket) => {
  const clientId = `client_${nextClientId++}`; // Assign a unique temporary ID
  console.log(`Client ${clientId} connected`);

  // Store the connected client with its temporary ID
  clients.set(clientId, { ws: ws, userId: clientId }); // Store temporary ID as userId initially

  // Send the temporary client ID back to the client so it knows who it is
  ws.send(JSON.stringify({ type: 'connected', clientId: clientId, message: `Successfully connected as ${clientId}` }));


  // Handle messages from clients
  ws.on('message', (message: string) => {
    console.log(`Received message from client ${clientId}: ${message}`);

    let parsedMessage: BaseIncomingMessage; // Use the base type initially
    try {
      parsedMessage = JSON.parse(message);
    } catch (e) {
      console.error(`Failed to parse message from client ${clientId}:`, e);
      ws.send(JSON.stringify({ type: 'error', message: 'Invalid JSON format' }));
      return;
    }

    // Check if the message has a 'type' property
    if (!parsedMessage.type) {
        console.warn(`Message from client ${clientId} missing 'type':`, parsedMessage);
        ws.send(JSON.stringify({ type: 'error', message: 'Message is missing the "type" property' }));
        return;
    }

    // Now we can potentially cast or handle based on the type
    // Using a switch statement is common for different message types
    switch (parsedMessage.type) {
        case 'call':
            // Assuming parsedMessage is a CallRequestMessage
            const callMessage = parsedMessage as CallRequestMessage;
            console.log(`Client ${clientId} wants to call ${callMessage.targetUserId}`);
            // TODO: Implement logic to find targetUserId and forward the call request
            // For now, let's just echo or indicate received
            ws.send(JSON.stringify({ type: 'call_received', status: 'processing', target: callMessage.targetUserId }));

            // Example: Forward the call request to the target user (if connected)
            const targetClient = clients.get(callMessage.targetUserId);
            if (targetClient && targetClient.ws.readyState === WebSocket.OPEN) {
                 console.log(`Forwarding call request from ${clientId} to ${callMessage.targetUserId}`);
                 targetClient.ws.send(JSON.stringify({
                     type: 'incoming_call',
                     callerUserId: clientId // Tell the target who is calling
                     // You might include user display names or other info here
                 }));
            } else {
                console.log(`Target user ${callMessage.targetUserId} not found or not connected.`);
                ws.send(JSON.stringify({ type: 'call_failed', reason: 'User not found or offline', target: callMessage.targetUserId }));
            }

            break;

        case 'offer':
            // Assuming parsedMessage is a SimpleOfferMessage
             const offerMessage = parsedMessage as SimpleOfferMessage;
             console.log(`Received offer from ${clientId} for target ${offerMessage.targetUserId}`);
             // TODO: Implement logic to find targetUserId and forward the offer
             const offerTargetClient = clients.get(offerMessage.targetUserId || ''); // Need a way to specify target!
             if (offerTargetClient && offerTargetClient.ws.readyState === WebSocket.OPEN) {
                 console.log(`Forwarding offer from ${clientId} to ${offerTargetClient.userId}`);
                 offerTargetClient.ws.send(JSON.stringify({
                     type: 'offer',
                     sdp: offerMessage.sdp,
                     from: clientId // Include sender info
                 }));
             } else {
                 console.log(`Target user for offer ${offerMessage.targetUserId} not found or not connected.`);
                 // Optionally send an error back to the sender
             }
             break;

        case 'answer':
            // Assuming parsedMessage is a SimpleAnswerMessage
            const answerMessage = parsedMessage as SimpleAnswerMessage;
             console.log(`Received answer from ${clientId} for target ${answerMessage.targetUserId}`);
             // TODO: Implement logic to find targetUserId and forward the answer
             const answerTargetClient = clients.get(answerMessage.targetUserId || ''); // Need a way to specify target!
              if (answerTargetClient && answerTargetClient.ws.readyState === WebSocket.OPEN) {
                 console.log(`Forwarding answer from ${clientId} to ${answerTargetClient.userId}`);
                 answerTargetClient.ws.send(JSON.stringify({
                     type: 'answer',
                     sdp: answerMessage.sdp,
                     from: clientId // Include sender info
                 }));
             } else {
                 console.log(`Target user for answer ${answerMessage.targetUserId} not found or not connected.`);
                 // Optionally send an error back to the sender
             }
            break;

        case 'candidate':
             // Assuming parsedMessage is a SimpleCandidateMessage
            const candidateMessage = parsedMessage as SimpleCandidateMessage;
             console.log(`Received candidate from ${clientId} for target ${candidateMessage.targetUserId}`);
            // TODO: Implement logic to find targetUserId and forward the candidate
             const candidateTargetClient = clients.get(candidateMessage.targetUserId || ''); // Need a way to specify target!
              if (candidateTargetClient && candidateTargetClient.ws.readyState === WebSocket.OPEN) {
                 console.log(`Forwarding candidate from ${clientId} to ${candidateTargetClient.userId}`);
                 candidateTargetClient.ws.send(JSON.stringify({
                     type: 'candidate',
                     candidate: candidateMessage.candidate,
                     from: clientId // Include sender info
                 }));
             } else {
                 console.log(`Target user for candidate ${candidateMessage.targetUserId} not found or not connected.`);
                 // Optionally send an error back to the sender
             }
            break;

        case 'hangup':
            const hangUpMessage = parsedMessage as HangUpMessage;
            console.log(`Client ${clientId} wants to hang up with ${hangUpMessage.targetUserId}`);
             const hangUpTargetClient = clients.get(hangUpMessage.targetUserId);
              if (hangUpTargetClient && hangUpTargetClient.ws.readyState === WebSocket.OPEN) {
                 console.log(`Forwarding hangup from ${clientId} to ${hangUpTargetClient.userId}`);
                 hangUpTargetClient.ws.send(JSON.stringify({
                     type: 'hangup',
                     from: clientId // Include sender info
                 }));
             } else {
                 console.log(`Target user for hangup ${hangUpMessage.targetUserId} not found or not connected.`);
                 // This might happen if the other side already disconnected
             }
            break;

        // Add other message types as needed
        // For instance, a 'login' message to associate a userId with the connection
        case 'login':
            // Example login logic:
            // const loginMessage = parsedMessage as { type: 'login', userId: string };
            // if (loginMessage.userId) {
            //     console.log(`Client ${clientId} identifying as user ${loginMessage.userId}`);
            //     // Update the client entry in the map to use the real userId
            //     clients.delete(clientId); // Remove by old ID
            //     clients.set(loginMessage.userId, { ws: ws, userId: loginMessage.userId }); // Add with new ID
            //     // Inform the client they are now logged in as this user ID
            //     ws.send(JSON.stringify({ type: 'loggedIn', userId: loginMessage.userId }));
            // } else {
            //      ws.send(JSON.stringify({ type: 'error', message: 'Login message requires userId' }));
            // }
            break;


        default:
            console.warn(`Received message with unknown type from client ${clientId}: ${parsedMessage.type}`);
            ws.send(JSON.stringify({ type: 'error', message: `Unknown message type: ${parsedMessage.type}` }));
            break;
    }
  });

  // Handle client disconnection
  ws.on('close', () => {
    // Find the client in the map by its WebSocket instance
    // This requires iterating the map unless you store the key on the ws object
    // A better approach is to find the entry by ws and then delete by key (userId/clientId)
    let disconnectedClientId: string | undefined;
    for (const [id, client] of clients.entries()) {
        if (client.ws === ws) {
            disconnectedClientId = id;
            break;
        }
    }

    if (disconnectedClientId) {
        console.log(`Client ${disconnectedClientId} disconnected`);
        clients.delete(disconnectedClientId); // Remove the client from the map
         // TODO: Notify other clients in active calls that this user disconnected
    } else {
         console.log("A client disconnected, but its ID was not found in the map.");
    }
  });

  // Handle errors
  ws.on('error', (error: Error) => {
     // Find the client by ws instance to log their ID
     let errorClientId: string | undefined;
     for (const [id, client] of clients.entries()) {
        if (client.ws === ws) {
            errorClientId = id;
            break;
        }
     }
    console.error(`Error with client ${errorClientId || 'unknown'}:`, error);
     if (errorClientId) {
         clients.delete(errorClientId); // Remove the client from the map on error
         // TODO: Notify other clients if this error affects an active call
     }
  });

});

// --- Start the server ---
server.listen(port, () => {
  console.log(`Express and WebSocket server listening on port ${port}`);
});