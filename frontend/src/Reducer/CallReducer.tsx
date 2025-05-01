export interface CallReducer {
    isCalling: boolean;
}

export type Action = 
| {type: "CALLING"}
| {type: "HANGUP"}

export const CallReducer = (state: CallReducer, action: Action)=>{
    switch (action.type){
        case "CALLING":
            return {isCalling: true}
        case "HANGUP":
            return {isCalling: false}
        default:
            return state;
    }   
}

export const initialCallReducer: CallReducer = {
    isCalling: false
};