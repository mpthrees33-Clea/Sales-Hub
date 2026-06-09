"""Or-Equal — the designer-facing app.

Run from the repo root:
    pip install -r requirements.txt
    python data/make_sample_swatches.py      # optional: a runnable demo catalog
    streamlit run app/streamlit_app.py

Flow: upload a discontinued/long-lead product -> hard-filter the catalog by budget &
lead time -> rank survivors by look (pattern + color) -> optionally render a pick into
the designer's own space.
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

import streamlit as st
from PIL import Image

# Make the repo root importable when launched via `streamlit run app/streamlit_app.py`
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from orequal.catalog import compute_embeddings, load_catalog  # noqa: E402
from orequal.color import dominant_rgb, lrv  # noqa: E402
from orequal.embedding import load_model  # noqa: E402
from orequal.matching import filter_products, rank  # noqa: E402
from orequal.render import render_on_surface  # noqa: E402

st.set_page_config(page_title="Or-Equal", page_icon="🔁", layout="wide")


@st.cache_resource(show_spinner="Loading match model (first run downloads ~600MB)…")
def get_model():
    return load_model()


@st.cache_resource(show_spinner="Indexing catalog…")
def get_catalog(catalog_dir: str):
    products = load_catalog(catalog_dir)
    compute_embeddings(products, get_model())
    return products


# ----------------------------------------------------------------- sidebar / controls
with st.sidebar:
    st.header("Catalog")
    catalog_dir = st.text_input("Catalog folder", value="data/sample_catalog")
    if st.button("Reload catalog"):
        get_catalog.clear()

    products = []
    try:
        products = get_catalog(catalog_dir)
        st.success(f"{len(products)} products indexed")
    except FileNotFoundError:
        st.warning("No catalog.csv found. Run `python data/make_sample_swatches.py` "
                   "for a demo, or point to your own folder (see data/README.md).")
    if not products and catalog_dir:
        st.info("Catalog is empty — add images + catalog.csv.")

    st.header("Match weighting")
    w_color = st.slider("Color importance", 0.0, 1.0, 0.40, 0.05,
                        help="The rest of the weight goes to pattern / look.")
    w_pattern = round(1.0 - w_color, 2)
    st.caption(f"Pattern / look weight: **{w_pattern}**")
    top_n = st.slider("How many alternates", 3, 12, 6)

    st.header("Hard constraints")
    max_price = (st.number_input("Max $/sq ft", 0.0, value=10.0, step=0.5)
                 if st.checkbox("Budget cap ($/sq ft)") else None)
    max_lead = (st.number_input("Max lead time (weeks)", 0.0, value=4.0, step=1.0)
                if st.checkbox("Lead-time cap") else None)
    material = st.text_input("Material contains (optional)").strip()
    finish = st.text_input("Finish contains (optional)").strip()

    st.header("Visualizer (optional)")
    api_key = st.text_input("GEMINI_API_KEY", type="password",
                            value=os.environ.get("GEMINI_API_KEY", ""))
    surface_type = st.selectbox("Surface input", ["photo", "elevation"])
    surface_name = st.text_input("Apply to which surface", value="floor")


# ------------------------------------------------------------------------------ header
st.title("Or-Equal")
st.caption("Specified product discontinued or long lead? Get verified, in-budget, "
           "in-lead-time look-alikes — and see them in your space.")

upload = st.file_uploader("Discontinued / unavailable product image",
                          type=["jpg", "jpeg", "png", "webp"])


# --------------------------------------------------------------------------- find step
if upload:
    query_img = Image.open(upload).convert("RGB")
    c1, c2 = st.columns([1, 3])
    with c1:
        st.image(query_img, caption="Specified product", use_container_width=True)
        st.metric("LRV", lrv(dominant_rgb(query_img)))
    with c2:
        bits = []
        if max_price is not None:
            bits.append(f"≤ ${max_price:.2f}/sf")
        if max_lead is not None:
            bits.append(f"≤ {max_lead:.0f} wk lead")
        if material:
            bits.append(f"material~“{material}”")
        if finish:
            bits.append(f"finish~“{finish}”")
        st.write("**Constraints:** " + (", ".join(bits) if bits else "none"))
        st.write(f"**Weighting:** {int(w_pattern*100)}% look / {int(w_color*100)}% color")
        if st.button("🔍 Find alternates", type="primary", disabled=not products):
            pool = filter_products(products, max_price, max_lead,
                                   material or None, finish or None)
            if not pool:
                st.session_state.pop("matches", None)
                st.error("Nothing passes the hard constraints. Loosen budget/lead time.")
            else:
                with st.spinner("Ranking look-alikes…"):
                    st.session_state["matches"] = rank(
                        query_img, get_model(), pool,
                        w_pattern=w_pattern, w_color=w_color)[:top_n]
                st.session_state["dropped"] = len(products) - len(pool)


# ------------------------------------------------------------- results (from session)
matches = st.session_state.get("matches")
if matches:
    dropped = st.session_state.get("dropped", 0)
    st.subheader(f"Top {len(matches)} verified alternates"
                 + (f"  ·  {dropped} ruled out by constraints" if dropped else ""))

    per_row = 3
    for start in range(0, len(matches), per_row):
        for col, m in zip(st.columns(per_row), matches[start:start + per_row]):
            p = m.product
            with col:
                st.image(str(p.image_path), use_container_width=True)
                st.markdown(f"**{p.name}**")
                if p.manufacturer:
                    st.caption(p.manufacturer + (f" · {p.size}" if p.size else ""))
                price = f"${p.price_per_sqft:.2f}/sf" if not m.price_unknown else "price?"
                lead = f"{p.lead_time_weeks:.0f} wk" if not m.lead_unknown else "lead?"
                st.write(f"match **{m.score:.2f}** · ΔE {m.delta_e:.1f} · "
                         f"LRV {p.lrv} · {price} · {lead}")
                if m.lead_unknown or m.price_unknown:
                    st.caption("⚠️ verify availability/price at source")
                if p.source_url:
                    st.markdown(f"[source]({p.source_url})")

                with st.expander("👁️ Visualize in a space"):
                    surf = st.file_uploader("Space / elevation image",
                                            type=["jpg", "jpeg", "png", "webp"],
                                            key=f"surf_{p.id}")
                    if st.button("Render", key=f"viz_{p.id}", disabled=not surf):
                        if not api_key:
                            st.error("Add your GEMINI_API_KEY in the sidebar.")
                        else:
                            try:
                                with st.spinner("Rendering…"):
                                    out, note = render_on_surface(
                                        Image.open(p.image_path),
                                        Image.open(surf),
                                        surface_type=surface_type,
                                        surface_name=surface_name,
                                        api_key=api_key)
                                if out is not None:
                                    st.image(out, caption=f"{p.name} on {surface_name}",
                                             use_container_width=True)
                                else:
                                    st.warning("No image returned — try another model/photo.")
                                if note:
                                    st.caption(note)
                            except Exception as e:  # noqa: BLE001
                                st.error(f"Render failed: {e}")
elif upload:
    st.info("Set your constraints in the sidebar, then hit **Find alternates**.")
else:
    st.info("⬆️ Upload a product image to begin. No catalog yet? "
            "Run `python data/make_sample_swatches.py` for a demo.")
