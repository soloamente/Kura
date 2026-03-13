import { cn } from "@Kura/ui/lib/utils";
import type * as React from "react";

// Generic label; association (htmlFor or wrapping input) is provided by the consumer.
function Label({ className, ...props }: React.ComponentProps<"label">) {
	return (
		// biome-ignore lint/a11y/noLabelWithoutControl: consumer provides htmlFor or wraps control
		<label
			data-slot="label"
			className={cn(
				"flex select-none items-center gap-2 text-xs leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-50 group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50",
				className,
			)}
			{...props}
		/>
	);
}

export { Label };
