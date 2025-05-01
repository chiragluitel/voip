import React, { useEffect, useRef, useState } from 'react';
import io, { Socket } from 'socket.io-client';
import { DefaultEventsMap } from '@socket.io/component-emitter';

// Assuming your server is running on localhost:5000
const SIGNALING_SERVER_URL = 'http://localhost:8080/call';
const STUN_SERVER_URL = 'stun:stun.l.google.com:19302'; // A public STUN server

const CallPage: React.FC = () => {
    const localVideoRef = useRef<HTMLVideoElement>(null);
    const remoteVideoRef = useRef<HTMLVideoElement>(null);
    const peerConnection = useRef<RTCPeerConnection | null>(null);
    // Corrected type for the socket ref
    const socket = useRef<Socket<DefaultEventsMap, DefaultEventsMap> | null>(null);

    const [callingStatus, setCallingStatus] = useState<'idle' | 'waiting' | 'connecting' | 'connected' | 'room_full' | 'error'>('idle');

    useEffect(() => {
        // Connect to the signaling server namespace
        socket.current = io(SIGNALING_SERVER_URL);

        socket.current.on('connect', () => {
            console.log('Connected to signaling server');
            // When connected, the backend will determine if we are waiting or if a call is ready
        });

        socket.current.on('waiting', () => {
            setCallingStatus('waiting');
            console.log('Waiting for another user...');
        });

        socket.current.on('ready', () => {
            // The backend signals that two users are in the namespace and a call can start
            setCallingStatus('connecting');
            console.log('Signaling server ready, attempting to connect...');
            // The user who receives 'ready' first (the second user to join the namespace)
            // will initiate the WebRTC offer/answer process.
            startCall(true);
        });

        socket.current.on('offer', async (offer: RTCSessionDescriptionInit) => {
            console.log('Received offer');
            setCallingStatus('connecting');
            if (!peerConnection.current) {
                 await createPeerConnection(); // Create peer connection if it doesn't exist
            }
            try {
                await peerConnection.current!.setRemoteDescription(new RTCSessionDescription(offer));
                const answer = await peerConnection.current!.createAnswer();
                await peerConnection.current!.setLocalDescription(answer);
                socket.current!.emit('answer', answer);
                console.log('Sent answer');
            } catch (error) {
                console.error('Error processing offer:', error);
                setCallingStatus('error');
            }
        });

        socket.current.on('answer', async (answer: RTCSessionDescriptionInit) => {
            console.log('Received answer');
             if (!peerConnection.current) {
                 await createPeerConnection(); // Create peer connection if it doesn't exist
            }
            try {
                await peerConnection.current!.setRemoteDescription(new RTCSessionDescription(answer));
                setCallingStatus('connected');
                console.log('Call connected!');
            } catch (error) {
                 console.error('Error processing answer:', error);
                 setCallingStatus('error');
            }
        });

        socket.current.on('candidate', async (candidate: RTCIceCandidateInit) => {
            console.log('Received ICE candidate');
            try {
                 if (peerConnection.current && candidate) {
                    await peerConnection.current.addIceCandidate(new RTCIceCandidate(candidate));
                    console.log('Added ICE candidate');
                 }
            } catch (e) {
                console.error('Error adding received ICE candidate', e);
                // This error might not require changing the calling status to 'error' immediately,
                // as some candidates might fail but the connection can still be established.
            }
        });

         socket.current.on('peer_disconnected', () => {
            console.log('Peer disconnected');
            // Handle peer disconnection (e.g., show message, reset state)
            setCallingStatus('idle'); // Or a specific 'peer_disconnected' status
            if (peerConnection.current) {
                peerConnection.current.close();
                peerConnection.current = null;
            }
             if (remoteVideoRef.current) {
                remoteVideoRef.current.srcObject = null;
            }
             // Optionally, signal the backend that this peer is now ready for a new connection
             // socket.current?.emit('ready_for_new_call'); // Example
        });


        socket.current.on('room_full', () => {
             setCallingStatus('room_full');
             console.log('Call room is currently full. Please try again later.');
             // Disconnect the socket as this user cannot join
             if (socket.current) {
                socket.current.disconnect();
             }
        });


        socket.current.on('disconnect', () => {
            console.log('Disconnected from signaling server');
             setCallingStatus('idle'); // Reset status on disconnect
             if (peerConnection.current) {
                peerConnection.current.close();
                peerConnection.current = null;
            }
             if (localVideoRef.current) {
                localVideoRef.current.srcObject = null;
            }
             if (remoteVideoRef.current) {
                remoteVideoRef.current.srcObject = null;
            }
        });


        // Cleanup on component unmount
        return () => {
            if (socket.current) {
                socket.current.disconnect();
            }
            if (peerConnection.current) {
                peerConnection.current.close();
                peerConnection.current = null;
            }
        };
    }, []); // Empty dependency array ensures this runs only once on mount

    const createPeerConnection = async () => {
         const configuration: RTCConfiguration = {
            iceServers: [
                { urls: STUN_SERVER_URL }
            ]
        };
        // Create the RTCPeerConnection with STUN server configuration
        peerConnection.current = new RTCPeerConnection(configuration);

        // Handle ICE candidates: send them to the other peer via the signaling server
        peerConnection.current.onicecandidate = (event) => {
            if (event.candidate) {
                console.log('Sending ICE candidate:', event.candidate);
                socket.current!.emit('candidate', event.candidate);
            }
        };

        // Handle incoming streams: display the remote stream in the video element
        peerConnection.current.ontrack = (event) => {
            console.log('Received remote stream');
            if (remoteVideoRef.current) {
                remoteVideoRef.current.srcObject = event.streams[0];
            }
        };

         // Log ICE connection state changes for debugging
        peerConnection.current.oniceconnectionstatechange = () => {
            console.log('ICE connection state changed:', peerConnection.current?.iceConnectionState);
             if (peerConnection.current?.iceConnectionState === 'failed' || peerConnection.current?.iceConnectionState === 'disconnected') {
                console.error('ICE connection failed or disconnected');
                // Handle reconnection or error state
                setCallingStatus('error');
            } else if (peerConnection.current?.iceConnectionState === 'connected') {
                 setCallingStatus('connected');
            }
        };

         // Log signaling state changes (optional)
        peerConnection.current.onsignalingstatechange = () => {
            console.log('Signaling state changed:', peerConnection.current?.signalingState);
        };
    };

    const startCall = async (isInitiator: boolean) => {
        setCallingStatus('connecting');
        try {
            // Get local media stream (video and audio)
            const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
            if (localVideoRef.current) {
                localVideoRef.current.srcObject = stream;
            }

            // Create the peer connection if it doesn't exist
            if (!peerConnection.current) {
                 await createPeerConnection();
            }


            // Add local tracks to the peer connection so they can be sent to the remote peer
            stream.getTracks().forEach(track => {
                peerConnection.current!.addTrack(track, stream);
            });

            if (isInitiator) {
                // If this peer is the initiator (the second person to join the room), create an offer
                const offer = await peerConnection.current!.createOffer();
                await peerConnection.current!.setLocalDescription(offer);
                // Send the offer to the other peer via the signaling server
                socket.current!.emit('offer', offer);
                console.log('Sent offer');
            }

        } catch (error) {
            console.error('Error starting call:', error);
            setCallingStatus('error');
        }
    };

    // Handle the "Call" button click
    const handleCallButtonClick = () => {
         // This button is primarily for the first user who arrives.
         // The second user will automatically attempt to start the call on receiving 'ready'.
         if (socket.current && socket.current.connected && callingStatus === 'idle') {
             // If the socket is connected and we are in the idle state, attempt to start the call.
             // The backend will handle if another user is waiting or if the room is full.
             setCallingStatus('waiting'); // Assume waiting until 'ready' or 'room_full' is received
             console.log("Attempting to start call, waiting for backend signal...");
             // We don't call startCall(true) here immediately.
             // The 'ready' event from the backend will trigger startCall(true) for the initiator.
             // This simplifies the frontend logic by letting the backend manage the two-user state.
         } else {
             console.log("Cannot start call. Current status:", callingStatus, "Socket connected:", socket.current?.connected);
         }
    };


    return (
        <div>
            <h1>VoIP Call</h1>
            {/* Render button based on status */}
            {callingStatus === 'idle' && (
                 <button onClick={handleCallButtonClick}>Call</button>
            )}
             {callingStatus === 'waiting' && <p>Waiting for another user to join...</p>}
             {callingStatus === 'connecting' && <p>Connecting...</p>}
             {callingStatus === 'connected' && <p>Connected!</p>}
             {callingStatus === 'room_full' && <p>Call room is currently full. Please try again later.</p>}
             {callingStatus === 'error' && <p>Error establishing call. Please try again.</p>}


            <div style={{ display: 'flex', gap: '20px', marginTop: '20px' }}>
                <div>
                    <h2>Local Stream</h2>
                    {/* Muted and playsInline are important for autoplay on mobile */}
                    <video ref={localVideoRef} autoPlay muted playsInline style={{ width: '100%', maxWidth: '400px', border: '1px solid #ccc' }} />
                </div>
                <div>
                    <h2>Remote Stream</h2>
                    <video ref={remoteVideoRef} autoPlay playsInline style={{ width: '100%', maxWidth: '400px', border: '1px solid #ccc' }} />
                </div>
            </div>
        </div>
    );
};

export default CallPage;
