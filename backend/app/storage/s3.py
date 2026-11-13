"""S3/Cloudflare R2 implementation of StorageBackend using boto3."""

from typing import Iterator

CHUNK_SIZE = 64 * 1024


class S3Storage:
    """Stores assets in S3 / Cloudflare R2 / MinIO."""

    def __init__(
        self,
        bucket: str,
        endpoint_url: str | None = None,
        access_key: str | None = None,
        secret_key: str | None = None,
        region: str = "auto",
        public_url_prefix: str | None = None,
    ) -> None:
        try:
            import boto3
            from botocore.config import Config
        except ImportError:
            raise RuntimeError("boto3 is required to use S3Storage. Install it with: pip install boto3")

        self.bucket = bucket
        self.public_url_prefix = public_url_prefix.rstrip("/") if public_url_prefix else None
        self._s3 = boto3.client(
            "s3",
            endpoint_url=endpoint_url,
            aws_access_key_id=access_key,
            aws_secret_access_key=secret_key,
            region_name=region,
            config=Config(signature_version="s3v4"),
        )

    def put(self, key: str, data: bytes, content_type: str = "application/octet-stream") -> None:
        normalized = key.replace("\\", "/").lstrip("/")
        self._s3.put_object(
            Bucket=self.bucket,
            Key=normalized,
            Body=data,
            ContentType=content_type,
        )

    def open(self, key: str) -> Iterator[bytes]:
        try:
            from botocore.exceptions import ClientError
        except ImportError:
            raise RuntimeError("boto3 is required")

        normalized = key.replace("\\", "/").lstrip("/")
        try:
            resp = self._s3.get_object(Bucket=self.bucket, Key=normalized)
            body = resp["Body"]
            while chunk := body.read(CHUNK_SIZE):
                yield chunk
        except ClientError as e:
            if e.response.get("Error", {}).get("Code") in ("NoSuchKey", "404"):
                raise FileNotFoundError(f"Key not found: {key}")
            raise

    def exists(self, key: str) -> bool:
        try:
            from botocore.exceptions import ClientError
        except ImportError:
            return False

        normalized = key.replace("\\", "/").lstrip("/")
        try:
            self._s3.head_object(Bucket=self.bucket, Key=normalized)
            return True
        except ClientError:
            return False

    def delete(self, key: str) -> None:
        normalized = key.replace("\\", "/").lstrip("/")
        self._s3.delete_object(Bucket=self.bucket, Key=normalized)

    def public_url(self, key: str) -> str | None:
        if self.public_url_prefix:
            normalized = key.replace("\\", "/").lstrip("/")
            return f"{self.public_url_prefix}/{normalized}"
        return None
