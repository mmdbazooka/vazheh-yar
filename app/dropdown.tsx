"use client";

import * as Select from "@radix-ui/react-select";
import { Check, ChevronDown, ChevronUp, type LucideIcon } from "lucide-react";
import { cx, ui } from "./styles";

type Option<Value extends string> = { value: Value; label: string };
type Group<Value extends string> = { label: string; options: Option<Value>[] };

type DropdownProps<Value extends string> = {
  label: string;
  value: Value;
  items: (Option<Value> | Group<Value>)[];
  onChange: (value: Value) => void;
  disabled?: boolean;
  icon?: LucideIcon;
};

export function Dropdown<Value extends string>({ label, value, items, onChange, disabled, icon: Icon }: DropdownProps<Value>) {
  const current = items.flatMap((item) => "options" in item ? item.options : [item]).find((item) => item.value === value);

  return (
    <Select.Root dir="rtl" value={value} onValueChange={(next) => onChange(next as Value)} disabled={disabled}>
      <Select.Trigger aria-label={label} className={cx(
        "group flex min-w-0 items-center gap-2 text-start disabled:opacity-[.55] data-[state=open]:border-(--accent)",
        Icon
          ? "min-w-[175px] max-w-[310px] border border-(--line) bg-(--surface) px-[11px] py-2 text-[13px] font-[650] text-(--ink) phone:min-h-11 phone:w-full phone:min-w-0 phone:max-w-none"
          : cx(ui.field, "phone:text-[16px]"),
      )}>
        {Icon && <Icon size={17} className="text-(--muted)" />}
        <span className="min-w-0 flex-1 truncate"><Select.Value>{current?.label}</Select.Value></span>
        <Select.Icon asChild>
          <ChevronDown size={15} className="text-(--muted) transition-transform group-data-[state=open]:rotate-180 motion-reduce:transition-none" />
        </Select.Icon>
      </Select.Trigger>
      <Select.Portal>
        <Select.Content position="popper" align="start" sideOffset={6} collisionPadding={10} className={cx(
          ui.surface,
          "z-20 max-h-[min(27rem,var(--radix-select-content-available-height))] max-w-(--radix-select-content-available-width) overflow-hidden shadow-[0_12px_32px_#0003]",
          Icon ? "w-[max(var(--radix-select-trigger-width),min(290px,var(--radix-select-content-available-width)))]" : "w-(--radix-select-trigger-width)",
        )}>
          <Select.ScrollUpButton className="grid h-7 place-items-center text-(--muted)"><ChevronUp size={15} /></Select.ScrollUpButton>
          <Select.Viewport className="p-1.5">
            {items.map((item) => "options" in item ? (
              <Select.Group key={item.label} className="mt-1 border-t border-(--line) pt-1">
                <Select.Label className="px-2.5 py-1 text-[11px] font-[700] text-(--muted)">{item.label}</Select.Label>
                {item.options.map((option) => <DropdownItem key={option.value} option={option} />)}
              </Select.Group>
            ) : <DropdownItem key={item.value} option={item} />)}
          </Select.Viewport>
          <Select.ScrollDownButton className="grid h-7 place-items-center text-(--muted)"><ChevronDown size={15} /></Select.ScrollDownButton>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  );
}

function DropdownItem({ option }: { option: Option<string> }) {
  return (
    <Select.Item value={option.value} className="relative flex min-h-9 cursor-pointer items-center rounded-[8px] ps-2.5 pe-8 text-[13px] outline-none wrap-anywhere data-highlighted:bg-(--soft) data-[state=checked]:bg-(--accent-soft) data-[state=checked]:font-[700] data-[state=checked]:text-(--accent) phone:min-h-11">
      <Select.ItemText>{option.label}</Select.ItemText>
      <Select.ItemIndicator className="absolute end-2.5 grid place-items-center"><Check size={15} /></Select.ItemIndicator>
    </Select.Item>
  );
}
