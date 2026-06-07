# EcoLens System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│  BROWSER / FRONTEND (Next.js)                                                                                           │
│  • Authenticates via Cognito hosted UI (Authorization Code flow)                                                        │
│  • Calls API Gateway with JWT Bearer token for all protected routes                                                     │
└────────────────────────────────┬────────────────────────────────────────────────────────────────────────────────────────┘
                                 │ HTTPS + JWT
                                 ▼
╔══════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════╗
║  AWS CLOUD                                                                                                               ║
║                                                                                                                          ║
║  ┌───────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐  ║
║  │  Cognito User Pool  (JWT issuer — email/password, OAuth2 Code flow, Cognito hosted UI)                           │  ║
║  │  ┌────────────────────────────────────────────────────────────────────────────────────────────────────────────┐  │  ║
║  │  │  API Gateway v2 (HTTP API)  — Cognito JWT authorizer on all routes except /inference-results               │  │  ║
║  │  │                                                                                                            │  │  ║
║  │  │  Upload / Manage          Search / Query              Notifications           Cross-cloud callback         │  │  ║
║  │  │  ──────────────────────   ───────────────────────     ───────────────────     ──────────────────────────   │  │  ║
║  │  │  POST /presign            POST /search-by-tags        GET  /notifications     POST /inference-results      │  │  ║
║  │  │  GET  /all-files          POST /search-by-species     POST /notifications/    (no JWT — HMAC secret)       │  │  ║
║  │  │  POST /delete-media       POST /lookup-by-thumbnail        read              │                             │  │  ║
║  │  │  POST /update-file-tags   POST /detect-image-tags     POST /subscribe        │                             │  │  ║
║  │  │  GET  /hello              POST /detect-image-tags     GET  /subscribe        │                             │  │  ║
║  │  │                                                       DEL  /subscribe        │                             │  │  ║
║  │  └──────┬─────────┬──────────────────┬──────────────────────────┬──────────────┴─────────────────────────────┘  │  ║
║  │         │         │                  │                          │              │                                  │  ║
║  └─────────┼─────────┼──────────────────┼──────────────────────────┼──────────────┼──────────────────────────────────┘  ║
║            │         │                  │                          │              │                                      ║
║            │         │                  │                          │              │                                      ║
║  ┌─────────▼──────┐  │  ┌───────────────▼────────────────────┐   │  ┌───────────▼──────────────────────────────────┐  ║
║  │  UPLOAD ΛAMBDAS│  │  │  QUERY ΛAMBDAS  (python3.11 zip)   │   │  │  NOTIFY ΛAMBDAS                              │  ║
║  │  ─────────────-│  │  │  ─────────────────────────────────-│   │  │  ──────────────────────────────────────────  │  ║
║  │  create-       │  │  │  search-by-tags    → DynamoDB scan  │   │  │  subscribe-notifications                     │  ║
║  │   presign-url  │  │  │  search-by-species → DynamoDB + S3  │   │  │  → SNS subscribe / unsubscribe              │  ║
║  │  (dedup check  │  │  │  lookup-by-        → DynamoDB query  │   │  │  → DynamoDB user-subscriptions             │  ║
║  │   via DynamoDB │  │  │   thumbnail                          │   │  │  → DynamoDB user-notifications             │  ║
║  │   checksum GSI)│  │  │  detect-image-tags → DynamoDB        │   │  │                                             │  ║
║  │  delete-media  │  │  │  update-file-tags  → DynamoDB        │   │  │  accept-results  (HMAC-validated)           │  ║
║  │  list-all-files│  │  │  list-all-files    → DynamoDB scan   │   │  │  → DynamoDB UpdateItem (tags, status)      │  ║
║  │  health        │  │  │  query-test        (dev only)        │   │  │  → SNS publish → email subscribers         │  ║
║  └────────┬───────┘  │  └──────────────────────┬──────────────┘   │  └──────────────────────────────────────────────┘  ║
║           │          │                          │                   │                      ▲                             ║
║           │ presigned │                          │                   │                      │ HTTPS POST                  ║
║           │ PUT URL   │                          │                   │                      │ X-Callback-Secret           ║
║           │           │                          │                   │                      │ (from GCP Cloud Run)        ║
║  ─ ─ ─ ─ ▼─ ─ ─ ─ ─ ─│─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─│─ ─ ─ ─ ─ ─ ─ ─ ─│─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─│─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─  ║
║  ┌────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐  ║
║  │  S3 Media Bucket  (single bucket, EventBridge notifications ON)                                                    │  ║
║  │                                                                                                                    │  ║
║  │   tmp/images/{id}/  ──────────────────────────────────────────────────────────────────────────────────────────┐   │  ║
║  │   tmp/videos/{id}/  (browser direct upload via presigned PUT)                                                  │   │  ║
║  │                                                                                                                │   │  ║
║  │   images/{id}/      ─────────────────────────────────────────────────────────────────────────────────────┐   │   │  ║
║  │   videos/{id}/      (permanent, moved/copied after validation)                                            │   │   │  ║
║  │                                                                                                           │   │   │  ║
║  │   thumbnails/{id}/  (written by on-media-uploaded Lambda) ──────────────────────────────────────────┐    │   │   │  ║
║  └───────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘  ║
║                                                   │                  │                    │                              ║
║  ┌────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐  ║
║  │  EventBridge  (default bus)                    │                  │                    │                            │  ║
║  │                                                │                  │                    │                            │  ║
║  │  Rule: S3 Object Created  tmp/images|videos/ ──┘                  │                    │                            │  ║
║  │         └──► on-tmp-uploaded λ                                    │                    │                            │  ║
║  │              emits  ecolens.metadata.created (job_type=temporary)  │                    │                            │  ║
║  │                                   │                               │                    │                            │  ║
║  │  Rule: S3 Object Created  images|videos/ ─────────────────────────┘                    │                            │  ║
║  │         └──► on-media-uploaded λ  (container, ECR, 1 GB RAM)                           │                            │  ║
║  │              makes thumbnail → writes  thumbnails/                                      │                            │  ║
║  │                                                                                         │                            │  ║
║  │  Rule: S3 Object Created  thumbnails/ ──────────────────────────────────────────────────┘                            │  ║
║  │         └──► on-thumbnail-created λ                                                                                 │  ║
║  │              DynamoDB PutItem (media table)                                                                          │  ║
║  │              emits  ecolens.metadata.created                                                                         │  ║
║  │                                   │                                                                                  │  ║
║  │  Rule: ecolens.metadata.created ──┘                                                                                  │  ║
║  │         └──► resolve-and-forward λ                                                                                   │  ║
║  │              reads DynamoDB record, generates presigned GET URL                                                       │  ║
║  │              emits  ecolens.gcp.inference ──────────────────────────────────────────────────────────────────────┐    │  ║
║  │                                                                                                                  │    │  ║
║  │  Rule: ecolens.gcp.inference ────────────────────────────────────────────────────────────────────────────────── ┘    │  ║
║  │         └──► API Destination (EventBridge → GCP)                                                               │    │  ║
║  │              Connection: API_KEY  X-Callback-Secret (Secrets Manager)                                          │    │  ║
║  │              Retry: 10 attempts / 1 hr                                                                          │    │  ║
║  │              DLQ: SQS  gcp-inference-dlq (14-day retention)                            ┌───────────────────┐    │  ║
║  └─────────────────────────────────────────────────────────────────────────────────────── │   SQS DLQ         │───┘  ║
║                                                                                            └───────────────────┘        ║
║  ┌──────────────────────────────────┐  ┌────────────────────────────────────┐  ┌───────────────────────────────────┐   ║
║  │  DynamoDB Tables                 │  │  SNS  media-alerts                 │  │  Secrets Manager                  │   ║
║  │  ────────────────────────────── │  │  (email subscription)              │  │  callback_secret  (shared HMAC)   │   ║
║  │  media          (file_id PK,    │  │  → SNS email → subscribers         │  │  GCP SA key                       │   ║
║  │                  checksum GSI)  │  └────────────────────────────────────┘  └───────────────────────────────────┘   ║
║  │  tmp_query      (file_id PK)    │                                                                                    ║
║  │  user-subscriptions             │  ┌────────────────────────────────────┐  ┌───────────────────────────────────┐   ║
║  │  user-notifications             │  │  ECR  (container registry)         │  │  Cognito  User Pool               │   ║
║  └──────────────────────────────────┘  │  on-media-uploaded image          │  │  + User Pool Client               │   ║
║                                        │  base_image                       │  │  + Hosted UI domain               │   ║
║                                        └────────────────────────────────────┘  └───────────────────────────────────┘   ║
╚══════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════╝
                                          │ HTTPS POST (EventBridge API Destination)
                                          │ Header: X-Callback-Secret   ← from Secrets Manager
                                          │ Body:   { file_id, presigned_url, file_type, job_type }
                                          ▼
