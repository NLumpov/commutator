import { ulid as generateUlid, incrementBase32 } from "ulid";

let lastTime = -1;
let lastId = "";

export function ulid(): string {
  const now = Date.now();
  // Increment only within the same millisecond; clock changes keep their actual timestamp.
  const id =
    now === lastTime ? lastId.slice(0, 10) + incrementBase32(lastId.slice(10)) : generateUlid(now);

  lastTime = now;
  lastId = id;
  return id;
}
