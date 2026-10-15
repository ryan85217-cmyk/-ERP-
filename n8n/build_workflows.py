"""
Builds the ERP automation workflows and creates them in n8n through its public API.

  python3 n8n/build_workflows.py            # create (skips names that already exist)
  python3 n8n/build_workflows.py --export   # only write n8n/workflows/*.json

Reads N8N_URL / N8N_API_KEY from .env.zeabur.local (git-ignored). Credentials are referenced
by name+id; create them in n8n first: "ERP API token" (Header Auth) and an SMTP credential.
"""
import json, os, sys, urllib.request, uuid

ERP = "https://smart-store-erp.zeabur.app/api/integrations"
# simulated POS vendor API (lives in the ERP app for the demo; swap for the real POS API later)
POS = "https://smart-store-erp.zeabur.app/api/mock-pos/v1"
TO = "ryan85217@gmail.com"
FROM = "智慧門市 ERP <ryan85217@gmail.com>"


def env():
    vals = {}
    for line in open(os.path.join(os.path.dirname(__file__), "..", ".env.zeabur.local")):
        if "=" in line and not line.startswith("#"):
            k, v = line.strip().split("=", 1)
            vals[k] = v.strip('"')
    return vals


def api(method, path, body=None):
    e = env()
    req = urllib.request.Request(
        e["N8N_URL"].rstrip("/") + "/api/v1" + path,
        method=method,
        data=json.dumps(body).encode() if body is not None else None,
        headers={"X-N8N-API-KEY": e["N8N_API_KEY"], "Content-Type": "application/json"},
    )
    with urllib.request.urlopen(req) as r:
        return json.loads(r.read() or b"{}")


def creds():
    by_type = {c["type"]: c for c in api("GET", "/credentials?limit=100")["data"]}
    erp, smtp = by_type["httpHeaderAuth"], by_type["smtp"]
    return {"erp": {"httpHeaderAuth": {"id": erp["id"], "name": erp["name"]}}, "smtp": {"smtp": {"id": smtp["id"], "name": smtp["name"]}}}


def node(name, type_, version, params, pos, credentials=None, **extra):
    n = {"id": str(uuid.uuid4()), "name": name, "type": type_, "typeVersion": version, "position": pos, "parameters": params}
    if credentials:
        n["credentials"] = credentials
    n.update(extra)
    return n


def schedule(cron, pos):
    return node("每天定時", "n8n-nodes-base.scheduleTrigger", 1.2, {"rule": {"interval": [{"field": "cronExpression", "expression": cron}]}}, pos)


def webhook(name, path, c, pos):
    return node(
        name,
        "n8n-nodes-base.webhook",
        2,
        {"httpMethod": "POST", "path": path, "authentication": "headerAuth", "responseMode": "onReceived", "options": {}},
        pos,
        c["erp"],
        webhookId=str(uuid.uuid4()),
    )


def fetch(name, url, c, pos):
    return node(
        name,
        "n8n-nodes-base.httpRequest",
        4.2,
        {"url": url, "authentication": "genericCredentialType", "genericAuthType": "httpHeaderAuth", "options": {}},
        pos,
        c["erp"],
    )


def http(name, method, url, c, pos, query=None, json_body=None):
    params = {"method": method, "url": url, "authentication": "genericCredentialType", "genericAuthType": "httpHeaderAuth", "options": {}}
    if query:
        params["sendQuery"] = True
        params["queryParameters"] = {"parameters": [{"name": k, "value": v} for k, v in query.items()]}
    if json_body:
        params.update({"sendBody": True, "specifyBody": "json", "jsonBody": json_body})
    return node(name, "n8n-nodes-base.httpRequest", 4.2, params, pos, c["erp"])


def if_count(pos):
    return node(
        "有資料才寄",
        "n8n-nodes-base.if",
        2.2,
        {
            "conditions": {
                "options": {"caseSensitive": True, "leftValue": "", "typeValidation": "loose", "version": 2},
                "conditions": [{"id": str(uuid.uuid4()), "leftValue": "={{ $json.count }}", "rightValue": 0, "operator": {"type": "number", "operation": "gt"}}],
                "combinator": "and",
            },
            "options": {},
        },
        pos,
    )


def email(pos, c, prefix="$json"):
    return node(
        "寄 Gmail",
        "n8n-nodes-base.emailSend",
        2.1,
        {"fromEmail": FROM, "toEmail": TO, "subject": "={{ " + prefix + ".subject }}", "emailFormat": "html", "html": "={{ " + prefix + ".html }}", "options": {}},
        pos,
        c["smtp"],
    )


def link(*pairs):
    conns = {}
    for a, b in pairs:
        conns.setdefault(a, {"main": [[]]})["main"][0].append({"node": b, "type": "main", "index": 0})
    return conns


SETTINGS = {"executionOrder": "v1", "timezone": "Asia/Taipei", "saveManualExecutions": True}


