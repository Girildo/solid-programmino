# programmino-web

Web port of [programmino-nuovo](https://github.com/Girildo/programmino-nuovo), the Java Swing tool
that tallies photo contests run in Flickr group discussions.

A thread has two phases: people post photos tagged with a number, then a marker comment opens
voting and people post ballots. The app reads the thread, scores it, and produces a report to paste
back into the discussion.

## Running it

```
npm install
cp .env.example .env.local     # then put a Flickr API key in it
npm run dev                    # http://localhost:5173, /api/flickr included
npm run build
npm run typecheck
npm run smoke                  # drives the real UI under jsdom and prints the rankings
npm run preview:server         # builds, then serves through Wrangler like production
npm run deploy                 # builds and pushes to Cloudflare Pages
```

`npm run smoke` builds the app as a library, mounts it in a headless DOM, types into the
textarea and clicks through, then prints what the ranking table actually contains. It exists
because a broken paste parser looks exactly like an empty contest: no exception, no error, just
zero photos.

## The declarative part

In the Java version each contest was a subclass of `LogicaProgramma`, and every subclass re-wrote
parsing, validation, scoring and report building in a single ~180 line method. Here a contest is a
plain object and the engine is shared.

`src/domain/format.ts` defines the schema. A format declares:

- `votingStarts` / `votingEnds`: the marker comments that split the thread into phases
- `photoIdPattern`: how a submission comment reveals its photo number
- `ballot`: the ballot grammar, either `ranked` (one ordered run of ids) or `categorical`
  (one vote per line, tagged with a category)
- `scoring`: `positional` (first preference worth the most) or `flat` (every vote worth the same)
- `tables`: which rankings come out, and which votes feed each one
- `rules`: which checks run, and whether each one is an error or a warning

`src/domain/formats/` holds the three formats. Only Click the CONTEST (four criteria, one photo
each) is offered in the picker; Sonia Gallery (ranked preferences) and Campionato (three categories)
are marked `hidden` because the group no longer runs them. The engine still reads them, so bringing
one back means deleting one line.

Adding a contest means adding one object there and listing it in `formats/index.ts`. No engine
change, no new class.

## Pipeline

`src/domain/engine/` is the single interpreter, one step per file:

1. `segment.ts` walks the thread in order and labels each comment: submission, ballot, marker or
   ignored. The phase split is positional, so a comment is a ballot because of where it sits.
2. `ballots.ts` collects the photos and reads each ballot through the format's grammar.
3. `tally.ts` drops votes that cannot be counted (unknown photo, duplicate, over the limit),
   re-ranks what survives, builds every declared table, and gathers the issues.
4. `report.ts` renders the pasteable text.

`tally()` is pure. The same thread and format always give the same result, which is what makes the
formats easy to poke at.

Photos keep the thumbnail and photo-page URL found in the submission's markup, so the lists can
show the picture on hover. A pasted thread carries no markup and simply has none.

## Sources

The Flickr link is the default way in; pasting is the fallback for when the API will not answer.

`src/sources/paste.ts` reads a pasted thread by finding the author headers. It recognises the name
sitting above a relative timestamp ("Marco Rossi" / "5 years ago"), the older `Nome says:` form,
explicit `@Nome` lines, blocks separated by a line of dashes, and raw JSON from the Flickr API.

Author names take precedence over dashes: once any header is found, a line of dashes is content.
Result tables rule themselves off with dashes, and splitting on those would tear a pasted table
into fragments that then read as ballots.

When no header is recognised the whole paste collapses into one comment, which yields an empty
tally. The UI reports how many comments it found and by which rule, and warns when it found only
one, so a bad paste is visible instead of looking like a contest nobody entered.

`src/sources/flickr.ts` calls `flickr.groups.discuss.replies.getList` directly from the browser.
Verified working: the endpoint sends `access-control-allow-origin: *` and answers an unsigned
request carrying only an API key.

Two things about that call are easy to get wrong. It needs `group_id` as well as `topic_id`, and
without it Flickr answers "Topic not found" rather than naming what is missing; the path alias out
of the discussion URL works as the group id, so no lookup is needed. Paging lives on
`replies.topic`, not next to `replies.reply`, so reading it from the wrong place silently caps a
thread at one page.

The browser never sees the API key. It calls `/api/flickr`, and the server adds the key before
forwarding to Flickr. See below.

## The report does not vote

A finished contest usually has its result table sitting in the thread, and a table full of photo
numbers reads like a ballot to anything that only looks for numbers.

`buildReport` opens with the format's own end marker, so a result pasted back into the discussion
is ignored on the next read. This is what `Risultato Finale` was always for in the Java version;
the report simply never carried it.

That only helps reports made from here on. Tables already in the threads, including every one the
Java version produced, are caught by the patterns in `formats/generated.ts`, which each format
lists as `ignore`. Those are checked before every other rule.

## The server half

The app is static except for one thing: the Flickr API key must not ship to the browser. That is
one function, not a backend.

`shared/flickrProxy.ts` holds the rules and is used by both sides, so there is one implementation
rather than two that drift:

- `functions/api/flickr.ts` is the Cloudflare Pages Function that runs in production.
- `vite.config.ts` mounts the same logic as dev middleware, so `npm run dev` behaves like the
  deployed app.

The rules matter more than the plumbing. The proxy accepts one Flickr method, forwards three
parameters verbatim, range-checks two numeric ones, and rejects anything else. Without the method
allowlist this would be an open Flickr proxy that anyone could drive using your key.

`FLICKR_API_KEY` deliberately has no `VITE_` prefix: Vite only exposes prefixed variables to client
code, so the key cannot reach the bundle by accident.

### Toolchain

Wrangler needs Node 22, so the version is pinned in `package.json` under `volta`. With Volta
installed, entering the directory selects it; without Volta, use Node 22 or newer by hand.

`compatibility_date` in `wrangler.toml` must not be newer than the runtime bundled with the
installed Wrangler, or the local server refuses to start with a date-mismatch error.

Local Function secrets come from `.dev.vars`, which is separate from the `.env.local` the Vite dev
server reads. Both are gitignored, and running the app both ways means putting the key in both.

### Deploying

1. Push the repo and connect it in Cloudflare Pages, or run `npm run deploy` with Wrangler.
2. Set `FLICKR_API_KEY` as an environment variable on the Pages project. Nothing else is needed;
   `wrangler.toml` already points at `dist` and picks up `functions/`.
3. For access control, put the site behind Cloudflare Access and allow the organisers' email
   addresses. It is enforced at the edge before anything loads, so the app needs no login code,
   no sessions and no user table.

## Correcting a thread by hand

The markers that split a thread are ordinary prose matched as substrings, so a member writing
"quando arriva il Come votare?" opens voting on the spot, and in SG a casual "Stop Voting"
discards every comment after it. The Java program behaves the same way.

Rather than guess who is entitled to post a marker, the Commenti panel lists every comment with the
role the format gave it and lets you pin a different one. A pinned role short-circuits every
automatic check for that comment, including an end marker that already fired, so a single
correction can rescue a thread the markers wrecked.

Overrides are keyed by comment index and are cleared whenever a thread is loaded, since an index
only means anything within the thread it came from.

## Differences from the Java version

The engine paginates the discussion; the Java version asks for the first 100 replies and stops.

Ballot length is checked per category. The Java version compares the total against
`categories x preferences`, which cannot say which criterion is short.

Votes past the limit are counted, not discarded, and reported as warnings. The same goes for
`maxVotesPerPhoto`: the group rules cap a photo at two mentions per ballot, the Java program never
checked it, and this reports it without changing the tally.

## Not ported

`LogicaProgrammaCTCS` still throws `UnsupportedOperationException` in the Java source.

`LogicaProgrammaCMS` (Campionato Segreto) reads its votes from Google Forms through Apps Script,
which would need Google OAuth in the browser. Neither it nor the form generator is here.
