import "https://d3js.org/d3.v5.min.js"

export function init(ctx, data_info) {
    ctx.importCSS("main.css")
    ctx.root.innerHTML = '<div class="parallelCoordinates"></div>';

    console.dir(data_info);

    /* Based on https://codepen.io/Janchorizo/pen/NzgReK
    ***************************************************/

    // Data
    var data = d3.csvParse(data_info.csv);
    var features = data_info.summaries;

    // Parameters
    const width = 960, height = 400, padding = 28, brush_width = 20;
    const filters = {};

    // ===== Helper functions =====
    // Horizontal scale
    const xScale = d3.scalePoint()
        .domain(features.map(x => x.name))
        .range([padding, width - padding]);

    // Each vertical scale
    const selectFeatures = features.map(x => x.name);
    const selectFeaturesPos = Object.assign({}, ...features.map((x, ix) => ({ [x.name]: ix })));

    const yScales = {};
    features.filter(x => x.summary_type === "numeric").map(x => {
        console.log(x)
        yScales[x.name] = d3.scaleLinear()
            .domain(x.range)
            .range([height - padding, padding]);
    });
    features.filter(x => x.summary_type === "categorical").map(x => {
        yScales[x.name] = d3.scaleOrdinal()
            // .domain(features[0].range)
            .range([height - padding, padding]);
    });

    // Each axis generator
    const yAxis = {};
    d3.entries(yScales).map(x => {
        yAxis[x.key] = d3.axisLeft(x.value);
    });

    // Each brush generator
    const brushEventHandler = function (feature) {
        if (d3.event.sourceEvent && d3.event.sourceEvent.type === "zoom")
            return; // ignore brush-by-zoom
        if (d3.event.selection != null) {
            filters[feature] = d3.event.selection.map(d => yScales[feature].invert(d));
        } else {
            if (feature in filters)
                delete (filters[feature]);
        }
        applyFilters();
    }

    const applyFilters = function () {
        d3.select('g.active').selectAll('path')
            .style('display', d => (selected(d) ? null : 'none'));
    }

    const selected = function (d) {
        const _filters = d3.entries(filters);
        return _filters.every(f => {
            return f.value[1] <= d[f.key] && d[f.key] <= f.value[0];
        });
    }

    const yBrushes = {};
    d3.entries(yScales).map(x => {
        let extent = [
            [-(brush_width / 2), padding],
            [brush_width / 2, height - padding]
        ];
        yBrushes[x.key] = d3.brushY()
            .extent(extent)
            .on('brush', () => brushEventHandler(x.key))
            .on('end', () => brushEventHandler(x.key));
    });

    // Paths for data
    const lineGenerator = d3.line();

    const linePath = function (d) {
        const _data = d3.entries(d).filter(x => x.key);
        let points = new Array(selectFeatures.length);
        _data.forEach(x => {
            const ix = selectFeaturesPos[x.key];
            points[ix] = ([xScale(x.key), yScales[x.key](x.value)]);
        });
        return (lineGenerator(points));
    }

    /*
    * Parallel Coordinates
    *********************/
    // Main svg container
    const pcSvg = d3.select('div.parallelCoordinates')
        .append('svg')
        .attr('width', width)
        .attr('height', height);

    // Inactive data
    pcSvg.append('g').attr('class', 'inactive').selectAll('path')
        .data(data)
        .enter()
        .append('path')
        .attr('d', d => linePath(d));

    // Inactive data
    pcSvg.append('g').attr('class', 'active').selectAll('path')
        .data(data)
        .enter()
        .append('path')
        .attr('d', d => linePath(d));

    // Vertical axis for the features
    const featureAxisG = pcSvg.selectAll('g.feature')
        .data(features)
        .enter()
        .append('g')
        .attr('class', 'feature')
        .attr('transform', d => ('translate(' + xScale(d.name) + ',0)'));

    featureAxisG
        .append('g')
        .each(function (d) {
            d3.select(this).call(yAxis[d.name]);
        });

    featureAxisG
        .each(function (d) {
            d3.select(this)
                .append('g')
                .attr('class', 'brush')
                .call(yBrushes[d.name]);
        });

    featureAxisG
        .append("text")
        .attr("text-anchor", "middle")
        .attr('y', padding / 2)
        .text(d => d.name);

}