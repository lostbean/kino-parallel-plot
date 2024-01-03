import "https://d3js.org/d3.v6.min.js";

export function init(ctx, data_info) {
  ctx.importCSS("main.css");
  ctx.root.innerHTML = `
    <div class="parallelCoordinates"></div>
    <div class="flex-container">
      <div class="flex-child legend"></div>
      <div class="flex-child group"></div>
    </div>
    `;

  /* Based on https://codepen.io/Janchorizo/pen/NzgReK
   ***************************************************/

  const __data_id__ = "__data_id__";
  // Data
  let features = data_info.summaries;
  let data = d3.csvParse(data_info.csv);
  data.forEach((d, i) => {
    d[__data_id__] = i;
  });
  console.dir(data);
  console.dir(features);

  // Parameters
  const width = 960,
    height = 400,
    padding = 50,
    brush_width = 25;
  const filters = {};

  // ===== Helper functions =====
  // Horizontal scale
  const xScale = d3
    .scalePoint()
    .domain(features.map((x) => x.name))
    .range([padding, width - padding]);

  // Each vertical scale
  var selectedLineIDs = data.map((d) => d[__data_id__]);
  const selectFeatures = features.map((x) => x.name);
  const selectFeaturesPos = Object.assign(
    {},
    ...features.map((x, ix) => ({ [x.name]: ix }))
  );

  const yScales = {};
  features
    .filter((x) => x.summary_type === "numeric")
    .map((x) => {
      yScales[x.name] = d3
        .scaleLinear()
        .domain(x.range)
        .range([height - padding, padding]);
    });
  features
    .filter((x) => x.summary_type === "categorical")
    .map((x) => {
      yScales[x.name] = d3
        .scaleOrdinal()
        // .domain(features[0].range)
        .range([height - padding, padding]);
    });

  // Each axis generator
  const yAxis = {};
  Object.entries(yScales).map(([key, value]) => {
    yAxis[key] = d3.axisLeft(value);
  });

  let fullGroups = d3.rollup(
    data,
    (v) => v.length,
    (d) => d.species
  );
  const colors = d3
    .scaleOrdinal()
    .domain([0, fullGroups.keys()])
    .range(
      d3
        .range(fullGroups.size)
        .map((x) => d3.interpolateRainbow((1.0 * x) / fullGroups.size))
    );

  // Each brush generator
  const brushEventHandler = function (feature, event) {
    if (event.sourceEvent && event.sourceEvent.type === "zoom") return; // ignore brush-by-zoom
    if (event.selection != null) {
      filters[feature] = event.selection.map((d) => yScales[feature].invert(d));
    } else {
      if (feature in filters) delete filters[feature];
    }
    selectedLineIDs = data.filter(selected).map((d) => d.__data_id__);
    applyFilters();
    renderGroupHist();
    renderLegend();
  };

  const applyFilters = function () {
    d3.select("g.active")
      .selectAll("path")
      .style("display", (d) =>
        selectedLineIDs.includes(d.__data_id__) ? null : "none"
      );
  };

  const selected = function (d) {
    const _filters = Object.entries(filters);
    return _filters.every(([key, value]) => {
      return value[1] <= d[key] && d[key] <= value[0];
    });
  };

  const yBrushes = {};
  Object.entries(yScales).map(([key, _]) => {
    let extent = [
      [-(brush_width / 2), padding],
      [brush_width / 2, height - padding],
    ];
    yBrushes[key] = d3
      .brushY()
      .extent(extent)
      .on("brush", (event) => brushEventHandler(key, event))
      .on("end", (event) => brushEventHandler(key, event));
  });

  // Paths for data
  const lineGenerator = d3.line();

  const linePath = function (d) {
    const _data = Object.entries(d).filter((x) => x[0] && x[0] !== __data_id__);
    let points = new Array(selectFeatures.length);
    _data.forEach(([key, value]) => {
      const ix = selectFeaturesPos[key];
      points[ix] = [xScale(key), yScales[key](value)];
    });
    return lineGenerator(points);
  };

  /*
   * Parallel Coordinates
   *********************/
  // Main svg container
  const pcSvg = d3
    .select("div.parallelCoordinates")
    .append("svg")
    .attr("width", width)
    .attr("height", height);

  // Inactive data
  pcSvg
    .append("g")
    .attr("class", "inactive")
    .selectAll("path")
    .data(data)
    .enter()
    .append("path")
    .attr("d", (d) => linePath(d));

  // Active data
  pcSvg
    .append("g")
    .attr("class", "active")
    .selectAll("path")
    .data(data)
    .enter()
    .append("path")
    .style("stroke", (d) => colors(d.species))
    .attr("d", (d) => linePath(d));

  // Vertical axis for the features
  const featureAxisG = pcSvg
    .selectAll("g.feature")
    .data(features)
    .enter()
    .append("g")
    .attr("class", "feature")
    .attr("transform", (d) => "translate(" + xScale(d.name) + ",0)");

  featureAxisG.append("g").each(function (d) {
    d3.select(this).call(yAxis[d.name]);
  });

  featureAxisG.each(function (d) {
    d3.select(this).append("g").attr("class", "brush").call(yBrushes[d.name]);
  });

  featureAxisG
    .append("text")
    .attr("text-anchor", "middle")
    .attr("y", padding / 2)
    .text((d) => d.name);

  function renderLegend() {
    //Initialize legend
    let legendItemSize = 12;
    let legendSpacing = 4;
    let xOffset = 0;
    let yOffset = 0;

    let availableData = data.filter((d) =>
      selectedLineIDs.includes(d.__data_id__)
    );

    let legendHeight =
      yOffset + (legendItemSize + legendSpacing) * availableData.length;

    d3.select("div.legend").select("svg").remove();
    let legend = d3
      .select("div.legend")
      .append("svg")
      .attr("height", legendHeight)
      .selectAll(".legendItem")
      .data(availableData);

    //Create legend items
    legend
      .enter()
      .append("rect")
      .attr("class", "legendItem")
      .attr("width", legendItemSize)
      .attr("height", legendItemSize)
      .style("fill", (d) => colors(d.species))
      .attr("transform", (d, i) => {
        var x = xOffset;
        var y = yOffset + (legendItemSize + legendSpacing) * i;
        return `translate(${x}, ${y})`;
      });

    const hoverHandler = function (selected) {
      d3.select("g.active")
        .selectAll("path")
        .style("display", (d) =>
          selected[__data_id__] === d[__data_id__] ? null : "none"
        );
    };
    //Create legend labels
    legend
      .enter()
      .append("text")
      .attr("x", xOffset + legendItemSize + 5)
      .attr("y", (_, i) => yOffset + (legendItemSize + legendSpacing) * i + 12)
      .text((d) => d.species)
      .on("mouseover", (ev, d) => hoverHandler(d))
      .on("mouseout", applyFilters);
  }

  function renderGroupHist() {
    // Create group histogram
    let groupBarHeight = 12;
    let groupBarLength = 48;
    let groupSpacing = 4;
    var xOffset = 0;
    var yOffset = 0;
    let groups = d3.rollup(
      data.filter((d) => selectedLineIDs.includes(d.__data_id__)),
      (v) => v.length,
      (d) => d.species
    );
    let groupHeight = yOffset + (groupBarHeight + groupSpacing) * groups.size;

    let maxGroupSize = Math.max(...groups.values());
    let Scale = d3
      .scaleLinear()
      .domain([0, maxGroupSize])
      .range([0, groupBarLength]);

    d3.select("div.group").select("svg").remove();
    let group_hist = d3
      .select("div.group")
      .append("svg")
      .attr("height", groupHeight)
      .selectAll("rect")
      .data(groups);

    group_hist
      .enter()
      .append("rect")
      .attr("class", "groupItem")
      .attr("width", (d) => Scale(d[1]))
      .attr("height", groupBarHeight)
      .style("fill", (d) => colors(d[0]))
      .attr("transform", (_, i) => {
        var x = xOffset;
        var y = yOffset + (groupBarHeight + groupSpacing) * i;
        return `translate(${x}, ${y})`;
      });

    group_hist
      .enter()
      .append("text")
      .attr("class", "groupItem")
      .attr("x", xOffset + groupBarLength + 5)
      .attr("y", (_, i) => yOffset + (groupBarHeight + groupSpacing) * i + 12)
      .text((d) => d[0])
      .on("mouseover", (ev, d) => console.dir(d))
      .on("mouseout", applyFilters);
  }

  renderGroupHist();
  renderLegend();
}
