const targetProjection = ol.proj.get("EPSG:3857");
const minYearBase = 1743;
const esriAttribution = "Tiles © Esri";

const categoryColors = {
  pre1919: "#7a0010",
  zwischen: "#b00000", // deep red
  wieder: "#f28e2b",
  gross: "#4e79a7",
  postmodern: "#9c6ade",
  modern: "#59a14f"
};

const legendItems = [
  { key: "pre1919", label: "Vor 1919", color: categoryColors.pre1919 },
  { key: "zwischen", label: "Zwischenkriegszeit (1919–1934)", color: categoryColors.zwischen },
  { key: "wieder", label: "Wiederaufbau (1945–1970)", color: categoryColors.wieder },
  { key: "gross", label: "Großsiedlungen (1971–1980)", color: categoryColors.gross },
  { key: "postmodern", label: "Postmoderne (1981–1999)", color: categoryColors.postmodern },
  { key: "modern", label: "Gegenwart (2000–heute)", color: categoryColors.modern }
];

const vectorSource = new ol.source.Vector();
const styleCache = {};
function styleByYear(feature, resolution) {
  const y = parseInt(feature.get("BAUJAHR"), 10);
  let key = "unknown";
  if (Number.isFinite(y)) {
    if (y < 1919) key = "pre1919";
    else if (y <= 1934) key = "zwischen";
    else if (y >= 1945 && y <= 1970) key = "wieder";
    else if (y >= 1971 && y <= 1980) key = "gross";
    else if (y >= 1981 && y <= 1999) key = "postmodern";
    else if (y >= 2000) key = "modern";
  }
  const width = Math.max(2.2, Math.min(9, 1.2 + resolution / 12));
  const cacheKey = `${key}-${Math.round(width * 10)}`;
  if (!styleCache[cacheKey]) {
    const fillColor = categoryColors[key] || "#cccccc";
    styleCache[cacheKey] = new ol.style.Style({
      stroke: new ol.style.Stroke({ color: fillColor, width }),
      fill: new ol.style.Fill({ color: fillColor + "cc" })
    });
  }
  return styleCache[cacheKey];
}

const gemeindebauLayer = new ol.layer.Vector({
  source: vectorSource,
  style: styleByYear
});

const baseLayerBmap = new ol.layer.Tile({
  source: new ol.source.XYZ({
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}",
    attributions: esriAttribution,
    crossOrigin: "anonymous",
    maxZoom: 19
  }),
  visible: true
});
const baseLayerOrtho = new ol.layer.Tile({
  source: new ol.source.XYZ({
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attributions: esriAttribution,
    crossOrigin: "anonymous",
    maxZoom: 19
  }),
  visible: false
});

const map = new ol.Map({
  target: "map",
  layers: [baseLayerBmap, baseLayerOrtho, gemeindebauLayer],
  view: new ol.View({
    projection: targetProjection,
    center: ol.proj.fromLonLat([16.3738, 48.2082], targetProjection),
    zoom: 13,
    minZoom: 4,
    maxZoom: 19
  })
});
gemeindebauLayer.setZIndex(1000);

document.querySelectorAll("input[name='basemap']").forEach((radio) => {
  radio.addEventListener("change", () => {
    const val = document.querySelector("input[name='basemap']:checked").value;
    baseLayerBmap.setVisible(val === "bmap");
    baseLayerOrtho.setVisible(val === "ortho");
  });
});
document.getElementById("gemeindebau-toggle").addEventListener("change", (e) => {
  gemeindebauLayer.setVisible(e.target.checked);
});

const searchInput = document.getElementById("hof-search");
const suggestionsBox = document.getElementById("hof-suggestions");

const popupEl = document.createElement("div");
popupEl.className = "ol-popup";
const popup = new ol.Overlay({
  element: popupEl,
  autoPan: { animation: { duration: 200 } }
});
map.addOverlay(popup);

const legendEl = document.getElementById("legend-content");
legendEl.innerHTML = legendItems.map(item =>
  `<div class="legend-row"><span class="legend-swatch" style="background:${item.color};"></span><span>${item.label}</span></div>`
).join("");

