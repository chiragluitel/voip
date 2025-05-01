import { useEffect, useReducer, useRef, useState } from "react";
import Button from "../Components/Button";
import Header from "../Components/Header"
import { CallReducer, initialCallReducer, Action } from "../Reducer/CallReducer";
// import { KnownSignalingMessage } from "../../../backend/src/server";
const Call = ()=>{

// Define interfaces for the messages we expect FROM the backend
interface ConnectedMessage {
    type: 'connected';
    clientId: string; // The temporary ID assigned by the server
    message: string;
}

interface IncomingCallMessage {
    type: 'incoming_call';
    callerUserId: string; // The ID of the user calling you
}

interface SimpleOfferMessage {
    type: 'offer';
    sdp: {
        type: string; // 'offer'
        sdp: string; // The SDP string
    };
    from: string; // Sender's ID
}

interface SimpleAnswerMessage {
    type: 'answer';
    sdp: {
        type: string; // 'answer'
        sdp: string; // The SDP string
    };
     from: string; // Sender's ID
}

interface SimpleCandidateMessage {
    type: 'candidate';
    candidate: {
        candidate: string; // The candidate string
        sdpMid: string | null;
        sdpMLineIndex: number | null;
        usernameFragment?: string; // Optional
    };
    from: string; // Sender's ID
}

// Union type for messages expected FROM the backend
type IncomingBackendMessage = ConnectedMessage | IncomingCallMessage | SimpleOfferMessage | SimpleAnswerMessage | SimpleCandidateMessage;
// Add other types like 'call_failed', 'hangup' etc.


    const [state, dispatch] = useReducer(CallReducer, initialCallReducer)

    const [mediaStream, setMediaStream] = useState<MediaStream | null>(null);

    const wsRef = useRef<WebSocket | null>(null);
    const peerConnectionRef = useRef<WebSocket | null>(null);

    // State to hold the current user's assigned ID from the server
    const [myUserId, setMyUserId] = useState<string | null>(null);
    // State to hold the ID of the user we are currently trying to call or are connected to
    const [remoteUserId, setRemoteUserId] = useState<string | null>(null);

    const [error, setError] = useState<string | null>(null);
    const [isCalling, setIsCalling] = useState<boolean>(false);


    const handleWebSocketMessage = (message: IncomingBackendMessage)=>{
        switch(message.type){
            case "connected":
                console.log(`Connected with client ${message.clientId}`)
                setMyUserId(message.clientId);
                break;
            case "incoming_call":
                console.log(`Incoming call from ${message.callerUserId}`)
                break;
            case "offer":
                console.log(`Received SDP offer: `, message.sdp )
                break;
            case "answer":
                console.log("Received SDP Answer: ", message.sdp)
                if (peerConnectionRef.current){
                    console.log("Handle Answer");
                }
                break;
            case "candidate":
                console.log("Received ICE Candidate: ", message.candidate)
                if (peerConnectionRef.current) {
                    console.log("Handle Candidate");
                }
            break;
            default:
                    console.warn("Received uknown WS type: ", message);
        }
    }




        // Effect to establish WebSocket connection when component mounts
        useEffect(() => {
            // Check if WebSocket is already open to avoid multiple connections
            if (!wsRef.current || wsRef.current.readyState === WebSocket.CLOSED) {
                 console.log("Attempting to connect to WebSocket server...");
                // Replace with your backend server URL
                const ws = new WebSocket('ws://localhost:3001'); // Or your deployed backend URL
    
                ws.onopen = () => {
                    console.log('WebSocket Connected');
                    wsRef.current = ws; // Store the WebSocket instance in the ref
                    // You could send a message here, e.g., a 'login' message if your backend supports it
                     // Example: ws.send(JSON.stringify({ type: 'login', username: 'user' + Math.random().toString(36).substring(7) }));
                };
    
                ws.onmessage = (event) => {
                    console.log('WebSocket Message Received:', event.data);
                    try {
                        const message: IncomingBackendMessage = JSON.parse(event.data as string);
                        handleWebSocketMessage(message); // Process the incoming message
                    } catch (e) {
                        console.error('Failed to parse WebSocket message:', e);
                    }
                };
    
                ws.onerror = (error) => {
                    console.error('WebSocket Error:', error);
                    // Handle WebSocket errors, e.g., show a message to the user
                };
    
                ws.onclose = (event) => {
                    console.log('WebSocket Disconnected:', event.code, event.reason);
                    wsRef.current = null; // Clear the ref
                    // Handle disconnection, e.g., attempt to reconnect or show a message
                };
            }
    
    
            // Cleanup function: Close WebSocket when component unmounts
            return () => {
                if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
                    wsRef.current.close();
                }
            };
        }, []); 

    const handleCall = async () =>{
        dispatch({type: "CALLING"})
        setError(null);

        try{
            const stream = await navigator.mediaDevices.getUserMedia({audio: true});
            console.log ("Microphone Access Granted!", stream);
            setMediaStream(stream);
        }catch(err){
            setIsCalling(false);
            console.error("Error Accesing Microphone", err);

            if (err instanceof DOMException) {
                if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
                    setError("Permission to access microphone was denied. Please allow microphone access in your browser settings.");
                } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
                    setError("No microphone found on this device.");
                } else if (err.name === 'NotReadableError' || err.name === 'OverconstrainedError') {
                     setError("Could not access the microphone. It might be in use by another application.");
                } else {
                    setError(`An error occurred while accessing the microphone: ${err.message}`);
                }
            } else {
               setError(`An unexpected error occurred: ${String(err)}`);
            }
        }
    }

    const handleEndCall= () =>{
        if(mediaStream){
            mediaStream.getTracks().forEach(track=>track.stop());
            setMediaStream(null);
            dispatch({type:"HANGUP"})
            console.log("Microphone streaming stopped")
        }
        return 0;
    }
    return (
    <>
        <Header state={state} dispatch={dispatch} />
        <div>
        <Button label="Call" onClick={handleCall}/>
        <Button label="End Call" onClick={handleEndCall}/>
        </div>
    </>
    )
}

export default Call;