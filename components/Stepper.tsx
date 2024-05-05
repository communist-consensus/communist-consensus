import React, { useState } from "react";
import Button from "./Button";

export default ({
  steps,
}: {
  steps: {
    content: React.ReactElement;
    name: string;
    validator?: () => boolean;
  }[];
}) => {
  const [step, setStep] = useState(0);
  return (
    <>
      <ul
        data-te-stepper-init
        className="relative m-0 flex list-none justify-between overflow-hidden p-0 transition-[height] duration-200 ease-in-out"
      >
        {steps.map((i, idx) => (
          <li key={i.name} className="w-[4.5rem] flex-auto">
            <div className="after:w-100 flex items-center pl-2 leading-[1.3rem] no-underline after:ml-2 after:h-px after:flex-1 after:bg-[#e0e0e0] after:content-['']  focus:outline-none dark:after:bg-neutral-600 dark:hover:bg-[#3b3b3b]">
              <span className={`my-6 mr-2 flex h-[1.938rem] w-[1.938rem] items-center justify-center rounded-full ${idx === step ? 'bg-red-500' : 'bg-[#ebedef]'} text-sm font-medium ${idx === step ? 'text-white' : 'text-[#40464f]'}`}>
                {idx + 1}
              </span>
              <span className={`font-medium text-neutral-500 after:flex after:text-[0.8rem] after:content-[data-content] dark:text-neutral-300`}>
                {i.name}
              </span>
            </div>
          </li>
        ))}
      </ul>
      <div className="w-100 p-4 transition-all duration-500 ease-in-out">
        {steps.find((i, idx) => idx === step)!.content}
      </div>
      <Button>上一步</Button>
      <Button onClick={() => {
        setStep(step + 1)
      }}>下一步</Button>
    </>
  );
};
