const MCP_URL = process.env.NEXT_PUBLIC_MCP_URL || "https://api.pokemcp.com";

export type FeedbackType = "bug" | "feature" | "feedback";

export interface FeedbackRequest {
	type: FeedbackType;
	message: string;
	email?: string;
	page?: string;
}

export interface FeedbackResponse {
	success: boolean;
	id?: string;
	error?: string;
}

export async function submitFeedback(
	request: FeedbackRequest,
): Promise<FeedbackResponse> {
	const response = await fetch(`${MCP_URL}/api/feedback`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			...request,
			page: request.page || window.location.pathname,
		}),
	});

	return response.json();
}
