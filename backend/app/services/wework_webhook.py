"""企业微信机器人 Webhook 群发（群机器人），文档见 https://developer.work.weixin.qq.com/document/path/91770"""

from __future__ import annotations

import logging
from typing import Any

import httpx

from app.config import settings

logger = logging.getLogger(__name__)


def _webhook_url() -> str | None:
    url = (settings.wework_webhook_url or "").strip()
    return url or None


def send_wework_raw(body: dict[str, Any], timeout: float = 10.0) -> dict[str, Any] | None:
    """
    发送任意符合企业微信机器人规范的 JSON body。
    未配置 QUANT_WEWORK_WEBHOOK_URL 时静默跳过，返回 None。
    """
    url = _webhook_url()
    if not url:
        logger.debug("wework webhook: QUANT_WEWORK_WEBHOOK_URL 未配置，已跳过")
        return None
    with httpx.Client(timeout=timeout) as client:
        resp = client.post(url, json=body)
        resp.raise_for_status()
        data: dict[str, Any] = resp.json()
    if data.get("errcode") != 0:
        logger.warning("wework webhook 返回错误: %s", data)
    return data


def send_wework_text(
    content: str,
    *,
    mentioned_list: list[str] | None = None,
    mentioned_mobile_list: list[str] | None = None,
) -> dict[str, Any] | None:
    """文本消息，content 过长时请自行截断（官方有长度限制）。"""
    text: dict[str, Any] = {"content": content}
    if mentioned_list:
        text["mentioned_list"] = mentioned_list
    if mentioned_mobile_list:
        text["mentioned_mobile_list"] = mentioned_mobile_list
    return send_wework_raw({"msgtype": "text", "text": text})


def send_wework_markdown(content: str) -> dict[str, Any] | None:
    """markdown 类型消息。"""
    return send_wework_raw({"msgtype": "markdown", "markdown": {"content": content}})


def send_wework_news(articles: list[dict[str, Any]]) -> dict[str, Any] | None:
    """
    图文消息。每条 article 建议字段：title, description, url, picurl（均为字符串，按官方文档）。
    """
    return send_wework_raw({"msgtype": "news", "news": {"articles": articles}})
