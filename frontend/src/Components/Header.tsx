import { Dispatch, useReducer } from "react";
import { Action, CallReducer, initialCallReducer } from "../Reducer/CallReducer";

interface HeaderProps {
    state: CallReducer,
    dispatch: Dispatch<Action>;
}

const Header = ({state, dispatch}: HeaderProps) =>{
    return (
        <>
            <h1> Chirag's Private Calling System </h1>
            {state.isCalling && <div>Calling....</div>}
            <br />
            <br />
            <br />
        </>
    )
}

export default Header;