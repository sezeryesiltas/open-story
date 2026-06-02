# Cloud Run + Cloud SQL MySQL

OpenStory API can use Google Cloud SQL for MySQL as its production relational database.
Admin Web does not connect to MySQL directly; it continues to proxy through the API.

## Runtime env

For the Cloud Run API service, set:

```env
NODE_ENV=production
OPEN_STORY_DB_PROVIDER=mysql
OPEN_STORY_MYSQL_SOCKET_PATH=/cloudsql/<project-id>:<region>:<instance-name>
OPEN_STORY_MYSQL_PORT=3306
OPEN_STORY_MYSQL_DATABASE=open_story
OPEN_STORY_MYSQL_USERNAME=<mysql-username>
OPEN_STORY_MYSQL_PASSWORD=<mysql-password>
OPEN_STORY_MYSQL_SSL_MODE=disable
OPEN_STORY_DB_READ_CACHE_TTL_MS=60000
```

Attach the Cloud SQL instance to the Cloud Run API service. With `gcloud run deploy`, use the
matching instance connection name:

```bash
gcloud run deploy <api-service-name> \
  --image <api-image> \
  --add-cloudsql-instances <project-id>:<region>:<instance-name>
```

The attached instance is available inside the container under `/cloudsql`. Unix socket
connections are already local to the Cloud Run instance, so use `OPEN_STORY_MYSQL_SSL_MODE=disable`
for this mode.

## TCP alternative

For private IP or another TCP route, omit `OPEN_STORY_MYSQL_SOCKET_PATH` and set:

```env
OPEN_STORY_MYSQL_HOST=<mysql-host>
OPEN_STORY_MYSQL_PORT=3306
OPEN_STORY_MYSQL_SSL_MODE=require
```

At least one of `OPEN_STORY_MYSQL_HOST` or `OPEN_STORY_MYSQL_SOCKET_PATH` is required.

## Migrated database

The MySQL store uses the normalized OpenStory tables: `client`, `static_token`, `placement`,
`story_group_set`, revision tables, and composition tables. Existing migrated tables must retain
those names. New MySQL databases are initialized with the same logical model automatically.

`story_group_set_revision.target_platforms` and `target_segments` are written as JSON arrays.
The reader also accepts PostgreSQL array literal text in already migrated rows.

## Admin verification

Open Admin Console and navigate to `Settings > DB Settings`. The `MySQL Connection Details`
section shows the effective env-backed values without exposing the password. Use
`Test MySQL connection` to verify Cloud Run API access to the attached Cloud SQL instance.
