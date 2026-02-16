"use client";

import React from "react";
import { ErrorFallback } from "./ErrorFallback";

interface ErrorBoundaryProps {
	children: React.ReactNode;
	fallback?: React.ReactNode;
	level?: "root" | "section";
	onError?: (error: Error) => void;
}

interface ErrorBoundaryState {
	hasError: boolean;
	error: Error | null;
}

export class ErrorBoundary extends React.Component<
	ErrorBoundaryProps,
	ErrorBoundaryState
> {
	constructor(props: ErrorBoundaryProps) {
		super(props);
		this.state = { hasError: false, error: null };
	}

	static getDerivedStateFromError(error: Error): ErrorBoundaryState {
		return { hasError: true, error };
	}

	componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
		console.error("ErrorBoundary caught an error:", error, errorInfo);
		this.props.onError?.(error);
	}

	resetErrorBoundary = (): void => {
		this.setState({ hasError: false, error: null });
	};

	render(): React.ReactNode {
		if (this.state.hasError && this.state.error) {
			if (this.props.fallback) {
				return this.props.fallback;
			}

			return (
				<ErrorFallback
					error={this.state.error}
					resetErrorBoundary={this.resetErrorBoundary}
					level={this.props.level ?? "section"}
				/>
			);
		}

		return this.props.children;
	}
}

export function withErrorBoundary<P extends object>(
	Component: React.ComponentType<P>,
	level: "root" | "section" = "section",
): React.FC<P> {
	const WrappedComponent: React.FC<P> = (props) => (
		<ErrorBoundary level={level}>
			<Component {...props} />
		</ErrorBoundary>
	);

	const displayName = Component.displayName || Component.name || "Component";
	WrappedComponent.displayName = `withErrorBoundary(${displayName})`;

	return WrappedComponent;
}
