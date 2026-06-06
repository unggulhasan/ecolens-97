"""Tag aggregation across video frames.

Consolidation rule (per gcp_video_processor_approach.md §5):
    - Take the MAX count per species across all frames.
    - Include a species if detected in ANY frame.
    - Sort by descending count, then ascending species name for determinism.

Example:
    frame 0s → [{"koala": 2}, {"magpie": 1}]
    frame 1s → [{"koala": 1}]
    frame 2s → [{"wombat": 1}, {"koala": 3}]

    aggregate([...]) → [{"koala": 3}, {"magpie": 1}, {"wombat": 1}]
"""

from __future__ import annotations


def aggregate(per_frame: list[list[dict[str, int]]]) -> list[dict[str, int]]:
    """Aggregate per-frame results into a single consolidated species list.

    Args:
        per_frame: list of per-frame results, each a list of single-key dicts
                   as returned by inference_service.run_inference_on_pil().

    Returns:
        A list of single-key dicts, sorted by count descending then name ascending.
    """
    max_counts: dict[str, int] = {}

    for frame_result in per_frame:
        for entry in frame_result:
            for species, count in entry.items():
                if count > max_counts.get(species, 0):
                    max_counts[species] = count

    if not max_counts:
        return []

    return [
        {species: count}
        for species, count in sorted(
            max_counts.items(),
            key=lambda kv: (-kv[1], kv[0]),  # desc count, asc name
        )
    ]
