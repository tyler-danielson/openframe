import { test } from "node:test";
import assert from "node:assert/strict";
import { chatLinkCode, isValidChatLinkCode } from "./chat-link.js";

process.env.ENCRYPTION_KEY ??= "0".repeat(64);

test("chat link codes are stable, per user and per provider", () => {
  const code = chatLinkCode("telegram", "user-1");
  assert.match(code, /^[A-Za-z0-9_-]{16}$/); // valid in a t.me/<bot>?start= link
  assert.equal(chatLinkCode("telegram", "user-1"), code);
  assert.notEqual(chatLinkCode("telegram", "user-2"), code);
  assert.notEqual(chatLinkCode("whatsapp", "user-1"), code);
});

test("only the exact code links a chat", () => {
  const code = chatLinkCode("whatsapp", "user-1");
  assert.equal(isValidChatLinkCode("whatsapp", "user-1", code), true);
  assert.equal(isValidChatLinkCode("whatsapp", "user-1", ` ${code} `), true);
  assert.equal(isValidChatLinkCode("whatsapp", "user-1", undefined), false);
  assert.equal(isValidChatLinkCode("whatsapp", "user-1", ""), false);
  assert.equal(isValidChatLinkCode("whatsapp", "user-1", "user-1"), false);
  assert.equal(isValidChatLinkCode("whatsapp", "user-2", code), false);
  assert.equal(isValidChatLinkCode("telegram", "user-1", code), false);
});
