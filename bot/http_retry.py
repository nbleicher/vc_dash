#!/usr/bin/env python3
"""
Shared HTTP request helper with retries for ChunkedEncodingError and connection/read failures.
Used by bot.py, freeze_eod.py, set_eod_marketing.py, policies_bot.py when calling the API.
"""

import time
from typing import Any, Callable

import requests


def request_with_retries(
    session: requests.Session,
    method: str,
    url: str,
    *,
    max_retries: int = 5,
    log_fn: Callable[[str], None] | None = None,
    **kwargs: Any,
) -> requests.Response:
    """
    Perform session.request(method, url, **kwargs), force a full read of the response,
    and retry on ChunkedEncodingError, ConnectionError, or Timeout with exponential backoff.
    Returns the Response (content is cached so callers can use r.status_code, r.json(), etc.).
    """
    last_exc: BaseException | None = None
    for attempt in range(max_retries):
        try:
            r = session.request(method, url, **kwargs)
            _ = r.content  # Force full read; raises ChunkedEncodingError if connection drops mid-stream
            return r
        except (
            requests.exceptions.ChunkedEncodingError,
            requests.exceptions.ConnectionError,
            requests.exceptions.Timeout,
        ) as e:
            last_exc = e
            if log_fn:
                log_fn(f"  Request failed (attempt {attempt + 1}/{max_retries}): {e}")
            if attempt < max_retries - 1:
                time.sleep(2 + 2**attempt)
    if last_exc is not None:
        raise last_exc
    raise RuntimeError("request_with_retries: no attempt ran")  # unreachable
