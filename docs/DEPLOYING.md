# Deploying AI Value at a client

This guide is for the IT, security and data-protection teams of an organisation that wants
to run AI Value on its own infrastructure. It covers what the application is, what data it
stores, how it is secured, how to install and operate it, and the compliance points to settle
before real employee data goes in.

> **Rule of thumb:** real employee data only goes into an instance hosted on the client's own
> infrastructure, after IT security and the data protection officer have approved it. The public
> demo instance is for fictional data only.

---

## 1. What AI Value is

An internal web application that measures AI adoption in teams:

- **Adoption**: each employee declares the AI tools they use and how often.
- **Skills**: self-assessment on 6 domains, plus short quizzes.
- **Feedback**: blockers, ideas and needs, optionally anonymous.
- **Use cases**: a catalogue of concrete uses, with the time saved per week.
- **Update campaigns**: a lead or a manager asks people to update the above; each campaign
  stores a snapshot, which feeds the evolution charts.
- **Dashboards**: personal space, team view (leads), organisation view (management).

Interface in English and French.

## 2. Architecture

```
browser ──HTTPS──► reverse proxy (client) ──► web  (Next.js 16, TypeScript, port 3000)
                                                │  relays /api/* on the internal network
                                                ▼
                                              api  (Python 3.12, FastAPI, port 8820)
                                                │
                                                ▼
                                              db   (PostgreSQL 16, Docker volume)
```

| Component | Technology | Exposed |
|---|---|---|
| `web` | Next.js 16 (React 19, TypeScript), Node 22 | Yes, the only entry point |
| `api` | Python 3.12, FastAPI, SQLAlchemy, Alembic | No, internal Docker network only |
| `db` | PostgreSQL 16 | No, internal Docker network only |

The three services run with Docker Compose. Database migrations are applied automatically
when the `api` container starts.

**Network:** at run time the application makes **no outbound calls**: no external AI service,
no analytics, no telemetry (Next.js telemetry is disabled), no third-party scripts. Internet
access is only needed at **build time**, to download base images (Docker Hub, GHCR), Python
packages (PyPI), Node packages (npm) and the Inter font (Google Fonts, then served locally).
In a closed environment, build the images once on a connected machine or through internal
mirrors, then push them to an internal registry.

## 3. Data inventory

Everything is stored in the PostgreSQL database. Nothing is stored in the browser except the
session cookie and the language preference.

| Data | Content | Personal data |
|---|---|---|
| Users | name, work email, job title, role, team, language, last visit | Yes |
| Credentials | password hash (scrypt, salted), session token hashes (SHA-256) | Yes (secrets) |
| AI tool usage | tool name and frequency, per user | Yes |
| Self-assessment | level 0–3 on 6 domains, per user | Yes |
| Quiz attempts | score and answers, per user | Yes |
| Campaign snapshots | the above, frozen at each campaign, plus the optional check-in (usage level, satisfaction, blockers, comment) | Yes |
| Use cases | free text written by the author (problem, method, prompt), time saved, author | Yes (authorship and free text) |
| Feedback | free text, team; author **only if not anonymous** | Yes, unless anonymous |
| Invitations | invited email, role, team, token hash | Yes |

**Free-text fields** (use cases, feedback, comments) can contain anything people type. Remind
users not to paste confidential or customer data into them.

## 4. Security and privacy model

- **Authentication**: email and password. Passwords hashed with scrypt. Sessions are random
  opaque tokens: only their SHA-256 hash is stored. 30-day expiry.
- **Cookie**: `httpOnly`, `SameSite=Lax`, `Secure` when served over HTTPS (`COOKIE_SECURE=true`).
- **Accounts by invitation only**: personal single-use links, or team links valid 14 days.
  There is no public sign-up.
- **API never exposed**: it is reachable only from `web`, which adds a shared secret
  (`INTERNAL_API_TOKEN`). Direct calls without it are refused.
- **Brute-force protection**: 8 failed logins per email per 10 minutes (in memory).
- **Roles**: member < team lead < management < admin. A lead sees their own team only.
- **Isolation**: every business table carries an organisation id. A user never sees another
  organisation's data.
- **Anonymity threshold**: check-in results (satisfaction, blockers, comments) are hidden
  whenever fewer than **3** people answered (`MIN_GROUP_SIZE`).
- **No individual scores for managers**: lead and management views show activity (campaigns
  answered, self-assessment done, number of tools and use cases, quiz score), never a
  person's check-in answers.
- **Anonymous feedback** stores no author at all, only the team: even an admin reading the
  database cannot link it to a person.

**Not available yet** (see section 9): single sign-on, self-service password reset, email
notifications.

## 5. Option A: local evaluation on a workstation

For a demo or an evaluation on one machine, with Docker Desktop or Docker Engine. The app is
only reachable from that machine.

```bash
git clone <repository> ai-value && cd ai-value
cat > .env <<EOF
DB_PASSWORD=$(openssl rand -hex 24)
INTERNAL_API_TOKEN=$(openssl rand -hex 32)
PUBLIC_URL=http://localhost:3000
EOF
docker compose -f docker-compose.yml -f docker-compose.local.yml up -d --build
```

