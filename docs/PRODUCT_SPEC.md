# LFC Social Hub — Product Specification

Single-church, multi-user social media management for Love First Church.

## Destinations
Facebook Pages, Instagram professional accounts, TikTok, YouTube, WhatsApp Channels (assisted/manual until official publishing support is verified), Telegram channels.

## Roles
- Owner: full control
- Administrator: workspace, integrations and team administration
- Editor: create and edit content
- Approver: approve, reject and request revisions

Publishing permissions are separately permissioned.

## Modules
Dashboard, calendar, composer, media library, publishing queue, approvals, analytics, campaigns, team, settings.

## Planned data model
users, roles, church_settings, social_accounts, posts, post_variants, media_assets, schedules, publishing_jobs, publishing_logs, approvals, comments, campaigns, analytics, notifications.

## Reliability and security
Idempotent publishing jobs, safe retry/backoff, encrypted OAuth credentials, role-based access control, audit logs, upload validation, backups, provider rate-limit handling, and no access tokens in frontend code.

## Scheduling
Default timezone: Africa/Accra. Scheduling runs in cloud workers, independently of desktop clients.

## Milestone 1 exclusions
Real OAuth connections, automatic publishing, production authentication, durable job scheduling, live analytics and invitation emails.
