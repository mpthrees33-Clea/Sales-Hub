"""
Or-Equal core package — the productized version of the logic validated in `spikes/`.

Modules:
  color     dominant color, LRV, CIEDE2000 deltaE
  embedding CLIP image embeddings
  catalog   Product model + load a catalog folder (catalog.csv + images)
  matching  hard-constraint filtering + visual ranking
  render    faithful product-on-surface visualization via Gemini
"""
__all__ = ["color", "embedding", "catalog", "matching", "render"]