const pieSvg = document.getElementById("pie-svg");
const yearLabels = document.getElementById("year-labels");
const wohnCountEl = document.getElementById("wohnungs-count");
const yearMin = document.getElementById("year-min");
const yearMax = document.getElementById("year-max");
const thumbMin = document.getElementById("thumb-min");
const thumbMax = document.getElementById("thumb-max");
const sliderRow = document.getElementById("year-slider-row");

let allFeatures = [];
let allTotals = {};

function positionThumbs(lo, hi) {
  const min = parseInt(yearMin.min, 10);
  const max = parseInt(yearMin.max, 10);
  const range = max - min;
  const pctMin = ((lo - min) / range) * 100;
  const pctMax = ((hi - min) / range) * 100;
  thumbMin.style.left = `${pctMin}%`;
  thumbMax.style.left = `${pctMax}%`;
}

function describeSlices(slices, totalMax, cx, cy, r, remainderColor = "#ddd") {
  let start = -Math.PI / 2;
  const totalVal = slices.reduce((acc, s) => acc + s.value, 0);
  const parts = slices.map((s) => {
    const angle = totalMax > 0 ? (s.value / totalMax) * Math.PI * 2 : 0;
    const end = start + angle;
    const largeArc = angle > Math.PI ? 1 : 0;
    const x1 = cx + r * Math.cos(start);
    const y1 = cy + r * Math.sin(start);
    const x2 = cx + r * Math.cos(end);
    const y2 = cy + r * Math.sin(end);
    const d = `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`;
    start = end;
    return `<path d="${d}" fill="${s.color}" stroke="#111" stroke-width="1" />`;
  });
  if (totalVal < totalMax) {
    const angle = ((totalMax - totalVal) / totalMax) * Math.PI * 2;
    const end = start + angle;
    const largeArc = angle > Math.PI ? 1 : 0;
    const x1 = cx + r * Math.cos(start);
    const y1 = cy + r * Math.sin(start);
    const x2 = cx + r * Math.cos(end);
    const y2 = cy + r * Math.sin(end);
    const d = `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`;
    parts.push(`<path d="${d}" fill="${remainderColor}" stroke="#111" stroke-width="1" />`);
  }
  return parts.join("");
}

function updatePie(filtered, sumWohn, totals) {
  const slices = legendItems.map((item) => ({
    key: item.key,
    color: item.color,
    value: filtered
      .filter((f) => {
        const y = parseInt(f.get("BAUJAHR"), 10);
        if (!Number.isFinite(y)) return false;
        if (item.key === "pre1919") return y < 1919;
        if (item.key === "zwischen") return y >= 1919 && y <= 1934;
        if (item.key === "wieder") return y >= 1945 && y <= 1970;
        if (item.key === "gross") return y >= 1971 && y <= 1980;
        if (item.key === "postmodern") return y >= 1981 && y <= 1999;
        if (item.key === "modern") return y >= 2000;
        return false;
      })
      .reduce((acc, f) => acc + (parseInt(f.get("WOHNUNGSANZAHL"), 10) || 0), 0)
  }));

  const totalMax = totals.max || 1;
  const r = 60;
  const cx = 90;
  const cy = 80;
  pieSvg.innerHTML = describeSlices(slices, totalMax, cx, cy, r);
  const needleAngle = Math.min(1, sumWohn / totalMax) * Math.PI * 2 - Math.PI / 2;
  const nx = cx + r * Math.cos(needleAngle);
  const ny = cy + r * Math.sin(needleAngle);
  pieSvg.innerHTML += `<line x1="${cx}" y1="${cy}" x2="${nx}" y2="${ny}" stroke="#111" stroke-width="3" stroke-linecap="round" />`;
}

