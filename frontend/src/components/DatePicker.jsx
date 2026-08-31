import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon } from "lucide-react";

export default function DatePicker({ value, onChange, testId, placeholder = "Pilih tanggal", fromYear = 1930, toYear = 2035, disabled }) {
  const date = value ? new Date(value) : undefined;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" data-testid={testId} className="w-full h-11 rounded-xl justify-start font-normal mt-1.5">
          <CalendarIcon className="h-4 w-4 mr-2 text-slate-400" />
          {date ? date.toLocaleDateString("id-ID", { dateStyle: "long" }) : <span className="text-slate-400">{placeholder}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={date}
          captionLayout="dropdown-buttons"
          fromYear={fromYear}
          toYear={toYear}
          defaultMonth={date}
          onSelect={(d) => onChange(d ? d.toISOString().slice(0, 10) : "")}
          disabled={disabled}
        />
      </PopoverContent>
    </Popover>
  );
}
