// The typed / model path: HF OAuth (the viewer's own token) + Inference
// Providers, called straight from the browser so inference bills to the
// signed-in viewer — no backend, no owner token. The Composer stays the
// no-login path; signing in only unlocks typing a task. The HF libraries load
// lazily from a pinned CDN and fail soft: if they can't load (offline / CDN
// blocked / not on a Space) the model path stays locked and the Composer + the
// example suggestions still work.

import { TASKS } from './demo.js';
import { validateOverlay } from './overlay.js';

// Pinned (verify the URL 200s before bumping). hub = OAuth, inference = chat.
const HUB_URL   = 'https://cdn.jsdelivr.net/npm/@huggingface/hub@2.13.2/+esm';
const INFER_URL = 'https://cdn.jsdelivr.net/npm/@huggingface/inference@4.13.19/+esm';
// A general instruction-following model — MosAIc is for *any* task, not just
// code — reliable at JSON and broadly available on Inference Providers.
// Change freely; `provider: "auto"` routes to whoever serves it.
const MODEL = 'meta-llama/Llama-3.3-70B-Instruct';
const OAUTH_KEY = 'mosaic-oauth';

let _hub, _infer;
const hub   = async () => (_hub   ||= await import(HUB_URL));
const infer = async () => (_infer ||= await import(INFER_URL));

// ── auth state ──────────────────────────────────────────────
let auth = null;   // { accessToken, accessTokenExpiresAt, userInfo }
const listeners = new Set();
export const onAuthChange = (cb) => { listeners.add(cb); return () => listeners.delete(cb); };
const emit = () => listeners.forEach(cb => cb(auth));

export const isSignedIn = () => !!auth?.accessToken;
export const userName = () => auth?.userInfo?.preferred_username || auth?.userInfo?.name || 'account';
// True only on a Space where the OAuth app is provisioned (vars injected).
export const oauthAvailable = () => !!window.huggingface?.variables?.OAUTH_CLIENT_ID;

const valid = (o) => o && o.accessToken && (!o.accessTokenExpiresAt || new Date(o.accessTokenExpiresAt) > new Date());

// Call once on boot: restore a cached token, or complete an OAuth redirect.
export async function initAuth() {
  try {
    const cached = JSON.parse(localStorage.getItem(OAUTH_KEY) || 'null');
    if (valid(cached)) { auth = cached; emit(); return auth; }
    if (cached) localStorage.removeItem(OAUTH_KEY);
  } catch { localStorage.removeItem(OAUTH_KEY); }

  // Only load the hub lib if this load is actually an OAuth callback.
  const q = new URLSearchParams(window.location.search);
  if (!(q.has('code') && q.has('state'))) return auth;
  try {
    const { oauthHandleRedirectIfPresent } = await hub();
    const result = await oauthHandleRedirectIfPresent();
    if (result?.accessToken) {
      auth = result;
      localStorage.setItem(OAUTH_KEY, JSON.stringify(result));
      emit();
    }
  } catch { /* not on a Space / blocked — stays locked, Composer still works */ }
  return auth;
}

export async function signIn() {
  const { oauthLoginUrl } = await hub();
  const scopes = window.huggingface?.variables?.OAUTH_SCOPES;
  window.location.href = (await oauthLoginUrl(scopes ? { scopes } : undefined)) + '&prompt=consent';
}

export function signOut() {
  auth = null;
  localStorage.removeItem(OAUTH_KEY);
  emit();
}

// ── overlay generation ──────────────────────────────────────
let _schema;
async function schema() {
  if (_schema) return _schema;
  try { _schema = await fetch('SCHEMA.md').then(r => r.text()); }
  catch { _schema = 'Overlay = { "views": [ { "id", "title", "layout": "stack|grid|split", "tesserae": [ { "type": "markdown|code|table|diagram|note|tasks", ... } ] } ] }'; }
  return _schema;
}

// Teach the exact output format from the canned task overlays.
const fewShot = () => TASKS.flatMap(t => [
  { role: 'user', content: t.label },
  { role: 'assistant', content: JSON.stringify(t.overlay) },
]);

// Pull the first balanced JSON object out of a model response.
function extractJson(text) {
  if (!text) return null;
  const s = text.replace(/```(?:json)?/gi, '').trim();
  const start = s.indexOf('{');
  if (start < 0) return null;
  let depth = 0;
  for (let i = start; i < s.length; i++) {
    if (s[i] === '{') depth++;
    else if (s[i] === '}' && --depth === 0) {
      try { return JSON.parse(s.slice(start, i + 1)); } catch { return null; }
    }
  }
  return null;
}

async function chat(client, messages, response_format) {
  const params = { model: MODEL, provider: 'auto', messages, max_tokens: 1500, temperature: 0.2 };
  if (response_format) params.response_format = response_format;
  const out = await client.chatCompletion(params);
  return out?.choices?.[0]?.message?.content || '';
}

// task (string) -> validated overlay. Throws with a friendly message on failure.
export async function generateOverlay(task, current = null) {
  if (!isSignedIn()) throw new Error('Sign in with Hugging Face to type a task.');
  const { InferenceClient } = await infer();
  const client = new InferenceClient(auth.accessToken);

  const hasCurrent = current && Array.isArray(current.views) && current.views.length > 0;
  const system = (await schema()) +
    `\n\nYou are MosAIc's overlay generator. Given a task, respond with ONLY a JSON overlay (no prose, no markdown fences) that reshapes the surface for that task: 1–3 views, each with a sensible layout and content-bearing tesserae.

You have NO access to the user's files, repository, or any external or private data — only the text of their task. If the task refers to specific content you don't have (e.g. "this repo", "my code", "the error above") and it isn't included in the task text, do NOT invent details. Instead, build a surface that asks for it — a note explaining you need the content, plus a tessera showing what to paste — and it will reshape once they provide it.

When a "Current surface" is included below, the task may ask you to MODIFY or EXTEND it. Emit a patch, not a fresh surface: reuse a view's "id" to edit it (omit "tesserae" to keep that view's tiles, or include them to replace), add a new "id" to append a view, and "remove": ["id"] to drop one. Include only what changes. Start over with a brand-new surface only if the task is clearly unrelated to what's already there.

When you do have enough — a self-contained task, or content included inline — use specific, realistic content, never lorem-ipsum placeholders.`;
  const ask = hasCurrent ? `Current surface (JSON):\n${JSON.stringify(current)}\n\nTask: ${task}` : task;
  const base = [{ role: 'system', content: system }, ...fewShot(), { role: 'user', content: ask }];

  // 1) guided JSON
  let content = await chat(client, base, { type: 'json_object' });
  let v = validateOverlay(extractJson(content) || {});
  if (v.ok) return v.overlay;

  // 2) corrective retry (some providers ignore response_format)
  const retry = [...base,
    { role: 'assistant', content },
    { role: 'user', content: 'That was not a valid overlay. Reply with ONLY the JSON overlay object — nothing else.' }];
  v = validateOverlay(extractJson(await chat(client, retry, null)) || {});
  if (v.ok) return v.overlay;

  throw new Error('The model didn’t return a valid layout — try rephrasing, or open the Composer to lay it out by hand.');
}
