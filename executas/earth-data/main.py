#!/usr/bin/env python3
"""
Earth Data Executa — real-time Earth anomaly data from USGS and NASA EONET.

Implements the full Anna Executa protocol:
  initialize → notifications/initialized → describe → health → invoke → shutdown
"""
from __future__ import annotations

import json
import sys
import traceback
import urllib.request
import urllib.error
from datetime import datetime, timezone
from typing import Any

VERSION = "1.1.0"
TOOL_NAME = "earth-data"

# Public APIs — all support no-auth access.
USGS_URL  = "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_week.geojson"
EONET_URL = "https://eonet.gsfc.nasa.gov/api/v3/events?status=open&limit=50&days=14"
SWPC_URL  = "https://services.swpc.noaa.gov/products/alerts.json"
ISS_URL   = "https://api.wheretheiss.at/v1/satellites/25544"

AVATAR_POOL = ["MC", "AL", "JR", "SN", "KT", "AM", "DB", "RO", "PL", "XT"]
AVATAR_CLASSES = [
    "avatar-rose", "avatar-blue", "avatar-sand", "avatar-purple",
    "avatar-teal", "avatar-violet", "avatar-yellow", "avatar-portrait",
]


# ─── Helpers ─────────────────────────────────────────────────────────────────

def _fetch(url: str) -> Any:
    req = urllib.request.Request(
        url, headers={"User-Agent": "EarthAnomalyObservatory/1.0.0"}
    )
    with urllib.request.urlopen(req, timeout=15) as resp:
        return json.loads(resp.read().decode())


def _age_hours(ts_ms: int | None = None, iso: str | None = None) -> float:
    now = datetime.now(timezone.utc)
    if ts_ms is not None:
        event_dt = datetime.fromtimestamp(ts_ms / 1000, tz=timezone.utc)
    elif iso:
        event_dt = datetime.fromisoformat(iso.replace("Z", "+00:00"))
    else:
        return 0.0
    return max(0.0, (now - event_dt).total_seconds() / 3600)


def _mag_to_priority(mag: float) -> str:
    if mag >= 7.0:
        return "high"
    if mag >= 5.5:
        return "medium"
    return "low"


def _cat_to_priority(cat: str) -> str:
    if cat in {"Volcanoes", "Severe Storms", "Wildfires"}:
        return "high"
    return "medium"


