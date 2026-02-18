"use client";

import {
    Bug,
    CheckCircle2,
    ExternalLink,
    Github,
    Lightbulb,
    Loader2,
    MessageCircle,
} from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { type FeedbackType, submitFeedback } from "@/lib/feedback";

const FEEDBACK_TYPES: {
    value: FeedbackType;
    label: string;
    icon: typeof Bug;
}[] = [
    { value: "bug", label: "Bug", icon: Bug },
    { value: "feature", label: "Feature", icon: Lightbulb },
    { value: "feedback", label: "Feedback", icon: MessageCircle },
];

interface FeedbackDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function FeedbackDialog({ open, onOpenChange }: FeedbackDialogProps) {
    const [type, setType] = useState<FeedbackType>("feedback");
    const [message, setMessage] = useState("");
    const [email, setEmail] = useState("");
    const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
    const [errorMessage, setErrorMessage] = useState("");

    const resetForm = () => {
        setType("feedback");
        setMessage("");
        setEmail("");
        setStatus("idle");
        setErrorMessage("");
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (message.trim().length < 10) {
            setErrorMessage("Please write at least 10 characters.");
            setStatus("error");
            return;
        }

        setStatus("submitting");
        setErrorMessage("");

        try {
            const result = await submitFeedback({
                type,
                message: message.trim(),
                email: email.trim() || undefined,
            });

            if (result.success) {
                setStatus("success");
            } else {
                setErrorMessage(result.error || "Something went wrong.");
                setStatus("error");
            }
        } catch {
            setErrorMessage("Failed to send. Please try again later.");
            setStatus("error");
        }
    };

    const handleOpenChange = (next: boolean) => {
        if (!next) resetForm();
        onOpenChange(next);
    };

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogContent className="sm:max-w-md max-w-[calc(100vw-2rem)]">
                <DialogHeader>
                    <DialogTitle>Send Feedback</DialogTitle>
                    <DialogDescription>Help us improve PokeMCP</DialogDescription>
                </DialogHeader>

                <Tabs defaultValue="feedback" className="w-full">
                    <TabsList className="w-full">
                        <TabsTrigger value="feedback" className="flex-1 min-h-[44px]">
                            <MessageCircle className="w-4 h-4" />
                            Send Feedback
                        </TabsTrigger>
                        <TabsTrigger value="github" className="flex-1 min-h-[44px]">
                            <Github className="w-4 h-4" />
                            GitHub Issues
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="feedback" className="mt-4">
                        {status === "success" ? (
                            <div className="flex flex-col items-center gap-3 py-6 text-center">
                                <CheckCircle2 className="w-10 h-10 text-green-500" />
                                <p className="font-semibold">Thanks for your feedback!</p>
                                <p className="text-sm text-muted-foreground">
                                    We&apos;ll review it soon.
                                </p>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleOpenChange(false)}
                                >
                                    Close
                                </Button>
                            </div>
                        ) : (
                            <form onSubmit={handleSubmit} className="space-y-4">
                                {/* Type selector */}
                                <fieldset
                                    className="flex gap-2 border-none p-0 m-0"
                                    aria-label="Feedback type"
                                >
                                    {FEEDBACK_TYPES.map((ft) => {
                                        const Icon = ft.icon;
                                        return (
                                            <button
                                                key={ft.value}
                                                type="button"
                                                aria-pressed={type === ft.value}
                                                onClick={() => setType(ft.value)}
                                                className={`flex-1 flex items-center justify-center gap-1.5 rounded-md border px-3 py-2 text-sm font-medium transition-colors ${
                                                    type === ft.value
                                                        ? "border-primary bg-primary/10 text-primary"
                                                        : "border-border text-muted-foreground hover:bg-muted hover:text-foreground hover:border-muted-foreground/50"
                                                }`}
                                            >
                                                <Icon className="w-4 h-4" />
                                                {ft.label}
                                            </button>
                                        );
                                    })}
                                </fieldset>

                                {/* Message */}
                                <div className="space-y-1.5">
                                    <label
                                        htmlFor="feedback-message"
                                        className="text-sm font-medium"
                                    >
                                        Message
                                    </label>
                                    <Textarea
                                        id="feedback-message"
                                        placeholder={
                                            type === "bug"
                                                ? "Describe what happened and what you expected..."
                                                : type === "feature"
                                                  ? "Describe the feature you'd like..."
                                                  : "Share your thoughts..."
                                        }
                                        value={message}
                                        onChange={(e) => setMessage(e.target.value)}
                                        className="min-h-24 resize-y"
                                        maxLength={5000}
                                        required
                                    />
                                    <p className="text-xs text-muted-foreground text-right">
                                        {message.length}/5000
                                    </p>
                                </div>

                                {/* Email (optional) */}
                                <div className="space-y-1.5">
                                    <label htmlFor="feedback-email" className="text-sm font-medium">
                                        Email{" "}
                                        <span className="text-muted-foreground font-normal">
                                            (optional, for follow-up)
                                        </span>
                                    </label>
                                    <Input
                                        id="feedback-email"
                                        type="email"
                                        placeholder="you@example.com"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                    />
                                </div>

                                {/* Error message */}
                                {status === "error" && errorMessage && (
                                    <p className="text-sm text-destructive">{errorMessage}</p>
                                )}

                                {/* Submit */}
                                <Button
                                    type="submit"
                                    className="w-full"
                                    disabled={status === "submitting"}
                                >
                                    {status === "submitting" ? (
                                        <>
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                            Sending...
                                        </>
                                    ) : (
                                        "Send Feedback"
                                    )}
                                </Button>
                            </form>
                        )}
                    </TabsContent>

                    <TabsContent value="github" className="mt-4">
                        <div className="space-y-4">
                            <p className="text-sm text-muted-foreground">
                                For detailed bug reports with screenshots, or to track the status of
                                your request, open a GitHub Issue.
                            </p>
                            <ul className="space-y-2 text-sm">
                                <li className="flex items-start gap-2">
                                    <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
                                    Track progress and get notified of updates
                                </li>
                                <li className="flex items-start gap-2">
                                    <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
                                    Attach screenshots and detailed reproduction steps
                                </li>
                                <li className="flex items-start gap-2">
                                    <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
                                    Discuss with other users and contributors
                                </li>
                            </ul>
                            <Button asChild className="w-full">
                                <a
                                    href="https://github.com/rborkow/pokeMCP/issues/new"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                >
                                    <Github className="w-4 h-4" />
                                    Open GitHub Issue
                                    <ExternalLink className="w-3 h-3" aria-hidden="true" />
                                    <span className="sr-only">(opens in new tab)</span>
                                </a>
                            </Button>
                        </div>
                    </TabsContent>
                </Tabs>
            </DialogContent>
        </Dialog>
    );
}
