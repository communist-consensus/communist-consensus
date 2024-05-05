import { useEffect, useState } from "react";

function RandomLine({offset}: {offset: number}) {
    const [y, setY] = useState(Math.random() * 100);
  return (
    <div
      className="
  absolute
  flex
  bg-gradient-to-b from-transparent via-red-500 ...
  w-1
  h-full
  "
  style={{left: offset, top: y.toFixed(2) + '%',

  transformOrigin: `${Math.random()} ${ Math.random()}`,
  animationDelay: `${-50 * Math.random()}s`
}}
    ></div>
  );
}

export default () => {
  return (
    <div className="absolute w-full h-full z-0 overflow-hidden">

{new Array(50).fill(0).map((i, idx) => 
<RandomLine offset={idx * 10 * Math.random()}/>
)}
    </div>
  );
};
