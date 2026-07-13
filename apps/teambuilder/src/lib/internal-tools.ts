import { getCloudflareContext } from "@opennextjs/cloudflare";

interface PrepAnalysisBinding extends Service {
    runTool(toolName: string, args: Record<string, unknown>): Promise<string>;
}

export async function callInternalTool(
    toolName: string,
    args: Record<string, unknown>,
): Promise<string> {
    const env = getCloudflareContext().env as CloudflareEnv;
    const service = env.PREP_ANALYSIS as PrepAnalysisBinding;
    return service.runTool(toolName, args);
}