function applyFilter() {
  let lo = parseInt(yearMin.value, 10);
  let hi = parseInt(yearMax.value, 10);
  if (lo > hi) lo = hi;
  if (hi < lo) hi = lo;
  yearMin.value = lo;
  yearMax.value = hi;
  yearLabels.textContent = `(${lo} – ${hi})`;
  positionThumbs(lo, hi);
  const filtered = allFeatures.filter((f) => {
    const y = parseInt(f.get("BAUJAHR"), 10);
    return Number.isFinite(y) && y >= lo && y <= hi;
  });
  vectorSource.clear(true);
  vectorSource.addFeatures(filtered);
  const sumWohn = filtered.reduce((acc, f) => acc + (parseInt(f.get("WOHNUNGSANZAHL"), 10) || 0), 0);
  wohnCountEl.textContent = `Wohnungsanzahl: ${sumWohn.toLocaleString("de-DE")}`;
  updatePie(filtered, sumWohn, allTotals);
}

function bindThumb(thumbEl, isMin) {
  const startDrag = (startEvent) => {
    startEvent.preventDefault();
    const move = (ev) => {
      const clientX = ev.touches ? ev.touches[0].clientX : ev.clientX;
      const rect = sliderRow.getBoundingClientRect();
      const min = parseInt(yearMin.min, 10);
      const max = parseInt(yearMin.max, 10);
      const range = max - min;
      const pct = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
      const val = Math.round(min + pct * range);
      if (isMin) {
        yearMin.value = Math.min(val, parseInt(yearMax.value, 10));
      } else {
        yearMax.value = Math.max(val, parseInt(yearMin.value, 10));
      }
      applyFilter();
    };
    const end = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
      window.removeEventListener("touchmove", move);
      window.removeEventListener("touchend", end);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", end);
    window.addEventListener("touchmove", move);
    window.addEventListener("touchend", end);
  };
  thumbEl.addEventListener("pointerdown", startDrag);
  thumbEl.addEventListener("touchstart", startDrag);
}

bindThumb(thumbMin, true);
bindThumb(thumbMax, false);
yearMin.addEventListener("input", applyFilter);
yearMax.addEventListener("input", applyFilter);

