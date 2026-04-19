import { EmptyStateCTAs } from "./EmptyStateCTAs";
import { StatusBar } from "./StatusBar";

export function Hero() {
    return (
        <section className="px-6 md:px-10 pt-10 md:pt-16 pb-8">
            <StatusBar />
            <h1 className="mt-6 text-3xl md:text-5xl font-display font-medium leading-[1.1] tracking-tight text-foreground max-w-[18ch]">
                A coach for the whole build — not just the first click.
            </h1>
            <p className="mt-4 max-w-[52ch] text-base md:text-lg text-muted-foreground leading-relaxed">
                Interview to start. Iterate in natural language. Walk into the match with a plan.
                The AI shows up at every step of the build loop, not just the blank canvas.
            </p>
            <EmptyStateCTAs className="mt-7" />
        </section>
    );
}
