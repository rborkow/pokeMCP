// @ts-expect-error OpenNext generates this JavaScript entry point at build time.
import handler from "./.open-next/worker.js";
import { REVIEW_VIDEO_PATH, serveReviewVideo } from "./src/lib/review-video";

export default {
    async fetch(request, env, ctx) {
        if (new URL(request.url).pathname === REVIEW_VIDEO_PATH) {
            return serveReviewVideo(request, env.ASSETS);
        }
        return handler.fetch(request, env, ctx);
    },
} satisfies ExportedHandler<Env>;
