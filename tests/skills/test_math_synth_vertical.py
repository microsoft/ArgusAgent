from __future__ import annotations

from argus_skill.skills.vertical_select import VERTICAL_PURPOSES, VERTICALS, persist_vertical
from argus_skill.verticals import builtin_verticals
from argus_skill.verticals._base import load_vertical_contract


def test_math_synth_is_registered_with_metric_contract(tmp_path) -> None:
    assert "math_synth" in VERTICALS
    assert builtin_verticals() == VERTICALS
    assert "pass@4-minus-pass@1" in VERTICAL_PURPOSES["math_synth"]

    persist_vertical(tmp_path, "math_synth")
    contract = load_vertical_contract("math_synth", project_root=tmp_path)

    assert contract.stage_order == ("setup", "optimize", "measure", "report")
    assert contract.completion_gate == "metric"
    assert contract.workflow_mode == "staged"
    assert contract.checklist_items["report"]


def test_math_synth_has_a_machine_metric_gate() -> None:
    from argus_skill.verticals.math_synth import stages

    measure_commands = "\n".join(command for _label, command in stages.STAGE_CHECKS["measure"])
    assert "metric_evidence math-synth" in measure_commands
    assert tuple(stages.STAGE_CHECKS) == tuple(stages.STAGE_ORDER)