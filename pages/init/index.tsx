import { useState } from "react";
import Button from "../../components/Button";
import RadioGroup from "../../components/RadioGroup";
import Stepper from "../../components/Stepper";
import Title from "../../components/Title";
import useSwr from 'swr'

enum InitMode {
  initiator = '发起一个去中心化决策网络（需要两个节点同时初始化）',
  participant = '加入一个去中心化决策网络',
}

const fetcher = (url: string) => fetch(url).then((res) => res.json())

export default () => {
  const [mode, setMode] = useState(InitMode[InitMode.initiator]);
  const { data, error, isLoading } = useSwr<any[]>('/api/status', fetcher)
  const steps = [
    {
      name: '选择初始化方式',
      content: (
        <RadioGroup
          options={Object.keys(InitMode).map((i) => ({
            name: InitMode[i],
            value: i,
          }))}
          value={mode}
          onChange={(v) => setMode(v as keyof InitMode)}
        />
      ),
    },
    {
      name: '密钥',
      content: (
        <div>
          密钥是证明身份的唯一方式，用于去中心化网络的信息加密和数字签名。
          密钥在生成后请妥善保存，丢失后无法找回。
          <Button>创建新的密钥（随机生成）</Button>
          <Button>使用已有的密钥</Button>
        </div>
      ),
    },
    {
      name: '交换公钥和 P2P 地址',
      content: (
        <>
          <div className="flex justify-center">
            <div className="relative mb-3 xl:w-96" data-te-input-wrapper-init>
              <input
                type="text"
                className="peer block min-h-[auto] w-full rounded border-0 bg-transparent py-[0.32rem] px-3 leading-[1.6] outline-none transition-all duration-200 ease-linear focus:placeholder:opacity-100 data-[te-input-state-active]:placeholder:opacity-100 motion-reduce:transition-none dark:text-neutral-200 dark:placeholder:text-neutral-200 [&:not([data-te-input-placeholder-active])]:placeholder:opacity-0"
                id="exampleFormControlInput1"
                placeholder="Example label"
              />
              <label className="pointer-events-none top-0 left-3 mb-0 max-w-[90%] origin-[0_0] truncate pt-[0.37rem] leading-[1.6] text-neutral-500 transition-all duration-200 ease-out peer-focus:-translate-y-[0.9rem] peer-focus:scale-[0.8] peer-focus:text-primary peer-data-[te-input-state-active]:-translate-y-[0.9rem] peer-data-[te-input-state-active]:scale-[0.8] motion-reduce:transition-none dark:text-neutral-200 dark:peer-focus:text-neutral-200">
                Example label
              </label>
            </div>
          </div>
        </>
      ),
    },
  ];
  return (
    <>
      <Button>asdf</Button>
      <Stepper steps={steps}/>
    </>
  );
};