def workflows(c):
    return [
        {
            "name": "ERP｜每日低庫存通知",
            "nodes": [
                schedule("0 8 * * *", [0, 0]),
                webhook("手動執行", "erp-run-low-stock", c, [0, 200]),
                fetch("取低庫存", f"{ERP}/low-stock", c, [260, 100]),
                if_count([520, 100]),
                email([780, 100], c),
            ],
            "connections": link(("每天定時", "取低庫存"), ("手動執行", "取低庫存"), ("取低庫存", "有資料才寄"), ("有資料才寄", "寄 Gmail")),
            "settings": SETTINGS,
        },
        {
            "name": "ERP｜每日營運摘要",
            "nodes": [
                schedule("30 7 * * *", [0, 0]),
                webhook("手動執行", "erp-run-daily-summary", c, [0, 200]),
                fetch("取昨日摘要", f"{ERP}/daily-summary", c, [260, 100]),
                email([520, 100], c),
            ],
            "connections": link(("每天定時", "取昨日摘要"), ("手動執行", "取昨日摘要"), ("取昨日摘要", "寄 Gmail")),
            "settings": SETTINGS,
        },
        {
            "name": "ERP｜盤點完成通知",
            "nodes": [
                webhook("ERP 盤點完成", "erp-count-completed", c, [0, 0]),
                email([260, 0], c, prefix="$json.body"),
            ],
            "connections": link(("ERP 盤點完成", "寄 Gmail")),
            "settings": SETTINGS,
        },
        {
            "name": "ERP｜新 POS 報表提醒",
            "nodes": [
                schedule("0 9 * * *", [0, 0]),
                webhook("手動執行", "erp-run-new-reports", c, [0, 200]),
                fetch("查雲端新報表", f"{ERP}/new-reports?hours=24", c, [260, 100]),
                if_count([520, 100]),
                email([780, 100], c),
            ],
            "connections": link(("每天定時", "查雲端新報表"), ("手動執行", "查雲端新報表"), ("查雲端新報表", "有資料才寄"), ("有資料才寄", "寄 Gmail")),
            "settings": SETTINGS,
        },
        {
            "name": "ERP｜POS 交易即時同步",
            "nodes": [
                node("每 15 分鐘", "n8n-nodes-base.scheduleTrigger", 1.2, {"rule": {"interval": [{"field": "cronExpression", "expression": "*/15 * * * *"}]}}, [0, 0]),
                webhook("手動執行", "erp-run-pos-sync", c, [0, 200]),
                http("ERP：同步起點", "GET", f"{ERP}/pos/cursor", c, [260, 100]),
                http("POS：取交易", "GET", f"{POS}/transactions", c, [520, 100], query={"since": "={{ $json.since }}", "until": "={{ $json.until }}"}),
                node(
                    "有新交易",
                    "n8n-nodes-base.if",
                    2.2,
                    {
                        "conditions": {
                            "options": {"caseSensitive": True, "leftValue": "", "typeValidation": "loose", "version": 2},
                            "conditions": [{"id": str(uuid.uuid4()), "leftValue": "={{ $json.count }}", "rightValue": 0, "operator": {"type": "number", "operation": "gt"}}],
                            "combinator": "and",
                        },
                        "options": {},
                    },
                    [780, 100],
                ),
                http("ERP：寫入交易", "POST", f"{ERP}/pos/transactions", c, [1040, 100], json_body="={{ JSON.stringify({ transactions: $json.transactions }) }}"),
            ],
            "connections": link(("每 15 分鐘", "ERP：同步起點"), ("手動執行", "ERP：同步起點"), ("ERP：同步起點", "POS：取交易"), ("POS：取交易", "有新交易"), ("有新交易", "ERP：寫入交易")),
            "settings": SETTINGS,
        },
    ]


def strip_ids(wf):
    """Exported copies keep credential names only, so the repo holds no instance-specific ids."""
    wf = json.loads(json.dumps(wf))
    for n in wf["nodes"]:
        for v in n.get("credentials", {}).values():
            v.pop("id", None)
    return wf


if __name__ == "__main__":
    fake = {"erp": {"httpHeaderAuth": {"id": "", "name": "ERP API token"}}, "smtp": {"smtp": {"id": "", "name": "SMTP account"}}}
    out = os.path.join(os.path.dirname(__file__), "workflows")
    os.makedirs(out, exist_ok=True)
    for i, wf in enumerate(workflows(fake), 1):
        json.dump(strip_ids(wf), open(os.path.join(out, f"{i}-{wf['name'].split('｜')[1]}.json"), "w"), ensure_ascii=False, indent=1)
    if "--export" in sys.argv:
        sys.exit()
    c = creds()
    existing = {w["name"]: w["id"] for w in api("GET", "/workflows?limit=100")["data"]}
    for wf in workflows(c):
        if wf["name"] in existing:
            print(f"skip (exists) {wf['name']} {existing[wf['name']]}")
            continue
        created = api("POST", "/workflows", wf)
        print(f"created {created['name']} {created['id']}")
