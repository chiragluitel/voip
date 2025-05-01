interface ButtonProps {
    label: string,
    isDisabled?: boolean,
    onClick: () =>{};
}
const Button = ({label, isDisabled=false, onClick}:ButtonProps) =>{
    return (
    <>
        <button 
        disabled = {isDisabled}
        onClick={onClick}
         >{label}</button>
    </>
    )
}
export default Button;