Open <http://localhost:3000>. Then create the first organisation and its admin (section 7).

To show the product with fictional data only (never on an instance holding real data):

```bash
docker compose exec api python -m scripts.admin demo --lang en --no-superadmin \
  --admin-email demo@example.com --password '<a password>'
```

## 6. Option B: server deployment

### Requirements

- A Linux server or VM with **Docker Engine 24+** and the **Compose v2** plugin.
- **2 vCPU, 4 GB RAM, 20 GB disk** comfortably cover a few thousand users.
- A **DNS name** (for example `aivalue.intranet.example.com`) and an **HTTPS reverse proxy**
  (nginx, Traefik, F5…) with the company certificate.
- Internet access at build time, or pre-built images in an internal registry (section 2).

### Installation

```bash
git clone <repository> /opt/ai-value && cd /opt/ai-value
cat > .env <<EOF
DB_PASSWORD=$(openssl rand -hex 24)
INTERNAL_API_TOKEN=$(openssl rand -hex 32)
PUBLIC_URL=https://aivalue.intranet.example.com
COOKIE_SECURE=true
WEB_BIND=127.0.0.1
WEB_PORT=3000
EOF
chmod 600 .env
docker compose -f docker-compose.yml -f docker-compose.local.yml up -d --build
```

`WEB_BIND=127.0.0.1` keeps the app reachable only by the reverse proxy on the same host.

### Reverse proxy (nginx example)

```nginx
server {
    listen 443 ssl;
    server_name aivalue.intranet.example.com;
    ssl_certificate     /etc/ssl/certs/aivalue.crt;
    ssl_certificate_key /etc/ssl/private/aivalue.key;

    location / {
        proxy_pass         http://127.0.0.1:3000;
        proxy_set_header   Host $host;
        proxy_set_header   X-Forwarded-Proto https;
        proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

## 7. First setup

1. Create the organisation and get the invitation link of its first admin:

   ```bash
   docker compose exec api python -m scripts.admin create-org "Company name" \
     --admin-email first.admin@company.com
   ```

2. The admin opens the link, creates their account, then in **Admin**:
   creates the teams, invites leads and members (personal links or team links to post on
   Teams or Slack), and adjusts the list of **allowed AI tools**.
3. A lead or a manager launches the first **update campaign**: it is the baseline.

Do **not** run the `demo` command on an instance that holds real data.

## 8. Operations

| Task | Command |
|---|---|
| Status | `docker compose ps` |
| Logs | `docker compose logs -f api web` |
| Upgrade | `git pull && docker compose -f docker-compose.yml -f docker-compose.local.yml up -d --build` (migrations run automatically) |
| Backup | `docker compose exec -T db pg_dump -U aivalue -Fc aivalue > aivalue-$(date +%F).dump` |
| Restore | `docker compose exec -T db pg_restore -U aivalue -d aivalue --clean < aivalue-YYYY-MM-DD.dump` |
| Reset a password | `docker compose exec api python -m scripts.admin create-user user@company.com --org-slug <slug> --role member` (prints a new password; use the user's current role and `--team` to keep them unchanged) |
| Deactivate a user | Admin → Members → untick "Active" |

Schedule the backup daily and keep copies outside the server, under the company's backup
policy. The database lives in the Docker volume `aivalue-db`.

**Erasing a person** (GDPR right to erasure), in SQL:

```bash
docker compose exec db psql -U aivalue -c "DELETE FROM users WHERE email = 'person@company.com';"
```

This deletes their sessions, tool usage, self-assessment, quiz attempts and campaign
snapshots. Their use cases and signed feedback are kept but no longer linked to anyone.

**Rotating secrets**: change `INTERNAL_API_TOKEN` in `.env` and run `up -d` again (this does not
sign anyone out). Changing `DB_PASSWORD` also requires changing the PostgreSQL user's password.

## 9. Compliance checklist (GDPR, works council)

Settle these before real data goes in:

- [ ] **Approval** from IT security for hosting and from the **DPO**.
- [ ] Entry in the **record of processing activities**: purpose (measuring AI adoption, skills
      and needs in order to steer training and tools), legal basis (typically legitimate
      interest), data categories (section 3), recipients (admins, leads for their team,
      management), retention period.
- [ ] **Information notice** to employees: what is collected, who sees what, the anonymity
      threshold, their rights (access, rectification, erasure).
- [ ] **Works council** informed or consulted, depending on local rules.
- [ ] A written commitment that the tool is **not used for individual performance
      evaluation**.
- [ ] A **retention period**, for example deleting campaigns older than 24 months.
- [ ] Usage rule for **free-text fields**: no customer data or confidential information.

## 10. Known limitations and roadmap

| Today | Planned |
|---|---|
| Email and password sign-in | Single sign-on (Microsoft Entra ID, Google) |
| Password reset by an admin (CLI) | Self-service password reset |
| Invitations and reminders copied and pasted | Email notifications |
| Erasure through SQL | Erasure and export from the admin interface |
| Brute-force limit kept in memory (one `api` instance) | Shared limit for several instances |