╔══════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════╗
║  GCP CLOUD                                                                                                               ║
║                                                                                                                          ║
║  ┌──────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐   ║
║  │  Cloud Function gen2 — accept-inference                                                                          │   ║
║  │  • Validates X-Callback-Secret (HMAC, from Secret Manager)                                                       │   ║
║  │  • Routes by file_type:                                                                                          │   ║
║  │      image → publishes to  image-inference-requests  Pub/Sub topic                                               │   ║
║  │      video → publishes to  video-inference-requests  Pub/Sub topic                                               │   ║
║  └───────────────────────────────┬─────────────────────────────────────────┬──────────────────────────────────────────┘  ║
║                                  │                                         │                                              ║
║              ┌───────────────────▼────────────────┐   ┌────────────────────▼────────────────┐                            ║
║              │  Pub/Sub  image-inference-requests  │   │  Pub/Sub  video-inference-requests  │                            ║
║              └───────────────────┬────────────────┘   └────────────────────┬────────────────┘                            ║
║                                  │  Eventarc trigger                        │  Eventarc trigger                           ║
║                                  ▼                                          ▼                                             ║
║  ┌──────────────────────────────────────────────┐  ┌───────────────────────────────────────────────────────────────┐    ║
║  │  Cloud Run v2 — image-processor              │  │  Cloud Run v2 — video-processor                               │    ║
║  │  (internal ingress, scale 0–20)              │  │  (internal ingress, scale 1–10)                               │    ║
║  │  CPU: 1  RAM: 4 GiB                          │  │  CPU: 2  RAM: 8 GiB  Timeout: 60 min                         │    ║
║  │                                              │  │                                                               │    ║
║  │  1. Download image via presigned_url         │  │  1. Download video via presigned_url                         │    ║
║  │  2. Run MegaDetector (mdv5a.onnx)            │  │  2. FFmpeg → extract frames @ 1 fps (max 600)               │    ║
║  │  3. Run species classifier (model.onnx)      │  │  3. Run ONNX detector + classifier per frame (2 threads)    │    ║
║  │  4. POST results → AWS API GW                │  │  4. Aggregate species counts (max per species)              │    ║
║  │     /inference-results                       │  │  5. POST results → AWS API GW                               │    ║
║  └──────────────────────┬───────────────────────┘  │     /inference-results                                       │    ║
║                         │                          └───────────────────────────────┬───────────────────────────────┘    ║
║                         │                                                          │                                     ║
║  ┌──────────────────────▼──────────────────────────────────────────────────────────▼──────────────────────────────┐    ║
║  │  GCS Bucket — models  (mdv5a.onnx  +  model.onnx)  — read at container cold-start                              │    ║
║  └───────────────────────────────────────────────────────────────────────────────────────────────────────────────┘    ║
║                                                                                                                          ║
║  ┌────────────────────────────────────┐  ┌──────────────────────────────────────┐  ┌─────────────────────────────┐      ║
║  │  GCS Bucket — function-source      │  │  Artifact Registry                   │  │  Secret Manager             │      ║
║  │  (accept-inference zip, versioned) │  │  image-processor image               │  │  callback-secret  (HMAC)    │      ║
║  └────────────────────────────────────┘  │  video-processor image               │  └─────────────────────────────┘      ║
║                                          └──────────────────────────────────────┘                                        ║
╚══════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════╝
                         │                          │
                         └──────────┬───────────────┘
                                    │ HTTPS POST  /inference-results
                                    │ Header: X-Callback-Secret  (same shared secret, HMAC-validated in Lambda)
                                    ▼
                     AWS API Gateway  →  accept-results λ
                                            │
                                            ├── DynamoDB UpdateItem  (tags, inference_status)
                                            └── SNS publish  →  email subscribers
