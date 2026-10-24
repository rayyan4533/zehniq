import { processSource } from "../modules/source/source.job.js";
import { summarizeConversation } from "../modules/chat/conversation-summary.job.js";
import { generateArtifact } from "../modules/artifact/artifact.job.js";

export { processSource, summarizeConversation, generateArtifact };
export const functions = [processSource, summarizeConversation, generateArtifact];
