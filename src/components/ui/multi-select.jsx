import * as React from "react";
import { X } from "lucide-react";
import { Badge } from "./badge";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "./command";

const MultiSelect = React.forwardRef(
  ({ options, value, onChange, placeholder = "Select items..." }, ref) => {
    const inputRef = React.useRef(null);
    const [open, setOpen] = React.useState(false);
    const [selected, setSelected] = React.useState(value || []);
    const [inputValue, setInputValue] = React.useState("");

    const handleUnselect = (item) => {
      const filtered = selected.filter((i) => i.value !== item.value);
      setSelected(filtered);
      onChange(filtered);
    };

    const handleKeyDown = (e) => {
      const input = inputRef.current;
      if (input) {
        if (e.key === "Delete" || e.key === "Backspace") {
          if (input.value === "" && selected.length > 0) {
            const newSelected = [...selected];
            newSelected.pop();
            setSelected(newSelected);
            onChange(newSelected);
          }
        }
        if (e.key === "Escape") {
          input.blur();
        }
      }
    };

    const selectables = options.filter(
      (item) => !selected.some((selectedItem) => selectedItem.value === item.value)
    );

    return (
      <Command
        ref={ref}
        className="overflow-visible bg-white"
        onKeyDown={handleKeyDown}
      >
        <div className="group border border-input px-3 py-2 text-sm ring-offset-background rounded-md focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2">
          <div className="flex gap-1 flex-wrap">
            {selected.map((item) => (
              <Badge key={item.value} variant="secondary">
                {item.label}
                <button
                  className="ml-1 ring-offset-background rounded-full outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleUnselect(item);
                    }
                  }}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                  onClick={() => handleUnselect(item)}
                >
                  <X className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                </button>
              </Badge>
            ))}
            <CommandInput
              ref={inputRef}
              value={inputValue}
              onValueChange={setInputValue}
              onBlur={() => setOpen(false)}
              onFocus={() => setOpen(true)}
              placeholder={placeholder}
              className="ml-2 bg-transparent outline-none placeholder:text-muted-foreground flex-1"
            />
          </div>
        </div>
        <div className="relative mt-2">
          {open && selectables.length > 0 ? (
            <div className="absolute w-full z-10 top-0 rounded-md border bg-popover text-popover-foreground shadow-md outline-none animate-in">
              <CommandGroup className="h-full overflow-auto">
                {selectables.map((option) => (
                  <CommandItem
                    key={option.value}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                    }}
                    onSelect={() => {
                      setInputValue("");
                      const newSelected = [...selected, option];
                      setSelected(newSelected);
                      onChange(newSelected);
                    }}
                    className="cursor-pointer"
                  >
                    {option.label}
                  </CommandItem>
                ))}
              </CommandGroup>
            </div>
          ) : null}
        </div>
      </Command>
    );
  }
);

MultiSelect.displayName = "MultiSelect";

export { MultiSelect };
