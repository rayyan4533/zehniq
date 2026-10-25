export type Workspace = {
  id: string;
  title: string;
  description: string | null;
  icon: string | null;
  defaultModel: string;
  updatedAt: string;
  createdAt: string;
};
export type Source = {
  id: string;
  workspaceId: string | null;
  collectionId?: string | null;
  type: string;
  title: string;
  content: string | null;
  status: "READY" | "PENDING" | "PROCESSING" | "FAILED";
  url?: string | null;
  metadata?: Record<string, unknown>;
};
export type ArtifactType =
  "SUMMARY" | "TAKEAWAYS" | "FLASHCARDS" | "QUIZ" | "MINDMAP" | "REPORT";
export type Artifact = {
  id: string;
  workspaceId: string;
  type: ArtifactType;
  title: string;
  status: string;
  content: unknown;
  sourceIds: string[];
  metadata?: Record<string, unknown>;
};
export type Memory = { id: string; memory: string; source: string };
export type Conversation = { id: string; title: string | null };
export const tools: {
  type: ArtifactType;
  label: string;
  description: string;
  color: string;
  icon: string;
}[] = [
  {
    type: "SUMMARY",
    label: "Summary",
    description: "The big picture, distilled.",
    color: "pink",
    icon: "file",
  },
  {
    type: "FLASHCARDS",
    label: "Flashcards",
    description: "Make knowledge stick.",
    color: "yellow",
    icon: "cards",
  },
  {
    type: "QUIZ",
    label: "Quiz",
    description: "Put yourself to the test.",
    color: "green",
    icon: "quiz",
  },
  {
    type: "MINDMAP",
    label: "Mind map",
    description: "Connect the dots.",
    color: "purple",
    icon: "map",
  },
  {
    type: "TAKEAWAYS",
    label: "Takeaways",
    description: "Keep the good stuff.",
    color: "orange",
    icon: "bulb",
  },
  {
    type: "REPORT",
    label: "Report",
    description: "Go a little deeper.",
    color: "blue",
    icon: "report",
  },
];
const date = "2026-10-24T08:00:00Z";
export const demoWorkspaces: Workspace[] = [
  {
    id: "demo-design",
    title: "Design that makes sense.",
    description:
      "A little psychology. A lot of good design. Exploring how people think, feel, and interact.",
    icon: "✳",
    defaultModel: "gpt-4o-mini",
    createdAt: date,
    updatedAt: date,
  },
  {
    id: "demo-ai",
    title: "Inside the AI rabbit hole",
    description:
      "LLMs, embeddings, and all the things I want to finally understand.",
    icon: "↗",
    defaultModel: "gpt-4o-mini",
    createdAt: date,
    updatedAt: date,
  },
  {
    id: "demo-reading",
    title: "The reading room",
    description:
      "Good ideas from good books. A home for my favorite rabbit holes.",
    icon: "▤",
    defaultModel: "gpt-4o-mini",
    createdAt: date,
    updatedAt: date,
  },
];
export const demoSources: Source[] = [
  {
    id: "demo-s1",
    workspaceId: "demo-design",
    title: "The Design of Everyday Things",
    type: "PDF",
    status: "READY",
    content:
      "Good design makes the right action obvious. Affordances describe what actions are possible; signifiers tell us where an action should take place. Feedback communicates the result of an action. Constraints guide users toward appropriate actions. A useful conceptual model helps people understand how a system works.",
  },
  {
    id: "demo-s2",
    workspaceId: "demo-design",
    title: "Laws of UX — a field guide",
    type: "WEBSITE",
    status: "READY",
    url: "https://lawsofux.com",
    content:
      "Hick's Law: decision time increases with the number and complexity of choices. Fitts's Law: target size and distance affect how quickly a target can be reached. Jakob's Law: people expect familiar behavior. Reduce unnecessary choices, make controls easy to reach, and use familiar patterns.",
  },
  {
    id: "demo-s3",
    workspaceId: "demo-design",
    title: "Why great interfaces feel invisible",
    type: "YOUTUBE",
    status: "READY",
    content:
      "Interfaces feel invisible when their structure matches the user's mental model. Consistency reduces cognitive load. Clear feedback and predictable navigation give users confidence.",
  },
  {
    id: "demo-s4",
    workspaceId: "demo-design",
    title: "My messy design notes",
    type: "MARKDOWN",
    status: "READY",
    content:
      "# Notes\nDesign is a conversation. Be clear before being clever. Use hierarchy to make the next step obvious. Test assumptions with real people. Accessibility belongs at the beginning.",
  },
];
export function demoContent(type: ArtifactType, sources: Source[]): unknown {
  const text = sources
    .map((s) => `## ${s.title}\n${s.content ?? ""}`)
    .join("\n\n");
  if (type === "FLASHCARDS")
    return {
      cards: [
        {
          front: "What is an affordance?",
          back: "An action that an object makes possible, such as pressing a button.",
        },
        {
          front: "What is a signifier?",
          back: "A cue that communicates where or how an action can take place.",
        },
        {
          front: "Why does feedback matter?",
          back: "It helps people understand what happened after an action.",
        },
      ],
    };
  if (type === "QUIZ")
    return {
      questions: [
        {
          question: "What helps someone understand the result of an action?",
          options: ["Feedback", "More choices", "Hidden controls"],
          correctIndex: 0,
          explanation: "Feedback communicates the result and current state.",
        },
        {
          question: "What does Hick’s Law describe?",
          options: [
            "Color contrast",
            "Decision time and choices",
            "Font sizes",
          ],
          correctIndex: 1,
          explanation: "More complex choices can increase decision time.",
        },
        {
          question: "Which is a signifier?",
          options: ["A button label", "The ability to press", "A database"],
          correctIndex: 0,
          explanation: "The label communicates the action.",
        },
      ],
    };
  if (type === "MINDMAP")
    return {
      nodes: [
        { id: "1", label: "Human-centered design" },
        { id: "2", label: "Clear signifiers" },
        { id: "3", label: "Useful feedback" },
        { id: "4", label: "Familiar patterns" },
        { id: "5", label: "Less cognitive load" },
      ],
      edges: [
        { id: "e1", source: "1", target: "2" },
        { id: "e2", source: "1", target: "3" },
        { id: "e3", source: "1", target: "4" },
        { id: "e4", source: "1", target: "5" },
      ],
    };
  if (type === "TAKEAWAYS")
    return {
      items: [
        "Make the next action obvious.",
        "Communicate results with clear feedback.",
        "Use familiar patterns to reduce cognitive load.",
        "Design for accessibility from the start.",
      ],
    };
  if (type === "REPORT")
    return {
      markdown: `# A field guide to better design\n\n${text}`,
      sections: [],
    };
  return {
    markdown: `# The big picture\n\nGood design helps people act with confidence. Clear signifiers, useful feedback, and familiar patterns make an interface easier to understand.\n\n${text}`,
  };
}
