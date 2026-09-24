# Contact Sheet

A lead engine for kevinsarasom.com. It finds businesses with a reason to hire you right now, checks their websites for contact details, scores each one against your five services, and writes an email draft you can review, edit and send. You triage everything on a dashboard designed like a contact sheet: circle the keepers, cross out the rest.

Nothing is ever sent automatically. The bot finds the leads and writes the drafts; you decide who gets an email.

## Where the leads come from

| Source | What it looks for | Best for |
| --- | --- | --- |
| **News** (Google News) | Companies that just raised money, opened a Toronto office, launched something, or pet brands in the news | Headshots, Nomadic Pods, experiential, Off Leash licensing |
| **Podcasts** (Apple Podcasts) | Business podcasts, ranked higher when they're Canadian or Toronto-based, stalled, audio-only, or run by a company | Nomadic Pods |
| **Map** (OpenStreetMap) | Independent pet shops, groomers, dog daycares and shelters around each Off Leash tour city | Off Leash tour partners, Pet Rescue shelters and sponsors |
| **You** (`add`) | Any company website you paste in | Whatever fits |

Every lead is then crawled (homepage plus up to three contact, about or team pages) for emails, phone numbers, social links, team size, video and podcasts, and any "no unsolicited email" notice.

## Get started

You need Python 3.11 or newer.

```sh
cd contact-sheet
python3 -m pip install -r requirements.txt
```

Open `config.toml` and fill in `[sender]`, at least `email` and `mailing_address`. Canada's anti-spam law requires both in every commercial email, and until you add the address the drafts say so in capitals.

```sh
python3 -m contactsheet run            # find, check, score and draft (10 to 20 minutes the first time)
python3 -m contactsheet serve --open   # the dashboard, at http://localhost:8765
```

Later runs are faster: websites are only crawled again after 30 days, and your statuses, notes and edited drafts are never overwritten.

## Working the sheet

Each frame shows the service the lead fits best, a score out of 100, the top reason, and how you can reach them. Filter by service, status or city, or search. Open a frame to see:

- **Why it fits:** every service it scored for, with the reasons behind each point.
- **Draft email:** one per service that fits, ready to copy or open in your mail app. Edit and hit *Save edits*, and future runs leave that draft alone.
- **How to reach them:** emails (with the page each was found on), phone, website and socials.
- **Signals:** the headlines, podcast stats or map listing that made it a lead.

Mark leads as you go: <kbd>C</kbd> circle, <kbd>S</kbd> sent, <kbd>R</kbd> replied, <kbd>B</kbd> booked, <kbd>X</kbd> pass, and <kbd>J</kbd>/<kbd>K</kbd> to move to the next or previous lead. Circled leads get a red grease-pencil ring and passed ones a big X, as on a real contact sheet.

## Commands

```sh
python3 -m contactsheet run [--source news podcasts map] [--no-enrich] [--ai]
python3 -m contactsheet add acme.com studio.ca --city Toronto   # or --file companies.csv
python3 -m contactsheet serve [--port 8765] [--open]
python3 -m contactsheet list [--service nomadic_pods] [--status new] [--top 20]
python3 -m contactsheet digest [--send]                         # best new leads, by email or to a file
python3 -m contactsheet report [-o sheet.html]                  # the dashboard as one self-contained file
python3 -m contactsheet export [-o leads.csv] [--min-score 50]   # for a spreadsheet or another CRM
python3 -m contactsheet mark 42 sent --note "Emailed Sam"
```

Everything is stored in `data/leads.db` (SQLite). The `data/` folder is git-ignored, and it has to stay that way because this repo is public.

## Make it automatic

### Weekly email digest

`digest --send` emails you the best new leads since the last digest. Set these environment variables. For Gmail, create an [app password](https://myaccount.google.com/apppasswords) and use it in place of your normal password:

```sh
export CONTACT_SHEET_SMTP_HOST=smtp.gmail.com
export CONTACT_SHEET_SMTP_PORT=587
export CONTACT_SHEET_SMTP_USER=you@gmail.com
export CONTACT_SHEET_SMTP_PASSWORD=your-app-password
export CONTACT_SHEET_DIGEST_TO=you@gmail.com
```

Without them, `digest` writes the email to `data/digest-<date>.html` instead.

### Option 1: on your own computer (most private)

Run it with cron (Mac or Linux). `crontab -e`, then add this line to run every Monday and Thursday at 7am:

```
0 7 * * 1,4 cd /path/to/super-garbanzo/contact-sheet && /usr/bin/python3 -m contactsheet run && /usr/bin/python3 -m contactsheet digest --send
```

### Option 2: GitHub Actions

`.github/workflows/contact-sheet.yml` runs the bot on Mondays and Thursdays and emails the digest. Add the five `CONTACT_SHEET_*` values above as repository secrets (Settings → Secrets and variables → Actions), and optionally `ANTHROPIC_API_KEY`. You can also start a run by hand from the Actions tab.

Keep in mind that this repo is public. The workflow runs with `--quiet` so lead names never show up in the public logs, and the lead database lives in the Actions cache rather than in git. If you'd rather your lead list never touch GitHub, make the repo private or use option 1.

## Claude-written openers (optional)

With an `ANTHROPIC_API_KEY` set, `run --ai` has Claude rewrite the subject line and the first sentence or two of the strongest drafts (score 50 or more, up to 25 per run). It uses only facts the bot actually found: the headline, the podcast stats, the website's own description. It never invents details or claims you listened to or visited anything. The model, effort and limits are in the `[ai]` section of `config.toml`.

## Tuning

Everything lives in `config.toml`:

- `[[cities]]`: tour stops for the map source. Add, remove or resize them.
- `[sources.news] queries`: the Google News searches, each tagged with the kind of signal it produces. Add one for any trigger you care about, for example `{ q = 'Toronto law firm new partners', signal = "expansion", local = true }`.
- `[sources.podcasts] terms`: the industries to search. Shows in other languages, or quiet for more than 18 months, are skipped.
- `[sources.map] categories`: add `"vet"` to include vet clinics as sponsor leads.
- `exclude_words`, `skip_names`, `skip_publishers`: noise filters.
- `[bot]`: crawl politeness and when drafts get written.

The email templates are plain text in `templates/`. Edit them freely: `{greeting}`, `{hook}`, `{company}`, `{city}` and `{signoff}` get filled in.

## Staying on the right side of the rules

This is not legal advice, but the tool is built around how CASL (Canada) and CAN-SPAM (US) treat cold B2B email:

- It only collects business addresses a company published on its own website, podcast feed or map listing, and records where each was found. Under CASL, a conspicuously published business address can be emailed about something relevant to the recipient's business role, unless they say they don't want unsolicited messages.
- If a site says it doesn't want unsolicited email, the lead is flagged "No cold email". Use their contact form or call instead.
- Every draft identifies you, includes your mailing address and offers a one-line way to opt out. When someone opts out, mark them **Pass** within 10 business days and they won't come up again.
- The crawler identifies itself (`ContactSheetBot`, linking to kevinsarasom.com), obeys robots.txt, waits between requests to the same site, and reads at most four pages per site.

## How scoring works

Each service starts at zero and earns points for evidence, with a reason attached to every point. News counts once per kind of event and fades after three weeks. Podcasts earn points for being local, stalled, audio-only or clearly a company's show, and big established shows score lower. Pet businesses in tour cities rank high for Off Leash, shelters for Pet Rescue, and a published email adds 10. Scores cap at 100. The rules are in `contactsheet/score.py` if you want to change the weights.

## Tests

```sh
python3 -m unittest discover -s tests -t .
```
