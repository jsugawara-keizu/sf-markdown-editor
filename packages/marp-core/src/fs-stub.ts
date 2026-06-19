// Stub for Node.js `fs` module used by Marp in browser/VF context.
// Only the methods referenced at import time need to be non-null.
const stub: Record<string, unknown> = {
  existsSync: () => false,
  readFileSync: () => null,
  readdirSync: () => [],
  statSync: () => null,
  lstatSync: () => null,
  promises: {},
};

export default stub;
export const existsSync = stub.existsSync;
export const readFileSync = stub.readFileSync;
export const readdirSync = stub.readdirSync;
export const statSync = stub.statSync;
export const lstatSync = stub.lstatSync;
export const promises = stub.promises;
