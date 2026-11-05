#!/usr/bin/env bun
import { main } from "../src/server.js";

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