def _fmt_age(hours: float) -> str:
    if hours < 1:
        return f"{max(1, round(hours * 60))} min"
    if hours < 24:
        return f"{round(hours)} h"
    d = int(hours // 24)
    h = round(hours % 24)
    return f"{d} d {h} h" if h else f"{d} d"


def _avatars(seed: str, count: int = 2) -> list[dict]:
    h = 0
    for c in seed:
        h = (h * 31 + ord(c)) & 0xFFFFFFFF
    return [
        {
            "text": AVATAR_POOL[(h + i) % len(AVATAR_POOL)],
            "bgClass": AVATAR_CLASSES[(h + i * 3) % len(AVATAR_CLASSES)],
        }
        for i in range(count)
    ]


# ─── Data fetching ────────────────────────────────────────────────────────────

def _fetch_usgs() -> tuple[list[dict], str | None]:
    try:
        data = _fetch(USGS_URL)
        events = []
        for f in data.get("features", []):
            p = f.get("properties", {})
            g = f.get("geometry", {})
            coords = g.get("coordinates", [0.0, 0.0, 0.0])
            mag = float(p.get("mag") or 0.0)
            place: str = p.get("place") or "Unknown region"
            ts: int | None = p.get("time")
            alert: str = (p.get("alert") or "").lower()
            h = _age_hours(ts_ms=ts)

            status_map = {
                "red": "investigating",
                "orange": "monitoring",
                "yellow": "monitoring",
            }
            status = status_map.get(alert, "pending_review")

            # Shorten place to region portion after "of"
            region = place.split(" of ", 1)[-1] if " of " in place else place

            detected_at = (
                datetime.fromtimestamp(ts / 1000, tz=timezone.utc).strftime("%H:%M")
                if ts else "00:00"
            )

            desc_key = (
                "signal.tracking" if alert in ("red", "orange")
                else "signal.linked" if mag >= 5.5
                else "signal.stable"
            )

            events.append({
                "id": f.get("id", f"usgs-{ts}"),
                "name": place,
                "region": region,
                "priority": _mag_to_priority(mag),
                "status": status,
                "detectedAt": detected_at,
                "magnitude": round(mag, 1),
                "confidence": min(100, int(55 + mag * 6)),
                "progressPercent": min(100, int((mag / 10.0) * 100)),
                "descKey": desc_key,
                "source": "usgs",
                "type": "earthquake",
                "ageHours": round(h, 1),
                "ageText": _fmt_age(h),
                "coordinates": [
                    round(coords[0], 4) if len(coords) > 0 else 0.0,
                    round(coords[1], 4) if len(coords) > 1 else 0.0,
                ],
                "extra": {
                    "depth": round(float(coords[2]), 1) if len(coords) > 2 else 0.0,
                    "alertLevel": alert or None,
                    "link": f"https://earthquake.usgs.gov/earthquakes/eventpage/{f.get('id', '')}",
                },
                "avatars": _avatars(f.get("id", place), 2),
            })
        return events, None
    except Exception as exc:  # noqa: BLE001
        return [], f"USGS fetch failed: {exc}"


def _fetch_eonet() -> tuple[list[dict], str | None]:
    try:
        data = _fetch(EONET_URL)
        events = []
        for ev in data.get("events", []):
            cats = ev.get("categories", [])
            cat_name: str = cats[0].get("title", "Unknown") if cats else "Unknown"
            geoms = ev.get("geometry", [])
            first_date: str | None = geoms[0].get("date") if geoms else None
            last_date: str | None = geoms[-1].get("date") if geoms else None
            coords = geoms[-1].get("coordinates", [0.0, 0.0]) if geoms else [0.0, 0.0]
            if isinstance(coords[0], list):
                coords = coords[0]  # MultiPoint — take first
            h = _age_hours(iso=first_date) if first_date else 0.0

            detected_at = (
                datetime.fromisoformat(first_date.replace("Z", "+00:00")).strftime("%H:%M")
                if first_date else "00:00"
            )

            title: str = ev.get("title", "Unknown event")

            events.append({
                "id": ev.get("id", title),
                "name": title,
                "region": title,
                "priority": _cat_to_priority(cat_name),
                "status": "monitoring",
                "detectedAt": detected_at,
                "magnitude": 0.0,
                "confidence": 72,
                "progressPercent": 50,
                "descKey": "signal.drift" if "storm" in cat_name.lower() else "signal.tracking",
                "source": "eonet",
                "type": cat_name.lower().replace(" ", "_"),
                "ageHours": round(h, 1),
                "ageText": _fmt_age(h),
                "coordinates": [
                    round(float(coords[0]), 4),
                    round(float(coords[1]), 4),
                ],
                "extra": {
                    "lastObserved": last_date,
                    "link": f"https://eonet.gsfc.nasa.gov/events/{ev.get('id', '')}",
                },
                "avatars": _avatars(ev.get("id", title), 1),
            })
        return events, None
    except Exception as exc:  # noqa: BLE001
        return [], f"EONET fetch failed: {exc}"


def _fetch_swpc() -> tuple[list[dict], str | None]:
    """NOAA SWPC — geomagnetic storms, solar flares, radiation events."""
    try:
        data = _fetch(SWPC_URL)
        events: list[dict] = []
        seen: set[str] = set()
        for alert in data[:30]:
            msg_code: str = alert.get("product_id", "")
            issue_time: str = alert.get("issue_datetime", "")
            message: str = alert.get("message", "")
            upper = message.upper()
            if any(kw in upper for kw in ("CANCEL", "EXPIRE", "SUPERSED", "SUMMARY: GREEN")):
                continue
            prefix = msg_code[:4]
            if prefix in seen:
                continue
            seen.add(prefix)
            try:
                issue_dt = datetime.strptime(issue_time, "%Y-%m-%d %H:%M:%S").replace(tzinfo=timezone.utc)
                h = _age_hours(iso=issue_dt.isoformat())
                detected_at = issue_dt.strftime("%H:%M")
            except Exception:
                h, detected_at = 0.0, "00:00"
            if h > 168:
                continue

            event_type, name, priority, confidence, scale = "space_weather", "Space Weather Advisory", "low", 65, None

            if "GEOMAGNETIC" in upper or any(f"G{n}" in upper for n in range(1, 6)):
                event_type = "geomagnetic_storm"
                scale = next((f"G{n}" for n in range(5, 0, -1) if f"G{n}" in upper), None)
                lvl = int(scale[1]) if scale else 0
                priority = "high" if lvl >= 3 else "medium"
                name = f"Geomagnetic Storm {scale}" if scale else "Geomagnetic Disturbance"
                confidence = min(99, 80 + lvl * 3)
            elif "SOLAR FLARE" in upper or "RADIO BLACKOUT" in upper or "X-RAY FLUX" in upper:
                event_type = "solar_flare"
                scale = next((s for s in ("X5","X4","X3","X2","X1","M9","M5","M3","M1") if s in upper), None)
                priority = "high" if scale and scale[0] == "X" else "medium" if scale and scale[0] == "M" else "low"
                name = f"Solar Flare Class {scale}" if scale else "Solar Flare"
                confidence = 90
            elif "PROTON" in upper or "RADIATION STORM" in upper:
                event_type = "solar_radiation"
                scale = next((f"S{n}" for n in range(5, 0, -1) if f"S{n}" in upper), None)
                priority = "high"
                name = f"Solar Radiation Storm {scale}" if scale else "Solar Radiation Storm"
                confidence = 88
            elif "AURORA" in upper or "BOREALIS" in upper:
                event_type = "aurora"
                priority = "medium"
                name = "Aurora Activity"
                confidence = 78

            event_id = f"swpc_{msg_code}"
            events.append({
                "id": event_id,
                "name": name,
                "region": "Near-Earth Space",
                "priority": priority,
                "status": "monitoring",
                "detectedAt": detected_at,
                "magnitude": 0.0,
                "confidence": min(99, confidence),
                "progressPercent": min(99, confidence),
                "descKey": "signal.drift",
                "source": "swpc",
                "type": event_type,
                "ageHours": round(h, 1),
                "ageText": _fmt_age(h),
                "coordinates": [0.0, 0.0],
                "extra": {"scale": scale, "link": "https://www.swpc.noaa.gov/"},
                "avatars": _avatars(event_id, 1),
            })
        return events, None
    except Exception as exc:  # noqa: BLE001
        return [], f"SWPC fetch failed: {exc}"


def _fetch_satellites() -> tuple[list[dict], str | None]:
    """ISS real-time position from wheretheiss.at."""
    try:
        iss = _fetch(ISS_URL)
        lat = float(iss.get("latitude", 0))
        lon = float(iss.get("longitude", 0))
        alt = float(iss.get("altitude", 408))
        vel = float(iss.get("velocity", 27600))
        ts  = int(iss.get("timestamp", 0))
        detected_at = datetime.fromtimestamp(ts, tz=timezone.utc).strftime("%H:%M") if ts else "00:00"
        return [{
            "id": "iss_realtime",
            "name": "International Space Station (ISS)",
            "region": f"Lat {lat:.1f}° Lon {lon:.1f}°",
            "priority": "low",
            "status": "monitoring",
            "detectedAt": detected_at,
            "magnitude": 0.0,
            "confidence": 99,
            "progressPercent": 99,
            "descKey": "signal.tracking",
            "source": "celestrak",
            "type": "satellite",
            "ageHours": 0.0,
            "ageText": "Real-time",
            "coordinates": [round(lon, 4), round(lat, 4)],
            "extra": {
                "altitude": round(alt, 1),
                "velocity": round(vel, 1),
                "link": "https://www.nasa.gov/international-space-station/",
            },
            "avatars": [{"text": "ISS", "bgClass": "avatar-teal"}],
        }], None
    except Exception as exc:  # noqa: BLE001
        return [], f"Satellite fetch failed: {exc}"


# ─── EONET deduplication ─────────────────────────────────────────────────────

def _title_word_overlap(a: str, b: str) -> float:
    wa = set(a.lower().split())
    wb = set(b.lower().split())
    stop = {"", "the", "a", "an", "of", "and", "fire", "wildfire", "storm", "hurricane", "tropical"}
    wa -= stop; wb -= stop
    if not wa or not wb:
        return 0.0
    return len(wa & wb) / max(len(wa | wb), 1)


def _dedup_eonet(events: list[dict]) -> list[dict]:
    """Collapse EONET records representing the same physical incident."""
    used: set[int] = set()
    canonical: list[dict] = []

    for i, ev in enumerate(events):
        if i in used:
            continue
        group = [i]
        lat_i, lon_i = ev["coordinates"][1], ev["coordinates"][0]

        for j, other in enumerate(events):
            if j <= i or j in used:
                continue
            if ev.get("type") != other.get("type"):
                continue
            lat_j, lon_j = other["coordinates"][1], other["coordinates"][0]
            # Geographic proximity: within ~15 km
            if abs(lat_i - lat_j) > 0.15 or abs(lon_i - lon_j) > 0.15:
                continue
            # Temporal proximity: within 72 h of each other
            if abs(ev["ageHours"] - other["ageHours"]) > 72:
                continue
            # Title similarity: >40 % word overlap
            if _title_word_overlap(ev["name"], other["name"]) < 0.40:
                continue
            group.append(j)
            used.add(j)

        used.add(i)

        # Use the most recent record as the canonical representative
        primary_idx = min(group, key=lambda k: events[k]["ageHours"])
        primary = dict(events[primary_idx])
        primary["sourceRecordIds"] = [events[k]["id"] for k in group]
        primary["sourceCount"] = len(group)
        dedup_cat = primary.get("type", "unknown")
        dedup_lat = round(lat_i, 1)
        dedup_lon = round(lon_i, 1)
        primary["deduplicationKey"] = f"{dedup_cat}:{dedup_lat:.1f}:{dedup_lon:.1f}"
        canonical.append(primary)

    return canonical


# ─── SWPC episode grouping ────────────────────────────────────────────────────

def _group_swpc_episodes(bulletins: list[dict]) -> list[dict]:
    """Merge SWPC bulletins for the same physical space-weather event into episodes."""
    WINDOW_HOURS = 36
    sorted_b = sorted(bulletins, key=lambda x: x["ageHours"])
    used: set[str] = set()
    episodes: list[dict] = []

    for b in sorted_b:
        if b["id"] in used:
            continue
        phenomenon = b["type"]
        group = [b]
        used.add(b["id"])

        for b2 in sorted_b:
            if b2["id"] in used or b2["type"] != phenomenon:
                continue
            if abs(b2["ageHours"] - b["ageHours"]) <= WINDOW_HOURS:
                group.append(b2)
                used.add(b2["id"])

        # Most recent bulletin is primary
        primary = min(group, key=lambda x: x["ageHours"])
        scales = [g.get("extra", {}).get("scale") for g in group if g.get("extra", {}).get("scale")]
        best_scale = max(scales, key=lambda s: int(s[1]) if s and len(s) >= 2 and s[1].isdigit() else 0, default=None)
        severity = int(best_scale[1]) if best_scale and len(best_scale) >= 2 and best_scale[1].isdigit() else 1

        episodes.append({
            "id": f"ep_{phenomenon}_{primary['id']}",
            "phenomenon": phenomenon,
            "phenomenonLabel": primary["name"],
            "firstObserved": primary["detectedAt"],
            "lastUpdated": primary["detectedAt"],
            "status": "active",
            "severity": severity,
            "scale": best_scale,
            "sourceMessages": [g["id"] for g in group],
            "observedOrForecast": "observed",
            "confidence": max(g["confidence"] for g in group),
            "ageText": primary["ageText"],
        })

    return episodes


# ─── Domain scoring (reference-baseline approach) ──────────────────────────────────

def _domain_score_earthquake(usgs_events: list[dict]) -> dict:
    count   = len(usgs_events)
    max_mag = max((e["magnitude"] for e in usgs_events), default=0.0)
    # USGS historical average: ~1 500 M4.5+ events/year → ~29 per 7-day window
    rate_score = min(50, round((count / 29) * 50))
    mag_score  = (40 if max_mag >= 7.5 else 30 if max_mag >= 7.0 else 20 if max_mag >= 6.5 else 10 if max_mag >= 6.0 else 0)
    return {
        "domain": "earthquake", "label": "Earthquakes",
        "score": min(100, rate_score + mag_score),
        "trend": "stable",
        "mainDriver": f"{count} events (M≥4.5), max M{max_mag:.1f}",
        "confidence": 80, "eventCount": count,
        "baselineAvailable": True,
        "baselineMethod": "USGS 7-day reference rate (≈29 global events)",
        "dataCoverage": 1.0 if count > 0 else 0.5,
    }


def _domain_score_wildfire(eonet_events: list[dict]) -> dict:
    fires = [e for e in eonet_events if "wildfire" in e.get("type", "").lower() or "fire" in e.get("type", "").lower()]
    count = len(fires)
    # EONET typically tracks 25–45 active global wildfires in a 14-day window
    rate_score = min(100, round((count / 35) * 70))
    return {
        "domain": "wildfire", "label": "Wildfires",
        "score": rate_score,
        "trend": "stable",
        "mainDriver": f"{count} active incidents (14-day window)",
        "confidence": 65, "eventCount": count,
        "baselineAvailable": True,
        "baselineMethod": "EONET reference (≈35 global active fires)",
        "dataCoverage": 1.0 if count > 0 else 0.5,
    }


def _domain_score_storm(eonet_events: list[dict]) -> dict:
    storms = [e for e in eonet_events if "storm" in e.get("type", "").lower()]
    count  = len(storms)
    has_major = any(
        kw in e["name"].lower()
        for e in storms
        for kw in ("hurricane", "typhoon")
    )
    # Typical global named storms: ~7 active; major hurricane adds severity bonus
    rate_score = min(60, round((count / 7) * 60))
    severity_bonus = 40 if has_major else 0
    return {
        "domain": "storm", "label": "Storms",
        "score": min(100, rate_score + severity_bonus),
        "trend": "stable",
        "mainDriver": f"{count} named events" + (" (major storm active)" if has_major else ""),
        "confidence": 70, "eventCount": count,
        "baselineAvailable": True,
        "baselineMethod": "EONET reference (≈7 global active named storms)",
        "dataCoverage": 1.0 if count > 0 else 0.5,
    }


def _domain_score_ice(eonet_events: list[dict]) -> dict:
    ice_evs = [e for e in eonet_events if "ice" in e.get("type", "").lower()]
    return {
        "domain": "ice", "label": "Sea Ice",
        "score": 0,  # no seasonal baseline available yet
        "trend": "stable",
        "mainDriver": f"{len(ice_evs)} tracked iceberg events",
        "confidence": 20, "eventCount": len(ice_evs),
        "baselineAvailable": False,
        "baselineMethod": "Baseline unavailable — seasonal reference not yet implemented",
        "dataCoverage": 0.3,
    }


def _domain_score_space_weather(episodes: list[dict]) -> dict:
    if not episodes:
        return {
            "domain": "space_weather", "label": "Space Weather",
            "score": 0, "trend": "stable",
            "mainDriver": "No active space weather episodes",
            "confidence": 90, "eventCount": 0,
            "baselineAvailable": True,
            "baselineMethod": "NOAA severity scale (G/X/S-class normalization)",
            "dataCoverage": 1.0,
        }
    max_sev  = max(ep.get("severity", 1) for ep in episodes)
    scale_names = {0: "None", 1: "Minor", 2: "Moderate", 3: "Strong", 4: "Severe", 5: "Extreme"}
    best_ep  = max(episodes, key=lambda ep: ep.get("severity", 0))
    return {
        "domain": "space_weather", "label": "Space Weather",
        "score": min(100, max_sev * 20),
        "trend": "stable",
        "mainDriver": f"{len(episodes)} episode(s), max {scale_names.get(max_sev, '?')} ({best_ep.get('scale', '?')})",
        "confidence": 88, "eventCount": len(episodes),
        "baselineAvailable": True,
        "baselineMethod": "NOAA severity scale normalization",
        "dataCoverage": 1.0,
    }


def _compute_gai(domain_scores: list[dict]) -> dict:
    WEIGHTS: dict[str, float] = {
        "earthquake": 0.25, "wildfire": 0.20, "storm": 0.20,
        "ice": 0.10, "space_weather": 0.25,
    }
    available = [d for d in domain_scores if d["baselineAvailable"] and d["dataCoverage"] >= 0.5]
    total_w   = sum(WEIGHTS.get(d["domain"], 0) for d in available)

    if total_w < 0.50:
        return {
            "score": None, "label": "Global Anomaly Index — Experimental Composite",
            "available": False,
            "unavailableReason": "Insufficient data coverage across domains",
            "domainScores": domain_scores, "trend": "stable",
            "lastUpdated": datetime.now(timezone.utc).isoformat(),
            "dataCoverage": round(total_w, 2), "confidence": 0,
            "baselineStatus": "insufficient",
            "baselineNote": "GAI unavailable — baseline insufficient",
            "weights": WEIGHTS,
        }

    weighted_sum = sum(d["score"] * WEIGHTS.get(d["domain"], 0) / total_w for d in available)
    avg_conf     = round(sum(d["confidence"] for d in available) / len(available))
    return {
        "score": round(weighted_sum),
        "label": "Global Anomaly Index — Experimental Composite",
        "available": True,
        "domainScores": domain_scores, "trend": "stable",
        "lastUpdated": datetime.now(timezone.utc).isoformat(),
        "dataCoverage": round(total_w, 2), "confidence": avg_conf,
        "baselineStatus": "reference",
        "baselineNote": "Based on published reference rates. Not empirically calibrated.",
        "weights": WEIGHTS,
    }



def fetch_anomalies() -> dict:
    t0 = datetime.now(timezone.utc)

    usgs_raw,  usgs_err  = _fetch_usgs()
    eonet_raw, eonet_err = _fetch_eonet()
    swpc_raw,  swpc_err  = _fetch_swpc()
    iss_data,  iss_err   = _fetch_satellites()

    fetch_ms = round((datetime.now(timezone.utc) - t0).total_seconds() * 1000)

    # Deduplicate EONET (same-location/time/title incidents collapse to one)
    eonet_deduped = _dedup_eonet(eonet_raw)
    deduped_count = len(eonet_raw) - len(eonet_deduped)

    # Group SWPC bulletins into physical episodes (not individual events)
    swpc_episodes = _group_swpc_episodes(swpc_raw)

    # Build canonical events from USGS + deduplicated EONET
    # ISS is spacecraft telemetry — NOT an environmental anomaly
    DOMAIN_MAP = {
        "earthquake": "earthquake",
        "wildfires": "wildfire", "wildfire": "wildfire",
        "severe_storms": "storm", "storm": "storm",
        "sea_and_lake_ice": "ice", "ice": "ice",
        "volcanoes": "wildfire",  # domain: surface hazard
    }
    canonical_events: list[dict] = []
    for ev in usgs_raw:
        e = dict(ev)
        e["domain"] = "earthquake"
        e.setdefault("sourceRecordIds", [ev["id"]])
        e.setdefault("sourceCount", 1)
        e["deduplicationKey"] = f"usgs:{ev['id']}"
        canonical_events.append(e)

    for ev in eonet_deduped:
        e = dict(ev)
        e["domain"] = DOMAIN_MAP.get(ev.get("type", ""), "wildfire")
        canonical_events.append(e)

    priority_order = {"high": 0, "medium": 1, "low": 2}
    canonical_events.sort(key=lambda x: (priority_order.get(x["priority"], 3), x["ageHours"]))

    # Domain scores
    domain_scores = [
        _domain_score_earthquake(usgs_raw),
        _domain_score_wildfire(eonet_deduped),
        _domain_score_storm(eonet_deduped),
        _domain_score_ice(eonet_deduped),
        _domain_score_space_weather(swpc_episodes),
    ]

    # Global Anomaly Index
    gai = _compute_gai(domain_scores)

    # ISS telemetry (separate from environmental events)
    iss_telemetry = None
    if iss_data:
        iss_raw = iss_data[0]
        iss_telemetry = {
            "latitude":    iss_raw["coordinates"][1],
            "longitude":   iss_raw["coordinates"][0],
            "altitude":    iss_raw.get("extra", {}).get("altitude", 408.0),
            "velocity":    iss_raw.get("extra", {}).get("velocity", 27600.0),
            "lastUpdated": iss_raw["detectedAt"] + " UTC",
            "available":   True,
        }

    # Data source health
    def _first_update(events: list[dict]) -> str:
        return min((e["detectedAt"] for e in events), default="--:--")

    data_health = [
        {"source": "usgs",     "label": "USGS Earthquakes",  "online": usgs_err is None,
         "lastUpdate": _first_update(usgs_raw), "recordCount": len(usgs_raw),
         "latencyMs": fetch_ms, "errors": [usgs_err] if usgs_err else []},
        {"source": "eonet",    "label": "NASA EONET",        "online": eonet_err is None,
         "lastUpdate": _first_update(eonet_raw), "recordCount": len(eonet_raw),
         "dedupedCount": deduped_count, "latencyMs": fetch_ms,
         "errors": [eonet_err] if eonet_err else []},
        {"source": "swpc",     "label": "NOAA SWPC",         "online": swpc_err is None,
         "lastUpdate": _first_update(swpc_raw), "recordCount": len(swpc_raw),
         "episodeCount": len(swpc_episodes), "latencyMs": fetch_ms,
         "errors": [swpc_err] if swpc_err else []},
        {"source": "celestrak","label": "ISS Telemetry",     "online": iss_err is None,
         "lastUpdate": iss_telemetry["lastUpdated"] if iss_telemetry else "--",
         "recordCount": 1 if iss_data else 0, "latencyMs": fetch_ms,
         "errors": [iss_err] if iss_err else []},
    ]

    return {
        "canonicalEvents": canonical_events,
        "spaceWeatherEpisodes": swpc_episodes,
        "globalAnomalyIndex": gai,
        "domainScores": domain_scores,
        "issTelemetry": iss_telemetry,
        "dataHealth": data_health,
        "errors": [e for e in [usgs_err, eonet_err, swpc_err, iss_err] if e],
        "fetchedAt": datetime.now(timezone.utc).isoformat(),
    }


    priority_order = {"high": 0, "medium": 1, "low": 2}
    anomalies = sorted(
        usgs_events + eonet_events + swpc_events + sat_events,
        key=lambda x: (priority_order.get(x["priority"], 3), x["ageHours"]),
    )

    regions = len({a["region"] for a in anomalies if a["region"]})

    metrics = {
        "open": len(anomalies),
        "regions": regions,
        "aiAssessments": min(len(anomalies), 10),
    }

    # Build top-3 network regions from most anomaly-dense areas
    region_counts: dict[str, dict] = {}
    for a in anomalies:
        r = a["region"]
        if r not in region_counts:
            region_counts[r] = {"count": 0, "status": a["status"], "time": a["detectedAt"]}
        region_counts[r]["count"] += 1

    network_regions = [
        {
            "name": name,
            "status": info["status"],
            "time": info["time"],
            "progress": min(100, info["count"] * 25),
            "percentText": f"{min(100, info['count'] * 25)}%",
        }
        for name, info in sorted(
            region_counts.items(), key=lambda kv: -kv[1]["count"]
        )[:3]
    ]

    errors = [e for e in [usgs_err, eonet_err, swpc_err, sat_err] if e]

    return {
        "anomalies": anomalies,
        "anomalyIndex": _anomaly_index(anomalies),
        "metrics": metrics,
        "insights": _insights(anomalies),
        "networkRegions": network_regions,
        "errors": errors,
        "fetchedAt": datetime.now(timezone.utc).isoformat(),
    }


# ─── JSON-RPC stdio loop ──────────────────────────────────────────────────────

def _send(obj: dict) -> None:
    sys.stdout.write(json.dumps(obj) + "\n")
    sys.stdout.flush()


def _err(req_id: Any, code: int, msg: str) -> dict:
    return {"jsonrpc": "2.0", "id": req_id, "error": {"code": code, "message": msg}}


def _handle(msg: dict) -> dict | None:
    method: str = msg.get("method", "")
    req_id = msg.get("id")
    params: dict = msg.get("params") or {}

    # Notifications have no id — must not produce a response.
    if req_id is None:
        return None

    if method == "initialize":
        offered = params.get("protocolVersion") or "2.0"
        version = offered if offered in ("1.1", "2.0") else "2.0"
        return {
            "jsonrpc": "2.0",
            "id": req_id,
            "result": {
                "protocolVersion": version,
                "serverInfo": {"name": TOOL_NAME, "version": VERSION},
                "client_capabilities": {},
                "capabilities": {},
            },
        }

    if method == "describe":
        return {
            "jsonrpc": "2.0",
            "id": req_id,
            "result": {
                "name": TOOL_NAME,
                "version": VERSION,
                "description": (
                    "Fetches real-time Earth and space anomaly data from USGS Earthquakes, "
                    "NASA EONET natural events, NOAA Space Weather Prediction Center, "
                    "and ISS satellite tracking."
                ),
                "tools": [
                    {
                        "name": "anomalies.fetch",
                        "description": (
                            "Returns current earthquakes (M4.5+, last 7 days), open natural events "
                            "(last 14 days), NOAA space weather alerts, and real-time ISS position, "
                            "with derived metrics and a Global Anomaly Index score."
                        ),
                        "parameters": [],
                    }
                ],
            },
        }

    if method == "health":
        return {
            "jsonrpc": "2.0",
            "id": req_id,
            "result": {"status": "healthy", "version": VERSION},
        }

    if method == "invoke":
        tool: str = params.get("name") or params.get("tool", "")
        if tool == "anomalies.fetch":
            try:
                result = fetch_anomalies()
                return {
                    "jsonrpc": "2.0",
                    "id": req_id,
                    "result": {"success": True, "data": result},
                }
            except Exception as exc:  # noqa: BLE001
                return {
                    "jsonrpc": "2.0",
                    "id": req_id,
                    "result": {"success": False, "error": str(exc)},
                }
        return _err(req_id, -32601, f"Unknown tool: {tool!r}")

    if method == "shutdown":
        return {"jsonrpc": "2.0", "id": req_id, "result": None}

    return _err(req_id, -32601, f"Method not found: {method!r}")


def main() -> None:
    for raw in sys.stdin:
        raw = raw.strip()
        if not raw:
            continue
        try:
            msg = json.loads(raw)
        except json.JSONDecodeError as exc:
            _send({"jsonrpc": "2.0", "id": None,
                   "error": {"code": -32700, "message": f"Parse error: {exc}"}})
            continue
        try:
            response = _handle(msg)
            if response is not None:
                _send(response)
        except Exception:  # noqa: BLE001
            _send(_err(msg.get("id"), -32603, traceback.format_exc()))


if __name__ == "__main__":
    main()
