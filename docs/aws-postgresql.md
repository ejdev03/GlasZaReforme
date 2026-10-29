# AWS PostgreSQL deployment

The application automatically uses Aurora PostgreSQL through the RDS Data API when `AWS_REGION`,
`AURORA_CLUSTER_ARN`, `AURORA_SECRET_ARN`, and `AURORA_DATABASE` are configured. Without them, the
Cloudflare Sites preview uses its D1 binding so local and hosted previews remain usable.

## Recommended production setup

1. Create an Aurora PostgreSQL cluster in an EU region and enable the RDS Data API.
2. Store the database credentials in AWS Secrets Manager.
3. Create the database named in `AURORA_DATABASE`.
4. Give the application role `rds-data:ExecuteStatement` and `secretsmanager:GetSecretValue` only for
   the selected cluster and secret.
5. Set the four non-secret identifiers as environment variables. On AWS, attach the IAM role instead
   of setting access keys. For the current Sites deployment, add scoped AWS access keys as secrets.

Tables and indexes are created idempotently on first use. `db/postgres/schema.ts` is the canonical
PostgreSQL schema; `npm run db:generate:postgres` can generate versioned Drizzle migrations as the
schema grows.

For a conventional Node.js service connected directly to RDS PostgreSQL, use RDS Proxy for connection
pooling. The current Data API adapter is preferred for serverless portability because it communicates
over HTTPS and does not hold database connections open.