fetch("GEMBAUTENFLOGD.json")
  .then((r) => {
    if (!r.ok) throw new Error(`GeoJSON load failed (${r.status})`);
    return r.json();
  })
  .then((data) => {
    const format = new ol.format.GeoJSON();
    allFeatures = format.readFeatures(data, {
      dataProjection: "EPSG:4326",
      featureProjection: targetProjection
    });

    const years = allFeatures
      .map((f) => parseInt(f.get("BAUJAHR"), 10))
      .filter((n) => Number.isFinite(n));
    const minYear = Math.min(...years, minYearBase);
    const maxYear = Math.max(...years);
    yearMin.min = minYearBase; yearMin.max = maxYear; yearMin.value = Math.max(minYearBase, minYear);
    yearMax.min = minYearBase; yearMax.max = maxYear; yearMax.value = maxYear;
    positionThumbs(parseInt(yearMin.value, 10), parseInt(yearMax.value, 10));
    yearLabels.textContent = `(${yearMin.value} – ${yearMax.value})`;

    allTotals = allFeatures.reduce((acc, f) => {
      const y = parseInt(f.get("BAUJAHR"), 10);
      const w = parseInt(f.get("WOHNUNGSANZAHL"), 10) || 0;
      let key = "unknown";
      if (Number.isFinite(y)) {
        if (y < 1919) key = "pre1919";
        else if (y <= 1934) key = "zwischen";
        else if (y >= 1945 && y <= 1970) key = "wieder";
        else if (y >= 1971 && y <= 1980) key = "gross";
        else if (y >= 1981 && y <= 1999) key = "postmodern";
        else if (y >= 2000) key = "modern";
      }
      acc[key] = (acc[key] || 0) + w;
      acc.max = (acc.max || 0) + w;
      return acc;
    }, {});

    vectorSource.addFeatures(allFeatures);
    applyFilter();

    const nameIndex = allFeatures
      .map((f) => ({
        id: f.getId() || f.ol_uid,
        name: (f.get("HOFNAME") || "").toString(),
        nameLc: (f.get("HOFNAME") || "").toString().toLowerCase(),
        feature: f
      }))
      .filter((n) => n.nameLc.length > 0);

    const renderSuggestions = (matches) => {
      if (!matches.length) {
        suggestionsBox.style.display = "none";
        return;
      }
      suggestionsBox.innerHTML = matches
        .slice(0, 8)
        .map((m) => `<div class="suggestions-item" data-id="${m.id}">${m.name}</div>`)
        .join("");
      suggestionsBox.style.display = "block";
    };

    const doSearch = (query, fly = false) => {
      const q = query.toLowerCase().trim();
      if (q.length < 3) {
        renderSuggestions([]);
        return;
      }
      const matches = nameIndex.filter((n) => n.nameLc.includes(q));
      renderSuggestions(matches);
      if (fly && matches.length) {
        const f = matches[0].feature;
        const geom = f.getGeometry();
        if (geom) {
          map.getView().fit(geom.getExtent(), { padding: [30, 30, 30, 30], duration: 200 });
        }
      }
    };

    searchInput.addEventListener("input", () => doSearch(searchInput.value));
    searchInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        doSearch(searchInput.value, true);
        suggestionsBox.style.display = "none";
      }
      if (e.key === "Escape") suggestionsBox.style.display = "none";
    });
    suggestionsBox.addEventListener("click", (e) => {
      const id = e.target.getAttribute("data-id");
      if (!id) return;
      const match = nameIndex.find((n) => (n.id || "").toString() === id.toString());
      if (match) {
        const geom = match.feature.getGeometry();
        if (geom) {
          map.getView().fit(geom.getExtent(), { padding: [30, 30, 30, 30], duration: 200 });
        }
        searchInput.value = match.name;
      }
      suggestionsBox.style.display = "none";
    });

    map.on("pointerdown", () => {
      suggestionsBox.style.display = "none";
    });

    const tlBtn = document.getElementById("timelapse-btn");
    const timeline = document.getElementById("timeline");
    const tlYear = document.getElementById("timeline-year");
    const tlProgress = document.getElementById("timeline-progress");
    let tlTimer = null;
    const TL_START = minYearBase;
    const TL_END = Math.min(2023, maxYear);
    const FAST_DELAY = 60;
    const SLOW_DELAY = 170;

    const stopTimelapse = () => {
      if (tlTimer) clearTimeout(tlTimer);
      tlTimer = null;
      tlBtn.innerHTML = '<span>▶</span><span class="tl-label">Timelapse</span>';
      timeline.style.display = "none";
    };

    const startTimelapse = () => {
      timeline.style.display = "block";
      tlBtn.innerHTML = '<span>⏸</span><span class="tl-label">Stop</span>';
      let current = TL_START;
      const step = () => {
        yearMin.value = TL_START;
        yearMax.value = current;
        applyFilter();
        const pct = ((current - TL_START) / (TL_END - TL_START)) * 100;
        tlProgress.style.width = `${Math.max(0, Math.min(100, pct))}%`;
        tlYear.textContent = current;
        current += 1;
        if (current > TL_END) {
          stopTimelapse();
          return;
        }
        const delay = current < 1900 ? FAST_DELAY : SLOW_DELAY;
        tlTimer = setTimeout(step, delay);
      };
      step();
    };

    tlBtn.addEventListener("click", () => {
      if (tlTimer) stopTimelapse();
      else startTimelapse();
    });
  })
  .catch((err) => {
    console.error(err);
    alert("Konnte die GeoJSON nicht laden. Details in der Konsole.");
  });

map.on("singleclick", (evt) => {
  popup.setPosition(undefined);
  map.forEachFeatureAtPixel(evt.pixel, (feature) => {
    const p = feature.getProperties();
    popupEl.innerHTML = `
      <div style="font-weight:700;margin-bottom:4px;">${p.HOFNAME || "Gemeindebau"}</div>
      <div><strong>Baujahr:</strong> ${p.BAUJAHR || "-"}</div>
      <div><strong>Adresse:</strong> ${p.ADRESSE || "-"}</div>
      <div><strong>Wohnungsanzahl:</strong> ${p.WOHNUNGSANZAHL ?? "-"}</div>
      <div><strong>Bezirk:</strong> ${p.BEZIRK ?? "-"}</div>
      <div><a href="${p.PDFLINK || "#"}" target="_blank" rel="noopener">PDF</a></div>
    `;
    popup.setPosition(evt.coordinate);
    return true;
  });
});
