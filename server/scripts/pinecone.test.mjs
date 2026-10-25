import assert from "node:assert/strict";
import { test } from "node:test";
import { Pinecone, Errors } from "@pinecone-database/pinecone";

process.env.PINECONE_API_KEY = "test-key";
const { deleteSourceVectors, deleteWorkspaceVectors } = await import("../src/lib/pinecone/pinecone.ts");

test("namespace cleanup", async (t) => {
    t.mock.method(Pinecone.prototype, "listIndexes", async () => ({ indexes: [{ name: "chaibook" }] }));
    t.mock.method(Pinecone.prototype, "describeIndex", async () => ({ dimension: 1536 }));
    let namespaces = {};
    let failure = new Errors.PineconeNotFoundError({});
    let filter;
    const index = {
        namespace: () => ({
            deleteMany: async (options) => { filter = options.filter; if (failure) throw failure; },
            deleteAll: async () => { if (failure) throw failure; },
        }),
        describeIndexStats: async () => ({ namespaces }),
    };
    t.mock.method(Pinecone.prototype, "index", () => index);
    await deleteSourceVectors("workspace", "source");
    await deleteWorkspaceVectors("workspace");
    assert.deepEqual(filter, { sourceId: { $eq: "source" } });
    namespaces = { workspace: { vectorCount: 1 } };
    await assert.rejects(deleteSourceVectors("workspace", "source"), failure);
    namespaces = {};
    failure = new Error("network failure");
    await assert.rejects(deleteSourceVectors("workspace", "source"), failure);
    failure = undefined;
    await deleteSourceVectors("workspace", "source");
});
