import assert from "node:assert";
import {
  getCollaboratorDocumentStatus,
  ActivityWithDocuments,
} from "../collaborator-status";

function makeActivity(docCount: number): ActivityWithDocuments {
  return {
    documents: Array.from({ length: docCount }, (_, index) => ({
      id: `doc-${index + 1}`,
    })),
  };
}

async function run() {
  assert.strictEqual(
    getCollaboratorDocumentStatus([]),
    "CON_PENDIENTES"
  );

  assert.strictEqual(
    getCollaboratorDocumentStatus([makeActivity(0)]),
    "CON_PENDIENTES"
  );

  assert.strictEqual(
    getCollaboratorDocumentStatus([makeActivity(1), makeActivity(0)]),
    "CON_PENDIENTES"
  );

  assert.strictEqual(
    getCollaboratorDocumentStatus([makeActivity(1), makeActivity(2)]),
    "AL_DIA"
  );

  console.log("collaborator-status tests passed");
}

run();

