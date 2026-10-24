import "dotenv/config";
import { getMem0Client } from "../src/lib/mem0.js";

async function main() {
    if (!process.env.MEM0_API_KEY?.trim()) {
        console.error("Set MEM0_API_KEY in server/.env, then run pnpm check:mem0.");
        process.exitCode = 1;
        return;
    }
    // Read only: validates access without creating or changing any memories.
    await getMem0Client().getAll({
        filters: { user_id: "notebook-road-lm-connection-check" },
        page: 1,
        pageSize: 1,
    });
    console.log("Mem0 connection OK. No memories were created or modified.");
}

main().catch(() => {
    console.error("Mem0 connection failed. Check the API key, project access, and network connection.");
    process.exitCode = 1;
});
