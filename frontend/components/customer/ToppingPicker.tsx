'use client';

import { Product } from '@/types';

interface Props {
  toppings: Product[];
  selected: Product[];
  onToggle: (topping: Product) => void;
}

export default function ToppingPicker({ toppings, selected, onToggle }: Props) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {toppings.map((t) => {
        const isSelected = selected.some((x) => x.id === t.id);
        return (
          <button
            key={t.id}
            onClick={() => onToggle(t)}
            className={`py-2 px-1 rounded-xl text-xs font-medium border-2 transition active:scale-95 ${
              isSelected
                ? 'bg-amber-400 text-white border-amber-400'
                : 'bg-white text-gray-700 border-gray-200'
            }`}
          >
            {t.name}
            <br />
            <span className="opacity-70">฿{Number(t.price)}</span>
          </button>
        );
      })}
    </div>
  );
}
