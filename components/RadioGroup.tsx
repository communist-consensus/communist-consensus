import React, { ChangeEvent } from 'react';

export default ({
  options,
  value,
  onChange,
}: {
  options: { name: string; value: string }[];
  value?: string;
  onChange: (v: string) => void;
}) => {
  return (
    <div className="flex items-center">
      {options.map((i) => (
        <div key={i.value} onClick={(e) => onChange(i.value)}>
          <input
            type="radio"
            checked={value === i.value}
            className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
            onChange={() => {}}
          />
          <label className="ml-2 text-sm font-medium text-gray-900 dark:text-gray-300">
            {i.name}
          </label>
        </div>
      ))}
    </div>
  );
};
