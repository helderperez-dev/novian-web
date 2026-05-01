import json
from pathlib import Path


ROOT = Path("/Users/helderperez/Projects/2026/novian/apps/novian-web")
WORKFLOW_PATH = ROOT / "n8n" / "mariana-whatsapp.json"
TMP_DIR = ROOT / ".tmp_workflow_nodes"


def main() -> None:
    workflow = json.loads(WORKFLOW_PATH.read_text())

    text_prompt = (TMP_DIR / "AI_Agent1_prompt.txt").read_text()
    system_prompt = (TMP_DIR / "AI_Agent1_system.txt").read_text()
    montar_js = (TMP_DIR / "Montar_contexto_do_lead.js").read_text()
    prepare_js = (TMP_DIR / "Prepare_Reply.js").read_text()
    sql_js = (TMP_DIR / "Preparar_SQL_de_saida.js").read_text()

    updated = set()

    for node in workflow.get("nodes", []):
        name = node.get("name")
        params = node.setdefault("parameters", {})

        if name == "AI Agent1":
            params["text"] = text_prompt
            options = params.setdefault("options", {})
            options["systemMessage"] = system_prompt
            options["maxIterations"] = 15
            updated.add(name)
        elif name == "Montar contexto do lead":
            params["jsCode"] = montar_js
            updated.add(name)
        elif name == "Prepare Reply":
            params["jsCode"] = prepare_js
            updated.add(name)
        elif name == "Preparar SQL de saída":
            params["jsCode"] = sql_js
            updated.add(name)

    expected = {
        "AI Agent1",
        "Montar contexto do lead",
        "Prepare Reply",
        "Preparar SQL de saída",
    }
    missing = expected - updated
    if missing:
        raise RuntimeError(f"Missing workflow nodes: {sorted(missing)}")

    WORKFLOW_PATH.write_text(json.dumps(workflow, ensure_ascii=False, indent=2) + "\n")
    print(f"Updated {WORKFLOW_PATH}")


if __name__ == "__main__":
    main()
