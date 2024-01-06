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

  // Data
  const __data_id__ = "__data_id__";
  let label_col = data_info.label_col;
  let group_col = data_info.group_col;
  let excludedFeatures = [__data_id__, label_col, group_col];

  let features = data_info.summaries.filter(
    (f) => ![label_col, group_col].includes(f.name)
  );

  let data = d3.csvParse(data_info.csv);
  data.forEach((d, i) => {
    d[__data_id__] = i;
  });

  let allAvailableGroups = d3.rollup(
    data,
    (v) => v.length,
    (d) => d[group_col]
  );

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
      let uniqueValues = [...new Set(data.map((d) => d[x.name]))];
      let step = (height - 2.0 * padding) / (uniqueValues.length - 1);
      let range = d3.range(uniqueValues.length).map((x) => padding + x * step);
      yScales[x.name] = d3.scaleOrdinal().domain(uniqueValues).range(range);
    });

  // Each axis generator
  const yAxis = {};
  Object.entries(yScales).map(([key, value]) => {
    yAxis[key] = d3.axisLeft(value);
  });

  const colorScaleByGroup = d3
    .scaleOrdinal()
    .domain([0, allAvailableGroups.keys()])
    .range(
      d3
        .range(allAvailableGroups.size)
        .map((x) => d3.interpolateRainbow((1.0 * x) / allAvailableGroups.size))
    );

  // Each brush generator
  const brushEventHandler = function (feature, event) {
    if (event.sourceEvent && event.sourceEvent.type === "zoom") return; // ignore brush-by-zoom
    if (event.selection != null) {
      filters[feature] = event.selection
        .map((d) => yScales[feature].invert(d))
        .sort((a, b) => b - a);
    } else {
      if (feature in filters) delete filters[feature];
    }
    selectedLineIDs = data.filter(selected).map((d) => d.__data_id__);
    applyFilters();
    renderGroupBars(true);
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
  const lineGenerator = d3
    .line()
    .x((p) => p[0])
    .y((p) => p[1])
    // .curve(d3.curveLinear);
    .curve(d3.curveMonotoneX);

  const linePath = function (d) {
    const _data = Object.entries(d).filter(
      (x) => x[0] && !excludedFeatures.includes(x[0])
    );
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

  function renderAllPaths() {
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
      .style("stroke", (d) => colorScaleByGroup(d[group_col]))
      .attr("d", (d) => linePath(d));
  }

  function removeAllPaths() {
    pcSvg.selectAll("g.active").remove();
    pcSvg.selectAll("g.inactive").remove();
  }

  // ==============================================================================================
  // Vertical axis for the features
  // ==============================================================================================
  const featureAxisG = pcSvg
    .selectAll("g.feature")
    .data(features)
    .enter()
    .append("g")
    .attr("class", "feature")
    .attr("transform", (d) => "translate(" + xScale(d.name) + ",0)");

  function renderBrushes(feature, d) {
    feature.append("g").attr("class", "brush").call(yBrushes[d.name]);
  }

  function removeFeatureAxis(feature) {
    feature.selectAll("g.axis").remove();
    feature.selectAll("g.ticks_values").remove();
  }

  function renderFeatureAxis(feature, d) {
    feature.append("g").attr("class", "axis").call(yAxis[d.name]);
    feature
      .append("g")
      .attr("class", "ticks_values")
      .append("text")
      .attr("text-anchor", "middle")
      .attr("y", padding / 2)
      .text((d) => d.name)
      .on("click", (_, d) => flipAxis(feature, d));
  }

  function flipAxis(feature, d) {
    // invert brush selection - here is just getting the current
    // selection and projecting the real value ranges, the re-projection
    // to the new position happens later after inverting the yScales
    const brush = feature.select("g.brush");
    const brushNode = brush.node();
    var initSelection = d3.brushSelection(brushNode);
    if (initSelection !== null) {
      initSelection = initSelection.map((x) => yScales[d.name].invert(x));
    }

    // invert scale and axis
    yScales[d.name].domain(yScales[d.name].domain().reverse());
    yAxis[d.name] = d3.axisLeft(yScales[d.name]);
    // note this has to happen after the yScales as inverted
    if (initSelection !== null) {
      brush.call(
        yBrushes[d.name].move,
        initSelection.reverse().map((x) => yScales[d.name](x))
      );
    }

    // clean-up and re-render
    removeFeatureAxis(feature);
    renderFeatureAxis(feature, d);
    removeAllPaths();
    renderAllPaths();
    applyFilters();
  }

  function renderAllFeatureAxis() {
    featureAxisG.each(function (d) {
      let feature = d3.select(this);
      renderBrushes(feature, d);
      renderFeatureAxis(feature, d);
    });
  }

  // ==============================================================================================
  // Render Legend box
  // ==============================================================================================
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
      .style("fill", (d) => colorScaleByGroup(d[group_col]))
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
      .text((d) => d[label_col])
      .on("mouseover", (ev, d) => hoverHandler(d))
      .on("mouseout", applyFilters);
  }

  // ==============================================================================================
  // Render Legend box
  // ==============================================================================================
  let groupBarHeight = 12;
  let groupBarLength = 48;
  let groupSpacing = 4;
  var xOffset = 0;
  var yOffset = 0;

  let groupHeight =
    yOffset + (groupBarHeight + groupSpacing) * allAvailableGroups.size;
  let maxGroupSize = Math.max(...allAvailableGroups.values());
  let groupBarScale = d3
    .scaleLinear()
    .domain([0, maxGroupSize])
    .range([0, groupBarLength]);

  let groupSvg = d3
    .select("div.group")
    .append("svg")
    .attr("height", groupHeight);

  function renderGroupBars(onlyColoredBars = true) {
    // Create group histogram
    const barClass = onlyColoredBars ? "groupColorBars" : "groupBars";
    const groups = d3.rollup(
      data.filter((d) => selectedLineIDs.includes(d.__data_id__)),
      (v) => v.length,
      (d) => d[group_col]
    );

    d3.select(`g.${barClass}`).remove();
    groupSvg
      .append("g")
      .attr("class", barClass)
      .selectAll("rect")
      .data(allAvailableGroups)
      .enter()
      .append("rect")
      .attr("width", (d) => groupBarScale(groups.get(d[0]) ?? 0))
      .attr("height", groupBarHeight)
      .style("fill", (d) => {
        return onlyColoredBars ? colorScaleByGroup(d[0]) : "lightgrey";
      })
      .attr("transform", (_, i) => {
        var x = xOffset;
        var y = yOffset + (groupBarHeight + groupSpacing) * i;
        return `translate(${x}, ${y})`;
      });
  }

  function renderGroupLabels() {
    d3.select("g.groupNames").remove();
    groupSvg
      .append("g")
      .attr("class", "groupNames")
      .selectAll("text")
      .data(allAvailableGroups)
      .enter()
      .append("text")
      .attr("x", xOffset + groupBarLength + 5)
      .attr("y", (_, i) => yOffset + (groupBarHeight + groupSpacing) * i + 12)
      .text((d) => d[0])
      .on("mouseover", (ev, d) => console.dir(d))
      .on("mouseout", applyFilters);
  }

  function renderGroupBackground() {
    renderGroupBars(false);
    renderGroupLabels();
  }

  // ==============================================================================================
  // Execute it all
  // ==============================================================================================
  renderAllFeatureAxis();
  renderAllPaths();
  renderGroupBackground();
  renderGroupBars(true);
  renderLegend();
}
