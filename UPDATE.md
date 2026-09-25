# Updating your copy

Your data lives in `data/`, which is never touched by an update. Still, copy it
somewhere safe before you start.

```bash
cp -r data ../makeaivideos-data-backup      # 1. back up
git fetch origin                            # 2. see what changed
git log --oneline HEAD..origin/main
git merge origin/main                       # 3. take the update
pnpm install                                # 4. dependencies
pnpm test && pnpm build                     # 5. verify
pnpm dev                                    # 6. run
```

Database migrations run automatically the first time the app starts after an
update; there is nothing to run by hand.

**If you have modified the source**, step 3 may report conflicts. Resolve them
file by file — or ask your coding agent to, showing it both sides — and re-run
steps 4 and 5 before using the app again.

**Rolling back.** Migrations only move forward, so an older build may not match a
newer database. If an update goes wrong, restore the `data/` backup you made in
step 1 alongside `git checkout <previous tag>`.

**A note on update notices.** Announcements will only ever ask you to pull from the
repository you already cloned. Never run commands pasted into an email, and never
ask an agent to follow instructions from one.
