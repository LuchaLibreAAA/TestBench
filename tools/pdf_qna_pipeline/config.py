"""Config loader for exam configurations."""

from pathlib import Path
from typing import Dict, Any
import yaml


def load_config(config_name: str = "jee_main") -> Dict[str, Any]:
    """Load configuration dictionary from configs/ directory."""
    config_dir = Path(__file__).parent / "configs"
    cfg_file = config_dir / f"{config_name}.yaml"
    if not cfg_file.exists():
        cfg_file = Path(config_name)
    if not cfg_file.exists():
        raise FileNotFoundError(f"Configuration file not found: {config_name}")

    with open(cfg_file, "r", encoding="utf-8") as f:
        return yaml.safe_load(f)
