"use client";

import { useState } from "react";
import { MessageSquarePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FeedbackDialog } from "./FeedbackDialog";

export function FeedbackButton() {
	const [open, setOpen] = useState(false);

	return (
		<>
			<Button
				variant="outline"
				size="icon"
				onClick={() => setOpen(true)}
				className="fixed bottom-4 right-4 z-40 h-11 w-11 rounded-full shadow-lg border-border bg-background/80 backdrop-blur-sm hover:bg-muted"
				aria-label="Send feedback"
			>
				<MessageSquarePlus className="w-5 h-5" />
			</Button>
			<FeedbackDialog open={open} onOpenChange={setOpen} />
		</>
	);
}