```

---

## How Stuff Flow

### 1. Upload (two paths)

**Temporary (query-only) path:**

User pick file. Frontend ask `POST /presign`. Lambda check checksum in DynamoDB—stop if dupe. Return presigned S3 `PUT` URL. Browser upload direct to S3 `tmp/images/` or `tmp/videos/`. EventBridge see object land, fire `on-tmp-uploaded`. Lambda read S3 metadata, emit `ecolens.metadata.created` with `job_type=temporary`. Resolver pick up event, generate presigned `GET` URL, emit `ecolens.gcp.inference` → inference starts right away. No thumbnail, no permanent record.

**Permanent path:**

Same presign step but target `images/` or `videos/` prefix. EventBridge fire `on-media-uploaded` (container Lambda, ECR image). It make thumbnail → write to `thumbnails/`. EventBridge see thumbnail, fire `on-thumbnail-created`. Lambda write DynamoDB record + emit `ecolens.metadata.created`. Resolver emit `ecolens.gcp.inference`. Now file is permanent and queryable.

### 2. Inference (Cross-Cloud)

EventBridge API Destination fire HTTPS POST to GCP Cloud Function with `X-Callback-Secret` header and payload `{file_id, presigned_url, file_type, job_type}`. If delivery fail, retry 10x over 1 hr then park in SQS DLQ.

Cloud Function validate secret, then push message to right Pub/Sub topic (image or video). Eventarc deliver message to Cloud Run v2 worker (internal ingress only—no public access). Worker download file from S3 via presigned URL, run ONNX model (`mdv5a.onnx` detector then `model.onnx` classifier). Video worker also do FFmpeg frame extraction first. Worker POST result back to AWS API Gateway `POST /inference-results` with same `X-Callback-Secret`. Lambda `accept-results` validate HMAC, update DynamoDB, publish SNS → email user.

### 3. Search & Query

All query routes hit API Gateway (JWT required). Seven Lambda functions read DynamoDB and/or generate presigned `GET` URLs for media:

| Route | Lambda | Does |
|---|---|---|
| `POST /search-by-tags` | search-by-tags | Scan media table by tag values |
| `POST /search-by-species` | search-by-species | Query by species name + presigned URLs |
| `POST /lookup-by-thumbnail` | lookup-by-thumbnail | Find record by thumbnail key |
| `POST /detect-image-tags` | detect-image-tags | Return inference tags for a file |
| `POST /update-file-tags` | update-file-tags | Write user-edited tags to DynamoDB |
| `POST /delete-media` | delete-media | S3 delete + DynamoDB remove |
| `GET  /all-files` | list-all-files | Scan whole media table (paginated) |

### 4. Notifications

User call `POST /subscribe` with email → Lambda subscribe email to SNS topic + store in DynamoDB. When inference done, `accept-results` publish SNS message → AWS send email. User poll `GET /notifications` or mark read with `POST /notifications/read` — both hit DynamoDB.

---

## Components Quick-Ref

### AWS Resources

| Resource | Type | Purpose |
|---|---|---|
| API Gateway v2 | HTTP API | Single entry point, Cognito JWT auth |
| Cognito User Pool | Auth | Email/password, OAuth2, JWT issuer |
| S3 media bucket | Object store | Temp + permanent media, thumbnails |
| ECR | Container registry | on-media-uploaded + base_image Docker images |
| DynamoDB `media` | Table | File metadata, tags, inference status; checksum GSI for dedup |
| DynamoDB `tmp_query` | Table | Temporary query state |
| DynamoDB `user-subscriptions` | Table | SNS email subscriptions per user |
| DynamoDB `user-notifications` | Table | In-app notification history |
| EventBridge (default bus) | Event bus | S3 → Lambda wiring + custom event routing |
| EventBridge API Destination | HTTP caller | Forward inference requests to GCP |
| SQS `gcp-inference-dlq` | Dead-letter queue | Catch undeliverable GCP events (14-day) |
| SNS `media-alerts` | Notification | Email alerts when inference complete |
| Secrets Manager | Secrets | `callback_secret` (shared HMAC) + GCP SA key |

### GCP Resources

| Resource | Type | Purpose |
|---|---|---|
| Cloud Function gen2 `accept-inference` | HTTP function (Python 3.11) | HMAC-validate incoming events, route to Pub/Sub |
| Pub/Sub `image-inference-requests` | Topic | Decouple accept-inference from image-processor |
| Pub/Sub `video-inference-requests` | Topic | Decouple accept-inference from video-processor |
| Cloud Run v2 `image-processor` | Container service | ONNX inference on images (0–20 instances) |
| Cloud Run v2 `video-processor` | Container service | FFmpeg + ONNX inference on videos (1–10 instances) |
| Eventarc (×2) | Event trigger | Pub/Sub → Cloud Run delivery |
| GCS `models` bucket | Object store | ONNX model files (mdv5a.onnx, model.onnx) |
| GCS `function-source` bucket | Object store | accept-inference zip (versioned by MD5) |
| Artifact Registry | Container registry | image-processor + video-processor images |
| Secret Manager | Secrets | `callback-secret` (shared HMAC) |

### Functions Reference

| Function folder | Runtime | Trigger | Role |
|---|---|---|---|
| `create-presign-url` | Python 3.11 zip | API GW `POST /presign` | Dedup by checksum, return S3 presigned PUT URL |
| `on-tmp-uploaded` | Python 3.11 zip | EventBridge (S3 `tmp/` created) | Read metadata, emit `ecolens.metadata.created` (temporary) |
| `on-media-uploaded` | Python container (ECR) | EventBridge (S3 `images/`+`videos/` created) | Generate thumbnail, write to `thumbnails/` |
| `on-thumbnail-created` | Python 3.11 zip | EventBridge (S3 `thumbnails/` created) | Write DynamoDB record, emit `ecolens.metadata.created` |
| `resolve-and-forward` | Python 3.11 zip | EventBridge `ecolens.metadata.created` | Read DynamoDB, make presigned GET URL, emit `ecolens.gcp.inference` |
| `accept-inference` | Python 3.11 (GCP CF gen2) | HTTPS (EventBridge API Destination) | Validate HMAC, publish to Pub/Sub image or video topic |
| `image-processor` | Python container (Artifact Registry) | Eventarc (Pub/Sub) | Download image, run ONNX detector + classifier, POST results to AWS |
| `video-processor` | Python container (Artifact Registry) | Eventarc (Pub/Sub) | Download video, FFmpeg frames, run ONNX per frame, POST results to AWS |
| `accept-results` | Python 3.11 zip | API GW `POST /inference-results` | Validate HMAC, write tags to DynamoDB, publish SNS |
| `search-by-tags` | Python 3.11 zip | API GW `POST /search-by-tags` | Query DynamoDB by tag |
| `search-by-species` | Python 3.11 zip | API GW `POST /search-by-species` | Query DynamoDB by species, return presigned URLs |
| `lookup-by-thumbnail` | Python 3.11 zip | API GW `POST /lookup-by-thumbnail` | Look up record by thumbnail key |
| `detect-image-tags` | Python 3.11 zip | API GW `POST /detect-image-tags` | Return inference tags for a file |
| `update-file-tags` | Python 3.11 zip | API GW `POST /update-file-tags` | Overwrite tags in DynamoDB |
| `delete-media` | Python 3.11 zip | API GW `POST /delete-media` | S3 delete + DynamoDB remove |
| `list-all-files` | Python 3.11 zip | API GW `GET /all-files` | Paginated DynamoDB scan |
| `subscribe-notifications` | Python 3.11 zip | API GW `POST\|GET\|DELETE /subscribe`, `GET\|POST /notifications*` | Manage SNS subscriptions + notification records |
| `health` | Python 3.11 zip | API GW `GET /hello` | Health check |
| `query-test` | Python 3.11 zip | (dev only) | Ad-hoc DynamoDB query tool |
| `base_image` | Dockerfile | Build-time only | Shared base layer for container Lambdas |
