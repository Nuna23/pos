'use client';

import { Product } from '@/types';

interface Props {
  toppings: Product[];
  selected: Product[];
  onToggle: (topping: Product) => void;
  // Toppings the branch is out of — shown greyed out and not selectable.
  disabledIds?: Set<number>;
}

export default function ToppingPicker({ toppings, selected, onToggle, disabledIds }: Props) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {toppings.map((t) => {
        const isSelected = selected.some((x) => x.id === t.id);
        const isDisabled = disabledIds?.has(t.id) ?? false;
        return (
          <button
            key={t.id}
            onClick={() => !isDisabled && onToggle(t)}
            disabled={isDisabled}
            className={`py-2 px-1 rounded-xl text-xs font-medium border-2 transition active:scale-95 ${
              isDisabled
                ? 'bg-gray-100 text-gray-300 border-gray-100 cursor-not-allowed'
                : isSelected
                  ? 'bg-amber-400 text-white border-amber-400'
                  : 'bg-white text-gray-700 border-gray-200'
            }`}
          >
            {t.name}
            <br />
            <span className="opacity-70">{isDisabled ? 'หมด' : `฿${Number(t.price)}`}</span>
          </button>
        );
      })}
    </div>
  );
}
