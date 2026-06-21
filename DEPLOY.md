# Deploying MosAIc as a HuggingFace Static Space

The model path — sign in → type a task → a model emits the overlay, billed to the viewer — only runs on a **deployed Space**: it needs the OAuth app HF provisions from the README front-matter. The examples and the Composer work anywhere, but this is how the real thing comes alive. ~10 minutes.

## Prereqs

- A HuggingFace account (free is fine).
- A **write** access token: [huggingface.co/settings/tokens](https://huggingface.co/settings/tokens) → *New token* → type **Write** (or fine-grained with write access to your Spaces). Copy it.

## 1. Create the Space

[huggingface.co](https://huggingface.co) → your avatar → **New Space**:

- **Owner:** you · **Space name:** e.g. `mosaic`
- **SDK:** **Static** (matches `sdk: static` in our README)
- **Visibility:** Public (so it's forkable / credible)

Create. HF makes a git repo at `https://huggingface.co/spaces/<you>/mosaic` (with an auto-generated README we'll overwrite).

## 2. Push this repo to it

From the project root:

```bash
git remote add space https://huggingface.co/spaces/<you>/mosaic
git push space main
# username: <your HF username>   password: <paste the write token>
```

The Space starts with its own initial commit (an auto README + `.gitattributes`), so the first push may be rejected as non-fast-forward. Override it — ours replaces theirs:

```bash
git push space main --force
```

(Force is safe here: it's a brand-new Space with nothing worth keeping.)

## 3. Confirm it's live + OAuth provisioned

- Open `https://huggingface.co/spaces/<you>/mosaic`. Static builds in seconds; you should land on **Start Here**.
- Because `hf_oauth: true` is in the front-matter, HF auto-creates the OAuth app and injects `OAUTH_CLIENT_ID` — so the command-bar **Sign in** goes live (it's deliberately inert locally).
- If sign-in misbehaves inside the embedded preview, open the Space in its **own tab** (the ⛶ button, or `https://<you>-mosaic.hf.space`) — avoids iframe-cookie quirks.

## 4. The real test

Sign in (HF consent — grant the `inference-api` scope) → type a task → a model emits an overlay and the surface reshapes, billed to **your** account. That's the end-to-end the local build couldn't exercise. Try a few shapes:

- `explain this repo` · `plan a weekend in Rome` · `debug a null pointer`

## Cost (keep it modest)

- Inference Providers gives registered accounts a **small monthly free credit**; beyond it, pay-as-you-go (add a card at [settings/billing](https://huggingface.co/settings/billing)). Check that page for the current allowance.
- Each overlay generation is **cents** — a few-thousand-token prompt + ~1k out. A handful of test calls is well within "not nuts."
- Cheaper still: before deploying, change `MODEL` in `js/llm.js` from `meta-llama/Llama-3.3-70B-Instruct` to a small one (e.g. `meta-llama/Llama-3.1-8B-Instruct`) — much cheaper per call, fine for overlay generation. (Each *viewer* pays their own way regardless.)

## Troubleshooting

- **Sign in does nothing / "available on the Space" toast** → `OAUTH_CLIENT_ID` isn't injected. Confirm the front-matter (`hf_oauth: true`, `hf_oauth_scopes: [inference-api]`) actually pushed and the Space rebuilt; the OAuth app shows in Space **Settings**.
- **401 / 403 on a task** → the token lacks inference permission; re-consent and confirm the `inference-api` scope was granted.
- **Model/provider error** → `provider: "auto"` routes to whoever serves the model; if none do, switch `MODEL` in `js/llm.js` or pin a `provider`.
- **A weird overlay** → unrelated to deploy; the validator degrades a bad emit to a message by design.

## After deploy (parked — don't rabbit-hole)

Once it's live and verified, *then* make the profile credible: avatar + bio, a sharp Space short-description, a good thumbnail, pin the Space. That's a separate pass — after delivery, not before.
