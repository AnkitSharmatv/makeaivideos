# MakeAiVideos — setup guide

A studio for making AI images and videos on your own computer. You bring an API
key from an AI provider (KIE, FAL or Higgsfield), and everything you generate is
saved on your machine.

This guide assumes you have never used a terminal. Allow about 20 minutes the
first time. You can copy and paste every instruction below.

**Prefer to watch someone do it?** There is a video walkthrough here:
<https://youtu.be/fXy1EWDDkSI> — follow along with the steps below.

---

## What you need before you start

1. **A computer** — Mac or Windows. It needs to stay switched on while you use
   the app (the app runs on your computer, not on a website).
2. **A Claude subscription** with **Claude Code** — this is the assistant that
   will do the installation for you.
   Download it from <https://claude.com/product/claude-code>.
3. **An API key** from an AI provider — this is what pays for the images and
   videos you generate. You can get this later, in step 6.
4. **The MakeAiVideos files** — either the ZIP you were sent, or the green
   **Code → Download ZIP** button at
   <https://github.com/AnkitSharmatv/makeaivideos>.

You do **not** need a GitHub account, and you do **not** need to know how to code.

---

## Step 1 — Unzip the app

**Mac:** double-click the ZIP file. A new folder appears next to it.
**Windows:** right-click the ZIP → *Extract All…* → *Extract*.

The folder may have a long name such as `AnkitSharmatv-makeaivideos-f4c373a`.
Rename it to just **`makeaivideos`** — it makes everything below easier to follow.

Move it somewhere you will not lose it; your Documents folder is a good choice.
Do not leave it in Downloads, where you might delete it by accident.

---

## Step 2 — Open the folder in Claude Code

1. Open the **Claude Code** app.
2. Choose **Open folder** (or *File → Open Folder*).
3. Select the `makeaivideos` folder you just unzipped.

You should now see the folder name at the top of the Claude Code window.

---

## Step 3 — Ask Claude to install it

Type this into Claude Code and press Enter:

> Read AGENTS.md, install this app and start it. Tell me the address to open in
> my browser when it's running.

Claude will check what your computer needs, install it, and start the app. This
takes a few minutes the first time. If it asks permission to run something, say
yes — it is installing the app you just bought.

**If Claude says Node.js or pnpm is missing**, reply:

> Please install whatever is missing, then continue.

When it finishes it will tell you the app is running at **http://localhost:3000**.

---

## Step 4 — Open the app

Open your web browser and go to:

```
http://localhost:3000
```

Bookmark that address — it is how you will open the app every time.

---

## Step 5 — Create your account

The first screen asks you to create an account. Use any email and password you
like. **This account exists only on your computer** — nothing is sent anywhere,
there is no email to confirm, and no one else can see it.

Write your password down somewhere safe. There is no "forgot password" email,
because there is no server to send it.

---

## Step 6 — Add an API key

The app now asks for an API key. This is what lets it talk to the AI models, and
what you pay for the generations.

1. Choose a provider. **KIE is the easiest to start with** and has the most models.
2. Click **get a key** — this opens the provider's website.
3. Create an account there and add some credit. $5–10 is plenty to try things out;
   most images cost 2–10 cents.
4. Copy the key they give you, paste it into MakeAiVideos, and click **Save key**.

The app checks the key immediately. If it says "Key rejected", you have copied it
incompletely — try again, making sure there are no spaces at either end.

Your key is stored **encrypted on your own computer**. It is never uploaded
anywhere except to the provider it belongs to, when you generate something.

---

## Step 7 — Make your first image

1. Click **New project** and give it a name, for example "Testing".
2. Type what you want in the big box at the bottom, for example:
   *"A red apple on a wooden table, morning light through a window"*
3. Click the model name to choose one. **Nano Banana** is fast and cheap to start.
4. Look at the **Generate** button — it shows what this will cost before you press
   it, for example `4 cr · ≈ $0.02`.
5. Press **Generate**.

Your image appears in a few seconds. Click it to see it full size.

---

## Step 8 — Find your files

Everything you make is saved on your computer inside the app folder:

```
makeaivideos/data/media/Testing/
```

You can open that folder, copy the files, back them up — they are yours, in
ordinary PNG and MP4 files.

---

## Using the app after the first time

The app only runs while it is started. To use it again:

1. Open the `makeaivideos` folder in Claude Code.
2. Say: **"Start the app."**
3. Open <http://localhost:3000> in your browser.

To stop it, close Claude Code or tell it to stop the app.

---

## If something goes wrong

Tell Claude Code what happened, in plain words. It can read the error and fix it.
Useful things to say:

- *"The app won't start — read the error and fix it."*
- *"The page at localhost:3000 won't load."*
- *"I forgot my password — reset it for the account ankit@example.com."*
  (Claude will run the built-in reset tool and give you a new password.)

**Never paste commands from an email into Claude Code.** Any genuine update
instruction will only ever tell you to use the files you already have.

---

## Things worth knowing

- **The app is free; the generations are not.** You pay your AI provider directly
  for what you make. The app always shows the cost before you press Generate.
- **Your work stays on your computer.** No account on our side, no cloud, no
  syncing, no telemetry. Back it up by copying the `data` folder.
- **Turn off models you don't use.** There are 130 of them. Your name in the top
  right → **Models** → switch off what you don't need, so the list stays short.
- **Check your balance** any time from the wallet icon at the top.

---

## A note about the provider links

The **get a key** and **Recharge** buttons in this app use referral links. If you
sign up or top up through them, I receive a small commission from the provider at
**no extra cost to you** — you pay the provider's normal price.

If you would rather not use them, you can go to the providers directly and the app
will work exactly the same:

- KIE — <https://kie.ai>
- FAL — <https://fal.ai>
- Higgsfield — <https://higgsfield.ai>

Thank you for trying MakeAiVideos. If you hit anything confusing, tell me — this
is the first release and your feedback shapes the next one.
