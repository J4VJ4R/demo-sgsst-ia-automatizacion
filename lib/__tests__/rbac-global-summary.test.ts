import assert from "node:assert/strict";
import { canViewGlobalSummary } from "../rbac";

function run() {
  assert.equal(canViewGlobalSummary("ADMIN_PMD"), true);
  assert.equal(canViewGlobalSummary("CONSULTANT"), true);
  assert.equal(canViewGlobalSummary("CLIENT"), true);
  assert.equal(canViewGlobalSummary("CLIENT_VIEWER"), true);

  assert.equal(canViewGlobalSummary("COLLABORATOR"), false);
  assert.equal(canViewGlobalSummary(""), false);
  assert.equal(canViewGlobalSummary(null), false);
  assert.equal(canViewGlobalSummary(undefined), false);

  console.log("rbac-global-summary tests passed");
}

run();

