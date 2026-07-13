"use client";

import { useEffect } from "react";
import { trackPrepEvent } from "@/lib/prep/analytics";

export function NewsroomTracker() {
    useEffect(() => trackPrepEvent("newsroom_view"), []);
    return null;
}
