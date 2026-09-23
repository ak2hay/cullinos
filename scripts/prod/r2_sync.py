#!/usr/bin/env python3
"""Sync a local directory to Cloudflare R2 (S3-compatible). Used by backup.sh / restore-backup.sh."""
from __future__ import annotations

import os
import sys
from pathlib import Path


def main() -> int:
    if len(sys.argv) < 3:
        print("Usage: r2_sync.py <local_dir> <s3_uri>   OR   r2_sync.py --download <s3_uri> <local_dir>", file=sys.stderr)
        return 2

    try:
        import boto3
        from botocore.config import Config
    except ImportError:
        print("boto3 missing - install with: apt-get install -y python3-boto3", file=sys.stderr)
        return 1

    download = sys.argv[1] == "--download"
    if download:
        s3_uri, local = sys.argv[2], sys.argv[3]
    else:
        local, s3_uri = sys.argv[1], sys.argv[2]

    if not s3_uri.startswith("s3://"):
        print("s3_uri must start with s3://", file=sys.stderr)
        return 2

    rest = s3_uri[5:]
    bucket, _, prefix = rest.partition("/")
    prefix = prefix.lstrip("/")
    if prefix and not prefix.endswith("/"):
        prefix += "/"

    account = os.environ.get("R2_ACCOUNT_ID", "").strip()
    endpoint = (
        os.environ.get("R2_BACKUP_ENDPOINT", "").strip()
        or os.environ.get("R2_ENDPOINT", "").strip()
        or (f"https://{account}.r2.cloudflarestorage.com" if account else "")
    )
    key_id = os.environ.get("R2_ACCESS_KEY_ID", "").strip()
    secret = os.environ.get("R2_SECRET_ACCESS_KEY", "").strip()
    if not endpoint or not key_id or not secret or not bucket:
        print("Missing R2_ENDPOINT/R2_ACCOUNT_ID or R2_ACCESS_KEY_ID/R2_SECRET_ACCESS_KEY/bucket", file=sys.stderr)
        return 1

    client = boto3.client(
        "s3",
        endpoint_url=endpoint,
        aws_access_key_id=key_id,
        aws_secret_access_key=secret,
        region_name=os.environ.get("AWS_DEFAULT_REGION", "auto"),
        config=Config(signature_version="s3v4"),
    )

    local_path = Path(local)
    if download:
        local_path.mkdir(parents=True, exist_ok=True)
        paginator = client.get_paginator("list_objects_v2")
        count = 0
        for page in paginator.paginate(Bucket=bucket, Prefix=prefix):
            for obj in page.get("Contents") or []:
                key = obj["Key"]
                rel = key[len(prefix) :] if key.startswith(prefix) else key
                if not rel or rel.endswith("/"):
                    continue
                dest = local_path / rel
                dest.parent.mkdir(parents=True, exist_ok=True)
                client.download_file(bucket, key, str(dest))
                count += 1
                print(f"downloaded {key}")
        print(f"done: {count} objects")
        return 0

    if not local_path.is_dir():
        print(f"not a directory: {local}", file=sys.stderr)
        return 1

    count = 0
    for path in local_path.rglob("*"):
        if not path.is_file():
            continue
        rel = path.relative_to(local_path).as_posix()
        key = f"{prefix}{rel}"
        client.upload_file(str(path), bucket, key)
        count += 1
        print(f"uploaded {key}")
    print(f"done: {count} objects")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
