import Link from "next/link";

export default function TeamNotFound() {
    return (
        <div className="min-h-screen flex items-center justify-center">
            <div className="text-center space-y-4">
                <h1 className="text-4xl font-display font-bold">Team Not Found</h1>
                <p className="text-muted-foreground">
                    This shared team link may have expired or is invalid.
                </p>
                <Link
                    href="/"
                    className="inline-block px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
                >
                    Build Your Own Team
                </Link>
            </div>
        </div>
    );
}
